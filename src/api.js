// ── Cliente Supabase ────────────────────────────────────────────────────────
import { supabase } from './lib/supabase';
import { createDiagnosticSessions } from './lib/progress';
import { questionsBySkill } from './data/catalogSource';

const DEFAULT_TARGETS = { lectora: 700, m1: 700, m2: 680, historia: 690, ciencias: 710 };

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
  });

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Warm-up delay: si es un reintento por cold-start, esperar 1.5s
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body,
        signal: controller.signal,
      });

      const data = await resp.json();
      if (data.error) {
        lastError = new Error(data.error);
        // 500 en intento 0 → probablemente cold start, reintentar
        if (resp.status === 500 && attempt < retries) continue;
        throw lastError;
      }
      return data;
    } catch (err) {
      lastError = err.name === 'AbortError'
        ? new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s). Revisa tu conexión.`)
        : err;
      if (attempt < retries) continue;
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
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

async function saveToBancoIA(questions, examId, skillId, userEmail) {
  try {
    const rows = questions.map(q => ({
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
    if (error) console.warn('[saveToBancoIA] insert error:', error.code, error.message);
  } catch (err) {
    console.warn('[saveToBancoIA] exception:', err.message);
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
      skill_id: skillId || null,
      question_ids: questionIds || [],
      wrong_ids: wrongIds || [],
      security_events: securityEvents || [],
      security_warnings: securityWarnings || 0,
    };

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
    try {
      // Ids ya vistos por este usuario en este examen
      const { data: vistas } = await supabase
        .from('preguntas_vistas')
        .select('question_id')
        .eq('user_email', userEmail)
        .eq('exam_id', examId);

      const vistoIds = (vistas || []).map(v => v.question_id);

      // Buscar preguntas disponibles en banco_ia
      let query = supabase
        .from('banco_ia')
        .select('*')
        .eq('exam_id', examId)
        .order('veces_usada', { ascending: true });

      if (skillId) query = query.eq('skill_id', skillId);

      const { data: banco } = await query;
      if (!banco || banco.length === 0) return [];

      // Filtrar las no vistas
      const noVistas = banco.filter(q => !vistoIds.includes(q.id));

      // Seleccionar hasta `count` preguntas, priorizando las menos usadas
      const selected = noVistas.slice(0, count);
      return selected.map(q => ({
        id:          q.id,
        skill:       q.skill_id,
        text:        q.text,
        options:     Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
        correct:     q.correct,
        explanation: q.explanation || '',
        aiGenerated: true,
        provider:    q.generado_por?.includes('@') ? 'banco' : 'claude',
        fromBanco:   true,
      }));
    } catch (_) {
      return [];
    }
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

  async completeOnboarding(email) {
    const { error } = await supabase
      .from('usuarios')
      .update({ onboarding_completado: true })
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
    const ctx = EXAM_CONTEXT[examId];
    if (!ctx) throw new Error('examId no reconocido: ' + examId);

    const requested = Math.max(1, Math.min(Number(count) || 5, 120));
    const gasChunkSize = 3; // Edge Function cap: máx 3 por llamada

    // Estrategia inteligente:
    // 1) usar primero preguntas no vistas del banco
    // 2) generar con IA SOLO el faltante (o todo si forceAI=true)
    const bancoQuestions =
      userEmail && !forceAI
        ? await this.getBancoQuestions(examId, skillId, userEmail, requested)
        : [];

    const fromBanco = bancoQuestions.length;
    let missing = forceAI ? requested : Math.max(0, requested - fromBanco);
    const aiQuestions = [];

    let usedStaticFallback = false;
    while (missing > 0) {
      const chunk = Math.min(gasChunkSize, missing);
      try {
        const result = await callEdgeFunctionForQuestions({
          examId,
          skillId,
          count: chunk,
          userEmail,
        });
        const generated = result.questions || [];
        if (generated.length === 0) break;

        aiQuestions.push(...generated);
        await saveToBancoIA(generated, examId, skillId, userEmail);
        missing -= generated.length;

        // Parar solo si no se generó nada (evitar loop infinito).
        if (generated.length === 0) break;
      } catch (e) {
        // Si no hay preguntas de banco ni IA, usar banco estático como fallback
        if (fromBanco === 0 && aiQuestions.length === 0) {
          const staticFallback = getStaticFallbackQuestions(examId, skillId, requested);
          if (staticFallback.length > 0) {
            aiQuestions.push(...staticFallback);
            usedStaticFallback = true;
            missing = 0;
            break;
          }
          // Si tampoco hay estáticas, lanzar error original (sin el mensaje de timeout)
          const msg = e.message;
          throw new Error(msg);
        }
        break;
      }
    }

    // Si aún faltan preguntas, completar con banco estático sin error
    if (missing > 0 && !usedStaticFallback) {
      const needed = requested - fromBanco - aiQuestions.length;
      if (needed > 0) {
        const staticComplement = getStaticFallbackQuestions(examId, skillId, needed);
        if (staticComplement.length > 0) {
          aiQuestions.push(...staticComplement);
          usedStaticFallback = true;
        }
      }
    }

    const allQuestions = [...bancoQuestions, ...aiQuestions].slice(0, requested);

    // Marcar todas como vistas para este usuario
    if (userEmail && allQuestions.length > 0) {
      await this.markQuestionsAsSeen(userEmail, allQuestions, examId);
    }

    return {
      ok:              true,
      questions:       allQuestions,
      fromBanco:       fromBanco,
      fromAI:          aiQuestions.length,
      requested,
      usedFallbackAI:  !forceAI && fromBanco < requested && aiQuestions.length > 0,
      usedStaticFallback,
      count:           allQuestions.length,
    };
  },
};


