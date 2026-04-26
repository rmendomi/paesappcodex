// ── Cliente Supabase ────────────────────────────────────────────────────────
import { supabase } from './lib/supabase';
import { createDiagnosticSessions } from './lib/progress';
import { questionsBySkill } from './data/catalogSource';

const DEFAULT_TARGETS = { lectora: 700, m1: 700, m2: 680, historia: 690, ciencias: 710 };
const STRICT_REVIEWED_BANCO_EXAMS = new Set(['ciencias', 'm1', 'm2']);
const REVIEWED_BANCO_VERSION = 'v5';

// â”€â”€ Contexto para generaciÃ³n de preguntas con IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EXAM_CONTEXT = {
  lectora: {
    name: 'ComprensiÃ³n Lectora PAES',
    instructions: 'Genera preguntas de comprensiÃ³n lectora estilo PAES chilena. Incluye un texto de lectura (150-250 palabras, informativo o literario) seguido de la pregunta. El texto debe ser coherente y de nivel 4Â° medio.',
    skills: {
      localizar:   'Localizar y recuperar informaciÃ³n explÃ­cita del texto',
      interpretar: 'Interpretar e integrar informaciÃ³n implÃ­cita del texto',
      evaluar:     'Evaluar y reflexionar crÃ­ticamente sobre el texto, propÃ³sito y estructura',
    },
  },
  m1: {
    name: 'MatemÃ¡tica M1 PAES',
    instructions: 'Genera problemas matemÃ¡ticos estilo PAES M1 (nivel 4Â° medio bÃ¡sico-medio). Temas: nÃºmeros, Ã¡lgebra, geometrÃ­a, estadÃ­stica y probabilidad. Los cÃ¡lculos deben ser verificados y correctos.',
    skills: {
      resolver:    'Resolver problemas usando procedimientos y algoritmos matemÃ¡ticos',
      modelar:     'Modelar situaciones cotidianas con expresiones o ecuaciones matemÃ¡ticas',
      representar: 'Representar informaciÃ³n en grÃ¡ficos, tablas o expresiones algebraicas',
      argumentar:  'Argumentar y justificar propiedades o resultados matemÃ¡ticos',
    },
  },
  m2: {
    name: 'MatemÃ¡tica M2 PAES',
    instructions: 'Genera problemas matemÃ¡ticos estilo PAES M2 (nivel avanzado). Temas: funciones, trigonometrÃ­a, vectores, geometrÃ­a analÃ­tica, cÃ¡lculo bÃ¡sico. Verifica todos los cÃ¡lculos.',
    skills: {
      resolver:    'Resolver problemas avanzados con funciones, trigonometrÃ­a o cÃ¡lculo',
      modelar:     'Modelar fenÃ³menos reales con funciones matemÃ¡ticas',
      representar: 'Representar funciones, vectores y transformaciones geomÃ©tricas',
      argumentar:  'Demostrar y argumentar propiedades matemÃ¡ticas avanzadas',
    },
  },
  historia: {
    name: 'Historia y Cs. Sociales PAES',
    instructions: 'Genera preguntas de historia y ciencias sociales estilo PAES. Temas: historia de Chile, historia universal, geografÃ­a, educaciÃ³n cÃ­vica y economÃ­a bÃ¡sica.',
    skills: {
      temporal: 'Pensamiento temporal: causas, consecuencias y procesos histÃ³ricos en el tiempo',
      fuentes:  'AnÃ¡lisis de fuentes: interpretar documentos histÃ³ricos, mapas o estadÃ­sticas',
      critico:  'Pensamiento crÃ­tico: evaluar mÃºltiples perspectivas e interpretaciones histÃ³ricas',
    },
  },
  ciencias: {
    name: 'Ciencias Naturales PAES',
    instructions: 'Genera preguntas de ciencias naturales estilo PAES (biologÃ­a, quÃ­mica o fÃ­sica). Indica el Ã¡rea al inicio de la pregunta. Los datos y conceptos deben ser cientÃ­ficamente correctos.',
    skills: {
      observar:   'Observar y describir fenÃ³menos naturales con precisiÃ³n cientÃ­fica',
      planificar: 'Planificar y diseÃ±ar investigaciones o experimentos cientÃ­ficos',
      procesar:   'Procesar e interpretar datos, grÃ¡ficos o resultados de experimentos',
      evaluar:    'Evaluar evidencias y sacar conclusiones cientÃ­ficas fundamentadas',
      comunicar:  'Comunicar y explicar conceptos y conocimientos cientÃ­ficos',
    },
  },
};

function buildPrompt(examId, skillId, count) {
  const ctx = EXAM_CONTEXT[examId];
  const skillDesc = (skillId && ctx.skills[skillId]) ? ctx.skills[skillId] : 'variedad de habilidades del examen';
  const skillLabel = skillId || 'mixed';

  return `Eres un experto evaluador de la PAES chilena (Prueba de Acceso a la EducaciÃ³n Superior).
Tu tarea: generar exactamente ${count} preguntas de "${ctx.name}".
Habilidad objetivo: "${skillDesc}".

${ctx.instructions}

FORMATO DE RESPUESTA â€” responde ÃšNICAMENTE con un array JSON vÃ¡lido, sin texto adicional:
[
  {
    "text": "Texto completo de la pregunta. Si es comprensiÃ³n lectora, incluye el texto de lectura aquÃ­ seguido de la pregunta.",
    "options": ["Primera opciÃ³n", "Segunda opciÃ³n", "Tercera opciÃ³n", "Cuarta opciÃ³n", "Quinta opciÃ³n"],
    "correct": 0,
    "skill": "${skillLabel}",
    "explanation": "ExplicaciÃ³n detallada de por quÃ© esa es la respuesta correcta y por quÃ© las otras son incorrectas."
  }
]

REGLAS CRÃTICAS:
- Responde SOLO con el array JSON, sin markdown ni texto extra
- "correct" es el Ã­ndice 0-based de la opciÃ³n correcta (0=primera, 1=segunda...)
- Cada pregunta debe tener exactamente 5 opciones
- Los distractores deben ser plausibles pero incorrectos
- Para matemÃ¡ticas: verifica el cÃ¡lculo dos veces antes de responder
- Nivel de dificultad: real PAES (4Â° medio Chile)
- Genera exactamente ${count} preguntas`;
}

