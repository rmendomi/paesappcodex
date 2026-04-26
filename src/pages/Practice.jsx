import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, AlertCircle, Clock, Flag, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getExam, toScore } from '../data/catalogData';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Duración PAES real por examen (en segundos)
const EXAM_DURATIONS = {
  lectora:  100 * 60,
  m1:       100 * 60,
  m2:       100 * 60,
  historia:  85 * 60,
  ciencias: 110 * 60,
};

// Palabras clave PAES que indican qué se pide
const KEYWORD_PATTERNS = [
  // Qué preguntan
  /\b(¿Cuál|¿Qué|¿Cómo|¿Por qué|¿Cuándo|¿Dónde|¿Quién|¿Cuánto|¿Cuántos|¿Cuántas)\b/gi,
  // Verbos de acción que definen la tarea
  /\b(señala|identifica|indica|determina|calcula|resuelve|evalúa|analiza|interpreta|deduce|infiere|explica|define|describe|compara|selecciona|elige|escoge|encuentra|menciona|establece|justifica|argumenta|reconoce|relaciona|clasifica|ordena|caracteriza|según|conforme|basándote|considerando|teniendo en cuenta)\b/gi,
  // Palabras que acotan el contexto
  /\b(EXCEPTO|NO|solo|únicamente|principalmente|principalmente|necesariamente|correctamente|incorrectamente|verdadero|falso|mejor|peor|mayor|menor|máximo|mínimo)\b/g,
];

// Resaltar palabras clave en el texto de una pregunta
function highlightKeywords(text) {
  if (!text) return null;

  const marks = new Array(text.length).fill(false);
  KEYWORD_PATTERNS.forEach(pattern => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        marks[i] = true;
      }
    }
  });

  const segments = [];
  let i = 0;
  while (i < text.length) {
    if (marks[i]) {
      let j = i;
      while (j < text.length && marks[j]) j++;
      segments.push({ text: text.slice(i, j), highlight: true });
      i = j;
    } else {
      let j = i;
      while (j < text.length && !marks[j]) j++;
      segments.push({ text: text.slice(i, j), highlight: false });
      i = j;
    }
  }

  return segments.map((seg, idx) =>
    seg.highlight ? (
      <mark key={idx} style={{
        background: 'rgba(245,158,11,0.25)',
        color: '#92400e',
        borderRadius: '3px',
        padding: '0 2px',
        fontWeight: 600,
      }}>
        {seg.text}
      </mark>
    ) : seg.text
  );
}

function normalizeBodyText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitQuestionText(text) {
  const clean = normalizeBodyText(text);
  const visualMatch = clean.match(/\bRECURSO\s+VISUAL\s*:/i);
  const questionMatch = clean.match(/\bPREGUNTA\s*:/i);

  if (visualMatch) {
    const intro = clean.slice(0, visualMatch.index).trim();
    const afterVisual = clean.slice(visualMatch.index + visualMatch[0].length).trim();
    const nestedQuestionMatch = afterVisual.match(/\bPREGUNTA\s*:/i);
    if (nestedQuestionMatch) {
      return {
        intro,
        visual: afterVisual.slice(0, nestedQuestionMatch.index).trim(),
        question: afterVisual.slice(nestedQuestionMatch.index + nestedQuestionMatch[0].length).trim(),
      };
    }
    return { intro, visual: afterVisual, question: '' };
  }

  if (questionMatch) {
    return {
      intro: clean.slice(0, questionMatch.index).trim(),
      visual: '',
      question: clean.slice(questionMatch.index + questionMatch[0].length).trim(),
    };
  }

  return { intro: clean, visual: '', question: '' };
}

function isVisualBorderLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return true;
  return /^[|+\-_=:\s\u2500-\u257f\\/]+$/.test(trimmed) && !/[A-Za-z0-9$%]/.test(trimmed);
}

function isDecorativeCell(cell) {
  const compact = String(cell || '').replace(/\s/g, '');
  return !compact || /^[\\/^v()\u2190-\u21ff]+$/i.test(compact) || /^h$/i.test(compact);
}

