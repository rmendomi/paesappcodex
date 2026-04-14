import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Trash2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;

const EXAM_OPTS = [
  { value: '', label: 'Todos los exámenes' },
  { value: 'lectora',  label: 'Comprensión Lectora' },
  { value: 'm1',       label: 'Matemática M1' },
  { value: 'm2',       label: 'Matemática M2' },
  { value: 'historia', label: 'Historia' },
  { value: 'ciencias', label: 'Ciencias' },
];

const EXAM_COLORS = { lectora: '#2563eb', m1: '#7c3aed', m2: '#9333ea', historia: '#b45309', ciencias: '#059669' };

function ExamBadge({ examId }) {
  const color = EXAM_COLORS[examId] || '#64748b';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color }}
    >
      {examId}
    </span>
  );
}

function PreguntaRow({ p, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-black/5 last:border-0">
      <div
        className="grid items-start px-5 py-3 text-sm gap-2"
        style={{ gridTemplateColumns: '90px 80px 1fr 60px 40px' }}
      >
        <ExamBadge examId={p.exam_id} />
        <span className="text-xs truncate pt-0.5" style={{ color: 'rgba(12,31,61,0.5)' }}>{p.skill_id}</span>
        <div className="min-w-0">
          <p
            className={`text-sm leading-snug ${expanded ? '' : 'line-clamp-2'}`}
            style={{ color: '#0c1f3d' }}
          >
            {p.text}
          </p>
          {p.explanation && expanded && (
            <p className="mt-2 text-xs leading-snug" style={{ color: 'rgba(12,31,61,0.5)' }}>
              <span className="font-semibold">Explicación:</span> {p.explanation}
            </p>
          )}
        </div>
        <span className="text-xs text-center pt-0.5" style={{ color: 'rgba(12,31,61,0.4)' }}>
          {p.veces_usada ?? 0}×
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
            title={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded
              ? <ChevronUp  size={14} style={{ color: 'rgba(12,31,61,0.4)' }} />
              : <ChevronDown size={14} style={{ color: 'rgba(12,31,61,0.4)' }} />}
          </button>
          <button
            disabled={deleting}
            onClick={() => onDelete(p.id)}
            className="p-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Eliminar pregunta"
          >
            <Trash2 size={14} style={{ color: deleting ? '#9ca3af' : '#ef4444' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPreguntas({ onNavigate }) {
  const { isAdmin } = useAuth();
  const [preguntas, setPreguntas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [examFilter, setExamFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback((p, exam) => {
    setLoading(true);
    setError(null);
    api.adminGetPreguntas({ page: p, pageSize: PAGE_SIZE, examId: exam || undefined })
      .then(({ preguntas, total }) => { setPreguntas(preguntas); setTotal(total); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (isAdmin) load(page, examFilter); }, [isAdmin, page, examFilter, load]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta pregunta del banco? Esta acción no se puede deshacer.')) return;
    setDeleting(id);
    try {
      await api.adminDeletePregunta(id);
      setPreguntas(prev => prev.filter(p => p.id !== id));
      setTotal(t => t - 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleExamChange = (val) => {
    setExamFilter(val);
    setPage(1);
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
        <button onClick={() => onNavigate('admin')} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
          <ChevronLeft size={18} style={{ color: '#0c1f3d' }} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0c1f3d' }}>Banco de Preguntas</h1>
          <p className="text-sm" style={{ color: 'rgba(12,31,61,0.45)' }}>
            {total} pregunta{total !== 1 ? 's' : ''} en total
          </p>
        </div>
      </div>

      {/* Filtro */}
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
        {/* Header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{ gridTemplateColumns: '90px 80px 1fr 60px 40px', color: 'rgba(12,31,61,0.45)', borderBottom: '1px solid rgba(12,31,61,0.06)' }}
        >
          <span>Examen</span>
          <span>Skill</span>
          <span>Texto</span>
          <span className="text-center">Usos</span>
          <span></span>
        </div>

        {loading ? (
          <div className="divide-y divide-black/5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 px-5 flex items-center gap-4">
                <div className="h-3 rounded-full animate-pulse w-16" style={{ background: '#e5e7eb' }} />
                <div className="h-3 rounded-full animate-pulse flex-1" style={{ background: '#e5e7eb' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {preguntas.map(p => (
              <PreguntaRow key={p.id} p={p} onDelete={handleDelete} deleting={deleting === p.id} />
            ))}
            {preguntas.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: 'rgba(12,31,61,0.4)' }}>
                Sin preguntas para este filtro
              </div>
            )}
          </>
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
