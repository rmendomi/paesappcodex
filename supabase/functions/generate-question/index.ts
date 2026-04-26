import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isMath = (examId: string) => examId === 'm1' || examId === 'm2';
const STRICT_REVIEW_EXAMS = new Set(['ciencias', 'm1', 'm2']);
const REVIEWED_ID_VERSION = 'v5';

function needsStrictReview(examId: string): boolean {
  return STRICT_REVIEW_EXAMS.has(examId);
}

function markReviewedId(id: string, examId: string): string {
  const marker = `ai_${examId}_${REVIEWED_ID_VERSION}_`;
  if (id.startsWith(marker)) return id;
  return id.replace(`ai_${examId}_`, marker);
}

function stripVisualBlock(text: string): string {
  return text
    .replace(/\n?\s*RECURSO\s+VISUAL\s*:[\s\S]*?(?=\n\s*PREGUNTA\s*:|$)/i, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeForSafety(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function hasOptionLetterReference(text: string): boolean {
  const normalized = normalizeForSafety(text);
  return (
    /\b(opcion|alternativa)\s+[a-e]\b/.test(normalized) ||
    /\b(la|el)\s+[a-e]\s+(es|era|seria)\s+(correcta|correcto|incorrecta|incorrecto)\b/.test(normalized) ||
    /\bindice\s*\d+\b/.test(normalized)
  );
}

function cleanExplanation(value: unknown, maxChars: number, math: boolean): string {
  let text = normalizeMultilineText(value, maxChars);

  text = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(part => !hasOptionLetterReference(part))
    .join('\n')
    .replace(/\(?\s*opci[oÃ³]n\s+[A-E]\s*\)?/gi, '')
    .replace(/\(?\s*alternativa\s+[A-E]\s*\)?/gi, '')
    .replace(/\(?\s*[Ã­i]ndice\s*\d+\s*\)?/gi, '')
    .replace(/Respuesta\s*:\s*Respuesta\s*:?/gi, 'Respuesta:')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();

  if (!math) return text;

  return text;
}

type ExamContext = {
  name: string;
  instructions: string;
  skills: Record<string, string>;
  optionCounts: number[];
};

type GeneratedQuestion = {
  id: string;
  skill: string;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty: number;
  aiGenerated: true;
  provider: 'claude';
  version: number;
};

type FewShotExample = {
  text: string;
  options: string[];
  correct: number;
  difficulty: number;
};

const EXAM_CONTEXT: Record<string, ExamContext> = {
  lectora: {
    name: 'ComprensiÃ³n Lectora PAES',
    instructions: `Genera preguntas originales de comprensiÃ³n lectora estilo PAES chilena, pensadas para preparaciÃ³n PAES 2026. InspÃ­rate en la estructura 2025, pero no copies textos, temas ni alternativas.

TEXTO: Escribe un texto de 180-240 palabras. Alterna entre estos gÃ©neros y soportes (no uses siempre el mismo):
- ArtÃ­culo periodÃ­stico o de divulgaciÃ³n cientÃ­fica
- Fragmento narrativo literario (cuento, novela)
- Texto argumentativo u opiniÃ³n
- Documento informativo con datos numÃ©ricos, fechas o cifras mÃºltiples
- Texto multimodal breve: afiche, cartilla, comunicado o infografÃ­a descrita con datos en lÃ­neas separadas

El texto debe tener complejidad lingÃ¼Ã­stica real: conectores lÃ³gicos, referentes pronominales, informaciÃ³n dispersa en varios pÃ¡rrafos, vocabulario de nivel 4Â° medio.

PREGUNTA: Usa enunciados estilo DEMRE, por ejemplo:
- "De acuerdo con el texto, Â¿cuÃ¡l de las siguientes afirmaciones es correcta?"
- "Â¿A quÃ© se refiere la expresiÃ³n '...' en el pÃ¡rrafo N?"
- "Â¿QuÃ© informaciÃ³n entrega el texto respecto a...?"
- "SegÃºn el texto, Â¿cuÃ¡l fue el [dato] de [X] entre [aÃ±o1] y [aÃ±o2]?"
- "Considerando el tratamiento del tema, Â¿quÃ© tono adopta el emisor?"
- "Â¿Con quÃ© propÃ³sito se incorpora [recurso/ejemplo/cifra]?"
- NO uses siempre Â¿QuÃ©...? Â¿CuÃ¡ndo...? Â¿DÃ³nde...?

DISTRACTORES: Deben ser plausibles. Incluye datos reales del texto pero que no responden la pregunta especÃ­fica. Evita distractores absurdos que nadie elegirÃ­a.

RECURSOS VISUALES: Solo cuando se autorice y aporte a la habilidad, puedes incluir una tabla breve, cartel, ficha informativa o afiche descrito. Debe poder responderse solo con el texto entregado; no uses URL ni imÃ¡genes externas.`,
    skills: {
      localizar:   'Localizar informaciÃ³n explÃ­cita: la respuesta estÃ¡ en el texto pero puede requerir discriminar entre datos similares, identificar referentes pronominales, o leer con precisiÃ³n un pÃ¡rrafo especÃ­fico. NO es transcripciÃ³n directa.',
      interpretar: 'Interpretar e integrar: inferir informaciÃ³n implÃ­cita, identificar relaciones semÃ¡nticas, reconocer el sentido de expresiones en contexto, deducir el propÃ³sito o la postura del autor.',
      evaluar:     'Evaluar y reflexionar: juzgar la solidez de los argumentos, reconocer el propÃ³sito comunicativo, analizar la estructura textual, evaluar la pertinencia de la evidencia presentada.',
    },
    optionCounts: [4],
  },
  m1: {
    name: 'MatemÃ¡tica M1 PAES',
    instructions: `Genera problemas matemÃ¡ticos originales estilo PAES M1, pensados para preparaciÃ³n PAES 2026. InspÃ­rate en los formatos 2025: contexto cotidiano, tabla/grÃ¡fico simple, modelaciÃ³n y selecciÃ³n del procedimiento correcto, pero no copies preguntas.

CONTEXTO: Usa situaciones reales de Chile actual (precios, transporte, consumo de agua/energÃ­a, distancias, planos, estadÃ­sticas escolares o comunales). Al menos 1 de cada 2 preguntas debe tener contexto cotidiano, no ser cÃ¡lculo puro.

DIFICULTAD: Problemas de 2-3 pasos encadenados. No operaciones de un solo paso. Formatos vÃ¡lidos:
- Porcentaje compuesto: "Si el precio aumenta 20% y luego se aplica un descuento del 15%..."
- GeometrÃ­a con datos: "Un terreno triangular con base 12m y altura que es el 75% de la base..."
- Ãlgebra contextualizada: "Juan tiene el doble de ahorro que Pedro. Si Pedro ahorra $15.000 mÃ¡s..."
- Identificar el error en un procedimiento de varios pasos
- Escoger el procedimiento que modela una situaciÃ³n
- Interpretar tabla, grÃ¡fico de barras, plano simple, recta numÃ©rica o esquema de medidas incluido en "text"

Temas: nÃºmeros reales, potencias, Ã¡lgebra, geometrÃ­a plana, estadÃ­stica descriptiva, probabilidad.

RECURSOS VISUALES: Solo cuando se autorice y sea necesario para leer datos, usa una tabla compacta o lista limpia de datos. No fuerces diagramas si el dato cabe en el enunciado.`,
    skills: {
      resolver:    'Resolver problemas de 2-3 pasos con procedimientos matemÃ¡ticos en contexto real',
      modelar:     'Modelar situaciones cotidianas: traducir enunciado verbal a expresiÃ³n o ecuaciÃ³n matemÃ¡tica',
      representar: 'Interpretar y usar representaciones: grÃ¡ficos de barras, tablas, rectas numÃ©ricas',
      argumentar:  'Justificar propiedades o resultados matemÃ¡ticos con razonamiento explÃ­cito',
    },
    optionCounts: [4],
  },
  m2: {
    name: 'MatemÃ¡tica M2 PAES',
    instructions: `Genera problemas matemÃ¡ticos originales estilo PAES M2, pensados para preparaciÃ³n PAES 2026. InspÃ­rate en la exigencia 2025: funciones, suficiencia de datos, interpretaciÃ³n grÃ¡fica y modelaciÃ³n avanzada, pero no copies preguntas.

CONTEXTO: Usa situaciones que justifiquen el uso de funciones, trigonometrÃ­a o geometrÃ­a analÃ­tica (fÃ­sica, ingenierÃ­a, economÃ­a).

DIFICULTAD: Problemas que requieren 2-3 pasos y selecciÃ³n del mÃ©todo correcto. Incluye ocasionalmente suficiencia de datos con afirmaciones (1) y (2), siguiendo el formato DEMRE.

FORMATOS PAES Ãºtiles:
- FunciÃ³n dada por tabla, grÃ¡fico textual o descripciÃ³n de fenÃ³meno
- Comparar parÃ¡metros de funciones y sus efectos
- Suficiencia de datos con afirmaciones (1) y (2)
- Elegir el sistema, expresiÃ³n o modelo que representa una situaciÃ³n
- Interpretar pendiente, intersecciÃ³n, dominio, crecimiento o probabilidad condicional

Temas: funciones (lineal, cuadrÃ¡tica, exponencial, logarÃ­tmica), trigonometrÃ­a, vectores, geometrÃ­a analÃ­tica, probabilidad y estadÃ­stica avanzada.

RECURSOS VISUALES: Solo cuando se autorice y sea necesario para leer datos, usa tabla de valores o datos tabulados. Si requiere un grÃ¡fico real, plantea la pregunta sin recurso visual.`,
    skills: {
      resolver:    'Resolver problemas avanzados con funciones, trigonometrÃ­a o geometrÃ­a analÃ­tica en contexto',
      modelar:     'Modelar fenÃ³menos reales con funciones matemÃ¡ticas',
      representar: 'Representar e interpretar funciones, vectores y transformaciones geomÃ©tricas',
      argumentar:  'Demostrar y justificar propiedades matemÃ¡ticas avanzadas',
    },
    optionCounts: [4, 5],
  },
  historia: {
    name: 'Historia y Cs. Sociales PAES',
    instructions: `Genera preguntas originales de Historia y Ciencias Sociales estilo PAES, pensadas para preparaciÃ³n PAES 2026. InspÃ­rate en los formatos 2025: anÃ¡lisis de fuentes, mapas, grÃ¡ficos, procesos y relaciones causa-consecuencia, pero no copies preguntas.

Temas: historia de Chile (colonia, repÃºblica, siglo XX), historia universal, geografÃ­a, formaciÃ³n ciudadana, economÃ­a bÃ¡sica.

TIPO: Preguntas que exigen relacionar causas y consecuencias, interpretar fuentes, evaluar procesos histÃ³ricos, reconocer continuidades/cambios o analizar ciudadanÃ­a/economÃ­a. No solo memorizaciÃ³n de fechas.

FUENTES: Usa fuentes breves y verosÃ­miles: fragmentos de discurso, ley, noticia, tabla estadÃ­stica, mapa descrito, grÃ¡fico de poblaciÃ³n, afiche polÃ­tico o testimonio. La fuente debe estar dentro de "text".

RECURSOS VISUALES: Solo cuando se autorice y aporte a la interpretaciÃ³n, usa una fuente breve, tabla simple o lÃ­nea de tiempo. No agregues recurso visual por decoraciÃ³n.`,
    skills: {
      temporal: 'Pensamiento temporal: causas, consecuencias, continuidades y cambios en procesos histÃ³ricos',
      fuentes:  'AnÃ¡lisis de fuentes: interpretar documentos histÃ³ricos, mapas, estadÃ­sticas o imÃ¡genes',
      critico:  'Pensamiento crÃ­tico: evaluar mÃºltiples perspectivas e interpretaciones histÃ³ricas',
    },
    optionCounts: [4],
  },
  ciencias: {
    name: 'Ciencias Naturales PAES',
    instructions: `Genera preguntas originales de ciencias naturales estilo PAES (biologÃ­a, quÃ­mica o fÃ­sica), pensadas para preparaciÃ³n PAES 2026. InspÃ­rate en la estructura 2025: contexto experimental, pregunta de investigaciÃ³n, hipÃ³tesis, evidencia, tabla/grÃ¡fico y conclusiÃ³n, pero no copies preguntas.

Indica el Ã¡rea al inicio de la pregunta. Los datos deben ser cientÃ­ficamente correctos.

TIPO: Incluye preguntas que interpretan resultados de experimentos, analizan tablas o grÃ¡ficos descritos en texto, evalÃºan hipÃ³tesis, identifican variables, reconocen conclusiones o aplican conceptos a situaciones nuevas. No solo definiciones.

FORMATOS PAES Ãºtiles:
- "Â¿QuÃ© pregunta de investigaciÃ³n surge directamente de la observaciÃ³n?"
- "Â¿CuÃ¡l de las siguientes hipÃ³tesis podrÃ­a validarse?"
- "Considerando los datos de la tabla, Â¿cuÃ¡l conclusiÃ³n es correcta?"
- "Al respecto, Â¿quÃ© componente de la investigaciÃ³n cientÃ­fica se reconoce?"
- AplicaciÃ³n conceptual con cÃ¡lculo breve o interpretaciÃ³n de grÃ¡fico

RECURSOS VISUALES: Solo cuando se autorice y sea necesario para interpretar datos o un diseÃ±o experimental, usa una tabla limpia o descripciÃ³n breve. No fuerces esquemas precarios. Las preguntas con combinaciones I, II y III pueden usar 5 opciones; el resto debe usar 4.`,
    skills: {
      observar:   'Observar y describir fenÃ³menos naturales con precisiÃ³n cientÃ­fica',
      planificar: 'Planificar y diseÃ±ar investigaciones o experimentos cientÃ­ficos',
      procesar:   'Procesar e interpretar datos, grÃ¡ficos o resultados de experimentos',
      evaluar:    'Evaluar evidencias y sacar conclusiones cientÃ­ficas fundamentadas',
      comunicar:  'Comunicar y explicar conceptos y conocimientos cientÃ­ficos',
    },
    optionCounts: [4, 5],
  },
};

async function fetchFewShotExamples(
  supabase: ReturnType<typeof createClient>,
  examId: string,
  skillId: string | null,
): Promise<FewShotExample[]> {
  try {
    let query = supabase
      .from('banco_ia')
      .select('text, options, correct, difficulty')
      .eq('exam_id', examId)
      .not('difficulty', 'is', null)
      .order('veces_usada', { ascending: false })
      .limit(2);
    if (skillId) query = query.eq('skill_id', skillId);
    if (needsStrictReview(examId)) query = query.like('id', `ai_${examId}_${REVIEWED_ID_VERSION}_%`);
    const { data } = await query;
    return (data || []) as FewShotExample[];
  } catch (_) {
    return [];
  }
}

function buildPrompt(
  examId: string,
  skillId: string | null,
  count: number,
  examples: FewShotExample[] = [],
  visualAllowed = false,
): string {
  const ctx = EXAM_CONTEXT[examId];
  const validSkillId = skillId && ctx.skills[skillId] ? skillId : null;
  const skillDesc = validSkillId ? ctx.skills[validSkillId] : 'variedad de habilidades del examen';
  const skillLabel = validSkillId || 'mixed';
  const math = isMath(examId);
  const optionRule = ctx.optionCounts.length === 1
    ? `exactamente ${ctx.optionCounts[0]} opciones`
    : `4 opciones por defecto; usa 5 solo si el formato lo exige (suficiencia de datos o combinaciones I, II y III)`;
  const optionExample = Array.from({ length: ctx.optionCounts[0] }, (_, i) => `alternativa ${i + 1}`);

  const explanationShape = math
    ? 'Dato clave: [quÃ© hay que encontrar, en palabras simples].\\nPaso 1: [operaciÃ³n corta].\\nPaso 2: [operaciÃ³n corta].\\nResultado: [resultado final, sin opciÃ³n ni Ã­ndice].'
    : 'Dato clave: [evidencia o relaciÃ³n central].\\nConclusiÃ³n: [por quÃ© esa evidencia permite responder].';

  const mathVerification = math ? `
VERIFICACIÃ“N MATEMÃTICA OBLIGATORIA (antes de escribir el JSON):
1. Calcula el resultado paso a paso en tu cabeza.
2. Verifica el resultado una segunda vez.
3. Identifica quÃ© opciÃ³n (0, 1, 2, 3 o 4) corresponde a ese resultado.
4. El campo "correct" DEBE ser el Ã­ndice de esa opciÃ³n. Si tu cÃ¡lculo da 19 y 19 estÃ¡ en la opciÃ³n C (Ã­ndice 2), entonces "correct": 2.
5. NUNCA pongas un Ã­ndice que no corresponde al resultado calculado. La explicaciÃ³n y el campo "correct" deben ser consistentes.
6. En "explanation", enseÃ±a rÃ¡pido: quÃ© dato usar, quÃ© operaciÃ³n hacer y cuÃ¡l es el resultado.
7. Usa este formato exacto con saltos de lÃ­nea:
Dato clave: [en palabras simples, sin fÃ³rmula larga]
Paso 1: [una sola operaciÃ³n corta y por quÃ©]
Paso 2: [una sola operaciÃ³n corta]
Resultado: [resultado final, sin mencionar opciÃ³n ni Ã­ndice]
8. Evita cadenas largas de fÃ³rmulas con flechas. No escribas "opciÃ³n A", "Ã­ndice 0" ni letras de alternativa en la explicaciÃ³n.
` : '';

  const scienceVerification = examId === 'ciencias' ? `
VERIFICACION CIENTIFICA OBLIGATORIA (antes de escribir el JSON):
1. Si hay calculo, resuelvelo completo y verifica que la alternativa correcta exista.
2. Si el resultado correcto no aparece entre las alternativas, reemplaza un distractor por el resultado correcto antes de responder.
3. Titulacion 1:1: M_acido * V_acido = M_base * V_base. Usa litros y no confundas volumen con concentracion.
4. Friccion con fuerza horizontal: F_neta = m*a y F_friccion = F_aplicada - F_neta.
5. Combustion/estequiometria: balancea la ecuacion, calcula todos los productos pedidos y suma masas solo si la pregunta pide masa total.
6. Biologia con tablas: la conclusion debe salir directamente de los datos; evita afirmaciones absolutas no sustentadas.
7. La explicacion debe ser simple y consistente con la clave. No menciones letras ni indices de alternativas.
` : '';

  const visualRequirement = visualAllowed
    ? (count > 1
      ? `Puedes usar "RECURSO VISUAL:" en como mÃ¡ximo 1 de las ${count} preguntas. Ãšsalo solo si la habilidad exige leer datos, una tabla, una fuente o un grÃ¡fico.`
      : 'Puedes usar "RECURSO VISUAL:" solo si es indispensable para responder; si el dato cabe en el enunciado, NO lo uses.')
    : 'En esta solicitud NO incluyas bloque "RECURSO VISUAL:". La pregunta debe resolverse con un enunciado claro y directo.';

  const textShape = visualAllowed
    ? (examId === 'lectora'
      ? 'TEXTO:\\n[texto de 180-240 palabras aquÃ­]\\n\\nRECURSO VISUAL:\\n[opcional y solo si aporta: tabla/afiche/ficha breve sin bordes]\\n\\nPREGUNTA:\\n[enunciado estilo DEMRE]'
      : '[contexto breve del problema]\\n\\nRECURSO VISUAL:\\n[opcional y solo si aporta: tabla limpia o lista de datos sin bordes]\\n\\nPREGUNTA:\\n[enunciado estilo DEMRE]')
    : (examId === 'lectora'
      ? 'TEXTO:\\n[texto de 180-240 palabras aquÃ­]\\n\\nPREGUNTA:\\n[enunciado estilo DEMRE]'
      : '[contexto breve del problema]\\n\\nPREGUNTA:\\n[enunciado estilo DEMRE]');

  const fewShotSection = examples.length > 0
    ? `\nEJEMPLOS DEL MISMO ESTILO (referencia de formato y nivel, no los copies ni repitas):
${examples.map((ex, i) => {
  const diffLabel = ex.difficulty === 1 ? 'fÃ¡cil' : ex.difficulty === 3 ? 'difÃ­cil' : 'media';
  const textPreview = stripVisualBlock(ex.text).slice(0, 320).replace(/\n{3,}/g, '\n\n');
  const opts = (ex.options as string[]).map((o, idx) => `${String.fromCharCode(65 + idx)}) ${o}`).join(' | ');
  return `Ejemplo ${i + 1} (dificultad ${diffLabel}):\n${textPreview}...\nOpciones: ${opts}`;
}).join('\n\n')}\n`
    : '';

  return `Eres un experto evaluador PAES chilena (DEMRE). Tu tarea: generar exactamente ${count} pregunta(s) de "${ctx.name}".
Habilidad objetivo: "${skillDesc}".

${ctx.instructions}
${mathVerification}${scienceVerification}${fewShotSection}
REFERENCIA DE ESTILO PAES 2025 PARA PREPARACIÃ“N 2026:
- Crea preguntas originales, no recicladas. Deben parecer PAES por estructura, habilidad y dificultad, pero estar orientadas a estudio 2026.
- Usa consignas frecuentes del estilo real: "Considerando...", "A partir de...", "En relaciÃ³n con...", "Al respecto...", "SegÃºn...", "Â¿CuÃ¡l de las siguientes opciones...?".
- Prioriza aplicaciÃ³n, interpretaciÃ³n, modelaciÃ³n, evidencia o propÃ³sito. Evita preguntas de memoria directa.
- Los distractores deben representar errores reales: confundir dato cercano, invertir relaciÃ³n causal, elegir conclusiÃ³n no sustentada, usar procedimiento incompleto o leer mal una tabla/grÃ¡fico.
- No todas las preguntas PAES traen tabla, grÃ¡fico o fuente. La mayorÃ­a puede ser un enunciado limpio; usa recurso visual solo cuando cambia realmente la habilidad evaluada.

CRITERIO PARA RECURSOS VISUALES:
- ${visualRequirement}
- El recurso visual debe ir escrito dentro del campo "text"; no agregues campos como "image", "imageUrl", "imagePrompt" ni URLs.
- Usa recursos compactos y sobrios: tablas de 2-5 filas, fuente breve, lÃ­nea de tiempo o datos tabulados. Si no queda limpio en texto, no lo uses.
- Si incluyes "RECURSO VISUAL:", la pregunta debe poder responderse completamente con ese bloque y el enunciado.
- No dibujes cajas, triangulos, flechas ni marcos con caracteres ASCII. Nunca uses bordes hechos con |, -, _, / o \\.
- Para una tabla, escribe solo filas limpias sin bordes: "Mes | Consumo\nEnero | 150 m3\nFebrero | 180 m3".
- Para datos sueltos, escribe lista limpia: "Base = 24 m\nAltura = 18 m".

FORMATO â€” responde ÃšNICAMENTE con un array JSON vÃ¡lido:
[
  {
    "text": "${textShape}",
    "options": ${JSON.stringify(optionExample)},
    "correct": 0,
    "skill": "${skillLabel}",
    "difficulty": 2,
    "explanation": "${explanationShape}"
  }
]

REGLAS:
- Responde SOLO con el array JSON, sin markdown ni texto extra
- "correct" es Ã­ndice 0-based (0=A, 1=B, 2=C, 3=D, 4=E)
- "difficulty" es 1 (fÃ¡cil), 2 (media) o 3 (difÃ­cil) segÃºn la exigencia real de la pregunta
- Cantidad de alternativas: ${optionRule}
- No escribas "A)", "B)", etc. dentro del texto de las opciones; la app ya agrega las letras
- Todas las opciones deben tener texto; nunca dejes opciones vacÃ­as
- Cada opciÃ³n debe ser breve: mÃ¡ximo 120 caracteres o 18 palabras, salvo fÃ³rmulas inevitables
- La explicaciÃ³n debe ser breve y Ãºtil: mÃ¡ximo 650 caracteres
- La explicaciÃ³n debe justificar solo la respuesta correcta; no expliques cada distractor.
- Nunca menciones letras de alternativas, Ã­ndices ni frases como "la opciÃ³n A" dentro de "explanation".
- Para matemÃ¡ticas, la explicaciÃ³n debe enseÃ±ar de forma simple; no debe ser una lÃ­nea larga de cÃ¡lculo.
- Distractores plausibles: errores comunes, no respuestas absurdas
- No incluyas encabezados/pies como "FORMA", "Proceso de AdmisiÃ³n", nÃºmero de pÃ¡gina ni marcas de extracciÃ³n PDF
- Nivel PAES real (4Â° medio Chile)`;
}

function parseAIResponse(raw: string): unknown[] {
  try { return JSON.parse(raw.trim()); } catch (_) { /* continue */ }

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(stripped); } catch (_) { /* continue */ }

  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) { /* continue */ }
  }

  const start = raw.indexOf('[');
  const end   = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { /* continue */ }
  }

  throw new Error('La IA no devolviÃ³ JSON vÃ¡lido. Intenta nuevamente.');
}

