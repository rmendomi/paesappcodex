import { useState, useEffect, useRef } from 'react';
import { CheckCircle, ChevronRight, ChevronLeft, Search, Sparkles, Brain, Target, BookOpen, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// ── Fallback estático si banco_ia no tiene preguntas (2 por examen = 10) ───
const FALLBACK_QUESTIONS = [
  // LECTORA
  {
    id: 'd_lect_1', examId: 'lectora',
    text: 'Lee el siguiente texto:\n\n"La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar, el dióxido de carbono y el agua en glucosa y oxígeno. Este proceso ocurre principalmente en los cloroplastos, orgánulos que contienen clorofila, el pigmento responsable del color verde de las plantas."\n\n¿En qué orgánulo ocurre principalmente la fotosíntesis?',
    options: ['En el núcleo.', 'En las mitocondrias.', 'En los ribosomas.', 'En los cloroplastos.'],
    correct: 3,
  },
  {
    id: 'd_lect_2', examId: 'lectora',
    text: 'Lee el siguiente texto:\n\n"El escritor chileno Pablo Neruda nació en Parral en 1904 y murió en Santiago en 1973. Obtuvo el Premio Nobel de Literatura en 1971, convirtiéndose en uno de los poetas más reconocidos del siglo XX."\n\n¿En qué año obtuvo Pablo Neruda el Premio Nobel de Literatura?',
    options: ['1904', '1960', '1971', '1973'],
    correct: 2,
  },
  // MATEMÁTICA M1
  {
    id: 'd_m1_1', examId: 'm1',
    text: 'Si 3x + 6 = 21, ¿cuánto vale x?',
    options: ['3', '5', '7', '9'],
    correct: 1,
  },
  {
    id: 'd_m1_2', examId: 'm1',
    text: 'Un estudiante respondió correctamente 18 de 24 preguntas. ¿Qué porcentaje de preguntas respondió correctamente?',
    options: ['65%', '70%', '75%', '80%'],
    correct: 2,
  },
  // MATEMÁTICA M2
  {
    id: 'd_m2_1', examId: 'm2',
    text: 'Si f(x) = 2x² - 3x + 1, ¿cuánto vale f(2)?',
    options: ['1', '3', '5', '7'],
    correct: 1,
  },
  {
    id: 'd_m2_2', examId: 'm2',
    text: 'El valor de log₂(8) es:',
    options: ['2', '3', '4', '8'],
    correct: 1,
  },
  // HISTORIA
  {
    id: 'd_hist_1', examId: 'historia',
    text: '¿En qué año se independizó Chile de España?',
    options: ['1810', '1818', '1823', '1830'],
    correct: 1,
  },
  {
    id: 'd_hist_2', examId: 'historia',
    text: '¿Cuál fue el principal objetivo del Golpe de Estado de 1973 en Chile?',
    options: [
      'Defender la constitución vigente.',
      'Derrocar al gobierno de Salvador Allende.',
      'Llamar a elecciones anticipadas.',
      'Crear una nueva constitución democrática.',
    ],
    correct: 1,
  },
  // CIENCIAS
  {
    id: 'd_cien_1', examId: 'ciencias',
    text: 'El ADN se encuentra principalmente en:',
    options: ['Las mitocondrias.', 'El citoplasma.', 'El núcleo celular.', 'El retículo endoplásmico.'],
    correct: 2,
  },
  {
    id: 'd_cien_2', examId: 'ciencias',
    text: 'Según la Ley de Newton, si se aplica una fuerza neta de 10 N sobre un objeto de 2 kg, ¿cuál es su aceleración?',
    options: ['2 m/s²', '5 m/s²', '10 m/s²', '20 m/s²'],
    correct: 1,
  },
];

// ── Regiones de Chile ────────────────────────────────────────────────────────
const REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble',
  'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
];

// ── Preguntas por examen en el diagnóstico (ajusta aquí) ────────────────────
const DIAGNOSTIC_PER_EXAM = 2; // banco_ia entrega este número por cada una de las 5 pruebas


