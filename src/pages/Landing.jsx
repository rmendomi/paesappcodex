import { useState, useEffect, useRef } from 'react';

function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll('.scroll-reveal');
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.08 }
    );
    targets.forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, []);
  return ref;
}
import { ArrowRight, GraduationCap, ChevronDown, CheckCircle, Target, TrendingUp, Shield, Sparkles, Trophy, ChevronRight } from 'lucide-react';
import WaveDecor from '../components/Decor';
import { exams } from '../data/catalogData';

const chartScores = [518, 537, 533, 562, 578, 598, 614, 641];
const chartLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];

function ScoreChart() {
  const minS = 500, maxS = 660, svgW = 400, svgH = 160, padX = 10, padY = 15;
  const w = svgW - 2 * padX, h = svgH - 2 * padY;
  const pts = chartScores.map((s, i) => ({
    x: padX + (i / (chartScores.length - 1)) * w,
    y: padY + ((maxS - s) / (maxS - minS)) * h,
    score: s,
  }));
  let linePath = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    linePath += ` C ${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  const areaPath = linePath + ` L ${pts[pts.length - 1].x},${svgH - padY} L ${pts[0].x},${svgH - padY} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: 160 }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[540, 580, 620].map(score => {
        const y = padY + ((maxS - score) / (maxS - minS)) * h;
        return (
          <g key={score}>
            <line x1={padX} y1={y} x2={svgW - padX} y2={y} stroke="rgba(12,31,61,0.07)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={padX + 2} y={y - 3} fill="rgba(12,31,61,0.3)" fontSize="8">{score}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#chartGrad)" />
      <path d={linePath} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill="white" stroke="#1d4ed8" strokeWidth="2" />
      ))}
      <rect x={last.x - 22} y={last.y - 22} width="44" height="16" rx="4" fill="#1d4ed8" />
      <text x={last.x} y={last.y - 11} fill="white" fontSize="8.5" fontWeight="bold" textAnchor="middle">{last.score} pts</text>
    </svg>
  );
}

const steps = [
  { n: '01', icon: '👤', title: 'Crea tu cuenta gratis', desc: 'Registro en menos de 30 segundos. Sin tarjeta, sin letra chica.' },
  { n: '02', icon: '🎯', title: 'Diagnóstico inicial', desc: 'Respondemos 10 preguntas para medir tu nivel y personalizar tu experiencia.' },
  { n: '03', icon: '📊', title: 'Practica y mejora', desc: 'Selecciona la prueba y responde preguntas con retroalimentación instantánea.' },
  { n: '04', icon: '🏆', title: 'Alcanza tu meta', desc: 'Sigue tu puntaje estimado, revisa carreras y llega confiado el día de la PAES.' },
];