function normalizeMultilineText(value: unknown, maxChars: number): string {
  const text = String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return compactText(text, maxChars);
}

function normalizeInlineText(value: unknown, maxChars: number): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return compactText(text, maxChars);
}

function normalizeOptionText(value: unknown): string {
  return normalizeInlineText(value, 160).replace(/^[A-E]\s*[\).:-]\s*/i, '').trim();
}

function compactText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (sentenceEnd >= Math.floor(maxChars * 0.55)) return slice.slice(0, sentenceEnd + 1).trim();
  return `${slice.slice(0, maxChars - 3).trim()}...`;
}

function isValidSkill(examId: string, skill: unknown): skill is string {
  return typeof skill === 'string' && Object.prototype.hasOwnProperty.call(EXAM_CONTEXT[examId].skills, skill);
}

function hasDuplicateOptions(options: string[]): boolean {
  const normalized = options.map(opt => opt.toLocaleLowerCase('es').replace(/\s+/g, ' ').trim());
  return new Set(normalized).size !== normalized.length;
}

function normalizeMathText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b2/g, '^2')
    .replace(/\u00b3/g, '^3')
    .replace(/[\u00b7\u00d7]/g, '*')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseDecimal(value: string): number | null {
  const number = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function extractOptionNumbers(option: unknown): number[] {
  return (String(option || '').match(/-?\d+(?:[.,]\d+)?/g) || [])
    .map(parseDecimal)
    .filter((n): n is number => n !== null);
}

function optionHasNumber(option: unknown, expected: number, tolerance = 0.02): boolean {
  const numbers = extractOptionNumbers(option);
  if (numbers.length >= 2) {
    const min = Math.min(numbers[0], numbers[1]);
    const max = Math.max(numbers[0], numbers[1]);
    if (expected >= min - tolerance && expected <= max + tolerance) return true;
  }
  return numbers.some(n => Math.abs(n - expected) <= tolerance);
}

function findOptionByNumber(options: string[], expected: number, tolerance = 0.02): number {
  return options.findIndex(option => optionHasNumber(option, expected, tolerance));
}

function findOptionByText(options: string[], pattern: RegExp): number {
  return options.findIndex(option => pattern.test(normalizeMathText(option)));
}

function powerDigitRule(text: string): { expected: number; tolerance: number } | null {
  if (!/cuantos digitos|cantidad de digitos/.test(text)) return null;
  const match = text.match(/(\d+)\s*\^\s*(\d+)/);
  if (!match) return null;
  const base = BigInt(match[1]);
  const exponent = BigInt(match[2]);
  if (exponent > 80n) return null;
  return { expected: (base ** exponent).toString().length, tolerance: 0 };
}

function sinePeriodRule(text: string, options: string[]): { expectedIndex: number } | null {
  if (!/funcion seno|sen\s*\(|seno/.test(text) || !/periodo/.test(text)) return null;
  return { expectedIndex: findOptionByText(options, /\b2\s*(pi|\u03c0)\b|2\u03c0/) };
}

function factoredXAxisRule(text: string, options: string[]): { expectedIndex: number } | null {
  if (!/corta al eje x|cortes? con el eje x/.test(text)) return null;
  const match = text.match(/\(x\s*([+-])\s*(\d+)\)\s*\(x\s*([+-])\s*(\d+)\)/);
  if (!match) return null;
  const first = match[1] === '+' ? -Number(match[2]) : Number(match[2]);
  const second = match[3] === '+' ? -Number(match[4]) : Number(match[4]);
  const expectedIndex = options.findIndex(option => {
    const normalized = normalizeMathText(option);
    return normalized.includes(`(${first},0)`) && normalized.includes(`(${second},0)`);
  });
  return { expectedIndex };
}

function depreciationModelRule(text: string, options: string[]): { expectedIndex: number } | null {
  const rate = text.match(/deprecia\s+un\s+(\d+(?:[.,]\d+)?)\s*%/);
  if (!rate || !/modelo/.test(text)) return null;
  const factor = 1 - Number(rate[1].replace(',', '.')) / 100;
  const comma = factor.toFixed(2).replace('.', ',').replace(/0$/, '');
  const dot = factor.toFixed(2).replace(/0$/, '');
  return { expectedIndex: findOptionByText(options, new RegExp(`\\(?(${comma}|${dot})\\)?\\s*\\^?\\s*t`)) };
}

function rampSineRule(text: string): { expected: number; tolerance: number } | null {
  if (!/rampa/.test(text) || !/sen|sin/.test(text)) return null;
  const heightMatch = text.match(/altura[^0-9]*(\d+(?:[.,]\d+)?)/);
  const angleMatch = text.match(/angulo[^0-9]*(\d+(?:[.,]\d+)?)/);
  if (!heightMatch || !angleMatch) return null;
  const height = Number(heightMatch[1].replace(',', '.'));
  const angle = Number(angleMatch[1].replace(',', '.'));
  if (!Number.isFinite(height) || !Number.isFinite(angle)) return null;
  const expected = height / Math.sin(angle * Math.PI / 180);
  return { expected, tolerance: Math.max(0.15, expected * 0.025) };
}

function exponentialTimeRule(text: string): { expected: number; tolerance: number } | null {
  const fn = text.match(/=\s*(\d+(?:[.,]\d+)?)\s*\*?\s*2\s*\^\s*\(?t\s*\/\s*(\d+(?:[.,]\d+)?)\)?/);
  const target = text.match(/=\s*(\d+(?:[.,]\d+)?)\s*(?:suscriptores|usuarios|personas|clientes|$)/g);
  if (!fn || !target || target.length < 2) return null;
  const start = Number(fn[1].replace(',', '.'));
  const divisor = Number(fn[2].replace(',', '.'));
  const targetValueMatch = target[target.length - 1].match(/(\d+(?:[.,]\d+)?)/);
  const targetValue = targetValueMatch ? Number(targetValueMatch[1].replace(',', '.')) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(divisor) || !Number.isFinite(targetValue) || targetValue <= start) return null;
  return { expected: divisor * Math.log2(targetValue / start), tolerance: 0.15 };
}

function quadraticVertexRule(text: string): { expected: number; tolerance: number } | null {
  if (!/vertice|maximo|minimo|maxima|disminuir/.test(text)) return null;
  const match = text.match(/=\s*([+-]?\d+(?:[.,]\d+)?)\s*x\^2\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*x/);
  if (!match) return null;
  const a = Number(match[1].replace(',', '.'));
  const b = Number(match[3].replace(',', '.')) * (match[2] === '-' ? -1 : 1);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return { expected: -b / (2 * a), tolerance: 0.15 };
}

function deterministicMathRule(question: GeneratedQuestion): { expected?: number; tolerance?: number; expectedIndex?: number } | null {
  const text = normalizeMathText(`${question.text || ''} ${question.explanation || ''}`);
  const options = Array.isArray(question.options) ? question.options : [];
  return (
    powerDigitRule(text) ||
    sinePeriodRule(text, options) ||
    factoredXAxisRule(text, options) ||
    depreciationModelRule(text, options) ||
    rampSineRule(text) ||
    exponentialTimeRule(text) ||
    quadraticVertexRule(text)
  );
}

function enforceDeterministicQuestionSafety(question: GeneratedQuestion, examId: string): GeneratedQuestion | null {
  if (!needsStrictReview(examId)) return question;
  const rule = deterministicMathRule(question);
  if (!rule) return question;

  const expectedIndex = Number.isInteger(rule.expectedIndex)
    ? rule.expectedIndex as number
    : findOptionByNumber(question.options || [], Number(rule.expected), rule.tolerance ?? 0.02);

  if (expectedIndex < 0) {
    console.warn(`[questionSafety] ${examId} descarta pregunta ${question.id || ''}: respuesta calculada no aparece`);
    return null;
  }

  if (question.correct !== expectedIndex) {
    console.warn(`[questionSafety] ${examId} corrige clave ${question.id || ''}: ${question.correct} -> ${expectedIndex}`);
    return { ...question, correct: expectedIndex };
  }

  return question;
}

function enforceDeterministicQuestionSafetyList(questions: GeneratedQuestion[], examId: string): GeneratedQuestion[] {
  return questions
    .map(q => enforceDeterministicQuestionSafety(q, examId))
    .filter((q): q is GeneratedQuestion => q !== null);
}

function buildStrictReviewPrompt(examId: string, questions: GeneratedQuestion[]): string {
  const ctx = EXAM_CONTEXT[examId];
  const subjectRules = examId === 'ciencias'
    ? `REGLAS ESPECIFICAS DE CIENCIAS:
- Titulacion 1:1: M_acido * V_acido = M_base * V_base. Convierte mL a L.
- Friccion: F_neta = m*a. Si la fuerza aplicada es horizontal, F_friccion = F_aplicada - F_neta.
- Combustion/estequiometria: balancea la ecuacion. Si se pide masa total de productos, suma CO2 + H2O u otros productos pedidos.
- Datos experimentales: una conclusion valida debe estar directamente sustentada por la tabla o el texto. Evita conclusiones absolutas no demostradas.`
    : `REGLAS ESPECIFICAS DE MATEMATICA:
- Resuelve el problema completo antes de mirar las alternativas.
- Verifica unidades, porcentajes sucesivos, promedios, proporcionalidad, ecuaciones y redondeos.
- Si el resultado numerico correcto no aparece, reemplaza un distractor por el resultado correcto.`;

  return `Actua como auditor independiente de preguntas PAES. Recibiras preguntas generadas por otra pasada de IA.
Tu trabajo es corregir SOLO si estas seguro. Es mejor descartar una pregunta dudosa que devolver una clave mala.

Examen: ${ctx.name}

${subjectRules}

VALIDACION OBLIGATORIA:
- Recalcula o valida cada pregunta desde cero.
- El campo "correct" debe apuntar exactamente a la alternativa correcta despues de tu correccion.
- Si la explicacion contradice el campo "correct", corrige la explicacion y/o el indice.
- Si el resultado correcto no existe entre las alternativas, reemplaza el distractor mas debil por el resultado correcto y ajusta "correct".
- Si no puedes validar con certeza una pregunta, devuelve {"index": n, "discard": true}.
- No devuelvas preguntas con datos insuficientes, formulas mal aplicadas, respuesta correcta ausente o clave dudosa.
- La explicacion debe ser corta, pedagogica y sin letras/indices de alternativas.
- Para calculos usa: "Dato clave:", "Paso 1:", "Paso 2:" y "Resultado:".
- Para interpretacion usa: "Dato clave:" y "Conclusion:".

Devuelve SOLO un array JSON valido. Mantiene el mismo "index" de entrada:
[
  {
    "index": 0,
    "text": "...",
    "options": ["...", "...", "...", "..."],
    "correct": 0,
    "skill": "mixed",
    "difficulty": 2,
    "explanation": "Dato clave: ...\\nConclusion: ..."
  }
]

Preguntas a auditar:
${JSON.stringify(questions.map((q, index) => ({
  index,
  text: q.text,
  options: q.options,
  correct: q.correct,
  skill: q.skill,
  difficulty: q.difficulty,
  explanation: q.explanation,
})), null, 2)}`;
}

async function reviewStrictQuestions(
  apiKey: string,
  examId: string,
  questions: GeneratedQuestion[],
): Promise<Record<string, unknown>[]> {
  const prompt = buildStrictReviewPrompt(examId, questions);
  const maxTokens = Math.min(4500, 1700 + questions.length * 900);
  const raw = await callClaude(apiKey, prompt, maxTokens, 0);
  const parsed = parseAIResponse(raw) as Record<string, unknown>[];
  if (!Array.isArray(parsed)) throw new Error('La auditoria IA no devolvio un array');
  return parsed;
}

function normalizeReviewedQuestions(
  reviewed: Record<string, unknown>[],
  originals: GeneratedQuestion[],
  examId: string,
  requestedSkillId: string | null,
  maxTextChars: number,
  math: boolean,
): GeneratedQuestion[] {
  const ctx = EXAM_CONTEXT[examId];
  const byIndex = new Map<number, Record<string, unknown>>();

  reviewed.forEach((item, fallbackIndex) => {
    if (!item || typeof item !== 'object') return;
    const rawIndex = Number(item.index);
    const index = Number.isInteger(rawIndex) ? rawIndex : fallbackIndex;
    if (index >= 0 && index < originals.length) byIndex.set(index, item);
  });

  return originals
    .map((original, index) => {
      const item = byIndex.get(index);
      if (!item || item.discard === true) return null;

      const options = Array.isArray(item.options)
        ? (item.options as unknown[]).map(normalizeOptionText).filter(Boolean)
        : [];
      const correct = Number.isInteger(item.correct) ? item.correct as number : -1;
      if (!ctx.optionCounts.includes(options.length)) return null;
      if (correct < 0 || correct >= options.length) return null;
      if (hasDuplicateOptions(options)) return null;

      const explanation = cleanExplanation(item.explanation ?? original.explanation, 760, math);
      if (!explanation || hasOptionLetterReference(explanation)) return null;

      const rawDifficulty = Number(item.difficulty);
      const difficulty = rawDifficulty >= 1 && rawDifficulty <= 3 ? rawDifficulty : original.difficulty;
      const skill = isValidSkill(examId, item.skill)
        ? item.skill
        : (requestedSkillId || original.skill || 'mixed');

      return {
        ...original,
        id: markReviewedId(original.id, examId),
        text: normalizeMultilineText(item.text ?? original.text, maxTextChars),
        options,
        correct,
        skill,
        explanation,
        difficulty,
        version: 5,
      };
    })
    .filter((q): q is GeneratedQuestion => (
      q !== null
      && q.text.length > 0
      && q.options.length >= 4
      && q.correct >= 0
      && q.correct < q.options.length
    ));
}

async function callClaude(apiKey: string, prompt: string, maxTokens: number, temperature = 0.65): Promise<string> {
  const RETRYABLE = new Set([500, 503, 529]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      if (RETRYABLE.has(res.status) && attempt < 2) {
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      throw new Error(`Claude API HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text);
    if (data.error) throw new Error(`Claude API: ${data.error.message}`);
    return (
      data.content?.find((b: { type?: string; text?: string }) => b.type === 'text')?.text ||
      data.content?.[0]?.text ||
      ''
    );
  }
  throw new Error('Claude API: todos los intentos fallaron');
}

function normalizeGeneratedQuestions(
  parsed: Record<string, unknown>[],
  examId: string,
  requestedSkillId: string | null,
  safeCount: number,
  maxTextChars: number,
  math: boolean,
): GeneratedQuestion[] {
  const ctx = EXAM_CONTEXT[examId];
  const ts = String(Date.now());

  return parsed.slice(0, safeCount)
    .map((q, i) => {
      const rawOptions = Array.isArray(q.options)
        ? (q.options as unknown[]).map(normalizeOptionText).filter(Boolean)
        : [];
      const correctIdx = Number.isInteger(q.correct) ? q.correct as number : -1;
      if (!ctx.optionCounts.includes(rawOptions.length)) return null;
      if (correctIdx < 0 || correctIdx >= rawOptions.length) return null;
      if (hasDuplicateOptions(rawOptions)) return null;

      const shuffled = rawOptions.map((text, idx) => ({ text, isCorrect: idx === correctIdx }));
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }

      const rawDifficulty = Number(q.difficulty);
      const difficulty = rawDifficulty >= 1 && rawDifficulty <= 3 ? rawDifficulty : 2;

      return {
        id:          `ai_${examId}_${requestedSkillId || 'mix'}_${ts}_${crypto.randomUUID().slice(0,8)}_${i}`,
        skill:       isValidSkill(examId, q.skill) ? q.skill : requestedSkillId || 'mixed',
        text:        normalizeMultilineText(q.text, maxTextChars),
        options:     shuffled.map(option => option.text),
        correct:     shuffled.findIndex(option => option.isCorrect),
        explanation: cleanExplanation(q.explanation, 720, math),
        difficulty,
        aiGenerated: true,
        provider:    'claude',
        version:     3,
      };
    })
    .filter((q): q is GeneratedQuestion => (
      q !== null
      && q.text.length > 0
      && q.options.length >= 4
      && q.correct >= 0
      && q.correct < q.options.length
    ));
}

async function validateGeneratedQuestions(
  apiKey: string,
  examId: string,
  requestedSkillId: string | null,
  questions: GeneratedQuestion[],
  maxTextChars: number,
  math: boolean,
): Promise<GeneratedQuestion[]> {
  let validated = questions;

  if (needsStrictReview(examId) && validated.length > 0) {
    try {
      const reviewed = await reviewStrictQuestions(apiKey, examId, validated);
      validated = normalizeReviewedQuestions(reviewed, validated, examId, requestedSkillId, maxTextChars, math);
    } catch (reviewErr) {
      console.warn('[generate-question] strict review failed:', (reviewErr as Error).message);
      return [];
    }
  }

  if (needsStrictReview(examId) && validated.length > 0) {
    validated = enforceDeterministicQuestionSafetyList(validated, examId);
  }

  return validated;
}

async function saveGeneratedQuestionsToBancoIA(
  supabase: ReturnType<typeof createClient>,
  questions: GeneratedQuestion[],
  examId: string,
  requestedSkillId: string | null,
  userEmail: string | null,
): Promise<boolean> {
  try {
    const rows = questions.map(q => ({
      id:           q.id,
      exam_id:      examId,
      skill_id:     q.skill || requestedSkillId || 'mixed',
      text:         q.text,
      options:      q.options,
      correct:      q.correct,
      explanation:  q.explanation,
      difficulty:   q.difficulty,
      generado_por: userEmail || 'unknown',
    }));
    const { error } = await supabase.from('banco_ia').insert(rows);
    if (error) {
      console.warn('[generate-question] banco_ia insert error:', error.code, error.message);
      return false;
    }
    console.log(`[generate-question] ${rows.length} preguntas guardadas en banco_ia`);
    return true;
  } catch (saveErr) {
    console.warn('[generate-question] banco_ia save exception:', (saveErr as Error).message);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { examId, skillId, count, userEmail, visualAllowed } = await req.json();

    const ctx = EXAM_CONTEXT[examId];
    if (!ctx) {
      return new Response(JSON.stringify({ error: `examId no reconocido: ${examId}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 3);
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) throw new Error('CLAUDE_API_KEY no configurada');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const requestedSkillId = typeof skillId === 'string' && ctx.skills[skillId] ? skillId : null;

    const examples = await fetchFewShotExamples(supabase, examId, requestedSkillId);
    const prompt = buildPrompt(examId, requestedSkillId, safeCount, examples, visualAllowed === true);
    const maxTokens = examId === 'lectora' ? 4500 : examId === 'm2' ? 3500 : 3200;
    const math = isMath(examId);

    const raw = await callClaude(apiKey, prompt, maxTokens);
    const parsed = parseAIResponse(raw) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) throw new Error('Respuesta IA no es un array');

    const maxTextChars = examId === 'lectora' ? 2200 : 1000;
    let questions = normalizeGeneratedQuestions(parsed, examId, requestedSkillId, safeCount, maxTextChars, math);
    questions = await validateGeneratedQuestions(apiKey, examId, requestedSkillId, questions, maxTextChars, math);

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, questions: [], error: 'La IA no pudo validar las claves con seguridad. Intenta nuevamente.', provider: 'claude', count: 0, savedToDb: false }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const savedToDb = await saveGeneratedQuestionsToBancoIA(
      supabase,
      questions,
      examId,
      requestedSkillId,
      typeof userEmail === 'string' ? userEmail : null,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        questions,
        provider: 'claude',
        count: questions.length,
        savedToDb,
        validation: {
          strict: needsStrictReview(examId),
          version: needsStrictReview(examId) ? REVIEWED_ID_VERSION : 'standard',
        },
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
