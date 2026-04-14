import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert, Shield, User } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;

const ROLE_LABELS = { admin: 'Admin', student: 'Estudiante' };
const ROLE_COLORS = { admin: '#7c3aed', student: '#1d4ed8' };

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#64748b';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color }}
    >
      {role === 'admin' ? <Shield size={11} /> : <User size={11} />}
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export default function AdminUsuarios({ onNavigate }) {
  const { isAdmin, user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changing, setChanging] = useState(null);

  const load = useCallback((p) => {
    setLoading(true);
    setError(null);
    api.adminGetUsuarios({ page: p, pageSize: PAGE_SIZE })
      .then(({ usuarios, total }) => {
        setUsuarios(usuarios);
        setTotal(total);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (isAdmin) load(page); }, [isAdmin, page, load]);

  const handleRoleToggle = async (email, currentRole) => {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    setChanging(email);
    try {
      await api.adminSetUserRole(email, newRole);
      setUsuarios(prev => prev.map(u => u.email === email ? { ...u, role: newRole } : u));
    } catch (e) {
      setError(e.message);
    } finally {
      setChanging(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldAlert size={36} style={{ color: '#ef4444' }} />
        <p className="font-semibold text-lg" style={{ color: '#0c1f3d' }}>Acceso denegado</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={() => onNavigate('admin')}
          className="p-2 rounded-xl hover:bg-black/5 transition-colors"
        >
          <ChevronLeft size={18} style={{ color: '#0c1f3d' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0c1f3d' }}>Usuarios</h1>
          <p className="text-sm" style={{ color: 'rgba(12,31,61,0.45)' }}>
            {total} usuario{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(12,31,61,0.07)', boxShadow: '0 1px 4px rgba(12,31,61,0.06)' }}>
        {/* Header tabla */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{ gridTemplateColumns: '1fr 1fr 80px 80px 100px', color: 'rgba(12,31,61,0.45)', borderBottom: '1px solid rgba(12,31,61,0.06)' }}
        >
          <span>Usuario</span>
          <span>Colegio / Región</span>
          <span>Sesiones</span>
          <span>Rol</span>
          <span></span>
        </div>

        {loading ? (
          <div className="divide-y divide-black/5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 px-5 flex items-center gap-4">
                <div className="h-3 rounded-full animate-pulse flex-1" style={{ background: '#e5e7eb' }} />
                <div className="h-3 rounded-full animate-pulse w-24" style={{ background: '#e5e7eb' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {usuarios.map(u => (
              <div
                key={u.email}
                className="grid items-center px-5 py-3 text-sm"
                style={{ gridTemplateColumns: '1fr 1fr 80px 80px 100px' }}
              >
                <div className="min-w-0 pr-3">
                  <p className="font-medium truncate" style={{ color: '#0c1f3d' }}>{u.name || '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(12,31,61,0.4)' }}>{u.email}</p>
                </div>
                <div className="min-w-0 pr-3">
                  <p className="text-xs truncate" style={{ color: 'rgba(12,31,61,0.55)' }}>{u.school || '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'rgba(12,31,61,0.35)' }}>{u.region || '—'}</p>
                </div>
                <span className="text-xs font-medium" style={{ color: 'rgba(12,31,61,0.55)' }}>
                  {u.sesiones}
                </span>
                <span><RoleBadge role={u.role} /></span>
                <div className="flex justify-end">
                  {u.email !== currentUser?.email && (
                    <button
                      disabled={changing === u.email}
                      onClick={() => handleRoleToggle(u.email, u.role)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      style={{
                        background: u.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(29,78,216,0.1)',
                        color: u.role === 'admin' ? '#dc2626' : '#1d4ed8',
                      }}
                    >
                      {changing === u.email ? '…' : u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {usuarios.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: 'rgba(12,31,61,0.4)' }}>
                Sin usuarios
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} style={{ color: '#0c1f3d' }} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors disabled:opacity-40"
            >
              <ChevronRight size={16} style={{ color: '#0c1f3d' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
