import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXAM_CONTEXT: Record<string, { name: string; instructions: string; skills: Record<string, string> }> = {
  lectora: {
    name: 'Comprensión Lectora PAES',
    instructions: 'Genera preguntas de comprensión lectora estilo PAES chilena. Incluye un texto breve (60-90 palabras, informativo o literario) seguido de la pregunta. El texto debe ser coherente y de nivel 4° medio.',
    skills: {
      localizar:   'Localizar y recuperar información explícita del texto',
      interpretar: 'Interpretar e integrar información implícita del texto',
      evaluar:     'Evaluar y reflexionar críticamente sobre el texto, propósito y estructura',
    },
  },
  m1: {
    name: 'Matemática M1 PAES',
    instructions: 'Genera problemas matemáticos estilo PAES M1 (nivel 4° medio básico-medio). Temas: números, álgebra, geometría, estadística y probabilidad. Los cálculos deben ser verificados y correctos.',
    skills: {
      resolver:    'Resolver problemas usando procedimientos y algoritmos matemáticos',
      modelar:     'Modelar situaciones cotidianas con expresiones o ecuaciones matemáticas',
      representar: 'Representar información en gráficos, tablas o expresiones algebraicas',
      argumentar:  'Argumentar y justificar propiedades o resultados matemáticos',
    },
  },
  m2: {
    name: 'Matemática M2 PAES',
    instructions: 'Genera problemas matemáticos estilo PAES M2 (nivel avanzado). Temas: funciones, trigonometría, vectores, geometría analítica, cálculo básico. Verifica todos los cálculos.',
    skills: {
      resolver:    'Resolver problemas avanzados con funciones, trigonometría o cálculo',
      modelar:     'Modelar fenómenos reales con funciones matemáticas',
      representar: 'Representar funciones, vectores y transformaciones geométricas',
      argumentar:  'Demostrar y argumentar propiedades matemáticas avanzadas',
    },
  },
  historia: {
    name: 'Historia y Cs. Sociales PAES',
    instructions: 'Genera preguntas de historia y ciencias sociales estilo PAES. Temas: historia de Chile, historia universal, geografía, educación cívica y economía básica.',
    skills: {
      temporal: 'Pensamiento temporal: causas, consecuencias y procesos históricos en el tiempo',
      fuentes:  'Análisis de fuentes: interpretar documentos históricos, mapas o estadísticas',
      critico:  'Pensamiento crítico: evaluar múltiples perspectivas e interpretaciones históricas',
    },
  },
  ciencias: {
    name: 'Ciencias Naturales PAES',
    instructions: 'Genera preguntas de ciencias naturales estilo PAES (biología, química o física). Indica el área al inicio de la pregunta. Los datos y conceptos deben ser científicamente correctos.',
    skills: {
      observar:   'Observar y describir fenómenos naturales con precisión científica',
      planificar: 'Planificar y diseñar investigaciones o experimentos científicos',
      procesar:   'Procesar e interpretar datos, gráficos o resultados de experimentos',
      evaluar:    'Evaluar evidencias y sacar conclusiones científicas fundamentadas',
      comunicar:  'Comunicar y explicar conceptos y conocimientos científicos',
    },
  },
};

function buildPrompt(examId: string, skillId: string | null, count: number): string {
  const ctx = EXAM_CONTEXT[examId];
  const skillDesc = (skillId && ctx.skills[skillId]) ? ctx.skills[skillId] : 'variedad de habilidades del examen';
  const skillLabel = skillId || 'mixed';

  return `Eres un experto evaluador de la PAES chilena (Prueba de Acceso a la Educación Superior).
Tu tarea: generar exactamente ${count} preguntas de "${ctx.name}".
Habilidad objetivo: "${skillDesc}".

${ctx.instructions}

FORMATO DE RESPUESTA — responde ÚNICAMENTE con un array JSON válido, sin texto adicional:
[
  {
    "text": "Texto completo de la pregunta. Si es comprensión lectora, incluye el texto de lectura aquí seguido de la pregunta.",
    "options": ["Primera opción", "Segunda opción", "Tercera opción", "Cuarta opción", "Quinta opción"],
    "correct": 0,
    "skill": "${skillLabel}",
    "explanation": "Explicación detallada de por qué esa es la respuesta correcta y por qué las otras son incorrectas."
  }
]

REGLAS CRÍTICAS:
- Tu respuesta debe comenzar DIRECTAMENTE con [ sin ningún texto previo
- Tu respuesta debe terminar DIRECTAMENTE con ] sin ningún texto posterior
- NO uses bloques de código markdown (no uses \`\`\`)
- "correct" es el índice 0-based de la opción correcta (0=primera, 1=segunda...)
- Cada pregunta debe tener exactamente 5 opciones
- Los distractores deben ser plausibles pero incorrectos
- Para matemáticas: verifica el cálculo dos veces antes de responder
- Nivel de dificultad: real PAES (4° medio Chile)
- Genera exactamente ${count} preguntas`;
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

    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 2);
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) throw new Error('CLAUDE_API_KEY no configurada');

    const prompt = buildPrompt(examId, skillId || null, safeCount);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(`Claude API: ${claudeData.error.message}`);

    const raw = claudeData.content[0].text;
    const parsed = parseAIResponse(raw) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) throw new Error('Respuesta IA no es un array');

    const ts = String(Date.now());
    const questions = parsed
      .map((q, i) => ({
        id:          `ai_${examId}_${skillId || 'mix'}_${ts}_${i}`,
        skill:       (q.skill as string) || skillId || 'mixed',
        text:        String(q.text || '').trim(),
        options:     Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [],
        correct:     typeof q.correct === 'number' ? q.correct : 0,
        explanation: String(q.explanation || '').trim(),
        aiGenerated: true,
        provider:    'claude',
      }))
      .filter(q => q.text.length > 0 && q.options.length >= 4);

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
