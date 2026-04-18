const EXAM_IDS = ['lectora', 'm1', 'm2', 'historia', 'ciencias'];

export const PROGRESS_MODE_OPTIONS = [
  { id: 'all', label: 'Todo' },
  { id: 'practice', label: 'Libre' },
  { id: 'ai_practice', label: 'IA' },
  { id: 'exam', label: 'Ensayo' },
  { id: 'skill', label: 'Habilidad' },
  { id: 'diagnostic', label: 'Diagnostico' },
];

const MODE_LABELS = Object.fromEntries(PROGRESS_MODE_OPTIONS.map((m) => [m.id, m.label]));

export function normalizeProgressMode(mode) {
  if (mode === 'global') return 'exam';
  if (mode === 'diagnostico') return 'diagnostic';
  return mode || 'practice';
}

export function getProgressModeLabel(mode) {
  return MODE_LABELS[normalizeProgressMode(mode)] || 'Practica';
}

export function sessionsForMode(sessions = [], modeFilter = 'all') {
  if (modeFilter === 'all') return sessions || [];
  return (sessions || []).filter((s) => normalizeProgressMode(s.mode) === modeFilter);
}

export function buildProgressStats(sessions = [], modeFilter = 'all') {
  const filtered = sessionsForMode(sessions, modeFilter);
  const stats = {};

  EXAM_IDS.forEach((id) => {
    const examSessions = filtered.filter((s) => s.examId === id);
    stats[id] = {
      attempted: examSessions.length,
      correct: examSessions.reduce((sum, s) => sum + (Number(s.correct) || 0), 0),
      lastScore: examSessions.length > 0 ? Number(examSessions[examSessions.length - 1].score) || 0 : 0,
      trend: examSessions.map((s) => Number(s.score) || 0).filter((score) => score > 0).slice(-5),
    };
  });

  return stats;
}

export function createDiagnosticSessions(userEmail, resultados, version = 1, completedAt) {
  const date = completedAt || new Date().toISOString();
  return Object.entries(resultados || {})
    .filter(([examId]) => EXAM_IDS.includes(examId))
    .map(([examId, result]) => ({
      id: `diagnostic_${userEmail || 'user'}_${version}_${examId}`,
      userEmail,
      examId,
      mode: 'diagnostic',
      correct: Number(result?.correct) || 0,
      total: Number(result?.total) || 0,
      score: Number(result?.score_estimado ?? result?.score) || 0,
      date,
      diagnosticVersion: version,
      isVirtual: true,
    }));
}
