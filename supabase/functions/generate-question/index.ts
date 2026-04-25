import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const isMath = (examId: string) => examId === 'm1' || examId === 'm2';

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
  aiGenerated: true;
  provider: 'claude';
  version: number;
};

const EXAM_CONTEXT: Record<string, ExamContext> = {
  lectora: {
    name: 'Comprensión Lectora PAES',
    instructions: `Genera preguntas auténticas de comprensión lectora estilo PAES chilena.

TEXTO: Escribe un texto de 180-240 palabras. Alterna entre estos géneros (no uses siempre el mismo):
- Artículo periodístico o de divulgación científica
- Fragmento narrativo literario (cuento, novela)
- Texto argumentativo u opinión
- Documento informativo con datos numéricos, fechas o cifras múltiples

El texto debe tener complejidad lingüística real: conectores lógicos, referentes pronominales, información dispersa en varios párrafos, vocabulario de nivel 4° medio.

PREGUNTA: Usa enunciados estilo DEMRE, por ejemplo:
- "De acuerdo con el texto, ¿cuál de las siguientes afirmaciones es correcta?"
- "¿A qué se refiere la expresión '...' en el párrafo N?"
- "¿Qué información entrega el texto respecto a...?"
- "Según el texto, ¿cuál fue el [dato] de [X] entre [año1] y [año2]?"
- NO uses siempre ¿Qué...? ¿Cuándo...? ¿Dónde...?

DISTRACTORES: Deben ser plausibles. Incluye datos reales del texto pero que no responden la pregunta específica. Evita distractores absurdos que nadie elegiría.`,
    skills: {
      localizar:   'Localizar información explícita: la respuesta está en el texto pero puede requerir discriminar entre datos similares, identificar referentes pronominales, o leer con precisión un párrafo específico. NO es transcripción directa.',
      interpretar: 'Interpretar e integrar: inferir información implícita, identificar relaciones semánticas, reconocer el sentido de expresiones en contexto, deducir el propósito o la postura del autor.',
      evaluar:     'Evaluar y reflexionar: juzgar la solidez de los argumentos, reconocer el propósito comunicativo, analizar la estructura textual, evaluar la pertinencia de la evidencia presentada.',
    },
    optionCounts: [4],
  },
  m1: {
    name: 'Matemática M1 PAES',
    instructions: `Genera problemas matemáticos estilo PAES M1. Nivel: 4° medio.

CONTEXTO: Usa situaciones reales (precios, velocidades, porcentajes, planos, estadísticas). Al menos 1 de cada 2 preguntas debe tener contexto cotidiano, no ser cálculo puro.

DIFICULTAD: Problemas de 2-3 pasos encadenados. No operaciones de un solo paso. Formatos válidos:
- Porcentaje compuesto: "Si el precio aumenta 20% y luego se aplica un descuento del 15%..."
- Geometría con datos: "Un terreno triangular con base 12m y altura que es el 75% de la base..."
- Álgebra contextualizada: "Juan tiene el doble de ahorro que Pedro. Si Pedro ahorra $15.000 más..."
- Identificar el error en un procedimiento de varios pasos
- Escoger el procedimiento que modela una situación

Temas: números reales, potencias, álgebra, geometría plana, estadística descriptiva, probabilidad.`,
    skills: {
      resolver:    'Resolver problemas de 2-3 pasos con procedimientos matemáticos en contexto real',
      modelar:     'Modelar situaciones cotidianas: traducir enunciado verbal a expresión o ecuación matemática',
      representar: 'Interpretar y usar representaciones: gráficos de barras, tablas, rectas numéricas',
      argumentar:  'Justificar propiedades o resultados matemáticos con razonamiento explícito',
    },
    optionCounts: [4],
  },
  m2: {
    name: 'Matemática M2 PAES',
    instructions: `Genera problemas matemáticos estilo PAES M2. Nivel avanzado 4° medio.

CONTEXTO: Usa situaciones que justifiquen el uso de funciones, trigonometría o geometría analítica (física, ingeniería, economía).

DIFICULTAD: Problemas que requieren 2-3 pasos y selección del método correcto. Incluye ocasionalmente suficiencia de datos con afirmaciones (1) y (2), siguiendo el formato DEMRE.

Temas: funciones (lineal, cuadrática, exponencial, logarítmica), trigonometría, vectores, geometría analítica, probabilidad y estadística avanzada.`,
    skills: {
      resolver:    'Resolver problemas avanzados con funciones, trigonometría o geometría analítica en contexto',
      modelar:     'Modelar fenómenos reales con funciones matemáticas',
      representar: 'Representar e interpretar funciones, vectores y transformaciones geométricas',
      argumentar:  'Demostrar y justificar propiedades matemáticas avanzadas',
    },
    optionCounts: [4, 5],
  },
  historia: {
    name: 'Historia y Cs. Sociales PAES',
    instructions: `Genera preguntas de historia y ciencias sociales estilo PAES.

Temas: historia de Chile (colonia, república, siglo XX), historia universal, geografía, formación ciudadana, economía básica.

TIPO: Preguntas que exigen relacionar causas y consecuencias, interpretar fuentes, o evaluar procesos históricos. No solo memorización de fechas. Si usas una fuente, descríbela en texto breve; no dependas de imágenes externas.`,
    skills: {
      temporal: 'Pensamiento temporal: causas, consecuencias, continuidades y cambios en procesos históricos',
      fuentes:  'Análisis de fuentes: interpretar documentos históricos, mapas, estadísticas o imágenes',
      critico:  'Pensamiento crítico: evaluar múltiples perspectivas e interpretaciones históricas',
    },
    optionCounts: [4],
  },
  ciencias: {
    name: 'Ciencias Naturales PAES',
    instructions: `Genera preguntas de ciencias naturales estilo PAES (biología, química o física).

Indica el área al inicio de la pregunta. Los datos deben ser científicamente correctos.

TIPO: Incluye preguntas que interpretan resultados de experimentos, analizan tablas o gráficos descritos en texto, o aplican conceptos a situaciones nuevas. No solo definiciones. Las preguntas con combinaciones I, II y III pueden usar 5 opciones; el resto debe usar 4.`,
    skills: {
      observar:   'Observar y describir fenómenos naturales con precisión científica',
      planificar: 'Planificar y diseñar investigaciones o experimentos científicos',
      procesar:   'Procesar e interpretar datos, gráficos o resultados de experimentos',
      evaluar:    'Evaluar evidencias y sacar conclusiones científicas fundamentadas',
      comunicar:  'Comunicar y explicar conceptos y conocimientos científicos',
    },
    optionCounts: [4, 5],
  },
};