function parseAIResponse(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  throw new Error('La IA no devolviÃ³ JSON vÃ¡lido. Intenta nuevamente.');
}

async function callEdgeFunctionForQuestions(params, { timeoutMs = 25000, retries = 1 } = {}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey    = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL no configurada en .env');

  const url  = `${supabaseUrl}/functions/v1/generate-question`;
  const body = JSON.stringify({
    examId:    params.examId,
    skillId:   params.skillId   || null,
    count:     params.count     || 5,
    userEmail: params.userEmail || '',
    visualAllowed: params.visualAllowed === true,
  });

  const tag = `[GQ:${params.examId}:${params.skillId||'mix'}:n${params.count}]`;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = performance.now();

    try {
      console.log(`${tag} attempt=${attempt} → fetch START (timeout=${timeoutMs}ms)`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body,
        signal: controller.signal,
      });
      const tHeaders = performance.now();
      console.log(`${tag} attempt=${attempt} → headers recibidos status=${resp.status} +${Math.round(tHeaders - t0)}ms`);

      const data = await resp.json();
      const tBody = performance.now();
      console.log(`${tag} attempt=${attempt} → body parseado +${Math.round(tBody - t0)}ms`, data.error ? `ERROR: ${data.error}` : `ok, questions=${data.questions?.length}`);

      if (data.error) {
        lastError = new Error(data.error);
        if (resp.status === 500 && attempt < retries) continue;
        throw lastError;
      }
      if (Array.isArray(data.questions)) {
        const safeQuestions = enforceDeterministicQuestionSafetyList(data.questions, params.examId);
        if (safeQuestions.length !== data.questions.length) {
          console.warn(`${tag} safety filter ${data.questions.length} -> ${safeQuestions.length}`);
        }
        data.questions = safeQuestions;
      }
      return data;
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0);
      lastError = err.name === 'AbortError'
        ? new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s). Revisa tu conexión.`)
        : err;
      console.warn(`${tag} attempt=${attempt} → CATCH err=${err.name}: ${err.message} +${elapsed}ms`);
      if (attempt < retries) continue;
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function runSettledWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = {
          status: 'fulfilled',
          value: await task(items[currentIndex], currentIndex),
        };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }));

  return results;
}

function shouldAllowVisualResource(examId, chunkIndex, chunkCount) {
  if (chunkCount <= 1) return false;
  const every = examId === 'lectora' ? 5 : examId === 'historia' ? 4 : 2;
  const offset = examId === 'lectora' || examId === 'historia' ? 2 : 1;
  return (chunkIndex + offset) % every === 0;
}

function getStaticFallbackQuestions(examId, skillId, count) {
  const examBank = questionsBySkill[examId];
  if (!examBank) return [];
  let pool = skillId && examBank[skillId]
    ? [...examBank[skillId]]
    : Object.values(examBank).flat();
  // Mezcla aleatoria simple
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map(q => ({ ...q, aiGenerated: false, fromBanco: false, fromStatic: true }));
}

function normalizeMathText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b2/g, '^2')
    .replace(/\u00b3/g, '^3')
    .replace(/[\u00b7\u00d7]/g, '*')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseDecimal(value) {
  const number = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function extractOptionNumbers(option) {
  return (String(option || '').match(/-?\d+(?:[.,]\d+)?/g) || [])
    .map(parseDecimal)
    .filter(n => n !== null);
}

function optionHasNumber(option, expected, tolerance = 0.02) {
  const numbers = extractOptionNumbers(option);
  if (numbers.length >= 2) {
    const min = Math.min(numbers[0], numbers[1]);
    const max = Math.max(numbers[0], numbers[1]);
    if (expected >= min - tolerance && expected <= max + tolerance) return true;
  }
  return numbers.some(n => Math.abs(n - expected) <= tolerance);
}

function findOptionByNumber(options, expected, tolerance = 0.02) {
  return options.findIndex(option => optionHasNumber(option, expected, tolerance));
}

function findOptionByText(options, pattern) {
  return options.findIndex(option => pattern.test(normalizeMathText(option)));
}

function powerDigitRule(text) {
  if (!/cuantos digitos|cantidad de digitos/.test(text)) return null;
  const match = text.match(/(\d+)\s*\^\s*(\d+)/);
  if (!match) return null;
  const base = BigInt(match[1]);
  const exponent = BigInt(match[2]);
  if (exponent > 80n) return null;
  return { expected: (base ** exponent).toString().length, tolerance: 0 };
}

function sinePeriodRule(text, options) {
  if (!/funcion seno|sen\s*\(|seno/.test(text) || !/periodo/.test(text)) return null;
  return { expectedIndex: findOptionByText(options, /\b2\s*(pi|\u03c0)\b|2\u03c0/) };
}

function factoredXAxisRule(text, options) {
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

function depreciationModelRule(text, options) {
  const rate = text.match(/deprecia\s+un\s+(\d+(?:[.,]\d+)?)\s*%/);
  if (!rate || !/modelo/.test(text)) return null;
  const factor = 1 - Number(rate[1].replace(',', '.')) / 100;
  const comma = factor.toFixed(2).replace('.', ',').replace(/0$/, '');
  const dot = factor.toFixed(2).replace(/0$/, '');
  return { expectedIndex: findOptionByText(options, new RegExp(`\\(?(${comma}|${dot})\\)?\\s*\\^?\\s*t`)) };
}

function rampSineRule(text) {
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

function exponentialTimeRule(text) {
  const fn = text.match(/=\s*(\d+(?:[.,]\d+)?)\s*\*?\s*2\s*\^\s*\(?t\s*\/\s*(\d+(?:[.,]\d+)?)\)?/);
  const target = text.match(/=\s*(\d+(?:[.,]\d+)?)\s*(?:suscriptores|usuarios|personas|clientes|$)/g);
  if (!fn || !target || target.length < 2) return null;
  const start = Number(fn[1].replace(',', '.'));
  const divisor = Number(fn[2].replace(',', '.'));
  const targetValueMatch = target[target.length - 1].match(/(\d+(?:[.,]\d+)?)/);
  const targetValue = targetValueMatch ? Number(targetValueMatch[1].replace(',', '.')) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(divisor) || !Number.isFinite(targetValue) || targetValue <= start) return null;
  const expected = divisor * Math.log2(targetValue / start);
  return { expected, tolerance: 0.15 };
}

function quadraticVertexRule(text) {
  if (!/vertice|maximo|minimo|minimo|maxima|disminuir/.test(text)) return null;
  const match = text.match(/=\s*([+-]?\d+(?:[.,]\d+)?)\s*x\^2\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*x/);
  if (!match) return null;
  const a = Number(match[1].replace(',', '.'));
  const b = Number(match[3].replace(',', '.')) * (match[2] === '-' ? -1 : 1);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return { expected: -b / (2 * a), tolerance: 0.15 };
}

function deterministicMathRule(question) {
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

function enforceDeterministicQuestionSafety(question, examId) {
  if (!STRICT_REVIEWED_BANCO_EXAMS.has(examId) || !question?.aiGenerated) return question;
  const rule = deterministicMathRule(question);
  if (!rule) return question;

  const expectedIndex = Number.isInteger(rule.expectedIndex)
    ? rule.expectedIndex
    : findOptionByNumber(question.options || [], rule.expected, rule.tolerance ?? 0.02);

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

function enforceDeterministicQuestionSafetyList(questions, examId) {
  return (questions || [])
    .map(q => enforceDeterministicQuestionSafety(q, examId))
    .filter(Boolean);
}

async function saveToBancoIA(questions, examId, skillId, userEmail) {
  const t0 = performance.now();
  try {
    const safeQuestions = enforceDeterministicQuestionSafetyList(questions, examId);
    if (safeQuestions.length === 0) return;
    const rows = safeQuestions.map(q => ({
      id:           q.id,
      exam_id:      examId,
      skill_id:     skillId || 'mixed',
      text:         q.text,
      options:      q.options,
      correct:      q.correct,
      explanation:  q.explanation,
      generado_por: userEmail || 'unknown',
    }));
    const { error } = await supabase.from('banco_ia').insert(rows);
    const elapsed = Math.round(performance.now() - t0);
    if (error) console.warn(`[saveToBancoIA] insert error +${elapsed}ms:`, error.code, error.message);
    else console.log(`[saveToBancoIA] ${rows.length} preguntas guardadas +${elapsed}ms`);
  } catch (err) {
    console.warn(`[saveToBancoIA] exception +${Math.round(performance.now() - t0)}ms:`, err.message);
  }
}

// â”€â”€ API principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EXAM_NAMES = {
  lectora: 'Comprensión Lectora',
  m1: 'Matemática M1',
  m2: 'Matemática M2',
  historia: 'Historia',
  ciencias: 'Ciencias',
};

const PLAN_TOPICS = {
  lectora: [
    'Localizar información explícita en textos',
    'Interpretar ideas implícitas y propósito del autor',
    'Ensayo breve de Comprensión Lectora',
  ],
  m1: [
    'Resolver ecuaciones y sistemas lineales',
    'Problemas de proporcionalidad, porcentajes y razones',
    'Interpretar gráficos y tablas en contexto PAES',
  ],
  m2: [
    'Funciones exponenciales y logarítmicas',
    'Trigonometría aplicada y análisis gráfico',
    'Modelación con funciones y optimización',
  ],
  historia: [
    'Análisis de fuentes históricas y confiabilidad',
    'Procesos históricos de Chile y multicausalidad',
    'Formación ciudadana e instituciones',
  ],
  ciencias: [
    'Diseño experimental: variables y control',
    'Interpretación de datos y gráficos científicos',
    'Explicación de fenómenos en biología, química y física',
  ],
};

const LEADERBOARD_RPC_MISSING_CODES = new Set(['PGRST202', '42883']);

function normalizeLeaderboardEntry(entry, fallbackRank) {
  const email = entry?.email || '';
  const safeEmail = String(email);
  const avgScore = Number(entry?.avg_score ?? entry?.avgScore ?? 0) || 0;
  const streak = Number(entry?.streak ?? 0) || 0;
  const sessions = Number(entry?.sessions ?? 0) || 0;
  const xp = Number(entry?.xp ?? (sessions * 100 + avgScore + streak * 10)) || 0;
  const rank = Number(entry?.rank ?? fallbackRank ?? 0) || fallbackRank || 0;

  return {
    email: safeEmail,
    name: entry?.name || (safeEmail.includes('@') ? safeEmail.split('@')[0] : safeEmail),
    school: entry?.school || '',
    avgScore,
    streak,
    sessions,
    xp,
    rank,
  };
}

function buildHeuristicStudyPlan({ name, progressStats, targets, objetivoPrincipal }) {
  const examIds = ['lectora', 'm1', 'm2', 'historia', 'ciencias'];
  const targetMap = { ...DEFAULT_TARGETS, ...(targets || {}) };

  // Si hay objetivo principal con puntaje de corte, ajustar targets mínimos
  if (objetivoPrincipal?.puntaje_corte) {
    const ponds = objetivoPrincipal.ponderaciones || {};
    // Subir targets de los exámenes que pondera la carrera objetivo
    Object.entries(ponds).forEach(([examId, weight]) => {
      if (weight > 0 && examIds.includes(examId)) {
        const needed = Math.round(objetivoPrincipal.puntaje_corte / weight * 0.9);
        if (needed > (targetMap[examId] || 0)) {
          targetMap[examId] = Math.min(needed, 1000);
        }
      }
    });
  }

  const ranked = examIds
    .map((id) => {
      const lastScore = Number(progressStats?.[id]?.lastScore) || 0;
      const target = Number(targetMap[id]) || 700;
      const gap = lastScore > 0 ? Math.max(0, target - lastScore) : 1000;
      // Amplificar prioridad para exámenes que pondera la carrera objetivo
      const objWeight = objetivoPrincipal?.ponderaciones?.[id] || 0;
      return { id, lastScore, target, gap, objWeight };
    })
    .sort((a, b) => (b.gap + b.objWeight * 200) - (a.gap + a.objWeight * 200));

  const rotation = [];
  ranked.forEach((r) => {
    rotation.push(r.id);
    // Doble slot para exámenes con brecha alta O que pondera mucho la carrera
    if (r.gap >= 100 || r.objWeight >= 0.3) rotation.push(r.id);
  });
  if (rotation.length === 0) rotation.push(...examIds);

  const daySlots = [2, 1, 2, 1, 2, 1, 0];
  const durationPattern = [45, 30, 60];
  const days = daySlots.map(() => ({ sessions: [] }));

  let examIdx = 0;
  let durIdx = 0;
  for (let day = 0; day < daySlots.length; day++) {
    for (let slot = 0; slot < daySlots[day]; slot++) {
      const examId = rotation[examIdx % rotation.length];
      const topics = PLAN_TOPICS[examId] || [`Practica focalizada de ${EXAM_NAMES[examId] || 'PAES'}`];
      const topic = topics[(day + slot) % topics.length];
      const duration = durationPattern[durIdx % durationPattern.length];
      days[day].sessions.push({ examId, topic, duration });
      examIdx += 1;
      durIdx += 1;
    }
  }

  const totalMinutes = days.reduce(
    (acc, d) => acc + (d.sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0),
    0
  );

  const topWeak = ranked.slice(0, 2).map((r) => EXAM_NAMES[r.id] || r.id);

  let analysis = '';
  if (objetivoPrincipal?.carrera_nombre) {
    const meta = objetivoPrincipal;
    const gap1 = ranked[0] ? `${EXAM_NAMES[ranked[0].id]} (brecha: ${ranked[0].gap} pts)` : '';
    analysis = `Tu objetivo es ${meta.carrera_nombre} en ${meta.universidad_nombre}` +
      (meta.puntaje_corte ? ` (corte histórico: ${meta.puntaje_corte} pts)` : '') +
      `. Priorizaremos ${gap1}` +
      (topWeak[1] ? ` y ${topWeak[1]}` : '') +
      ` para cerrar la brecha con tu meta. Mantén constancia: 6 días de estudio con descanso el domingo.`;
  } else if (topWeak.length > 0) {
    analysis = `Priorizaremos ${topWeak.join(' y ')} por su mayor brecha respecto a tu meta. Mantendremos sesiones cortas y frecuentes para consolidar avance sin sobrecarga.`;
  } else {
    analysis = 'Distribuiremos sesiones equilibradas para mantener progreso sostenido en todas las pruebas PAES.';
  }

  return {
    name: `Plan Personalizado${name ? ` para ${name}` : ''}`,
    icon: 'AI',
    hoursPerWeek: Math.max(1, Math.round(totalMinutes / 60)),
    analysis,
    generatedBy: 'heuristic',
    days,
  };
}

export const api = {

  // Crea perfil en tabla usuarios tras registro con Supabase Auth
  async createUserProfile({ email, nombre, anioNacimiento, situacion, region, colegioId }) {
    const now = new Date().toISOString();
    const { error } = await supabase.from('usuarios').upsert({
      email,
      name:                    nombre || '',
      picture:                 '',
      school:                  '',
      grade_level:             '4° Medio',
      target_score:            700,
      targets:                 DEFAULT_TARGETS,
      anio_nacimiento:         anioNacimiento || null,
      situacion:               situacion || 'estudiante',
      region:                  region || null,
      colegio_id:              colegioId || null,
      onboarding_completado:   false,
      created_at:              now,
      last_login:              now,
    });
    if (error) throw new Error(error.message);

    // Crear fila de streak (idempotente para evitar errores en reintentos)
    const { error: streakError } = await supabase.from('streak').upsert({
      user_email: email, current: 0, best: 0,
      total_days: 0, last_activity: '', history: {},
    }, { onConflict: 'user_email' });
    if (streakError) throw new Error(streakError.message);

    return { ok: true };
  },

  // Obtiene perfil del usuario autenticado
  async getUserProfile(email) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    await supabase.from('usuarios').update({ last_login: new Date().toISOString() }).eq('email', email);

    return {
      email:                  data.email,
      name:                   data.name,
      picture:                data.picture || null,
      school:                 data.school,
      gradeLevel:             data.grade_level,
      targetScore:            data.target_score,
      targets:                data.targets || DEFAULT_TARGETS,
      anioNacimiento:         data.anio_nacimiento,
      situacion:              data.situacion,
      region:                 data.region,
      colegioId:              data.colegio_id,
      createdAt:              data.created_at,
      lastLogin:              new Date().toISOString(),
      role:                   data.role || 'student',
      objetivoPrincipal:      data.objetivo_principal      || null,
      objetivosSecundarios:   data.objetivos_secundarios   || [],
      onboardingCompletado:   data.onboarding_completado   ?? false,
      diagnosticoCompletado:  data.diagnostico_completado  ?? false,
    };
  },

  // Obtiene colegios filtrados por regiÃ³n
  async getColegiosByRegion(region) {
    const { data, error } = await supabase
      .from('colegios')
      .select('id, nombre, comuna, tipo')
      .eq('region', region)
      .order('nombre');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getOrCreateUser({ email, name, picture }) {
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      await supabase.from('usuarios').update({
        last_login: now,
        ...(name    && { name }),
        ...(picture && { picture }),
      }).eq('email', email);

      return {
        ok: true,
        user: {
          email:       existing.email,
          name:        name    || existing.name,
          picture:     picture || existing.picture,
          school:      existing.school,
          gradeLevel:  existing.grade_level,
          targetScore: existing.target_score,
          targets:     existing.targets || DEFAULT_TARGETS,
          createdAt:   existing.created_at,
          lastLogin:   now,
        },
      };
    }

    // Nuevo usuario
    const { error } = await supabase.from('usuarios').insert({
      email, name: name || '', picture: picture || '',
      school: '', grade_level: '4Â° Medio', target_score: 700,
      targets: DEFAULT_TARGETS,
    });
    if (error) throw new Error(error.message);

    // Crear fila de streak
    const { error: streakError } = await supabase.from('streak').upsert({
      user_email: email, current: 0, best: 0,
      total_days: 0, last_activity: '', history: {},
    }, { onConflict: 'user_email' });
    if (streakError) throw new Error(streakError.message);

    return {
      ok: true,
      user: {
        email, name: name || '', picture: picture || '',
        school: '', gradeLevel: '4Â° Medio', targetScore: 700,
        targets: DEFAULT_TARGETS, createdAt: now, lastLogin: now,
      },
    };
  },

  async updateProfile({ email, name, picture, school, region, colegioId, gradeLevel, targetScore, targets }) {
    const update = {};
    if (name        !== undefined) update.name         = name;
    if (picture     !== undefined) update.picture      = picture;
    if (school      !== undefined) update.school       = school;
    if (region      !== undefined) update.region       = region;
    if (colegioId   !== undefined) update.colegio_id   = colegioId;
    if (gradeLevel  !== undefined) update.grade_level  = gradeLevel;
    if (targetScore !== undefined) update.target_score = targetScore;
    if (targets     !== undefined) update.targets      = targets;

    const { error } = await supabase.from('usuarios').update(update).eq('email', email);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async saveSession({ userEmail, examId, mode, skillId, correct, total, score, date, questionIds, wrongIds, securityEvents, securityWarnings }) {
    const id = `${userEmail}_${Date.now()}`;
    const payload = {
      id, user_email: userEmail, exam_id: examId,
      mode: mode || 'practice',
      correct: correct || 0, total: total || 0, score: score || 0,
      date: date || new Date().toISOString(),
    };

    if (skillId) payload.skill_id = skillId;
    if (Array.isArray(questionIds) && questionIds.length > 0) payload.question_ids = questionIds;
    if (Array.isArray(wrongIds) && wrongIds.length > 0) payload.wrong_ids = wrongIds;
    if (Array.isArray(securityEvents) && securityEvents.length > 0) payload.security_events = securityEvents;
    if (Number(securityWarnings) > 0) payload.security_warnings = Number(securityWarnings);

    const { error } = await supabase.from('sesiones').insert(payload);
    if (error && error.message?.includes('column')) {
      // Fallback: intentar sin columnas nuevas para instalaciones sin migración
      const { error: fallbackError } = await supabase.from('sesiones').insert({
        id, user_email: userEmail, exam_id: examId,
        mode: mode || 'practice',
        correct: correct || 0, total: total || 0, score: score || 0,
        date: date || new Date().toISOString(),
      });
      if (fallbackError) throw new Error(fallbackError.message);
      return { ok: true, id };
    }
    if (error) throw new Error(error.message);
    return { ok: true, id };
  },

  async getUserData(email) {
    const [sesRes, strRes, planRes, diagRes] = await Promise.all([
      supabase.from('sesiones').select('*').eq('user_email', email).order('date'),
      supabase.from('streak').select('*').eq('user_email', email).maybeSingle(),
      supabase.from('planner').select('*').eq('user_email', email).maybeSingle(),
      supabase.from('diagnostico').select('*').eq('user_email', email).order('completed_at'),
    ]);

    const practiceSessions = (sesRes.data || []).map(s => ({
      id: s.id, examId: s.exam_id, mode: s.mode,
      correct: s.correct, total: s.total, score: s.score, date: s.date,
      skillId: s.skill_id || null,
      skill_id: s.skill_id || null,
      questionIds: s.question_ids || [],
      wrongIds: s.wrong_ids || [],
      securityEvents: s.security_events || [],
      securityWarnings: s.security_warnings || 0,
    }));

    const diagnosticSessions = (diagRes.data || []).flatMap((d) =>
      createDiagnosticSessions(email, d.resultados, d.version, d.completed_at)
    );

    const sessions = [...practiceSessions, ...diagnosticSessions]
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const raw = strRes.data;
    const streak = raw
      ? { current: raw.current || 0, best: raw.best || 0, totalDays: raw.total_days || 0, lastActivity: raw.last_activity || '', history: raw.history || {} }
      : { current: 0, best: 0, totalDays: 0, lastActivity: '', history: {} };

    const plan = planRes.data;
    const planner = plan
      ? {
          weekId:      plan.week_id     || '',
          planId:      plan.plan_id     || 'standard',
          progress:    plan.progress    || {},
          planContent: plan.plan_content || null,
          generatedBy: plan.generated_by || 'heuristic',
        }
      : { weekId: '', planId: 'standard', progress: {}, planContent: null, generatedBy: 'heuristic' };

    return { ok: true, sessions, streak, planner };
  },

  async updateStreak(email, streak) {
    const { error } = await supabase.from('streak').upsert({
      user_email:    email,
      current:       streak.current    || 0,
      best:          streak.best       || 0,
      total_days:    streak.totalDays  || 0,
      last_activity: streak.lastActivity || '',
      history:       streak.history    || {},
    }, { onConflict: 'user_email' });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async savePlannerProgress(email, weekId, planId, progress) {
    const { error } = await supabase.from('planner').upsert({
      user_email: email,
      week_id:    weekId  || '',
      plan_id:    planId  || 'standard',
      progress:   progress || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email' });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async getLeaderboard(limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));

    // 1) Camino recomendado: RPC con SECURITY DEFINER
    //    permite ranking global incluso con RLS activo.
    const rpcRes = await supabase.rpc('get_public_leaderboard', { p_limit: safeLimit });
    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      return {
        ok: true,
        leaderboard: rpcRes.data.map((row, i) => normalizeLeaderboardEntry(row, i + 1)),
      };
    }

    // 2) Compatibilidad: fallback para instalaciones antiguas sin RPC.
    //    Si falla por permisos/RLS, devolvemos error explicito para no
    //    mostrar datos desactualizados.
    if (rpcRes.error && !LEADERBOARD_RPC_MISSING_CODES.has(rpcRes.error.code)) {
      throw new Error(rpcRes.error.message);
    }

    const [sesRes, usrRes, strRes] = await Promise.all([
      supabase.from('sesiones').select('user_email, score'),
      supabase.from('usuarios').select('email, name, school'),
      supabase.from('streak').select('user_email, current'),
    ]);

    const queryErrors = [sesRes.error, usrRes.error, strRes.error]
      .filter(Boolean)
      .map((e) => e.message);
    if (queryErrors.length > 0) {
      throw new Error(`No se pudo cargar el ranking en vivo: ${queryErrors.join(' | ')}`);
    }

    const byUser = {};
    for (const s of sesRes.data || []) {
      if (!s.user_email || s.score == null) continue;
      if (!byUser[s.user_email]) byUser[s.user_email] = { total: 0, count: 0 };
      byUser[s.user_email].total += s.score;
      byUser[s.user_email].count += 1;
    }

    const uInfo = Object.fromEntries((usrRes.data || []).map(u => [u.email, u]));
    const sInfo = Object.fromEntries((strRes.data || []).map(s => [s.user_email, s.current || 0]));

    // Incluir TODOS los usuarios, no solo los que tienen sesiones
    const entries = Object.values(uInfo)
      .map(info => {
        const u   = byUser[info.email] || { total: 0, count: 0 };
        const avg = u.count > 0 ? Math.round(u.total / u.count) : 0;
        return normalizeLeaderboardEntry({
          email:    info.email,
          name:     info.name   || info.email.split('@')[0],
          school:   info.school || '',
          avg_score: avg,
          streak:   sInfo[info.email] || 0,
          sessions: u.count,
          xp:       u.count * 100 + avg + (sInfo[info.email] || 0) * 10,
        });
      })
      .sort((a, b) => b.xp - a.xp || b.avgScore - a.avgScore)
      .slice(0, safeLimit)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    return { ok: true, leaderboard: entries };
  },

  // â”€â”€ Banco de preguntas IA: obtener no-vistas por usuario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getBancoQuestions(examId, skillId, userEmail, count) {
    const t0 = performance.now();
    try {
      const { data: vistas } = await supabase
        .from('preguntas_vistas')
        .select('question_id')
        .eq('user_email', userEmail)
        .eq('exam_id', examId);
      console.log(`[getBanco] preguntas_vistas +${Math.round(performance.now() - t0)}ms → ${vistas?.length ?? 0} vistas`);

      const vistoIds = (vistas || []).map(v => v.question_id);

      let query = supabase
        .from('banco_ia')
        .select('*')
        .eq('exam_id', examId)
        .order('veces_usada', { ascending: true });

      if (skillId) query = query.eq('skill_id', skillId);

      const { data: banco } = await query;
      console.log(`[getBanco] banco_ia +${Math.round(performance.now() - t0)}ms → ${banco?.length ?? 0} en banco`);
      if (!banco || banco.length === 0) return [];

      const bancoValidado = STRICT_REVIEWED_BANCO_EXAMS.has(examId)
        ? banco.filter(q => String(q.id || '').startsWith(`ai_${examId}_${REVIEWED_BANCO_VERSION}_`))
        : banco;
      if (bancoValidado.length !== banco.length) {
        console.log(`[getBanco] ${examId} omite ${banco.length - bancoValidado.length} preguntas IA sin validacion estricta`);
      }

      const noVistas = bancoValidado.filter(q => !vistoIds.includes(q.id));
      const selected = noVistas.slice(0, count);
      console.log(`[getBanco] no-vistas=${noVistas.length} seleccionadas=${selected.length} +${Math.round(performance.now() - t0)}ms`);
      return enforceDeterministicQuestionSafetyList(selected.map(q => ({
        id:          q.id,
        skill:       q.skill_id,
        text:        q.text,
        options:     Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
        correct:     q.correct,
        explanation: q.explanation || '',
        aiGenerated: true,
        provider:    q.generado_por?.includes('@') ? 'banco' : 'claude',
        fromBanco:   true,
      })), examId);
    } catch (err) {
      console.warn(`[getBanco] CATCH +${Math.round(performance.now() - t0)}ms:`, err.message);
      return [];
    }
  },

  // ── Diagnóstico dinámico: 2 preguntas por examen desde banco_ia ────────────

  async getDiagnosticQuestions(userEmail, perExam = 2) {
    const EXAMS = ['lectora', 'm1', 'm2', 'historia', 'ciencias'];
    const results = await Promise.all(
      EXAMS.map(async (examId) => {
        // 1. Buscar en banco_ia preguntas no vistas
        const fromBanco = await this.getBancoQuestions(examId, null, userEmail, perExam).catch(() => []);
        const tagged = fromBanco.map(q => ({ ...q, examId }));

        if (tagged.length >= perExam) return tagged.slice(0, perExam);

        const missing = perExam - tagged.length;

        // 2. Generar con IA lo que falta (Supabase Edge Function)
        try {
          const result = await callEdgeFunctionForQuestions(
            { examId, skillId: null, count: missing, userEmail },
            { timeoutMs: 30000, retries: 1 },
          );
          const generated = (result.questions || []).slice(0, missing);
          if (generated.length > 0) {
            if (!result.savedToDb) await saveToBancoIA(generated, examId, null, userEmail);
            return [...tagged, ...generated.map(q => ({ ...q, examId, aiGenerated: true }))];
          }
        } catch (_) { /* IA falló, usar fallback estático */ }

        // 3. Fallback estático (solo si IA también falla)
        const staticFb = getStaticFallbackQuestions(examId, null, missing);
        return [...tagged, ...staticFb.map(q => ({ ...q, examId }))];
      })
    );
    return results.flat();
  },

  // Marcar preguntas del diagnóstico como vistas (multi-examen)
  async markDiagnosticAsSeen(userEmail, questions, answersMap) {
    if (!userEmail || !questions?.length) return;
    try {
      const rows = questions.map(q => ({
        user_email:   userEmail,
        question_id:  q.id,
        exam_id:      q.examId,
        skill_id:     q.skill || 'mixed',
        fue_correcta: answersMap ? (answersMap[q.id] === q.correct) : null,
      }));
      await supabase
        .from('preguntas_vistas')
        .upsert(rows, { onConflict: 'user_email,question_id', ignoreDuplicates: false });
    } catch (_) { /* no crítico */ }
  },

  // Marcar preguntas como vistas (llamar tras servir preguntas al usuario)
  async markQuestionsAsSeen(userEmail, questions, examId) {
    if (!userEmail || !questions?.length) return;
    try {
      const rows = questions.map(q => ({
        user_email:  userEmail,
        question_id: q.id,
        exam_id:     examId,
        skill_id:    q.skill || 'mixed',
        fue_correcta: null,
      }));
      await supabase.from('preguntas_vistas').upsert(rows, { onConflict: 'user_email,question_id', ignoreDuplicates: true });

      // Incrementar contador veces_usada
      const ids = questions.map(q => q.id);
      // Incrementar en lote (mejor esfuerzo)
      await Promise.all(ids.map(id =>
        supabase.rpc('increment_veces_usada', { qid: id }).catch(() => {})
      ));
    } catch (_) { /* no crÃ­tico */ }
  },

  // Actualizar resultado de preguntas (correcta/incorrecta) despuÃ©s de la sesiÃ³n
  async updateQuestionsResults(userEmail, answers) {
    if (!userEmail || !answers?.length) return;
    try {
      await Promise.all(answers.map(a =>
        supabase.from('preguntas_vistas')
          .update({ fue_correcta: a.correct })
          .eq('user_email', userEmail)
          .eq('question_id', a.questionId)
          .catch(() => {})
      ));
    } catch (_) { /* no crÃ­tico */ }
  },

  // ── Admin API ──────────────────────────────────────────────────────────────

  async adminGetStats() {
    const [usrRes, sesRes, bancoRes, todayRes] = await Promise.all([
      supabase.from('usuarios').select('email', { count: 'exact', head: true }),
      supabase.from('sesiones').select('id', { count: 'exact', head: true }),
      supabase.from('banco_ia').select('id', { count: 'exact', head: true }),
      supabase.from('sesiones')
        .select('id', { count: 'exact', head: true })
        .gte('date', new Date().toISOString().split('T')[0]),
    ]);
    return {
      totalUsuarios: usrRes.count ?? 0,
      totalSesiones: sesRes.count ?? 0,
      totalPreguntas: bancoRes.count ?? 0,
      sesionesHoy: todayRes.count ?? 0,
    };
  },

  async adminGetUsuarios({ page = 1, pageSize = 20 } = {}) {
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    const [usrRes, sesRes] = await Promise.all([
      supabase.from('usuarios')
        .select('email, name, picture, school, region, situacion, role, created_at, last_login', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to),
      supabase.from('sesiones').select('user_email'),
    ]);

    if (usrRes.error) throw new Error(usrRes.error.message);

    const sessionCount = {};
    for (const s of sesRes.data || []) {
      sessionCount[s.user_email] = (sessionCount[s.user_email] || 0) + 1;
    }

    const usuarios = (usrRes.data || []).map(u => ({
      ...u,
      sesiones: sessionCount[u.email] || 0,
    }));

    return { usuarios, total: usrRes.count ?? 0 };
  },

  async adminSetUserRole(email, role) {
    const { error } = await supabase
      .from('usuarios')
      .update({ role })
      .eq('email', email);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async adminGetPreguntas({ page = 1, pageSize = 20, examId, skillId } = {}) {
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    let query = supabase
      .from('banco_ia')
      .select('id, exam_id, skill_id, text, correct, explanation, generado_por, fecha, veces_usada', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(from, to);

    if (examId) query = query.eq('exam_id', examId);
    if (skillId) query = query.eq('skill_id', skillId);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { preguntas: data || [], total: count ?? 0 };
  },

  async adminDeletePregunta(id) {
    const { error } = await supabase.from('banco_ia').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async adminGetSesiones({ page = 1, pageSize = 20, examId } = {}) {
    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    let query = supabase
      .from('sesiones')
      .select('id, user_email, exam_id, mode, correct, total, score, date', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to);

    if (examId) query = query.eq('exam_id', examId);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { sesiones: data || [], total: count ?? 0 };
  },

  // ── Universidades y Carreras ───────────────────────────────────────────────

  async getUniversidades() {
    const { data, error } = await supabase
      .from('universidades')
      .select('id, nombre, abbr, tipo, ciudad, acreditacion, descripcion, color, logo')
      .order('tipo')
      .order('nombre');
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getCarrerasByUniversidad(universidadId) {
    const { data, error } = await supabase
      .from('carreras')
      .select('id, nombre, ponderaciones, puntaje_corte, vacantes, anio')
      .eq('universidad_id', universidadId)
      .order('puntaje_corte', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async searchCarreras(query) {
    const { data, error } = await supabase
      .from('carreras')
      .select('id, nombre, puntaje_corte, universidad_id, universidades(nombre, abbr, ciudad)')
      .ilike('nombre', `%${query}%`)
      .order('puntaje_corte', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ── Objetivos académicos ───────────────────────────────────────────────────

  async saveObjetivos(email, objetivoPrincipal, objetivosSecundarios) {
    const { error } = await supabase
      .from('usuarios')
      .update({
        objetivo_principal:    objetivoPrincipal   || null,
        objetivos_secundarios: objetivosSecundarios || [],
      })
      .eq('email', email);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ── Diagnóstico inicial ────────────────────────────────────────────────────

  async saveDiagnostico(email, resultados) {
    // Obtener versión más alta existente
    const { data: existing } = await supabase
      .from('diagnostico')
      .select('version')
      .eq('user_email', email)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

    const { error } = await supabase
      .from('diagnostico')
      .insert({
        user_email:   email,
        resultados,
        version:      nextVersion,
        completed_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);

    // Marcar usuario como con diagnóstico completado
    await supabase
      .from('usuarios')
      .update({ diagnostico_completado: true })
      .eq('email', email);

    return { ok: true, version: nextVersion, completedAt: new Date().toISOString() };
  },

  async getDiagnostico(email) {
    const { data, error } = await supabase
      .from('diagnostico')
      .select('*')
      .eq('user_email', email)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  async completeOnboarding(email, durationSeconds) {
    const update = { onboarding_completado: true };
    if (typeof durationSeconds === 'number') update.onboarding_duration_seconds = durationSeconds;
    const { error } = await supabase
      .from('usuarios')
      .update(update)
      .eq('email', email);
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  // ── Plan de estudio ─── híbrido heurístico + IA opcional ──────────────────

  async generateStudyPlan({ name, progressStats, targets, objetivoPrincipal }) {
    // 1. Motor heurístico determinista (siempre funciona)
    const plan = buildHeuristicStudyPlan({ name, progressStats, targets, objetivoPrincipal });
    if (!plan?.days || plan.days.length !== 7) {
      throw new Error('No se pudo construir el plan semanal.');
    }

    return { ok: true, plan };
  },

  async savePlannerWithContent(email, weekId, planId, progress, planContent) {
    const { error } = await supabase.from('planner').upsert({
      user_email:   email,
      week_id:      weekId       || '',
      plan_id:      planId       || 'standard',
      progress:     progress     || {},
      plan_content: planContent  || null,
      generated_by: planContent?.generatedBy || 'heuristic',
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_email' });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async generateQuestions({ examId, skillId, count, userEmail, forceAI = false }) {
    const T0 = performance.now();
    const label = `[generateQuestions:${examId}:${skillId||'mix'}:n${count}:forceAI=${forceAI}]`;
    console.log(`${label} START`);

    const ctx = EXAM_CONTEXT[examId];
    if (!ctx) throw new Error('examId no reconocido: ' + examId);

    const requested = Math.max(1, Math.min(Number(count) || 5, 120));
    // Lectora/Historia tienen prompts largos. Ciencias/M1/M2 pasan por una
    // auditoria extra de claves, asi que tambien van de a una pregunta.
    const usesStrictReview = STRICT_REVIEWED_BANCO_EXAMS.has(examId);
    const usesSingleQuestionChunks = examId === 'lectora' || examId === 'historia' || usesStrictReview;
    const chunkSize = usesSingleQuestionChunks ? 1 : 3;
    const chunkTimeout = usesStrictReview ? 45000 : usesSingleQuestionChunks ? 30000 : 20000;
    const maxParallelChunks = usesStrictReview ? 3 : 4;

    // Estrategia inteligente:
    // 1) usar primero preguntas no vistas del banco
    // 2) generar con IA el faltante en paralelo (o todo si forceAI=true)
    const bancoQuestions =
      userEmail && !forceAI
        ? await this.getBancoQuestions(examId, skillId, userEmail, requested)
        : [];
    console.log(`${label} getBanco done → fromBanco=${bancoQuestions.length} +${Math.round(performance.now() - T0)}ms`);

    const fromBanco = bancoQuestions.length;
    const missing = forceAI ? requested : Math.max(0, requested - fromBanco);
    const aiQuestions = [];
    const staticQuestions = [];
    let usedStaticFallback = false;

    if (missing > 0) {
      const chunks = [];
      for (let i = 0; i < missing; i += chunkSize) {
        chunks.push(Math.min(chunkSize, missing - i));
      }
      console.log(`${label} chunks=${JSON.stringify(chunks)} -> ${chunks.length} requests, concurrency=${maxParallelChunks}`);

      // Recoge preguntas de chunks exitosos aunque otros fallen, sin disparar
      // demasiadas Edge Functions simultaneas.
      const tAI = performance.now();
      const settled = await runSettledWithConcurrency(
        chunks,
        maxParallelChunks,
        (n, chunkIndex) => callEdgeFunctionForQuestions(
          {
            examId,
            skillId,
            count: n,
            userEmail,
            visualAllowed: shouldAllowVisualResource(examId, chunkIndex, chunks.length),
          },
          { timeoutMs: chunkTimeout, retries: 0 },
        )
      );
      console.log(`${label} allSettled done +${Math.round(performance.now() - tAI)}ms`);

      for (const res of settled) {
        if (res.status === 'fulfilled') {
          aiQuestions.push(...(res.value.questions || []));
        } else {
          console.warn(`${label} chunk REJECTED:`, res.reason?.message);
        }
      }
      console.log(`${label} aiQuestions=${aiQuestions.length} (de ${missing} pedidas) +${Math.round(performance.now() - T0)}ms`);

      if (aiQuestions.length > 0) {
        // Skip saveToBancoIA if the edge function already persisted the questions
        const savedByEdge = settled
          .filter(r => r.status === 'fulfilled')
          .some(r => r.value?.savedToDb === true);
        if (!savedByEdge) {
          saveToBancoIA(aiQuestions, examId, skillId, userEmail).catch(err =>
            console.warn(`${label} saveToBancoIA background error:`, err?.message)
          );
        } else {
          console.log(`${label} banco_ia ya guardado por edge function, skip saveToBancoIA`);
        }
      } else if (fromBanco === 0) {
        // Todos los chunks fallaron y no hay banco: usar estático
        console.warn(`${label} todos los chunks fallaron → static fallback`);
        const staticFallback = getStaticFallbackQuestions(examId, skillId, requested);
        if (staticFallback.length > 0) {
          staticQuestions.push(...staticFallback);
          usedStaticFallback = true;
        } else {
          const firstErr = settled.find(r => r.status === 'rejected');
          throw new Error(firstErr?.reason?.message || 'Error generando preguntas con IA');
        }
      }
    }

    // Si aún faltan preguntas, completar con banco estático sin error
    if (!usedStaticFallback && (fromBanco + aiQuestions.length + staticQuestions.length) < requested) {
      const needed = requested - fromBanco - aiQuestions.length - staticQuestions.length;
      if (needed > 0) {
        console.log(`${label} complementando con ${needed} preguntas estáticas`);
        const staticComplement = getStaticFallbackQuestions(examId, skillId, needed);
        if (staticComplement.length > 0) {
          staticQuestions.push(...staticComplement);
          usedStaticFallback = true;
        }
      }
    }

    const allQuestions = [...bancoQuestions, ...aiQuestions, ...staticQuestions].slice(0, requested);
    console.log(`${label} END total=${allQuestions.length} +${Math.round(performance.now() - T0)}ms (banco=${fromBanco} ai=${aiQuestions.length} static=${staticQuestions.length} staticFallback=${usedStaticFallback})`);

    // Marcar todas como vistas para este usuario
    if (userEmail && allQuestions.length > 0) {
      const tMark = performance.now();
      this.markQuestionsAsSeen(userEmail, allQuestions, examId)
        .then(() => console.log(`${label} markAsSeen done +${Math.round(performance.now() - tMark)}ms`))
        .catch(err => console.warn(`${label} markAsSeen background error:`, err?.message));
    }

    return {
      ok:              true,
      questions:       allQuestions,
      fromBanco:       fromBanco,
      fromAI:          aiQuestions.length,
      fromStatic:      staticQuestions.length,
      requested,
      usedFallbackAI:  !forceAI && fromBanco < requested && aiQuestions.length > 0,
      usedStaticFallback,
      count:           allQuestions.length,
    };
  },
};


