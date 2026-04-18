import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';

// Páginas críticas (cargadas siempre, sin lazy)
import Landing  from './pages/Landing';
import Login    from './pages/Login';
import Register from './pages/Register';

// Resto de páginas: lazy — se cargan solo cuando el usuario las visita
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Exams         = lazy(() => import('./pages/Exams'));
const Practice      = lazy(() => import('./pages/Practice'));
const Results       = lazy(() => import('./pages/Results'));
const Progress      = lazy(() => import('./pages/Progress'));
const Proyecciones  = lazy(() => import('./pages/Proyecciones'));
const Settings      = lazy(() => import('./pages/Settings'));
const Calculator    = lazy(() => import('./pages/Calculator'));
const Universities  = lazy(() => import('./pages/Universities'));
const Planner       = lazy(() => import('./pages/Planner'));
const Leaderboard   = lazy(() => import('./pages/Leaderboard'));
const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const AdminUsuarios   = lazy(() => import('./pages/AdminUsuarios'));
const AdminPreguntas  = lazy(() => import('./pages/AdminPreguntas'));
const AdminSesiones   = lazy(() => import('./pages/AdminSesiones'));
const Onboarding      = lazy(() => import('./pages/Onboarding'));

function PageFallback() {
  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
    </div>
  );
}

const studentPages = {
  dashboard:        Dashboard,
  exams:            Exams,
  progress:         Progress,
  proyecciones:     Proyecciones,
  settings:         Settings,
  calculator:       Calculator,
  universities:     Universities,
  planner:          Planner,
  leaderboard:      Leaderboard,
  'admin':          AdminDashboard,
  'admin-usuarios': AdminUsuarios,
  'admin-preguntas':AdminPreguntas,
  'admin-sesiones': AdminSesiones,
};

const PAGE_TITLES = {
  dashboard:          'Panel Principal',
  exams:              'Pruebas PAES',
  progress:           'Mi Progreso',
  proyecciones:       'Proyecciones',
  settings:           'Configuración',
  calculator:         'Calculadora',
  universities:       'Universidades y Calculadora',
  planner:            'Planificador',
  leaderboard:        'Ranking',
  'admin':            'Administración',
  'admin-usuarios':   'Admin · Usuarios',
  'admin-preguntas':  'Admin · Banco de Preguntas',
  'admin-sesiones':   'Admin · Sesiones',
  onboarding:         'Configuración inicial',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function App() {
  const [view,         setView]         = useState('landing');
  const [practiceData, setPracticeData] = useState(null);
  const [resultData,   setResultData]   = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  // Hash pendiente al cargar (e.g. #universities → navegar tras auth)
  const pendingHash = useRef(null);

  const { user, logout, authLoading } = useAuth();

  // Bloquear scroll del body cuando el sidebar mobile está abierto
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Capturar hash de la URL al montar (antes de que auth resuelva)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && studentPages[hash]) pendingHash.current = hash;
  }, []);

  // Si hay sesión activa al cargar: ir a onboarding si es primer acceso, si no al dashboard
  useEffect(() => {
    if (!authLoading && user && (view === 'landing' || view === 'login' || view === 'register')) {
      if (user.onboardingCompletado === false) {
        setView('onboarding');
      } else {
        const target = pendingHash.current || 'dashboard';
        pendingHash.current = null;
        setView(target);
      }
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (target, data) => {
    if (target === 'practice' && data) setPracticeData(data);
    if (target === 'results'  && data) setResultData(data);
    setView(target);
    // Sincronizar URL hash para páginas de estudiante (permite compartir / navegar directo)
    if (studentPages[target]) {
      history.replaceState(null, '', `#${target}`);
    } else {
      history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleLogin  = () => setView('dashboard');
  const handleLogout = () => { logout(); setView('landing'); };

  // ── Pantalla de carga inicial (verificando sesión) ────────────────
  // No desmontar 'register' durante authLoading: evita que setEmailSent() quede sin efecto
  // al ejecutarse sobre una instancia desmontada (React 18 ignora setState en unmounted).
  if (authLoading && view !== 'register' && view !== 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8faff' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(29,78,216,0.1)' }}>
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#1d4ed8" strokeWidth="2" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'rgba(12,31,61,0.5)' }}>Cargando…</p>
        </div>
      </div>
    );
  }

  // ── Páginas públicas
  if (view === 'landing')  return <Landing  onEnter={() => setView('login')} />;
  if (view === 'register') return <Register onBack={() => setView('landing')} onLogin={() => setView('login')} onSuccess={handleLogin} />;
  if (view === 'login')    return <Login    onLogin={handleLogin} onBack={() => setView('landing')} onRegister={() => setView('register')} />;

  // ── Onboarding (primer acceso, sin sidebar) ───────────────────────────────
  if (view === 'onboarding') {
    return (
      <Suspense fallback={<PageFallback />}>
        <Onboarding onComplete={() => setView('dashboard')} />
      </Suspense>
    );
  }

  // ── Flujo de práctica (sin sidebar)
  if (view === 'practice') {
    return (
      <Suspense fallback={<PageFallback />}>
        <Practice
          data={practiceData}
          onFinish={(res) => navigate('results', res)}
          onBack={() => setView('exams')}
        />
      </Suspense>
    );
  }
  if (view === 'results') {
    return (
      <Suspense fallback={<PageFallback />}>
        <Results
          data={resultData}
          onPracticeAgain={() => setView('exams')}
          onDashboard={() => setView('dashboard')}
        />
      </Suspense>
    );
  }

  // ── Portal del estudiante (con sidebar)
  const PageComponent = studentPages[view] || Dashboard;
  const initials      = getInitials(user?.name);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        current={view}
        onNavigate={navigate}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content: en desktop ml-64; en mobile ml-0 (sidebar se superpone) */}
      <main className="flex-1 min-h-screen lg:ml-64" style={{ background: '#f8faff' }}>
        {/* Top bar */}
        <div
          className="sticky top-0 z-20 h-14 flex items-center px-4 sm:px-8 justify-between backdrop-blur-md"
          style={{ background: 'rgba(248,250,255,0.92)', borderBottom: '1px solid rgba(12,31,61,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger — solo mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-black/5 transition-colors"
            >
              <Menu size={18} style={{ color: '#0c1f3d' }} />
            </button>
            <p className="font-display text-base font-semibold capitalize" style={{ color: '#0c1f3d' }}>
              {PAGE_TITLES[view] || view}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: '1.5px solid rgba(59,130,246,0.25)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#1d4ed8', border: '1.5px solid rgba(59,130,246,0.25)' }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        <Suspense fallback={<PageFallback />}>
          <PageComponent onNavigate={navigate} />
        </Suspense>
      </main>
    </div>
  );
}