function buildPrompt(examId: string, skillId: string | null, count: number): string {
  const ctx = EXAM_CONTEXT[examId];
  const validSkillId = skillId && ctx.skills[skillId] ? skillId : null;
  const skillDesc = validSkillId ? ctx.skills[validSkillId] : 'variedad de habilidades del examen';
  const skillLabel = validSkillId || 'mixed';
  const math = isMath(examId);
  const optionRule = ctx.optionCounts.length === 1
    ? `exactamente ${ctx.optionCounts[0]} opciones`
    : `4 opciones por defecto; usa 5 solo si el formato lo exige (suficiencia de datos o combinaciones I, II y III)`;
  const optionExample = Array.from({ length: ctx.optionCounts[0] }, (_, i) => `opción ${String.fromCharCode(65 + i)}`);

  const mathVerification = math ? `
VERIFICACIÓN MATEMÁTICA OBLIGATORIA (antes de escribir el JSON):
1. Calcula el resultado paso a paso en tu cabeza.
2. Verifica el resultado una segunda vez.
3. Identifica qué opción (0, 1, 2, 3 o 4) corresponde a ese resultado.
4. El campo "correct" DEBE ser el índice de esa opción. Si tu cálculo da 19 y 19 está en la opción C (índice 2), entonces "correct": 2.
5. NUNCA pongas un índice que no corresponde al resultado calculado. La explicación y el campo "correct" deben ser consistentes.
` : '';

  return `Eres un experto evaluador PAES chilena (DEMRE). Tu tarea: generar exactamente ${count} pregunta(s) de "${ctx.name}".
Habilidad objetivo: "${skillDesc}".

${ctx.instructions}
${mathVerification}
FORMATO — responde ÚNICAMENTE con un array JSON válido:
[
  {
    "text": "${examId === 'lectora' ? 'TEXTO:\\n[texto de 180-240 palabras aquí]\\n\\nPREGUNTA:\\n[enunciado estilo DEMRE]' : '[enunciado del problema con contexto real]'}",
    "options": ${JSON.stringify(optionExample)},
    "correct": 0,
    "skill": "${skillLabel}",
    "explanation": "${math ? 'Solución breve: [pasos esenciales]. Resultado: [valor]. Corresponde a la opción [letra] (índice [número]).' : 'Explicación breve: por qué la clave responde la pregunta y cuál es el error principal de los distractores.'}"
  }
]

REGLAS:
- Responde SOLO con el array JSON, sin markdown ni texto extra
- "correct" es índice 0-based (0=A, 1=B, 2=C, 3=D, 4=E)
- Cantidad de alternativas: ${optionRule}
- No escribas "A)", "B)", etc. dentro del texto de las opciones; la app ya agrega las letras
- Cada opción debe ser breve: máximo 120 caracteres o 18 palabras, salvo fórmulas inevitables
- La explicación debe ser breve: 2 a 4 oraciones, máximo 520 caracteres
- Distractores plausibles: errores comunes, no respuestas absurdas
- Nivel PAES real (4° medio Chile)`;
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

  throw new Error('La IA no devolvió JSON válido. Intenta nuevamente.');
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { examId, skillId, count, userEmail } = await req.json();

    const ctx = EXAM_CONTEXT[examId];
    if (!ctx) {
      return new Response(JSON.stringify({ error: `examId no reconocido: ${examId}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 3);
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) throw new Error('CLAUDE_API_KEY no configurada');

    const requestedSkillId = typeof skillId === 'string' && ctx.skills[skillId] ? skillId : null;
    const prompt = buildPrompt(examId, requestedSkillId, safeCount);

    const maxTokens = examId === 'lectora' ? 4500 : 3000;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        temperature: 0.65,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error(`Claude API HTTP ${claudeRes.status}`);
    if (claudeData.error) throw new Error(`Claude API: ${claudeData.error.message}`);

    const raw = claudeData.content?.find((block: { type?: string; text?: string }) => block.type === 'text')?.text
      || claudeData.content?.[0]?.text
      || '';
    const parsed = parseAIResponse(raw) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) throw new Error('Respuesta IA no es un array');

    const ts = String(Date.now());
    const maxTextChars = examId === 'lectora' ? 2200 : 1000;
    const questions = parsed.slice(0, safeCount)
      .map((q, i) => {
        const rawOptions = Array.isArray(q.options)
          ? (q.options as unknown[]).map(opt => normalizeInlineText(opt, 160)).filter(Boolean)
          : [];
        const correctIdx = Number.isInteger(q.correct) ? q.correct as number : -1;
        if (!ctx.optionCounts.includes(rawOptions.length)) return null;
        if (correctIdx < 0 || correctIdx >= rawOptions.length) return null;
        if (hasDuplicateOptions(rawOptions)) return null;

        // Fisher-Yates shuffle para distribuir la clave en posición aleatoria
        const shuffled = rawOptions.map((text, idx) => ({ text, isCorrect: idx === correctIdx }));
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        const newCorrect = shuffled.findIndex(option => option.isCorrect);
        const normalizedText = normalizeMultilineText(q.text, maxTextChars);

        return {
          id:          `ai_${examId}_${requestedSkillId || 'mix'}_${ts}_${crypto.randomUUID().slice(0,8)}_${i}`,
          skill:       isValidSkill(examId, q.skill) ? q.skill : requestedSkillId || 'mixed',
          text:        normalizedText,
          options:     shuffled.map(option => option.text),
          correct:     newCorrect >= 0 ? newCorrect : 0,
          explanation: normalizeMultilineText(q.explanation, 560),
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

    if (questions.length === 0) {
      throw new Error('La IA generó preguntas con formato inválido. Intenta nuevamente.');
    }

    return new Response(
      JSON.stringify({ ok: true, questions, provider: 'claude', count: questions.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
