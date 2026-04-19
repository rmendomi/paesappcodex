import { useState } from 'react';
import { LayoutDashboard, BookOpen, TrendingUp, Settings, LogOut, GraduationCap, Building2, Calendar, Trophy, Flame, X, ShieldCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard',     label: 'Panel Principal',       icon: LayoutDashboard },
      { id: 'exams',         label: 'Pruebas PAES',          icon: BookOpen },
      { id: 'progress',      label: 'Mi Progreso',           icon: TrendingUp },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { id: 'universities', label: 'Universidades & Calc.', icon: Building2 },
      { id: 'planner',      label: 'Planificador IA',       icon: Calendar },
    ],
  },
  {
    label: 'Comunidad',
    items: [
      { id: 'leaderboard',  label: 'Ranking',        icon: Trophy },
      { id: 'settings',     label: 'Configuración',  icon: Settings },
    ],
  },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function Sidebar({ current, onNavigate, onLogout, isOpen, onClose }) {
  const { user, streak, isAdmin } = useAuth();
  // Secciones colapsadas: por defecto todas abiertas
  const [collapsed, setCollapsed] = useState({});

  const initials    = getInitials(user?.name);
  const displayName = (user?.name || 'Estudiante')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const grade       = user?.gradeLevel || '4° Medio';
  const target      = user?.targetScore || 700;

  const handleNav = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  const toggleSection = (label) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {/* Overlay — solo mobile cuando está abierto */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #0c1f3d 0%, #1a2f5a 100%)' }}
      >
        {/* Logo + botón cerrar en mobile */}
        <div className="px-6 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.3)' }}>
                <GraduationCap size={18} color="#93c5fd" />
              </div>
              <div>
                <p className="text-white font-display font-semibold text-lg leading-tight">PAES Prep</p>
                <p className="text-white/35 text-xs">Practica · Aprende · Supera</p>
              </div>
            </div>
            {/* Botón cerrar — solo mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={16} color="rgba(255,255,255,0.5)" />
            </button>
          </div>
        </div>

        {/* Info del estudiante + racha */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                style={{ border: '2px solid rgba(147,197,253,0.3)' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                style={{ background: 'rgba(147,197,253,0.2)', color: '#93c5fd', border: '2px solid rgba(147,197,253,0.3)' }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-medium leading-tight truncate">{displayName}</p>
              <p className="text-white/35 text-xs mt-0.5 truncate">{grade} · Meta {target} pts</p>
            </div>
          </div>

          {/* Pill de racha */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{
              background: streak.current > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
              border:     streak.current > 0 ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Flame size={14} style={{ color: streak.current > 0 ? '#f97316' : 'rgba(255,255,255,0.2)' }} />
            <span
              className="text-xs font-semibold"
              style={{ color: streak.current > 0 ? '#fdba74' : 'rgba(255,255,255,0.3)' }}
            >
              {streak.current > 0 ? `${streak.current} días seguidos` : 'Sin racha activa'}
            </span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          {navGroups.map(group => {
            const isCollapsed = !!collapsed[group.label];
            const hasActive   = group.items.some(i => i.id === current);
            return (
              <div key={group.label}>
                {/* Cabecera de sección colapsable */}
                <button
                  onClick={() => toggleSection(group.label)}
                  className="w-full flex items-center justify-between px-4 mb-1 group"
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider transition-colors group-hover:text-white/40"
                    style={{ color: hasActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)' }}
                  >
                    {group.label}
                  </p>
                  <ChevronDown
                    size={12}
                    className="transition-transform duration-200"
                    style={{
                      color: 'rgba(255,255,255,0.2)',
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>

                {/* Items de la sección */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map(({ id, label, icon: Icon }) => {
                      const active = current === id;
                      return (
                        <button
                          key={id}
                          onClick={() => handleNav(id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px] ${
                            active ? 'text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                          }`}
                          style={active
                            ? { borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.15)' }
                            : { borderLeft: '3px solid transparent' }}
                        >
                          <Icon size={17} style={active ? { color: '#93c5fd' } : {}} />
                          <span className="truncate flex-1 text-left">{label}</span>
                          {active && (
                            <div
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0 pulse-ring"
                              style={{ background: '#3b82f6' }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sección Administración — solo para admins */}
        {isAdmin && (
          <div className="px-3 pb-2">
            <div className="border-t border-white/10 pt-4">
              <p
                className="px-4 mb-1.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                Administración
              </p>
              {[
                { id: 'admin',           label: 'Panel Admin' },
                { id: 'admin-usuarios',  label: 'Usuarios' },
                { id: 'admin-preguntas', label: 'Banco de Preguntas' },
                { id: 'admin-sesiones',  label: 'Sesiones' },
              ].map(({ id, label }) => {
                const active = current === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleNav(id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                    style={active
                      ? { borderLeft: '3px solid #a78bfa', background: 'rgba(124,58,237,0.15)' }
                      : { borderLeft: '3px solid transparent' }}
                  >
                    <ShieldCheck size={14} style={active ? { color: '#a78bfa' } : {}} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Parte inferior */}
        <div className="px-3 pb-6">
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => handleNav('landing')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/35 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <GraduationCap size={15} />
              <span>Ver página principal</span>
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <LogOut size={14} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