const platformStats = [
  { value: '5',     label: 'Pruebas PAES',            sub: 'Lectora, M1, M2, Historia y Ciencias',          icon: Target,    color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)'  },
  { value: 'IA',    label: 'Preguntas únicas',         sub: 'Claude genera preguntas originales en tiempo real', icon: Sparkles,  color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { value: '2026',  label: 'Datos DEMRE',              sub: 'Ponderaciones y puntajes de corte actualizados',  icon: TrendingUp, color: '#0891b2', bg: 'rgba(8,145,178,0.1)'  },
  { value: '30s',   label: 'Registro rápido',            sub: 'Sin tarjeta de crédito requerida',               icon: Trophy,    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
];

const scoreRanges = [
  { label: '≤ 549', desc: 'Acceso base',      color: '#94a3b8', careers: 'CFT, IP, pedagogías básicas' },
  { label: '550–649', desc: 'Acceso amplio',  color: '#22c55e', careers: 'Universidades regionales, humanidades' },
  { label: '650–729', desc: 'Competitivo',    color: '#3b82f6', careers: 'Ing. Comercial, Psicología, Derecho URP' },
  { label: '730–799', desc: 'Selectivo',      color: '#8b5cf6', careers: 'Ing. Civil UC/USACH, Derecho UChile' },
  { label: '800+',    desc: 'Muy selectivo',  color: '#ef4444', careers: 'Medicina, Derecho UC, carreras top' },
];

export default function Landing({ onEnter, isLoggedIn }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stepsRef    = useScrollReveal();
  const platformRef = useScrollReveal();

  return (
    <div className="min-h-screen grain" style={{ background: '#f8faff' }}>

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
        style={{ background: 'rgba(248,250,255,0.93)', borderBottom: '1px solid rgba(12,31,61,0.07)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap size={20} style={{ color: '#1d4ed8' }} />
            <span className="font-display font-semibold text-lg" style={{ color: '#0c1f3d' }}>PAES Prep</span>
            <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#1d4ed8' }}>2026</span>
          </div>
          <nav className="hidden md:flex items-center gap-7">
            {[['Puntajes', '#puntajes'], ['Cómo funciona', '#como-funciona'], ['Pruebas PAES', '#pruebas']].map(([s, href]) => (
              <a key={s} href={href} className="text-sm font-medium transition-colors"
                style={{ color: 'rgba(12,31,61,0.5)', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color = '#1d4ed8'}
                onMouseLeave={e => e.target.style.color = 'rgba(12,31,61,0.5)'}>
                {s}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={onEnter}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}>
              {isLoggedIn ? 'Ir al dashboard' : 'Comenzar gratis'}
              <ArrowRight size={14} />
            </button>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            <ChevronDown size={22} style={{ color: '#0c1f3d' }} />
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 pb-4 space-y-2 border-t" style={{ borderColor: 'rgba(12,31,61,0.06)', background: '#f8faff' }}>
            {[['Puntajes', '#puntajes'], ['Cómo funciona', '#como-funciona'], ['Pruebas PAES', '#pruebas']].map(([s, href]) => (
              <a key={s} href={href} onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm font-medium" style={{ color: '#0c1f3d', textDecoration: 'none' }}>{s}</a>
            ))}
            <button onClick={onEnter} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}>
              {isLoggedIn ? 'Ir al dashboard' : 'Comenzar gratis'}
            </button>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-28 pb-0 overflow-hidden" style={{ minHeight: '95vh', display: 'flex', alignItems: 'center' }}>
        <div className="absolute top-10 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)', transform: 'translate(20%, -20%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%)', transform: 'translate(-25%, 30%)' }} />

        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 fade-up delay-1"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Sparkles size={13} style={{ color: '#7c3aed' }} />
                <span className="text-xs font-semibold" style={{ color: '#7c3aed' }}>Powered by Claude AI · Para estudiantes chilenos</span>
              </div>

              <h1 className="font-display text-5xl md:text-6xl leading-tight mb-5 fade-up delay-2" style={{ color: '#0c1f3d' }}>
                <span style={{ fontWeight: 300 }}>Sube tu puntaje</span><br />
                <em className="font-bold not-italic" style={{ color: '#1d4ed8' }}>PAES 2026</em><br />
                <span style={{ fontWeight: 300, fontSize: '0.85em' }}>con práctica real</span>
              </h1>

              <p className="text-base leading-relaxed mb-8 fade-up delay-3 max-w-lg" style={{ color: 'rgba(12,31,61,0.55)' }}>
                Practica preguntas estilo PAES generadas por IA, mide tu puntaje estimado en tiempo real,
                identifica tus áreas débiles y descubre qué carreras y universidades están a tu alcance.
              </p>

              <div className="flex flex-wrap gap-3 fade-up delay-4">
                <button onClick={onEnter}
                  className="flex items-center gap-2 px-7 py-4 rounded-2xl font-semibold text-white transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)', boxShadow: '0 4px 20px rgba(29,78,216,0.3)' }}>
                  {isLoggedIn ? 'Ir al dashboard' : 'Comenzar a practicar'}
                  <ArrowRight size={16} />
                </button>
                <a href="#como-funciona"
                  className="flex items-center gap-2 px-7 py-4 rounded-2xl font-semibold transition-all hover:scale-105"
                  style={{ color: '#1d4ed8', border: '1.5px solid rgba(29,78,216,0.25)', background: 'transparent', textDecoration: 'none' }}>
                  ¿Cómo funciona?
                </a>
              </div>

              <div className="flex flex-wrap gap-5 mt-10 fade-up delay-5">
                {[['Sin tarjeta de crédito'], ['Registro en 30 segundos'], ['Sin publicidad invasiva']].map(([text]) => (
                  <div key={text} className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: '#22c55e' }}>✓</span>
                    <span className="text-xs font-medium" style={{ color: 'rgba(12,31,61,0.5)' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="relative hidden md:flex justify-center fade-up delay-3">
              <div className="relative w-[370px]">
                <div className="relative rounded-3xl overflow-hidden p-6"
                  style={{ background: 'linear-gradient(160deg, #0c1f3d 0%, #1a3a7a 100%)', boxShadow: '0 30px 70px rgba(12,31,61,0.4)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-white/50 text-xs">Tu progreso · Matemática M1</p>
                      <p className="text-white font-display text-xl font-bold mt-0.5">Semana 8 de 12</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <span className="text-xs font-bold text-green-400">+123 pts</span>
                    </div>
                  </div>
                  <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-end gap-3 mb-3">
                      <p className="font-display text-5xl font-bold text-white">641</p>
                      <div className="pb-1">
                        <p className="text-white/50 text-xs">pts estimados</p>
                        <p className="text-green-400 text-xs font-semibold">↑ desde 518</p>
                      </div>
                    </div>
                    <ScoreChart />
                  </div>
                  <div className="space-y-2.5">
                    {[['Álgebra y funciones', 78, '#93c5fd'], ['Geometría', 62, '#c4b5fd'], ['Números', 85, '#6ee7b7']].map(([skill, pct, color]) => (
                      <div key={skill}>
                        <div className="flex justify-between mb-1">
                          <span className="text-white/60 text-xs">{skill}</span>
                          <span className="text-white/80 text-xs font-medium">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute -left-16 top-16 px-4 py-3 rounded-2xl"
                  style={{ background: 'white', boxShadow: '0 8px 30px rgba(12,31,61,0.15)', minWidth: 150 }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#0c1f3d' }}>🔥 Racha activa</p>
                  <p className="font-display text-2xl font-bold" style={{ color: '#f59e0b' }}>7 días</p>
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>¡Sigue así!</p>
                </div>
                <div className="absolute -right-12 bottom-20 px-4 py-3 rounded-2xl"
                  style={{ background: 'white', boxShadow: '0 8px 30px rgba(12,31,61,0.15)', minWidth: 148 }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#0c1f3d' }}>🎯 Meta alcanzable</p>
                  <p className="font-display text-sm font-bold" style={{ color: '#1d4ed8' }}>Ing. Comercial</p>
                  <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>USACH · 638 pts</p>
                  <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>✓ Dentro de rango</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <WaveDecor className="absolute bottom-0 left-0 right-0" color="#1d4ed8" opacity={0.05} height={90} />
      </section>

      {/* ── PAES Context Bar ── */}
      <section style={{ background: '#0c1f3d' }} className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: '+280.000', desc: 'estudiantes rinden la PAES cada año', color: '#93c5fd' },
              { n: '~520 pts',  desc: 'puntaje promedio nacional',           color: '#fcd34d' },
              { n: '700+',     desc: 'pts exigen las carreras más selectivas', color: '#f9a8d4' },
              { n: '< 20%',   desc: 'practica con simulacros antes del examen', color: '#6ee7b7' },
            ].map(({ n, desc, color }) => (
              <div key={n}>
                <p className="font-display text-3xl font-bold mb-1" style={{ color }}>{n}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Score Scale ── */}
      <section id="puntajes" className="py-20" style={{ background: '#eff6ff', scrollMarginTop: '4rem' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#1d4ed8' }}>¿Cuánto necesitas?</p>
            <h2 className="font-display text-4xl font-light" style={{ color: '#0c1f3d' }}>
              Tu puntaje define <em>tus opciones</em>
            </h2>
            <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: 'rgba(12,31,61,0.5)' }}>
              Cada rango de puntaje abre puertas distintas. ¿Dónde estás y a dónde quieres llegar?
            </p>
          </div>
          <div className="mb-10">
            <div className="relative h-5 rounded-full overflow-hidden mb-2"
              style={{ background: 'linear-gradient(90deg, #94a3b8 0%, #22c55e 25%, #3b82f6 50%, #8b5cf6 75%, #ef4444 100%)' }}>
              {[{ left: '25%', label: '550' }, { left: '50%', label: '650' }, { left: '75%', label: '750' }].map(m => (
                <div key={m.label} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: m.left }} />
              ))}
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-medium" style={{ color: 'rgba(12,31,61,0.4)' }}>500 pts</span>
              {[{ left: '23%', label: '550' }, { left: '48%', label: '650' }, { left: '73%', label: '750' }].map(m => (
                <span key={m.label} className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{m.label}</span>
              ))}
              <span className="text-xs font-medium" style={{ color: 'rgba(12,31,61,0.4)' }}>850 pts</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {scoreRanges.map(({ label, desc, color, careers }) => (
              <div key={label} className="p-4 rounded-2xl card-lift"
                style={{ background: 'white', boxShadow: '0 2px 16px rgba(12,31,61,0.06)', borderTop: `3px solid ${color}` }}>
                <p className="font-display text-lg font-bold mb-0.5" style={{ color }}>{label}</p>
                <p className="text-xs font-semibold mb-2" style={{ color: '#0c1f3d' }}>{desc}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(12,31,61,0.5)' }}>{careers}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature 1: Practice with AI ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.15)' }}>
                Powered by Claude AI
              </span>
              <h2 className="font-display text-4xl font-light mb-4" style={{ color: '#0c1f3d' }}>
                Preguntas únicas,<br /><em className="font-semibold">explicaciones reales</em>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(12,31,61,0.55)' }}>
                La IA genera preguntas originales estilo PAES en tiempo real. Nunca te quedas sin material nuevo.
                Cada respuesta incluye una explicación completa para que entiendas el concepto, no solo memorices.
              </p>
              <div className="space-y-3">
                {[
                  'Preguntas calibradas al nivel PAES real',
                  'Retroalimentación inmediata en cada respuesta',
                  'Explicación paso a paso del concepto',
                  'Historial de errores para reforzar lo débil',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle size={16} style={{ color: '#7c3aed', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'rgba(12,31,61,0.7)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={onEnter}
                className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)' }}>
                Probar preguntas IA <ArrowRight size={14} />
              </button>
            </div>

            {/* Mock question card */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl" style={{ background: 'rgba(124,58,237,0.05)', transform: 'rotate(-2deg)' }} />
              <div className="relative p-6 rounded-3xl" style={{ background: 'white', boxShadow: '0 20px 50px rgba(12,31,61,0.1)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}>📐 Matemática M1</span>
                  <span className="text-xs" style={{ color: 'rgba(12,31,61,0.35)' }}>Generada por IA</span>
                </div>
                <p className="text-sm font-medium mb-5 leading-relaxed" style={{ color: '#0c1f3d' }}>
                  Se lanza una pelota verticalmente. Su altura en metros está dada por
                  h(t) = −5t² + 20t, donde t es el tiempo en segundos. ¿En qué instante alcanza la altura máxima?
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    { opt: 'A)  t = 1 s',  correct: false },
                    { opt: 'B)  t = 2 s',  correct: true  },
                    { opt: 'C)  t = 4 s',  correct: false },
                    { opt: 'D)  t = 20 s', correct: false },
                  ].map(({ opt, correct }) => (
                    <div key={opt} className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-2"
                      style={{
                        background: correct ? 'rgba(34,197,94,0.08)' : 'rgba(12,31,61,0.03)',
                        border: `1.5px solid ${correct ? 'rgba(34,197,94,0.3)' : 'rgba(12,31,61,0.06)'}`,
                        color: correct ? '#16a34a' : 'rgba(12,31,61,0.6)',
                        fontWeight: correct ? 600 : 400,
                      }}>
                      {correct && <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0 }} />}
                      {opt}
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#7c3aed' }}>💡 Explicación</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(12,31,61,0.6)' }}>
                    h(t) es una parábola con a = −5 &lt; 0, por lo que tiene un máximo en el vértice.<br />
                    t<sub>vértice</sub> = −b / (2a) = −20 / (2·(−5)) = <strong>2 segundos</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 2: Progress Tracking ── */}
      <section className="py-24" style={{ background: '#eff6ff' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Chart visual */}
            <div className="order-2 md:order-1">
              <div className="p-6 rounded-3xl mb-4" style={{ background: 'white', boxShadow: '0 20px 50px rgba(12,31,61,0.08)' }}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>Puntaje estimado · M1</p>
                    <p className="font-display text-xl font-bold mt-0.5" style={{ color: '#0c1f3d' }}>Progreso en 8 semanas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>Inicio → Hoy</p>
                    <p className="font-display font-bold text-sm" style={{ color: '#22c55e' }}>518 → 641 ↑</p>
                  </div>
                </div>
                <ScoreChart />
                <div className="grid grid-cols-4 gap-1 mt-3">
                  {chartLabels.slice(0, 4).map((l, i) => (
                    <div key={l} className="text-center">
                      <p className="font-semibold text-sm" style={{ color: '#1d4ed8' }}>{chartScores[i]}</p>
                      <p className="text-xs" style={{ color: 'rgba(12,31,61,0.35)' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-2xl" style={{ background: 'white', boxShadow: '0 8px 30px rgba(12,31,61,0.07)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(12,31,61,0.45)' }}>Desglose por habilidad</p>
                <div className="space-y-3">
                  {[
                    { name: 'Modelamiento y resolución', pct: 82, color: '#1d4ed8' },
                    { name: 'Representación y comunicación', pct: 67, color: '#7c3aed' },
                    { name: 'Razonamiento y argumentación', pct: 74, color: '#0891b2' },
                  ].map(({ name, pct, color }) => (
                    <div key={name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs" style={{ color: 'rgba(12,31,61,0.6)' }}>{name}</span>
                        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'rgba(12,31,61,0.05)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <span className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8', border: '1px solid rgba(29,78,216,0.15)' }}>
                Análisis de progreso
              </span>
              <h2 className="font-display text-4xl font-light mb-4" style={{ color: '#0c1f3d' }}>
                Ve exactamente<br /><em className="font-semibold">cómo mejoras</em>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(12,31,61,0.55)' }}>
                Cada sesión queda registrada. Ve tu evolución en el tiempo, qué habilidades dominas
                y cuáles necesitan más atención. Tu puntaje estimado se actualiza con cada práctica.
              </p>
              <div className="space-y-3">
                {[
                  'Puntaje estimado en escala PAES real (150–850)',
                  'Historial por prueba y por habilidad',
                  'Identificación automática de áreas débiles',
                  'Plan de estudio semanal personalizado con IA',
                  'Comparación continua con tu meta personal',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle size={16} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'rgba(12,31,61,0.7)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 3: University Calculator ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(8,145,178,0.08)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.15)' }}>
                Calculadora universitaria
              </span>
              <h2 className="font-display text-4xl font-light mb-4" style={{ color: '#0c1f3d' }}>
                Descubre a qué<br /><em className="font-semibold">carreras puedes entrar</em>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(12,31,61,0.55)' }}>
                Ingresa tus puntajes PAES y NEM y calculamos tu puntaje ponderado real para miles de carreras.
                Usamos la oferta académica SIES 2026 con ponderaciones y puntajes de corte actualizados.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Oferta académica 2026 completa (SIES)',
                  'Ponderaciones oficiales por carrera',
                  'Puntajes de corte históricos DEMRE',
                  'Búsqueda por carrera, universidad o región',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle size={16} style={{ color: '#0891b2', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'rgba(12,31,61,0.7)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <button onClick={onEnter}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #0891b2, #0c4a6e)' }}>
                Explorar carreras <ArrowRight size={14} />
              </button>
            </div>

            {/* University calculator mock */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl" style={{ background: 'rgba(8,145,178,0.04)', transform: 'rotate(1.5deg)' }} />
              <div className="relative p-6 rounded-3xl" style={{ background: 'white', boxShadow: '0 20px 50px rgba(12,31,61,0.1)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(12,31,61,0.4)' }}>Tu simulación</p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[['NEM', '6.2', '#f59e0b'], ['Lectora', '650', '#1d4ed8'], ['M1', '641', '#7c3aed']].map(([label, val, color]) => (
                    <div key={label} className="p-3 rounded-xl text-center"
                      style={{ background: `${color}0d`, border: `1px solid ${color}25` }}>
                      <p className="text-xs mb-0.5" style={{ color: 'rgba(12,31,61,0.45)' }}>{label}</p>
                      <p className="font-display font-bold text-lg" style={{ color }}>{val}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(12,31,61,0.5)' }}>Carreras según tu puntaje ponderado:</p>
                <div className="space-y-1.5">
                  {[
                    { name: 'Ingeniería Comercial',  uni: 'USACH',    pts: 648, status: 'in'    },
                    { name: 'Psicología',             uni: 'UTEM',     pts: 631, status: 'in'    },
                    { name: 'Contador Auditor',       uni: 'UBO',      pts: 610, status: 'in'    },
                    { name: 'Derecho',                uni: 'UDP',      pts: 668, status: 'close' },
                    { name: 'Ingeniería Civil',       uni: 'U. Chile', pts: 710, status: 'out'   },
                  ].map(({ name, uni, pts, status }) => (
                    <div key={name} className="flex items-center justify-between p-2.5 rounded-xl"
                      style={{
                        background: status === 'in' ? 'rgba(34,197,94,0.06)' : status === 'close' ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.04)',
                        opacity: status === 'out' ? 0.55 : 1,
                      }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{name}</p>
                        <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>{uni}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-right">
                        <span className="text-xs font-bold"
                          style={{ color: status === 'in' ? '#16a34a' : status === 'close' ? '#d97706' : '#dc2626' }}>{pts}</span>
                        <span className="text-xs"
                          style={{ color: status === 'in' ? '#16a34a' : status === 'close' ? '#d97706' : '#dc2626' }}>
                          {status === 'in' ? '✓' : status === 'close' ? '≈' : `−${pts - 641}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works + Exam Coverage integrado ── */}
      <section id="como-funciona" className="py-24" style={{ background: '#eff6ff', scrollMarginTop: '4rem' }}>
        <div className="max-w-6xl mx-auto px-6" ref={stepsRef}>
          <div className="text-center mb-14 scroll-reveal">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#1d4ed8' }}>Paso a paso</p>
            <h2 className="font-display text-5xl font-light" style={{ color: '#0c1f3d' }}>
              Simple, directo <em>y efectivo</em>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {steps.map((s, i) => (
              <div key={i} className={`p-6 rounded-3xl card-lift relative scroll-reveal delay-s${i + 1}`}
                style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)' }}>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 -right-3 z-10">
                    <ChevronRight size={20} style={{ color: 'rgba(29,78,216,0.3)' }} />
                  </div>
                )}
                <p className={`text-4xl mb-3 float-icon d${i + 1}`}>{s.icon}</p>
                <p className="font-display text-xs font-bold mb-1" style={{ color: 'rgba(29,78,216,0.4)' }}>{s.n}</p>
                <h3 className="font-semibold text-base mb-2" style={{ color: '#0c1f3d' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(12,31,61,0.55)' }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Exámenes integrados como fila */}
          <div id="pruebas" className="scroll-reveal delay-s5 pt-8 border-t" style={{ borderColor: 'rgba(29,78,216,0.1)', scrollMarginTop: '4rem' }}>
            <p className="text-center text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: 'rgba(12,31,61,0.35)' }}>
              Disponible para las 5 pruebas PAES
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {exams.map((exam, i) => (
                <div key={exam.id} className={`exam-pill flex items-center gap-2.5 px-5 py-3 rounded-2xl`}
                  style={{ background: 'white', boxShadow: '0 2px 14px rgba(12,31,61,0.07)', border: `1.5px solid ${exam.color}22` }}>
                  <span className="text-2xl">{exam.icon}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: '#0c1f3d' }}>{exam.name}</p>
                    <p className="text-xs" style={{ color: exam.color }}>Prueba oficial PAES</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ¿Por qué PAES Prep? (dark block unificado) ── */}
      <section id="plataforma" className="py-24">
        <div className="max-w-6xl mx-auto px-6" ref={platformRef}>
          <div className="rounded-4xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c1f3d 0%, #1a3575 50%, #1d4ed8 100%)' }}>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.08)' }}>
              {platformStats.map(({ value, label, sub, icon: Icon, color }, i) => (
                <div key={label} className={`p-6 text-center scroll-reveal delay-s${i + 1}`}
                  style={{ background: 'linear-gradient(135deg, #0c1f3d 0%, #1a3575 50%, #1d4ed8 100%)' }}>
                  <p className="font-display text-4xl font-bold mb-0.5" style={{ color }}>{value}</p>
                  <p className="text-white text-xs font-semibold mb-1">{label}</p>
                  <p className="text-white/40 text-xs leading-snug">{sub}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />

            {/* Content */}
            <div className="p-8 md:p-10 grid md:grid-cols-2 gap-10 items-center">
              <div className="scroll-reveal delay-s1">
                <h3 className="font-display text-3xl font-light text-white mb-2">¿Por qué PAES Prep?</h3>
                <p className="text-white/50 text-sm mb-6">Todo lo que los libros de ensayo no te dan.</p>
                <div className="space-y-2.5">
                  {[
                    ['✓', 'Preguntas generadas por IA, siempre nuevas'],
                    ['✓', 'Explicaciones completas en cada respuesta'],
                    ['✓', 'Puntaje estimado en escala real (150–850)'],
                    ['✓', 'Plan de estudio semanal personalizado'],
                    ['✓', 'Calculadora universitaria con datos 2026'],
                    ['✓', 'Ranking y racha de práctica diaria'],
                    ['✓', 'Acceso desde cualquier dispositivo'],
                  ].map(([check, text]) => (
                    <div key={text} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>{check}</span>
                      <p className="text-sm text-white/75">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 scroll-reveal delay-s2">
                {[
                  ['📱', 'Mobile friendly', 'Practica desde tu teléfono en cualquier momento'],
                  ['🔥', 'Racha diaria',    'Mantén el hábito con tu racha y metas semanales'],
                  ['🏆', 'Ranking',         'Compite con otros estudiantes a nivel nacional'],
                  ['🎯', 'Diagnóstico IA',  'Test inicial para personalizar tu plan de estudio'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="p-4 rounded-2xl card-lift"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)' }}>
                    <p className="text-2xl mb-2">{icon}</p>
                    <p className="text-white text-xs font-semibold mb-1">{title}</p>
                    <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#1d4ed8' }}>Empieza hoy · PAES 2026</p>
          <h2 className="font-display text-5xl font-light mb-4" style={{ color: '#0c1f3d' }}>
            La PAES 2026<br /><em className="font-bold">se practica</em>
          </h2>
          <p className="text-sm leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: 'rgba(12,31,61,0.55)' }}>
            Cada sesión de práctica es un paso más hacia tu puntaje ideal.
            Crea tu cuenta en 30 segundos y empieza ahora mismo.
          </p>
          <button onClick={onEnter}
            className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl font-semibold text-white text-lg transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)', boxShadow: '0 8px 30px rgba(29,78,216,0.35)' }}>
            {isLoggedIn ? 'Ir al dashboard' : 'Comenzar ahora'}
            <ArrowRight size={20} />
          </button>
          <div className="flex justify-center gap-6 mt-6">
            {['Sin tarjeta de crédito', 'Sin publicidad', 'Registro en 30 segundos'].map(t => (
              <span key={t} className="text-xs font-medium" style={{ color: 'rgba(12,31,61,0.35)' }}>✓ {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t" style={{ borderColor: 'rgba(12,31,61,0.08)' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap size={17} style={{ color: '#1d4ed8' }} />
            <span className="font-display font-semibold" style={{ color: '#0c1f3d' }}>PAES Prep</span>
            <span className="text-xs" style={{ color: 'rgba(12,31,61,0.35)' }}>· Plataforma de práctica</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(12,31,61,0.3)' }}>© 2026 · Chile</p>
          <button onClick={onEnter}
            className="flex items-center gap-1.5 text-xs font-semibold hover:underline"
            style={{ color: '#1d4ed8' }}>
            <Shield size={11} />
            Área de estudiantes →
          </button>
        </div>
      </footer>
    </div>
  );
}