const EXAM_NAMES = {
  lectora:  'Comprensión Lectora',
  m1:       'Matemática M1',
  m2:       'Matemática M2',
  historia: 'Historia',
  ciencias: 'Ciencias',
};
const EXAM_ICONS = { lectora: '📖', m1: '📐', m2: '∑', historia: '🌎', ciencias: '🧬' };

// Puntaje estimado basado en correctas/total (escala PAES aprox.)
function estimarPuntaje(correct, total) {
  if (total === 0) return 500;
  const pct = correct / total;
  // 0% → ~350, 50% → ~550, 100% → ~750
  return Math.round(350 + pct * 400);
}

const STEPS = ['bienvenida', 'diagnostico', 'objetivos', 'resumen'];

export default function Onboarding({ onComplete }) {
  const { user, saveDiagnostico, saveObjetivos, completeOnboarding, updateProfile } = useAuth();

  const onboardingStartRef = useRef(Date.now());
  const [step, setStep] = useState('bienvenida');

  // ── Región / colegio (solo egresados) ───────────────────────────────────────
  const [selectedRegion,   setSelectedRegion]   = useState(user?.region || '');
  const [colegios,         setColegios]         = useState([]);
  const [loadingColegios,  setLoadingColegios]  = useState(false);
  const [selectedColegioId, setSelectedColegioId] = useState(user?.colegioId || '');
  const [colegioSearch,    setColegioSearch]    = useState('');

  // ── Diagnóstico ─────────────────────────────────────────────────────────────
  const [diagQuestions, setDiagQuestions] = useState([]);  // cargadas desde banco_ia
  const [loadingDiag,   setLoadingDiag]   = useState(false);
  const [diagAnswers, setDiagAnswers]   = useState({});  // { questionId: selectedIndex }
  const [diagStep, setDiagStep]         = useState(0);   // pregunta actual
  const [diagCompleted, setDiagCompleted] = useState(false);
  const [diagResults, setDiagResults]   = useState(null);
  const [diagStarted,  setDiagStarted]  = useState(false);

  // ── Objetivos ───────────────────────────────────────────────────────────────
  const [universidades,    setUniversidades]    = useState([]);
  const [loadingUnis,      setLoadingUnis]      = useState(false);
  const [selectedUniId,    setSelectedUniId]    = useState('');
  const [carreras,         setCarreras]         = useState([]);
  const [loadingCarreras,  setLoadingCarreras]  = useState(false);
  const [selectedCarrera,  setSelectedCarrera]  = useState(null);  // objeto carrera completo
  const [uniSearch,        setUniSearch]        = useState('');

  // Secundarios: hasta 2
  const [secundarios, setSecundarios] = useState([null, null]);
  const [secStep,     setSecStep]     = useState(0);   // 0 = primer secundario, 1 = segundo
  const [secUniId,    setSecUniId]    = useState('');
  const [secCarreras, setSecCarreras] = useState([]);
  const [secUniSearch, setSecUniSearch] = useState('');
  const [addingSecundario, setAddingSecundario] = useState(false);

  // ── Generación ──────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  // Cargar preguntas del diagnóstico desde banco_ia al entrar al paso
  useEffect(() => {
    if (step !== 'diagnostico' || diagQuestions.length > 0) return;
    if (!user?.email) return;
    setLoadingDiag(true);
    api.getDiagnosticQuestions(user.email, DIAGNOSTIC_PER_EXAM)
      .then(qs => setDiagQuestions(qs.length > 0 ? qs : FALLBACK_QUESTIONS))
      .catch(() => setDiagQuestions(FALLBACK_QUESTIONS))
      .finally(() => setLoadingDiag(false));
  }, [step, user?.email]);

  // Cargar colegios cuando el egresado selecciona una región
  useEffect(() => {
    if (!selectedRegion) { setColegios([]); setSelectedColegioId(''); return; }
    setLoadingColegios(true);
    api.getColegiosByRegion(selectedRegion)
      .then(setColegios)
      .catch(() => setColegios([]))
      .finally(() => setLoadingColegios(false));
  }, [selectedRegion]);

  // Cargar universidades al entrar al paso de objetivos
  useEffect(() => {
    if (step !== 'objetivos') return;
    setLoadingUnis(true);
    api.getUniversidades()
      .then(setUniversidades)
      .catch(() => setUniversidades([]))
      .finally(() => setLoadingUnis(false));
  }, [step]);

  // Cargar carreras al seleccionar universidad
  useEffect(() => {
    if (!selectedUniId) { setCarreras([]); return; }
    setLoadingCarreras(true);
    api.getCarrerasByUniversidad(selectedUniId)
      .then(setCarreras)
      .catch(() => setCarreras([]))
      .finally(() => setLoadingCarreras(false));
  }, [selectedUniId]);

  // Cargar carreras de secundario
  useEffect(() => {
    if (!secUniId) { setSecCarreras([]); return; }
    api.getCarrerasByUniversidad(secUniId)
      .then(setSecCarreras)
      .catch(() => setSecCarreras([]));
  }, [secUniId]);

  // ── Handlers diagnóstico ─────────────────────────────────────────────────────
  const handleDiagAnswer = (questionId, idx) => {
    setDiagAnswers(prev => ({ ...prev, [questionId]: idx }));
  };

  const handleDiagNext = () => {
    if (diagStep < diagQuestions.length - 1) {
      setDiagStep(s => s + 1);
    } else {
      // Calcular resultados por examen
      const byExam = {};
      diagQuestions.forEach(q => {
        if (!byExam[q.examId]) byExam[q.examId] = { correct: 0, total: 0 };
        byExam[q.examId].total += 1;
        if (diagAnswers[q.id] === q.correct) byExam[q.examId].correct += 1;
      });
      const results = {};
      Object.entries(byExam).forEach(([examId, { correct, total }]) => {
        results[examId] = { correct, total, score_estimado: estimarPuntaje(correct, total) };
      });
      setDiagResults(results);
      setDiagCompleted(true);
      // Marcar preguntas como vistas en preguntas_vistas
      if (user?.email) {
        api.markDiagnosticAsSeen(user.email, diagQuestions, diagAnswers);
      }
    }
  };

  // ── Handlers objetivos ────────────────────────────────────────────────────────
  const unisFiltradas = universidades.filter(u =>
    u.nombre.toLowerCase().includes(uniSearch.toLowerCase()) ||
    u.abbr?.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const uniSeleccionada = universidades.find(u => u.id === selectedUniId);

  const addSecundario = (carrera, uniId) => {
    const uni = universidades.find(u => u.id === uniId);
    const objetivo = {
      carrera_id:         carrera.id,
      universidad_id:     uniId,
      carrera_nombre:     carrera.nombre,
      universidad_nombre: uni?.nombre || uniId,
      puntaje_corte:      carrera.puntaje_corte,
      ponderaciones:      carrera.ponderaciones,
    };
    setSecundarios(prev => {
      const next = [...prev];
      next[secStep] = objetivo;
      return next;
    });
    setAddingSecundario(false);
    setSecUniId('');
    setSecCarreras([]);
    setSecUniSearch('');
  };

  const removeSecundario = (idx) => {
    setSecundarios(prev => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  // ── Finalizar onboarding ──────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // Guardar región/colegio si es egresado
      if (user?.situacion === 'egresado' && selectedRegion) {
        await updateProfile({ region: selectedRegion, colegioId: selectedColegioId || null });
      }

      // Guardar diagnóstico
      if (diagResults) {
        await saveDiagnostico(diagResults);
      }

      // Guardar objetivos
      const uni = universidades.find(u => u.id === selectedUniId);
      const principal = selectedCarrera
        ? {
            carrera_id:         selectedCarrera.id,
            universidad_id:     selectedUniId,
            carrera_nombre:     selectedCarrera.nombre,
            universidad_nombre: uni?.nombre || selectedUniId,
            puntaje_corte:      selectedCarrera.puntaje_corte,
            ponderaciones:      selectedCarrera.ponderaciones,
          }
        : null;

      const secFiltrados = secundarios.filter(Boolean);
      await saveObjetivos(principal, secFiltrados);

      // Marcar onboarding completado + guardar duración
      const durationSeconds = Math.round((Date.now() - onboardingStartRef.current) / 1000);
      await completeOnboarding(durationSeconds);

      onComplete();
    } catch (err) {
      setSaveError(err.message || 'Error al guardar. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const currentQ = diagQuestions[diagStep];
  const answered  = diagAnswers[currentQ?.id] !== undefined;
  const isEgresado = user?.situacion === 'egresado';
  const canStartDiag = !isEgresado || !!selectedRegion;

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'linear-gradient(160deg, #f8faff 0%, #eff6ff 100%)' }}>
      <div className="w-full max-w-2xl">

        {/* Barra de progreso */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: STEPS.indexOf(step) >= i ? 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' : 'rgba(12,31,61,0.1)',
                  color:      STEPS.indexOf(step) >= i ? 'white' : 'rgba(12,31,61,0.35)',
                }}>
                {STEPS.indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-0.5 flex-1 rounded"
                  style={{ background: STEPS.indexOf(step) > i ? '#1d4ed8' : 'rgba(12,31,61,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── PASO 1: BIENVENIDA ── */}
        {step === 'bienvenida' && (
          <div className="p-8 rounded-3xl text-center"
            style={{ background: 'white', boxShadow: '0 4px 40px rgba(12,31,61,0.1)' }}>
            <div className="text-5xl mb-4">🎓</div>
            <h1 className="font-display text-2xl font-semibold mb-2" style={{ color: '#0c1f3d' }}>
              ¡Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(12,31,61,0.6)' }}>
              Antes de comenzar, vamos a hacer dos cosas rápidas para personalizar tu experiencia:
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8 text-left">
              {[
                { icon: Brain, title: 'Diagnóstico inicial', desc: `${DIAGNOSTIC_PER_EXAM * 5} preguntas para medir tu nivel actual en cada prueba PAES.` },
                { icon: Target, title: 'Tu objetivo académico', desc: 'Elige la carrera y universidad que quieres alcanzar.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-4 rounded-2xl" style={{ background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.12)' }}>
                  <Icon size={18} style={{ color: '#1d4ed8', marginBottom: 8 }} />
                  <p className="text-sm font-semibold mb-1" style={{ color: '#0c1f3d' }}>{title}</p>
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.55)' }}>{desc}</p>
                </div>
              ))}
            </div>
            {/* Región y colegio — solo para egresados */}
            {isEgresado && (
              <div className="mb-6 p-4 rounded-2xl text-left"
                style={{ background: 'rgba(29,78,216,0.04)', border: '1.5px solid rgba(29,78,216,0.12)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#0c1f3d' }}>
                  Antes de continuar, cuéntanos un poco más
                </p>

                {/* Región (obligatorio) */}
                <label className="block text-xs mb-1" style={{ color: 'rgba(12,31,61,0.6)' }}>
                  Región <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={selectedRegion}
                  onChange={e => { setSelectedRegion(e.target.value); setSelectedColegioId(''); setColegioSearch(''); }}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3"
                  style={{ background: 'white', border: `1.5px solid ${selectedRegion ? '#1d4ed8' : 'rgba(12,31,61,0.12)'}`, color: '#0c1f3d' }}
                >
                  <option value="">Selecciona tu región…</option>
                  {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {/* Colegio (opcional) */}
                {selectedRegion && (
                  <>
                    <label className="block text-xs mb-1" style={{ color: 'rgba(12,31,61,0.6)' }}>
                      Colegio donde egresaste <span style={{ color: 'rgba(12,31,61,0.35)' }}>(opcional)</span>
                    </label>
                    {loadingColegios ? (
                      <div className="text-center py-2"><Loader2 size={14} className="animate-spin inline" style={{ color: '#1d4ed8' }} /></div>
                    ) : (
                      <>
                        <div className="relative mb-1">
                          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(12,31,61,0.4)' }} />
                          <input
                            value={colegioSearch}
                            onChange={e => setColegioSearch(e.target.value)}
                            placeholder="Buscar colegio…"
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
                            style={{ background: 'white', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
                          />
                        </div>
                        {selectedColegioId && (
                          <p className="text-xs mb-1" style={{ color: '#1d4ed8' }}>
                            ✓ {colegios.find(c => c.id === selectedColegioId)?.nombre}
                            <button onClick={() => { setSelectedColegioId(''); setColegioSearch(''); }}
                              className="ml-2" style={{ color: 'rgba(12,31,61,0.4)' }}>✕</button>
                          </p>
                        )}
                        {!selectedColegioId && colegioSearch && (
                          <div className="max-h-28 overflow-y-auto rounded-xl border"
                            style={{ borderColor: 'rgba(12,31,61,0.08)', background: 'white' }}>
                            {colegios
                              .filter(c => c.nombre.toLowerCase().includes(colegioSearch.toLowerCase()))
                              .slice(0, 6)
                              .map(c => (
                                <button key={c.id}
                                  onClick={() => { setSelectedColegioId(c.id); setColegioSearch(''); }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors"
                                  style={{ color: '#0c1f3d' }}>
                                  {c.nombre}
                                  <span className="ml-1" style={{ color: 'rgba(12,31,61,0.4)' }}>— {c.comuna}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setStep('diagnostico')}
              disabled={!canStartDiag}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
            >
              Comenzar diagnóstico <ChevronRight size={14} className="inline ml-1" />
            </button>
            <button
              onClick={handleFinish}
              className="mt-3 text-xs w-full text-center"
              style={{ color: 'rgba(12,31,61,0.4)' }}
            >
              Saltar por ahora y configurar después
            </button>
          </div>
        )}

        {/* ── MODAL DE INICIO DE DIAGNÓSTICO ── */}
        {step === 'diagnostico' && !diagCompleted && !loadingDiag && currentQ && !diagStarted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(12,31,61,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-lg rounded-3xl p-8"
              style={{ background: 'white', boxShadow: '0 30px 80px rgba(12,31,61,0.15)', border: '1px solid rgba(12,31,61,0.06)' }}>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(29,78,216,0.1)' }}>
                  <Brain size={22} style={{ color: '#1d4ed8' }} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold" style={{ color: '#0c1f3d' }}>
                    Diagnóstico inicial
                  </h2>
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                    {diagQuestions.length} preguntas · 5 exámenes PAES
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl mb-4"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#92400e' }}>
                  Recuerda: responder con IA no te ayuda. En la PAES real no tendrás una IA al lado;
                  si hoy haces trampa, después no sabrás hacerlo solo.{' '}
                  <strong>Te haces un daño.</strong>
                </p>
              </div>

              <div className="p-4 rounded-2xl mb-6"
                style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.08)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(12,31,61,0.6)' }}>
                  Responde con honestidad: usaremos tus resultados para identificar tus áreas de mayor
                  oportunidad y personalizar tu plan de estudio.
                </p>
              </div>

              <button
                onClick={() => setDiagStarted(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}>
                <Brain size={15} />
                Comenzar diagnóstico
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: DIAGNÓSTICO ── */}
        {step === 'diagnostico' && !diagCompleted && (
          <div className="p-8 rounded-3xl"
            style={{ background: 'white', boxShadow: '0 4px 40px rgba(12,31,61,0.1)' }}>

            {/* Cargando preguntas */}
            {loadingDiag && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={28} className="animate-spin" style={{ color: '#1d4ed8' }} />
                <p className="text-sm" style={{ color: 'rgba(12,31,61,0.5)' }}>Preparando tu diagnóstico…</p>
              </div>
            )}

            {/* Contenido de la pregunta (oculto mientras carga) */}
            {!loadingDiag && currentQ && (<>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Brain size={18} style={{ color: '#1d4ed8' }} />
                  <h2 className="font-display text-lg font-semibold" style={{ color: '#0c1f3d' }}>
                    Diagnóstico inicial
                  </h2>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-xl"
                  style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}>
                  {diagStep + 1} / {diagQuestions.length}
                </span>
              </div>

              {/* Progreso */}
              <div className="h-1.5 rounded-full mb-6" style={{ background: 'rgba(12,31,61,0.07)' }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${(diagStep / diagQuestions.length) * 100}%`, background: '#1d4ed8' }} />
              </div>

              {/* Badge examen */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl mb-4"
                style={{ background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)' }}>
                <span>{EXAM_ICONS[currentQ.examId]}</span>
                <span className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                  {EXAM_NAMES[currentQ.examId]}
                </span>
              </div>

              {/* Pregunta */}
              <p className="text-sm leading-relaxed mb-6 whitespace-pre-line" style={{ color: '#0c1f3d' }}>
                {currentQ.text}
              </p>

              {/* Opciones */}
              <div className="space-y-2 mb-6">
                {currentQ.options.map((opt, idx) => {
                  const selected = diagAnswers[currentQ.id] === idx;
                  return (
                    <button key={idx}
                      onClick={() => handleDiagAnswer(currentQ.id, idx)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all hover:scale-[1.01]"
                      style={{
                        background: selected ? 'rgba(29,78,216,0.1)' : '#f8faff',
                        border:     selected ? '1.5px solid #1d4ed8' : '1.5px solid rgba(12,31,61,0.08)',
                        color:      selected ? '#1d4ed8' : '#0c1f3d',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: selected ? '#1d4ed8' : 'rgba(12,31,61,0.07)',
                          color:      selected ? 'white' : 'rgba(12,31,61,0.5)',
                        }}>
                        {['A', 'B', 'C', 'D', 'E'][idx]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                {diagStep > 0 && (
                  <button onClick={() => setDiagStep(s => s - 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.08)', color: 'rgba(12,31,61,0.6)' }}>
                    <ChevronLeft size={14} /> Anterior
                  </button>
                )}
                <button
                  onClick={handleDiagNext}
                  disabled={!answered}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
                >
                  {diagStep < diagQuestions.length - 1
                    ? <><ChevronRight size={14} /> Siguiente</>
                    : <><CheckCircle size={14} /> Ver resultados</>
                  }
                </button>
              </div>
            </>)}
          </div>
        )}

        {/* ── RESULTADOS DIAGNÓSTICO ── */}
        {step === 'diagnostico' && diagCompleted && diagResults && (
          <div className="p-8 rounded-3xl"
            style={{ background: 'white', boxShadow: '0 4px 40px rgba(12,31,61,0.1)' }}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">📊</div>
              <h2 className="font-display text-xl font-semibold mb-1" style={{ color: '#0c1f3d' }}>
                Resultados del diagnóstico
              </h2>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Puntaje estimado basado en tus respuestas
              </p>
            </div>
            <div className="space-y-3 mb-6">
              {Object.entries(diagResults).map(([examId, { correct, total, score_estimado }]) => {
                const pct = Math.round((correct / total) * 100);
                const isGood = pct >= 50;
                return (
                  <div key={examId} className="p-4 rounded-2xl"
                    style={{ background: isGood ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${isGood ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{EXAM_ICONS[examId]}</span>
                        <span className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>
                          {EXAM_NAMES[examId]}
                        </span>
                      </div>
                      <span className="font-display text-lg font-bold" style={{ color: isGood ? '#10b981' : '#ef4444' }}>
                        ~{score_estimado} pts
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(12,31,61,0.07)' }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: isGood ? '#10b981' : '#ef4444' }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'rgba(12,31,61,0.45)' }}>
                      {correct}/{total} correctas
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mb-5 p-3 rounded-xl text-center"
              style={{ background: 'rgba(29,78,216,0.05)', color: 'rgba(12,31,61,0.5)', border: '1px solid rgba(29,78,216,0.1)' }}>
              Estos puntajes son estimaciones orientativas basadas en {DIAGNOSTIC_PER_EXAM} preguntas por prueba. Tu puntaje real se calcularía con el examen completo.
            </p>
            <button
              onClick={() => setStep('objetivos')}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
            >
              Seleccionar mi objetivo académico <ChevronRight size={14} className="inline ml-1" />
            </button>
          </div>
        )}

        {/* ── PASO 3: OBJETIVOS ── */}
        {step === 'objetivos' && (
          <div className="p-8 rounded-3xl"
            style={{ background: 'white', boxShadow: '0 4px 40px rgba(12,31,61,0.1)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} style={{ color: '#1d4ed8' }} />
              <h2 className="font-display text-lg font-semibold" style={{ color: '#0c1f3d' }}>
                Objetivo académico principal
              </h2>
            </div>
            <p className="text-xs mb-6" style={{ color: 'rgba(12,31,61,0.5)' }}>
              ¿A qué carrera y universidad quieres postular?
            </p>

            {/* Buscador universidad */}
            {!selectedCarrera && (
              <>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(12,31,61,0.4)' }} />
                  <input
                    value={uniSearch}
                    onChange={e => { setUniSearch(e.target.value); setSelectedUniId(''); setSelectedCarrera(null); }}
                    placeholder="Buscar universidad…"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
                  />
                </div>

                {loadingUnis ? (
                  <div className="text-center py-6"><Loader2 size={18} className="animate-spin inline" style={{ color: '#1d4ed8' }} /></div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
                    {unisFiltradas.map(u => (
                      <button key={u.id}
                        onClick={() => { setSelectedUniId(u.id); setUniSearch(''); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                        style={{
                          background: selectedUniId === u.id ? 'rgba(29,78,216,0.1)' : '#f8faff',
                          border:     selectedUniId === u.id ? '1.5px solid #1d4ed8' : '1.5px solid rgba(12,31,61,0.06)',
                        }}>
                        <span className="text-xl flex-shrink-0">{u.logo}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#0c1f3d' }}>{u.nombre}</p>
                          <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                            {u.tipo} · {u.ciudad} · {u.acreditacion} años acred.
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Carreras */}
            {selectedUniId && !selectedCarrera && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => { setSelectedUniId(''); setCarreras([]); }}
                    className="text-xs" style={{ color: '#1d4ed8' }}>
                    ← {uniSeleccionada?.abbr || 'Universidad'}
                  </button>
                  <span className="text-xs" style={{ color: 'rgba(12,31,61,0.3)' }}>/</span>
                  <span className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>Carreras</span>
                </div>
                {loadingCarreras ? (
                  <div className="text-center py-4"><Loader2 size={16} className="animate-spin inline" style={{ color: '#1d4ed8' }} /></div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {carreras.map(c => (
                      <button key={c.id}
                        onClick={() => setSelectedCarrera(c)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                        style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.06)' }}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>{c.nombre}</p>
                          <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                            Corte: {c.puntaje_corte} pts · {c.vacantes} vacantes
                          </p>
                        </div>
                        <ChevronRight size={14} style={{ color: 'rgba(12,31,61,0.3)' }} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Objetivo seleccionado */}
            {selectedCarrera && (
              <div className="p-4 rounded-2xl mb-4"
                style={{ background: 'rgba(29,78,216,0.07)', border: '1.5px solid rgba(29,78,216,0.2)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>{selectedCarrera.nombre}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(12,31,61,0.55)' }}>
                      {uniSeleccionada?.nombre} · Corte: {selectedCarrera.puntaje_corte} pts
                    </p>
                  </div>
                  <button onClick={() => setSelectedCarrera(null)} className="p-1">
                    <X size={14} style={{ color: 'rgba(12,31,61,0.35)' }} />
                  </button>
                </div>
              </div>
            )}

            {/* Objetivos secundarios */}
            <div className="border-t pt-4 mt-4" style={{ borderColor: 'rgba(12,31,61,0.08)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(12,31,61,0.6)' }}>
                Opciones secundarias (hasta 2, opcional)
              </p>
              {secundarios.map((sec, idx) => sec ? (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl mb-2"
                  style={{ background: 'rgba(12,31,61,0.04)', border: '1px solid rgba(12,31,61,0.08)' }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{sec.carrera_nombre}</p>
                    <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>{sec.universidad_nombre}</p>
                  </div>
                  <button onClick={() => removeSecundario(idx)}>
                    <X size={13} style={{ color: 'rgba(12,31,61,0.35)' }} />
                  </button>
                </div>
              ) : null)}

              {secundarios.filter(Boolean).length < 2 && !addingSecundario && (
                <button
                  onClick={() => { setAddingSecundario(true); setSecStep(secundarios.filter(Boolean).length); }}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: '#1d4ed8' }}>
                  + Agregar opción secundaria
                </button>
              )}

              {addingSecundario && (
                <div className="mt-2 p-3 rounded-xl" style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>Opción {secStep + 2}</p>
                    <button onClick={() => { setAddingSecundario(false); setSecUniId(''); }}><X size={13} style={{ color: 'rgba(12,31,61,0.4)' }} /></button>
                  </div>
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(12,31,61,0.4)' }} />
                    <input
                      value={secUniSearch}
                      onChange={e => { setSecUniSearch(e.target.value); setSecUniId(''); }}
                      placeholder="Buscar universidad…"
                      className="w-full pl-8 pr-2 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'white', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
                    />
                  </div>
                  {!secUniId ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {universidades.filter(u =>
                        u.nombre.toLowerCase().includes(secUniSearch.toLowerCase()) || u.abbr?.toLowerCase().includes(secUniSearch.toLowerCase())
                      ).slice(0, 8).map(u => (
                        <button key={u.id} onClick={() => setSecUniId(u.id)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-blue-50"
                          style={{ color: '#0c1f3d' }}>
                          {u.logo} {u.abbr || u.nombre}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <button onClick={() => setSecUniId('')} className="text-xs mb-1" style={{ color: '#1d4ed8' }}>← Volver</button>
                      {secCarreras.map(c => (
                        <button key={c.id} onClick={() => addSecundario(c, secUniId)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-blue-50 transition-colors"
                          style={{ color: '#0c1f3d' }}>
                          <span className="font-medium truncate">{c.nombre}</span>
                          <span style={{ color: 'rgba(12,31,61,0.4)' }}>{c.puntaje_corte} pts</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep('resumen')}
              className="w-full mt-6 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
            >
              {selectedCarrera ? 'Continuar' : 'Continuar sin objetivo'} <ChevronRight size={14} className="inline ml-1" />
            </button>
          </div>
        )}

        {/* ── PASO 4: RESUMEN ── */}
        {step === 'resumen' && (
          <div className="p-8 rounded-3xl"
            style={{ background: 'white', boxShadow: '0 4px 40px rgba(12,31,61,0.1)' }}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🚀</div>
              <h2 className="font-display text-xl font-semibold mb-1" style={{ color: '#0c1f3d' }}>
                ¡Todo listo para comenzar!
              </h2>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Esto es lo que configuramos para ti:
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {/* Diagnóstico */}
              <div className="p-4 rounded-2xl" style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={14} style={{ color: '#1d4ed8' }} />
                  <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>Diagnóstico inicial</p>
                </div>
                {diagResults ? (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(diagResults).map(([examId, { score_estimado }]) => (
                      <span key={examId} className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                        style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}>
                        {EXAM_ICONS[examId]} ~{score_estimado} pts
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>No realizado — podrás hacerlo después.</p>
                )}
              </div>

              {/* Objetivo principal */}
              <div className="p-4 rounded-2xl" style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={14} style={{ color: '#1d4ed8' }} />
                  <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>Objetivo principal</p>
                </div>
                {selectedCarrera ? (
                  <>
                    <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>{selectedCarrera.nombre}</p>
                    <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>
                      {universidades.find(u => u.id === selectedUniId)?.nombre} · Corte: {selectedCarrera.puntaje_corte} pts
                    </p>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>No configurado — podrás hacerlo desde Ajustes.</p>
                )}
              </div>

              {/* Secundarios */}
              {secundarios.filter(Boolean).length > 0 && (
                <div className="p-4 rounded-2xl" style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.07)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={14} style={{ color: '#1d4ed8' }} />
                    <p className="text-sm font-semibold" style={{ color: '#0c1f3d' }}>Opciones secundarias</p>
                  </div>
                  {secundarios.filter(Boolean).map((sec, i) => (
                    <p key={i} className="text-xs" style={{ color: 'rgba(12,31,61,0.55)' }}>
                      {i + 1}. {sec.carrera_nombre} — {sec.universidad_nombre}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {saveError && (
              <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#991b1b' }}>
                <AlertCircle size={13} />
                {saveError}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin inline mr-2" />Guardando…</>
                : <><Sparkles size={14} className="inline mr-1.5" />Ir a mi panel de estudio</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
