import { useState, useEffect } from 'react';
import { CheckSquare, Square, Calendar, Clock, Zap, RotateCcw, Sparkles, Brain, AlertCircle, Loader2, Target, TrendingUp, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { studyPlanTemplates, exams } from '../data/catalogData';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const EXAM_NAMES = { lectora: 'Comprensión Lectora', m1: 'Matemática M1', m2: 'Matemática M2', historia: 'Historia', ciencias: 'Ciencias' };

function getWeekId() {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function detectWeakAreas(progressStats, targets) {
  return ['lectora', 'm1', 'm2', 'historia', 'ciencias']
    .map(id => {
      const stat   = (progressStats && progressStats[id]) || {};
      const target = (targets && targets[id]) || 700;
      const score  = stat.lastScore || 0;
      const gap    = score ? target - score : 999;
      return { id, score, target, gap, name: EXAM_NAMES[id] };
    })
    .sort((a, b) => b.gap - a.gap);
}

// Calcula el puntaje ponderado estimado para una carrera
function calcPuntajePonderado(progressStats, ponderaciones) {
  if (!ponderaciones) return null;
  let total = 0;
  let weightSum = 0;
  const examMap = { lectora: 'lectora', m1: 'm1', m2: 'm2', historia: 'historia', ciencias: 'ciencias' };
  Object.entries(ponderaciones).forEach(([key, w]) => {
    if (key === 'nem') return; // NEM no lo manejamos aquí
    const examId = examMap[key];
    if (!examId) return;
    const score = progressStats?.[examId]?.lastScore || 0;
    if (score > 0) {
      total += score * w;
      weightSum += w;
    }
  });
  if (weightSum === 0) return null;
  // Ajustar por el peso que falta (asumiendo promedio 600 para exámenes sin datos)
  const totalWeight = Object.entries(ponderaciones).reduce((s, [k, w]) => k !== 'nem' ? s + w : s, 0);
  const missingWeight = totalWeight - weightSum;
  if (missingWeight > 0) total += 600 * missingWeight;
  return Math.round(total);
}

export default function Planner({ onNavigate }) {
  const { planner, savePlannerProgress, user, progressStats } = useAuth();

  const currentWeekId = getWeekId();
  const targets = user?.targets || {};
  const objetivoPrincipal = user?.objetivoPrincipal || null;

  // Modo: 'ai' | 'manual'
  const [mode, setMode] = useState('ai');

  // ── Estado plan IA ──────────────────────────────────────────────────────────
  // Recuperar plan desde DB si existe para la semana actual
  const savedPlanContent = planner.weekId === currentWeekId && planner.planId === 'ai'
    ? planner.planContent
    : null;

  const [aiPlan,    setAiPlan]    = useState(savedPlanContent);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState('');

  // ── Estado plan manual ──────────────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState(
    planner.weekId === currentWeekId && planner.planId !== 'ai' ? planner.planId : 'standard'
  );

  // ── Checkboxes ─────────────────────────────────────────────────────────────
  const [checked, setChecked] = useState(
    planner.weekId === currentWeekId ? planner.progress : {}
  );

  useEffect(() => {
    if (planner.weekId === currentWeekId) {
      setChecked(planner.progress || {});
      // Restaurar modo según planId guardado
      if (planner.planId === 'ai') {
        setMode('ai');
        setAiPlan(planner.planContent || null);
      } else if (planner.planId && planner.planId !== 'ai') {
        setMode('manual');
        setSelectedPlan(planner.planId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planner.weekId]);

  // Plan activo según modo
  const activePlan = mode === 'ai' && aiPlan
    ? aiPlan
    : studyPlanTemplates.find(p => p.id === selectedPlan);

  const allSessions    = (activePlan?.days || []).flatMap((day, di) => (day.sessions || []).map((s, si) => ({ ...s, day: di, si })));
  const totalSessions  = allSessions.length;
  const completedCount = allSessions.filter(s => checked[`${s.day}-${s.si}`]).length;
  const pct            = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  const toggle = (key) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const planId      = mode === 'ai' ? 'ai' : selectedPlan;
      const planContent = mode === 'ai' ? aiPlan : null;
      savePlannerProgress(currentWeekId, planId, next, planContent);
      return next;
    });
  };

  const handleChangePlan = (id) => {
    setSelectedPlan(id);
    setChecked({});
    savePlannerProgress(currentWeekId, id, {}, null);
  };

  const resetWeek = () => {
    setChecked({});
    const planId      = mode === 'ai' ? 'ai' : selectedPlan;
    const planContent = mode === 'ai' ? aiPlan : null;
    savePlannerProgress(currentWeekId, planId, {}, planContent);
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const result = await api.generateStudyPlan({
        name:              user?.name,
        progressStats,
        targets,
        objetivoPrincipal,
      });
      setAiPlan(result.plan);
      setChecked({});
      // Guardar plan content en DB
      savePlannerProgress(currentWeekId, 'ai', {}, result.plan);
    } catch (e) {
      setAiError(e.message || 'No se pudo generar el plan. Verifica tu conexión.');
    } finally {
      setAiLoading(false);
    }
  };

  const weakAreas = detectWeakAreas(progressStats, targets);

  // Calcular brecha con objetivo
  const puntajePonderado = objetivoPrincipal?.ponderaciones
    ? calcPuntajePonderado(progressStats, objetivoPrincipal.ponderaciones)
    : null;
  const brechaObjetivo = puntajePonderado && objetivoPrincipal?.puntaje_corte
    ? objetivoPrincipal.puntaje_corte - puntajePonderado
    : null;

  return (
    <div className="px-4 sm:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="fade-up delay-1">
        <h1 className="font-display text-3xl font-light" style={{ color: '#0c1f3d' }}>
          Planificador <em>de estudio</em>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(12,31,61,0.45)' }}>
          Plan adaptativo basado en tus resultados y objetivos reales
        </p>
      </div>

      {/* Banner objetivo académico */}
      {objetivoPrincipal && (
        <div className="p-4 rounded-2xl fade-up delay-1 flex items-center justify-between gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(12,31,61,0.04), rgba(29,78,216,0.07))', border: '1.5px solid rgba(29,78,216,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(29,78,216,0.12)' }}>
              <Target size={16} style={{ color: '#1d4ed8' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>Objetivo principal</p>
              <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>
                {objetivoPrincipal.carrera_nombre}
              </p>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>
                {objetivoPrincipal.universidad_nombre}
                {objetivoPrincipal.puntaje_corte ? ` · Corte: ${objetivoPrincipal.puntaje_corte} pts` : ''}
              </p>
            </div>
          </div>
          {puntajePonderado !== null && (
            <div className="text-right flex-shrink-0">
              <p className="font-display text-xl font-bold" style={{ color: brechaObjetivo > 0 ? '#ef4444' : '#10b981' }}>
                {puntajePonderado} pts
              </p>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                {brechaObjetivo > 0
                  ? `Faltan ${brechaObjetivo} pts`
                  : '¡Ya superas el corte!'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tabs modo */}
      <div className="flex gap-2 fade-up delay-1">
        {[
          { id: 'ai',     label: 'Plan con IA',  icon: Sparkles },
          { id: 'manual', label: 'Plan manual',   icon: Calendar },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: mode === id ? 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' : 'white',
              color:      mode === id ? 'white' : 'rgba(12,31,61,0.5)',
              boxShadow:  '0 2px 12px rgba(12,31,61,0.06)',
              border:     mode === id ? 'none' : '1.5px solid rgba(12,31,61,0.08)',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ─── MODO IA ─────────────────────────────────────────────────────── */}
      {mode === 'ai' && (
        <>
          {/* Panel análisis de rendimiento */}
          <div className="p-6 rounded-3xl fade-up delay-2"
            style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Brain size={16} style={{ color: '#1d4ed8' }} />
              <h2 className="font-display text-base font-semibold" style={{ color: '#0c1f3d' }}>
                Análisis de tu rendimiento
              </h2>
            </div>

            <div className="space-y-2 mb-5">
              {weakAreas.map(({ id, score, target, gap, name }) => {
                const exam    = exams.find(e => e.id === id);
                const hasData = score > 0;
                const pctFill = hasData ? Math.min(100, Math.round((score / 1000) * 100)) : 0;
                const isWeak  = gap > 50 || !hasData;
                // Ponderal si aplica al objetivo
                const objW = objetivoPrincipal?.ponderaciones?.[id] || 0;
                return (
                  <div key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: isWeak ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)', border: `1px solid ${isWeak ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'}` }}>
                    <span className="text-base flex-shrink-0">{exam?.icon || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{name}</p>
                        <p className="text-xs" style={{ color: hasData ? (isWeak ? '#ef4444' : '#10b981') : 'rgba(12,31,61,0.35)' }}>
                          {hasData ? `${score} / ${target} pts` : 'Sin datos'}
                        </p>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(12,31,61,0.07)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pctFill}%`, background: isWeak ? '#ef4444' : '#10b981' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isWeak && (
                        <span className="text-xs px-1.5 py-0.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          Priorizar
                        </span>
                      )}
                      {objW > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>
                          {Math.round(objW * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón generar */}
            {!aiPlan ? (
              <button
                onClick={handleGenerateAI}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
              >
                {aiLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Generando tu plan personalizado…</>
                  : <><Sparkles size={15} /> Generar plan con IA basado en mis resultados</>
                }
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: aiPlan.generatedBy === 'ai' ? '#10b981' : '#6366f1' }} />
                  <span className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                    {aiPlan.generatedBy === 'ai' ? 'Generado con IA' : 'Generado con motor heurístico'}
                  </span>
                </div>
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                  style={{ color: '#1d4ed8' }}
                >
                  {aiLoading
                    ? <><Loader2 size={12} className="animate-spin" /> Regenerando…</>
                    : <><RotateCcw size={12} /> Regenerar plan</>
                  }
                </button>
              </div>
            )}

            {aiError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#991b1b' }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                {aiError}
              </div>
            )}
          </div>

          {/* Plan IA generado */}
          {aiPlan && (
            <>
              {/* Análisis */}
              <div className="p-5 rounded-2xl fade-up delay-2"
                style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.15)' }}>
                <div className="flex items-start gap-3">
                  <Sparkles size={15} style={{ color: '#1d4ed8', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#1d4ed8' }}>Análisis del plan</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(12,31,61,0.7)' }}>
                      {aiPlan.analysis}
                    </p>
                    {aiPlan.tips && aiPlan.tips.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {aiPlan.tips.map((tip, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'rgba(12,31,61,0.65)' }}>
                            <span style={{ color: '#1d4ed8' }}>•</span> {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <PlanProgress plan={aiPlan} completedCount={completedCount} totalSessions={totalSessions} pct={pct} onReset={resetWeek} />
              <PlanDays plan={aiPlan} checked={checked} onToggle={toggle} />
            </>
          )}

          {/* Estado inicial (sin plan) */}
          {!aiPlan && !aiLoading && (
            <div className="py-10 text-center fade-up delay-3">
              <p className="text-4xl mb-3">🤖</p>
              <p className="font-semibold text-sm" style={{ color: '#0c1f3d' }}>Plan personalizado listo para generar</p>
              <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'rgba(12,31,61,0.45)' }}>
                {objetivoPrincipal
                  ? `El planificador usará tu objetivo en ${objetivoPrincipal.carrera_nombre} para personalizar el plan.`
                  : 'La IA analizará tus resultados reales y creará un plan de 7 días priorizando tus áreas débiles.'}
              </p>
              {!objetivoPrincipal && (
                <button
                  onClick={() => onNavigate?.('settings')}
                  className="mt-3 text-xs font-semibold flex items-center gap-1 mx-auto"
                  style={{ color: '#1d4ed8' }}>
                  Configurar objetivo académico <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── MODO MANUAL ─────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <>
          <div className="grid grid-cols-3 gap-3 fade-up delay-2">
            {studyPlanTemplates.map(p => (
              <button
                key={p.id}
                onClick={() => handleChangePlan(p.id)}
                className="p-4 rounded-2xl text-left transition-all hover:scale-[1.02]"
                style={{
                  background: selectedPlan === p.id ? 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' : 'white',
                  boxShadow:  '0 2px 12px rgba(12,31,61,0.06)',
                  border:     selectedPlan === p.id ? 'none' : '1.5px solid rgba(12,31,61,0.08)',
                }}
              >
                <p className="text-xl mb-1">{p.icon}</p>
                <p className="font-semibold text-sm" style={{ color: selectedPlan === p.id ? 'white' : '#0c1f3d' }}>
                  {p.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: selectedPlan === p.id ? 'rgba(255,255,255,0.55)' : 'rgba(12,31,61,0.45)' }}>
                  {p.hoursPerWeek}h / semana
                </p>
              </button>
            ))}
          </div>

          <PlanProgress plan={activePlan} completedCount={completedCount} totalSessions={totalSessions} pct={pct} onReset={resetWeek} />
          <PlanDays plan={activePlan} checked={checked} onToggle={toggle} />

          <div className="p-5 rounded-2xl fade-up"
            style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.15)' }}>
            <div className="flex items-start gap-3">
              <Zap size={15} style={{ color: '#1d4ed8', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(12,31,61,0.65)' }}>
                <strong style={{ color: '#0c1f3d' }}>Consejo:</strong> El plan manual es genérico para todos los estudiantes.
                Usa el <strong style={{ color: '#1d4ed8' }}>Plan con IA</strong> para un plan basado en tus resultados y objetivo real.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function PlanProgress({ plan, completedCount, totalSessions, pct, onReset }) {
  return (
    <div className="p-6 rounded-3xl fade-up delay-3"
      style={{ background: 'linear-gradient(160deg, #0c1f3d, #1d4ed8)', boxShadow: '0 8px 32px rgba(12,31,61,0.2)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white/50 text-xs">Semana actual · {plan?.name || 'Plan'}</p>
          <p className="font-display text-2xl font-semibold text-white mt-0.5">
            {completedCount} / {totalSessions} sesiones
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold" style={{ color: '#93c5fd' }}>{pct}%</p>
          <p className="text-white/40 text-xs">{plan?.hoursPerWeek || '—'}h planificadas</p>
        </div>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #93c5fd, #60a5fa)' }} />
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
          <RotateCcw size={11} /> Reiniciar semana
        </button>
      </div>
    </div>
  );
}

function PlanDays({ plan, checked, onToggle }) {
  if (!plan?.days) return null;
  return (
    <div className="space-y-4 fade-up delay-4">
      {plan.days.map((day, di) => {
        if (!day.sessions || day.sessions.length === 0) {
          return (
            <div key={di} className="px-5 py-3 rounded-2xl flex items-center gap-3"
              style={{ background: 'white', boxShadow: '0 1px 8px rgba(12,31,61,0.04)', border: '1px solid rgba(12,31,61,0.05)' }}>
              <Calendar size={14} style={{ color: 'rgba(12,31,61,0.2)' }} />
              <p className="text-sm font-medium" style={{ color: 'rgba(12,31,61,0.35)' }}>
                {DAYS[di]} — Descanso
              </p>
            </div>
          );
        }
        const dayDone = day.sessions.every((_, si) => checked[`${di}-${si}`]);
        return (
          <div key={di} className="p-5 rounded-3xl"
            style={{ background: 'white', boxShadow: '0 2px 16px rgba(12,31,61,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: dayDone ? 'rgba(16,185,129,0.12)' : 'rgba(12,31,61,0.06)' }}>
                  <Calendar size={16} style={{ color: dayDone ? '#10b981' : 'rgba(12,31,61,0.4)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#0c1f3d' }}>{DAYS[di]}</p>
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>
                    {day.sessions.length} sesión{day.sessions.length !== 1 ? 'es' : ''} · {day.sessions.reduce((s, ses) => s + (ses.duration || 0), 0)} min
                  </p>
                </div>
              </div>
              {dayDone && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }}>
                  ✓ Completado
                </span>
              )}
            </div>
            <div className="space-y-2">
              {day.sessions.map((session, si) => {
                const key  = `${di}-${si}`;
                const done = !!checked[key];
                const exam = exams.find(e => e.id === session.examId);
                return (
                  <button key={si} onClick={() => onToggle(key)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                    style={{
                      background: done ? 'rgba(16,185,129,0.07)' : '#f8faff',
                      border:     done ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(12,31,61,0.06)',
                    }}
                  >
                    {done
                      ? <CheckSquare size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                      : <Square      size={18} style={{ color: 'rgba(12,31,61,0.25)', flexShrink: 0 }} />}
                    <span className="text-lg flex-shrink-0">{exam?.icon || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate"
                        style={{ color: done ? '#065f46' : '#0c1f3d', textDecoration: done ? 'line-through' : 'none' }}>
                        {session.topic}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>
                        {exam?.name || 'General'} · {session.duration} min
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'rgba(12,31,61,0.3)' }}>
                      <Clock size={11} />
                      <span className="text-xs">{session.duration}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
