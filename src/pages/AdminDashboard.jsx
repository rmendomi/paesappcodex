import { useEffect, useState } from 'react';
import { Users, BookOpen, Activity, TrendingUp, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const EXAM_NAMES = {
  lectora: 'Comprensión Lectora',
  m1: 'Matemática M1',
  m2: 'Matemática M2',
  historia: 'Historia',
  ciencias: 'Ciencias',
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div
      className="rounded-2xl p-5 flex items-start gap-4"
      style={{ background: '#fff', border: '1px solid rgba(12,31,61,0.07)', boxShadow: '0 1px 4px rgba(12,31,61,0.06)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + '18' }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: '#0c1f3d' }}>{value ?? '—'}</p>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'rgba(12,31,61,0.55)' }}>{label}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'rgba(12,31,61,0.35)' }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    api.adminGetStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert size={36} style={{ color: '#ef4444' }} />
        <p className="font-semibold text-lg" style={{ color: '#0c1f3d' }}>Acceso denegado</p>
        <p className="text-sm" style={{ color: 'rgba(12,31,61,0.5)' }}>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold" style={{ color: '#0c1f3d' }}>Panel de Administración</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(12,31,61,0.45)' }}>Resumen general de la plataforma</p>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          Error al cargar estadísticas: {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#e5e7eb' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users}     label="Usuarios registrados" value={stats?.totalUsuarios}  color="#1d4ed8" />
          <StatCard icon={Activity}  label="Sesiones totales"      value={stats?.totalSesiones}  color="#059669" />
          <StatCard icon={BookOpen}  label="Preguntas banco IA"    value={stats?.totalPreguntas} color="#7c3aed" />
          <StatCard icon={TrendingUp} label="Sesiones hoy"         value={stats?.sesionesHoy}    color="#d97706" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'admin-usuarios',  label: 'Gestionar Usuarios',          desc: 'Ver, editar roles y detalles de usuarios', color: '#1d4ed8', icon: Users },
          { id: 'admin-preguntas', label: 'Banco de Preguntas',          desc: 'Revisar y eliminar preguntas generadas por IA', color: '#7c3aed', icon: BookOpen },
          { id: 'admin-sesiones',  label: 'Historial de Sesiones',       desc: 'Analizar sesiones de práctica por usuario y examen', color: '#059669', icon: Activity },
        ].map(({ id, label, desc, color, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="text-left p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: '#fff', border: '1px solid rgba(12,31,61,0.07)', boxShadow: '0 1px 4px rgba(12,31,61,0.06)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '18' }}>
              <Icon size={17} style={{ color }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: '#0c1f3d' }}>{label}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(12,31,61,0.45)' }}>{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
