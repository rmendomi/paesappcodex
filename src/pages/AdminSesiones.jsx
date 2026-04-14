import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 25;

const EXAM_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'lectora',  label: 'Lectora' },
  { value: 'm1',       label: 'M1' },
  { value: 'm2',       label: 'M2' },
  { value: 'historia', label: 'Historia' },
  { value: 'ciencias', label: 'Ciencias' },
];

const EXAM_COLORS = { lectora: '#2563eb', m1: '#7c3aed', m2: '#9333ea', historia: '#b45309', ciencias: '#059669' };

function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, ((score - 100) / 900) * 100));
  const color = score >= 600 ? '#059669' : score >= 450 ? '#d97706' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(12,31,61,0.08)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminSesiones({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [sesiones, setSesiones] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [examFilter, setExamFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback((p, exam) => {
    setLoading(true);
    setError(null);
    api.adminGetSesiones({ page: p, pageSize: PAGE_SIZE, examId: exam || undefined })
      .then(({ sesiones, total }) => { setSesiones(sesiones); setTotal(total); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (isAdmin) load(page, examFilter); }, [isAdmin, page, examFilter, load]);

  const handleExamChange = (val) => { setExamFilter(val); setPage(1); };

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
        <button onClick={() => onNavigate('admin')} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
          <ChevronLeft size={18} style={{ color: '#0c1f3d' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0c1f3d' }}>Historial de Sesiones</h1>
          <p className="text-sm" style={{ color: 'rgba(12,31,61,0.45)' }}>
            {total} sesión{total !== 1 ? 'es' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtros examen */}
      <div className="flex flex-wrap gap-2 mb-5">
        {EXAM_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleExamChange(opt.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              background: examFilter === opt.value ? '#1d4ed8' : 'rgba(12,31,61,0.06)',
              color: examFilter === opt.value ? '#fff' : 'rgba(12,31,61,0.6)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(12,31,61,0.07)', boxShadow: '0 1px 4px rgba(12,31,61,0.06)' }}>
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{ gridTemplateColumns: '1fr 90px 80px 70px 130px', color: 'rgba(12,31,61,0.45)', borderBottom: '1px solid rgba(12,31,61,0.06)' }}
        >
          <span>Usuario</span>
          <span>Examen</span>
          <span>Correctas</span>
          <span>Puntaje</span>
          <span>Fecha</span>
        </div>

        {loading ? (
          <div className="divide-y divide-black/5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 px-5 flex items-center gap-4">
                <div className="h-3 rounded-full animate-pulse flex-1" style={{ background: '#e5e7eb' }} />
                <div className="h-3 rounded-full animate-pulse w-20" style={{ background: '#e5e7eb' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {sesiones.map(s => {
              const color = EXAM_COLORS[s.exam_id] || '#64748b';
              return (
                <div
                  key={s.id}
                  className="grid items-center px-5 py-2.5 text-sm"
                  style={{ gridTemplateColumns: '1fr 90px 80px 70px 130px' }}
                >
                  <p className="truncate text-xs" style={{ color: 'rgba(12,31,61,0.6)' }}>{s.user_email}</p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                    style={{ background: color + '18', color }}
                  >
                    {s.exam_id}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(12,31,61,0.55)' }}>
                    {s.correct ?? 0}/{s.total ?? 0}
                  </span>
                  <div>
                    <ScoreBar score={s.score ?? 100} />
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>
                    {formatDate(s.date)}
                  </span>
                </div>
              );
            })}
            {sesiones.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: 'rgba(12,31,61,0.4)' }}>
                Sin sesiones para este filtro
              </div>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-xl hover:bg-black/5 transition-colors disabled:opacity-40">
              <ChevronLeft size={16} style={{ color: '#0c1f3d' }} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-xl hover:bg-black/5 transition-colors disabled:opacity-40">
              <ChevronRight size={16} style={{ color: '#0c1f3d' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