function parsePipeCells(line) {
  if (!line.includes('|')) return [];
  return line
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell && !isVisualBorderLine(cell) && !isDecorativeCell(cell));
}

function parseKeyValue(text) {
  const match = String(text || '').match(/^(.{2,60}?)(?:\s*[:=]\s*)(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function parseVisualResource(text) {
  const lines = normalizeBodyText(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const captions = [];
  const rows = [];
  const directItems = [];

  lines.forEach(line => {
    if (isVisualBorderLine(line)) return;
    const cells = parsePipeCells(line);
    if (cells.length > 0) {
      rows.push(cells);
    } else {
      const item = parseKeyValue(line);
      if (item) {
        directItems.push(item);
      } else {
        captions.push(line.replace(/:$/, ''));
      }
    }
  });

  const tableRows = rows.filter(row => row.length >= 2);
  const listItems = directItems.concat(rows
    .filter(row => row.length === 1)
    .map(row => parseKeyValue(row[0]))
    .filter(Boolean));

  const fallbackLines = rows
    .filter(row => row.length === 1 && !parseKeyValue(row[0]))
    .map(row => row[0]);

  if (tableRows.length >= 2) {
    const columnCount = Math.max(...tableRows.map(row => row.length));
    return {
      captions,
      table: tableRows.map(row => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('')]),
      listItems,
      fallbackLines: [],
    };
  }

  return { captions, table: null, listItems, fallbackLines };
}

function TextParagraphs({ text, highlight = false }) {
  const clean = normalizeBodyText(text).replace(/^TEXTO\s*:\s*/i, '').trim();
  if (!clean) return null;

  return clean.split(/\n{2,}/).map((paragraph, idx) => {
    const readable = paragraph.replace(/\n+/g, ' ').trim();
    if (!readable) return null;
    return (
      <p key={idx} className="text-base leading-8" style={{ color: '#0c1f3d' }}>
        {highlight ? highlightKeywords(readable) : readable}
      </p>
    );
  });
}

function VisualResource({ text }) {
  const parsed = parseVisualResource(text);
  const hasTable = parsed.table && parsed.table.length >= 2;
  const hasList = parsed.listItems.length > 0;
  const hasFallback = parsed.fallbackLines.length > 0;
  if (!hasTable && !hasList && !hasFallback && parsed.captions.length === 0) return null;

  return (
    <figure className="rounded-2xl px-4 py-4 sm:px-5"
      style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.08)' }}>
      <figcaption className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(12,31,61,0.48)' }}>
        Recurso visual
      </figcaption>

      {parsed.captions.map((caption, idx) => (
        <p key={idx} className="text-sm font-semibold mb-3" style={{ color: '#0c1f3d' }}>
          {caption}
        </p>
      ))}

      {hasTable && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ color: '#0c1f3d' }}>
            <thead>
              <tr>
                {parsed.table[0].map((cell, idx) => (
                  <th key={idx} className="text-left px-3 py-2 font-semibold"
                    style={{ background: '#eff6ff', border: '1px solid rgba(12,31,61,0.1)' }}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.table.slice(1).map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2"
                      style={{ background: 'white', border: '1px solid rgba(12,31,61,0.08)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasList && (
        <dl className="grid sm:grid-cols-2 gap-2">
          {parsed.listItems.map((item, idx) => (
            <div key={idx} className="rounded-xl px-3 py-2"
              style={{ background: 'white', border: '1px solid rgba(12,31,61,0.08)' }}>
              <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(12,31,61,0.45)' }}>
                {item.label}
              </dt>
              <dd className="text-sm font-semibold mt-0.5" style={{ color: '#0c1f3d' }}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {hasFallback && (
        <div className="space-y-1">
          {parsed.fallbackLines.map((line, idx) => (
            <p key={idx} className="text-sm leading-7" style={{ color: '#0c1f3d' }}>{line}</p>
          ))}
        </div>
      )}
    </figure>
  );
}

function QuestionBody({ text }) {
  const { intro, visual, question } = splitQuestionText(text);
  const hasSections = Boolean(visual || question);

  if (!hasSections) {
    return (
      <div className="space-y-4">
        <TextParagraphs text={intro} highlight />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TextParagraphs text={intro} />
      {visual && <VisualResource text={visual} />}
      {question && (
        <section className="pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(12,31,61,0.45)' }}>
            Pregunta
          </p>
          <p className="text-base leading-8" style={{ color: '#0c1f3d' }}>
            {highlightKeywords(question)}
          </p>
        </section>
      )}
    </div>
  );
}

function stripExplanationLabel(text) {
  return String(text || '')
    .replace(/^(Idea|Paso\s*\d+|Resultado|Respuesta|Por eso|Conclusion|Conclusi[oó]n|Explicaci[oó]n)\s*:\s*/i, '')
    .trim();
}

function normalizeForSafety(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function mentionsOptionLetter(text) {
  const normalized = normalizeForSafety(text);
  return /\b(opcion|alternativa)\s+[a-e]\b/.test(normalized);
}

function explanationIsUnsafe(text) {
  const normalized = normalizeForSafety(text);
  return (
    /\b(opcion|alternativa)\s+[a-e]\b/.test(normalized) ||
    /\b(la|el)\s+[a-e]\s+(es|era|seria)\s+(correcta|correcto|incorrecta|incorrecto)\b/.test(normalized) ||
    /\bindice\s*\d+\b/.test(normalized)
  );
}

function splitExplanationChunks(text) {
  const prepared = normalizeBodyText(text)
    .replace(/\s+((?:Idea|Paso\s*\d+|Resultado|Respuesta|Por eso|Conclusion|Conclusi[oó]n|Explicaci[oó]n)\s*:)/gi, '\n$1');

  const lineChunks = prepared.split(/\n+/).map(chunk => chunk.trim()).filter(Boolean);
  if (lineChunks.length > 1) return lineChunks;

  return (prepared.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [prepared])
    .map(chunk => chunk.trim())
    .filter(Boolean);
}

function compactExplanationChunks(text) {
  const chunks = splitExplanationChunks(text)
    .map(stripExplanationLabel)
    .map(chunk => chunk.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(chunk => !mentionsOptionLetter(chunk));

  const unique = [];
  chunks.forEach(chunk => {
    const key = chunk.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (key && !unique.some(item => item.key === key)) {
      unique.push({ key, text: chunk });
    }
  });

  return unique.slice(0, 3).map(item => item.text);
}

function looksLikeMathExplanation(text) {
  return /[=+\-*/^]|\b(calcula|promedio|porcentaje|ecuaci[oó]n|multiplica|divide|suma|resta|valor|resultado)\b/i.test(text);
}

function labelExplanationChunk(chunk, idx, total, isMath) {
  if (total === 1) return isMath ? 'Resultado' : 'Por que';
  if (isMath) {
    if (idx === 0) return 'Dato clave';
    if (idx === total - 1) return 'Resultado';
    return `Paso ${idx}`;
  }
  if (idx === 0) return 'Dato clave';
  if (idx === total - 1) return 'Conclusion';
  return 'Relacion';
}

function buildSafeExplanationParts(question, examId) {
  const correctText = question?.options?.[question.correct];
  const isMathExam = examId === 'm1' || examId === 'm2';

  if (isMathExam) {
    return [
      {
        type: 'note',
        number: null,
        label: 'Resultado',
        text: correctText
          ? `El resultado que debe coincidir con la alternativa correcta es: ${correctText}.`
          : 'El resultado correcto es el que coincide con la alternativa marcada.',
      },
      {
        type: 'note',
        number: null,
        label: 'Cómo revisarlo',
        text: 'Vuelve a los datos del enunciado y comprueba una operación a la vez. Si un paso no sale, reporta la pregunta.',
      },
    ];
  }

  return [
    {
      type: 'note',
      number: null,
      label: 'Respuesta',
      text: correctText
        ? `La respuesta correcta afirma: ${correctText}.`
        : 'La respuesta correcta es la que coincide directamente con la información del enunciado.',
    },
    {
      type: 'note',
      number: null,
      label: 'Cómo revisarlo',
      text: 'Busca en el texto o en los datos la idea que respalda exactamente esa afirmación. Descarta opciones que agregan, exageran o cambian información.',
    },
  ];
}

function parseExplanationParts(text, fallbackParts = []) {
  const clean = normalizeBodyText(text);
  if (!clean || explanationIsUnsafe(clean)) return fallbackParts;

  let chunks = compactExplanationChunks(clean);
  if (chunks.length === 0) return fallbackParts;

  const isMath = looksLikeMathExplanation(clean);
  return chunks.map((chunk, idx) => {
    const label = labelExplanationChunk(chunk, idx, chunks.length, isMath);
    const isStep = /^Paso/.test(label);
    return {
      type: isStep ? 'step' : 'note',
      number: isStep ? label.replace(/\D/g, '') : null,
      label,
      text: chunk,
    };
  });
}

function LearningExplanation({ text, question, examId }) {
  const parts = parseExplanationParts(text, buildSafeExplanationParts(question, examId));
  if (parts.length === 0) return null;

  return (
    <div className="space-y-2">
      {parts.map((part, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl px-3 py-2"
          style={{ background: part.type === 'note' ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.45)' }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
            style={{
              background: part.type === 'note' ? 'rgba(29,78,216,0.12)' : 'rgba(12,31,61,0.08)',
              color: part.type === 'note' ? '#1d4ed8' : 'rgba(12,31,61,0.65)',
            }}>
            {part.type === 'step' ? part.number : 'i'}
          </span>
          <p className="text-sm leading-7" style={{ color: 'rgba(12,31,61,0.72)' }}>
            <span className="font-semibold" style={{ color: '#0c1f3d' }}>{part.label}: </span>
            {part.text}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Practice({ data, onFinish, onBack }) {
  const { examId, questions, mode = 'practice', skillId, skillName } = data;
  const exam = getExam(examId);
  const isExamMode = mode === 'exam' || mode === 'skill';

  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [selected,    setSelected]    = useState(null);
  const [confirmed,   setConfirmed]   = useState(false);
  const [answers,     setAnswers]     = useState([]);
  const [reported,    setReported]    = useState({});
  const [reportToast, setReportToast] = useState(false);

  // Timer: solo en modo ensayo
  const totalSeconds = isExamMode ? (EXAM_DURATIONS[examId] || 100 * 60) : 0;
  const [timeLeft,   setTimeLeft]   = useState(totalSeconds);
  const [timerDone,  setTimerDone]  = useState(false);

  // Modo ensayo seguro
  const [safeExamReady,      setSafeExamReady]      = useState(!isExamMode);
  const [safeCommitted,      setSafeCommitted]      = useState(false);
  const [fsWarning,          setFsWarning]          = useState(false);
  const [securityEvents,     setSecurityEvents]     = useState([]);
  const [securityWarnings,   setSecurityWarnings]   = useState(0);
  const [showSecurityOverlay,setShowSecurityOverlay]= useState(false);
  const [securityToast,      setSecurityToast]      = useState(null);

  // Refs para acceso estable en callbacks sin stale closure
  const currentIdxRef      = useRef(0);
  const securityEventsRef  = useRef([]);
  const securityWarningsRef= useRef(0);
  const toastTimerRef      = useRef(null);

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // Salir de fullscreen al desmontar
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Registrar evento de integridad
  const addSecurityEvent = useCallback((type, label) => {
    const event = {
      type,
      label,
      timestamp: new Date().toISOString(),
      questionIndex: currentIdxRef.current,
      mode,
    };
    securityEventsRef.current  = [...securityEventsRef.current, event];
    securityWarningsRef.current += 1;
    setSecurityEvents([...securityEventsRef.current]);
    setSecurityWarnings(securityWarningsRef.current);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSecurityToast('Evento registrado: mantente en la pantalla del ensayo y responde sin ayuda externa.');
    toastTimerRef.current = setTimeout(() => setSecurityToast(null), 4500);
  }, [mode]);

  const finishExam = useCallback((currentAnswers) => {
    const correct = currentAnswers.filter(a => a.correct).length;
    const questionIds = questions.map(q => q.id);
    const wrongIds = currentAnswers.filter(a => !a.correct).map(a => a.questionId);
    onFinish({
      examId, questions, answers: currentAnswers, skillId,
      correct, total: questions.length,
      score: toScore(correct, questions.length),
      mode, questionIds, wrongIds,
      securityEvents:  securityEventsRef.current,
      securityWarnings: securityWarningsRef.current,
    });
  }, [examId, questions, mode, skillId, onFinish]);

  // Countdown timer — espera a que el ensayo seguro esté listo
  useEffect(() => {
    if (!isExamMode || !safeExamReady || timerDone) return;
    if (timeLeft <= 0) {
      setTimerDone(true);
      setAnswers(prev => {
        finishExam(prev);
        return prev;
      });
      return;
    }
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [isExamMode, safeExamReady, timeLeft, timerDone, finishExam]);

  // Monitoreo de integridad — solo en modo ensayo activo
  useEffect(() => {
    if (!isExamMode || !safeExamReady) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addSecurityEvent('tab_hidden', 'Cambio de pestaña o ventana minimizada');
        setShowSecurityOverlay(true);
      } else {
        setShowSecurityOverlay(false);
      }
    };
    const handleBlur = () => {
      addSecurityEvent('window_blur', 'Ventana perdió el foco');
      setShowSecurityOverlay(true);
    };
    const handleFocus  = () => setShowSecurityOverlay(false);
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addSecurityEvent('fullscreen_exit', 'Salió de pantalla completa');
        setShowSecurityOverlay(true);
      } else {
        setShowSecurityOverlay(false);
      }
    };
    const handleCopy = (e) => {
      e.preventDefault();
      addSecurityEvent('copy', 'Intento de copiar texto');
    };
    const handleCut = (e) => {
      e.preventDefault();
      addSecurityEvent('cut', 'Intento de cortar texto');
    };
    const handlePaste = (e) => {
      e.preventDefault();
      addSecurityEvent('paste', 'Intento de pegar texto');
    };
    const handleContextMenu = (e) => {
      e.preventDefault();
      addSecurityEvent('contextmenu', 'Menú contextual (click derecho)');
    };
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'PrintScreen') {
        addSecurityEvent('printscreen', 'Posible intento de captura (PrintScreen)');
      } else if (ctrl && e.key.toLowerCase() === 'c') {
        addSecurityEvent('copy_key', 'Atajo copiar (Ctrl+C)');
      } else if (ctrl && e.key.toLowerCase() === 'v') {
        addSecurityEvent('paste_key', 'Atajo pegar (Ctrl+V)');
      } else if (ctrl && e.key.toLowerCase() === 'x') {
        addSecurityEvent('cut_key', 'Atajo cortar (Ctrl+X)');
      } else if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        addSecurityEvent('print', 'Intento de imprimir (Ctrl+P)');
      } else if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        addSecurityEvent('save', 'Atajo guardar (Ctrl+S)');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExamMode, safeExamReady, addSecurityEvent]);

  // Iniciar ensayo seguro: solicitar fullscreen y activar monitoreo
  const handleStartSafeExam = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFsWarning(true);
    }
    setSafeExamReady(true);
  };

  const q        = questions[currentIdx];
  const isLast   = currentIdx === questions.length - 1;
  const progress = Math.round(((currentIdx + (confirmed ? 1 : 0)) / questions.length) * 100);

  const timerPct    = totalSeconds > 0 ? timeLeft / totalSeconds : 1;
  const timerColor  = timerPct > 0.33 ? '#10b981' : timerPct > 0.15 ? '#f59e0b' : '#ef4444';
  const timerBg     = timerPct > 0.33 ? 'rgba(16,185,129,0.08)' : timerPct > 0.15 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  const timerBorder = timerPct > 0.33 ? 'rgba(16,185,129,0.2)' : timerPct > 0.15 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.3)';

  const handleConfirm = () => {
    if (selected === null) return;
    const newAnswer = {
      questionId: q.id,
      selected,
      correct: selected === q.correct,
      question: q,
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    if (isExamMode) {
      if (isLast) {
        finishExam(newAnswers);
      } else {
        setCurrentIdx(i => i + 1);
        setSelected(null);
      }
    } else {
      setConfirmed(true);
    }
  };

  const handleReport = (questionId) => {
    setReported(prev => ({ ...prev, [questionId]: true }));
    setReportToast(true);
    setTimeout(() => setReportToast(false), 3500);
    try {
      const key = 'paes_reported_questions';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      if (!existing.includes(questionId)) {
        localStorage.setItem(key, JSON.stringify([...existing, questionId]));
      }
    } catch { /* no crítico */ }
  };

  const handleNext = () => {
    if (isLast) {
      finishExam(answers);
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setConfirmed(false);
    }
  };

  const optionClass = (idx) => {
    if (!confirmed || isExamMode) return selected === idx ? 'option-selected' : '';
    if (idx === q.correct)                         return 'option-correct';
    if (idx === selected && idx !== q.correct)     return 'option-wrong';
    return '';
  };

  // ── Modal de compromiso (ensayo seguro) ──────────────────────────────
  if (isExamMode && !safeExamReady) {
    return (
      <div className="min-h-screen grain flex items-center justify-center p-4"
        style={{ background: '#f8faff' }}>
        <div className="w-full max-w-lg rounded-3xl p-8"
          style={{ background: 'white', boxShadow: '0 30px 80px rgba(12,31,61,0.15)', border: '1px solid rgba(12,31,61,0.06)' }}>

          {/* Icono + título */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <ShieldCheck size={22} style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold" style={{ color: '#0c1f3d' }}>
                Ensayo seguro
              </h2>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>
                Integridad académica — {exam.icon} {skillName || exam.name}
              </p>
            </div>
          </div>

          {/* Mensaje principal */}
          <div className="p-4 rounded-2xl mb-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.28)' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#92400e' }}>
              Recuerda: responder con IA no te ayuda. En la PAES real no tendrás una IA al lado;
              si hoy haces trampa, después no sabrás hacerlo solo.{' '}
              <strong>Te haces un daño.</strong>
            </p>
          </div>

          {/* Reglas */}
          <div className="p-4 rounded-2xl mb-5"
            style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.08)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(12,31,61,0.6)' }}>
              Durante este ensayo <strong style={{ color: '#0c1f3d' }}>no está permitido</strong> usar
              ChatGPT, Gemini, Copilot u otra IA para responder; tampoco grabar la pantalla, sacar capturas,
              copiar preguntas, cambiar de pestaña, usar buscadores, celulares, apuntes o pedir ayuda externa.
            </p>
          </div>

          {/* Advertencia fullscreen (si aplica) */}
          {fsWarning && (
            <div className="p-3 rounded-xl mb-4"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs" style={{ color: '#991b1b' }}>
                No se pudo activar pantalla completa. Puedes continuar, pero se recomienda usar
                el ensayo en pantalla completa para mayor concentración.
              </p>
            </div>
          )}

          {/* Checkbox de compromiso */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safeCommitted}
              onChange={e => setSafeCommitted(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 rounded"
              style={{ accentColor: '#1d4ed8' }}
            />
            <span className="text-sm leading-relaxed" style={{ color: '#0c1f3d' }}>
              Entiendo y me comprometo a responder sin ayuda externa.
            </span>
          </label>

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="px-5 py-3 rounded-2xl text-sm font-medium transition-all"
              style={{ color: 'rgba(12,31,61,0.5)', border: '1.5px solid rgba(12,31,61,0.12)', background: 'white' }}>
              Cancelar
            </button>
            <button
              onClick={handleStartSafeExam}
              disabled={!safeCommitted}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}>
              <ShieldCheck size={15} />
              Comenzar ensayo seguro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen grain" style={{ background: '#f8faff' }}>

      {/* Overlay de integridad (cambio de pestaña / salida de fullscreen) */}
      {isExamMode && showSecurityOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
          style={{ background: 'rgba(12,31,61,0.92)', backdropFilter: 'blur(8px)' }}>
          <ShieldAlert size={48} style={{ color: '#fbbf24', marginBottom: 20 }} />
          <h2 className="font-display text-2xl font-semibold text-white mb-3 text-center">
            Vuelve al ensayo para continuar
          </h2>
          <p className="text-white/60 text-sm text-center max-w-sm mb-6">
            Este evento quedó registrado. Haz clic en el botón para retomar el ensayo.
          </p>
          <button
            onClick={() => setShowSecurityOverlay(false)}
            className="px-8 py-3.5 rounded-2xl font-semibold text-sm"
            style={{ background: '#1d4ed8', color: 'white' }}>
            Retomar ensayo
          </button>
        </div>
      )}

      {/* Toast reporte enviado */}
      {reportToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-xl"
          style={{ background: '#0c1f3d', border: '1px solid rgba(255,255,255,0.1)' }}>
          Pregunta reportada. Gracias por tu aporte.
        </div>
      )}

      {/* Toast de integridad */}
      {securityToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-xl text-sm font-medium shadow-xl max-w-sm text-center"
          style={{ background: '#92400e', color: 'white', border: '1px solid rgba(245,158,11,0.3)' }}>
          {securityToast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ background: 'rgba(248,250,255,0.95)', borderColor: 'rgba(12,31,61,0.07)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium flex-shrink-0"
            style={{ color: 'rgba(12,31,61,0.5)' }}>
            <ArrowLeft size={15} /> Salir
          </button>

          <div className="flex flex-col items-center min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{exam.icon}</span>
              <span className="font-display font-semibold text-sm truncate" style={{ color: '#0c1f3d' }}>
                {skillName ? skillName : exam.name}
              </span>
            </div>
            {isExamMode && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#991b1b', border: '1px solid rgba(239,68,68,0.2)' }}>
                Modo ensayo
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Contador de integridad */}
            {isExamMode && securityWarnings > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.25)' }}>
                <ShieldAlert size={11} />
                Eventos: {securityWarnings}
              </div>
            )}
            {/* Timer */}
            {isExamMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold"
                style={{ background: timerBg, border: `1px solid ${timerBorder}`, color: timerColor }}>
                <Clock size={13} />
                {formatTime(timeLeft)}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(12,31,61,0.5)' }}>
              <span className="font-semibold" style={{ color: exam.color }}>{currentIdx + 1}</span>
              <span>/</span>
              <span>{questions.length}</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1" style={{ background: '#eff6ff' }}>
          <div className="h-1 transition-all duration-500"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${exam.color}99, ${exam.color})` }} />
        </div>
        {/* Timer bar */}
        {isExamMode && totalSeconds > 0 && (
          <div className="h-0.5" style={{ background: 'rgba(12,31,61,0.05)' }}>
            <div className="h-0.5 transition-all duration-1000"
              style={{ width: `${(timeLeft / totalSeconds) * 100}%`, background: timerColor, opacity: 0.6 }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Question number badge */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="badge" style={{ background: exam.bg, color: exam.color, border: `1px solid ${exam.color}30` }}>
            Pregunta {currentIdx + 1} de {questions.length}
          </span>
          {!isExamMode && confirmed && (
            <span className="badge"
              style={selected === q.correct
                ? { background: 'rgba(16,185,129,0.1)', color: '#065f46', border: '1px solid rgba(16,185,129,0.2)' }
                : { background: 'rgba(239,68,68,0.08)', color: '#991b1b', border: '1px solid rgba(239,68,68,0.2)' }}>
              {selected === q.correct ? '✓ Correcto' : '✗ Incorrecto'}
            </span>
          )}
          {isExamMode && (
            <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.2)' }}>
              Sin retroalimentación
            </span>
          )}
          {q.aiGenerated && (
            <span className="badge" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)' }}>
              {q.fromBanco ? '📚 Del banco' : '✨ IA nueva'}
            </span>
          )}
        </div>

        {/* Question text con keywords resaltadas */}
        <div className="mb-8 p-6 rounded-3xl"
          style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)', border: '1px solid rgba(12,31,61,0.04)' }}>
          <QuestionBody text={q.text} />
          <div className="mt-3 pt-3 flex items-center gap-1.5" style={{ borderTop: '1px solid rgba(12,31,61,0.04)' }}>
            <mark style={{ background: 'rgba(245,158,11,0.25)', color: '#92400e', borderRadius: '3px', padding: '0 2px', fontSize: '11px', fontWeight: 600 }}>
              palabras clave
            </mark>
            <span className="text-xs" style={{ color: 'rgba(12,31,61,0.35)' }}>indican qué te piden</span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {q.options.map((opt, idx) => (
            <button key={idx}
              disabled={confirmed && !isExamMode}
              onClick={() => !(confirmed && !isExamMode) && setSelected(idx)}
              className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl text-left transition-all option-btn ${optionClass(idx)}`}
              style={{
                background: 'white',
                border: '1.5px solid rgba(12,31,61,0.1)',
                boxShadow: '0 1px 8px rgba(12,31,61,0.04)',
              }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5"
                style={{
                  background: (!isExamMode && confirmed && idx === q.correct) ? 'rgba(16,185,129,0.15)' :
                              (!isExamMode && confirmed && idx === selected && idx !== q.correct) ? 'rgba(239,68,68,0.12)' :
                              selected === idx ? 'rgba(59,130,246,0.12)' : 'rgba(12,31,61,0.06)',
                  color: (!isExamMode && confirmed && idx === q.correct) ? '#065f46' :
                         (!isExamMode && confirmed && idx === selected && idx !== q.correct) ? '#991b1b' :
                         selected === idx ? '#1d4ed8' : 'rgba(12,31,61,0.5)',
                }}>
                {LETTERS[idx]}
              </span>
              <span className="text-sm leading-relaxed flex-1" style={{ color: '#0c1f3d' }}>{opt}</span>
              {!isExamMode && confirmed && idx === q.correct && (
                <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
              )}
              {!isExamMode && confirmed && idx === selected && idx !== q.correct && (
                <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              )}
            </button>
          ))}
        </div>

        {/* Explanation (practice mode only) */}
        {!isExamMode && confirmed && (
          <div className="mb-8 p-5 rounded-2xl fade-up delay-1"
            style={{
              background: selected === q.correct ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.07)',
              border: `1px solid ${selected === q.correct ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}`,
            }}>
            <div className="flex items-start gap-3">
              <AlertCircle size={16} style={{ color: selected === q.correct ? '#10b981' : '#1d4ed8', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0c1f3d' }}>
                  {selected === q.correct ? 'Explicación' : `La respuesta correcta era ${LETTERS[q.correct]}`}
                </p>
                <LearningExplanation text={q.explanation} question={q} examId={examId} />
                {q.videoUrl && (
                  <a href={q.videoUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}>
                    ▶ Ver explicación en video
                  </a>
                )}
                <button
                  onClick={() => handleReport(q.id)}
                  disabled={!!reported[q.id]}
                  aria-label="Reportar pregunta incorrecta"
                  title="Reportar pregunta incorrecta"
                  className="inline-flex items-center gap-1.5 mt-2 ml-2 text-xs px-2.5 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
                  style={{ background: 'rgba(239,68,68,0.07)', color: '#991b1b', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <Flag size={11} />
                  {reported[q.id] ? 'Reportada' : 'Reportar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          {!confirmed || isExamMode ? (
            <button
              onClick={handleConfirm}
              disabled={selected === null}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-white transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: `linear-gradient(135deg, ${exam.color}dd, ${exam.color})` }}>
              {isExamMode && isLast ? 'Finalizar ensayo' : isExamMode ? 'Siguiente' : 'Confirmar respuesta'}
              {isExamMode && <ArrowRight size={15} />}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #0c1f3d, #1d4ed8)' }}>
              {isLast ? 'Ver resultados' : 'Siguiente pregunta'}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
