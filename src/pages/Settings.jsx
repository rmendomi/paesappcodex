import { useEffect, useRef, useState } from 'react';
import { Save, User, Target, CheckCircle, Loader2, Plus, Minus, Search, X, ChevronRight, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exams } from '../data/catalogData';
import { api } from '../api';

const REGIONES = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
];

const DEFAULT_TARGETS = {
  lectora: 700,
  m1: 700,
  m2: 680,
  historia: 690,
  ciencias: 710,
};

const TARGET_MIN = 100;
const TARGET_MAX = 1000;
const TARGET_STEP = 10;
const QUICK_TARGETS = [650, 700, 750, 800];

function clampTarget(value) {
  const numeric = Number.parseInt(String(value), 10);
  if (Number.isNaN(numeric)) return TARGET_MIN;
  return Math.min(TARGET_MAX, Math.max(TARGET_MIN, numeric));
}

function buildTargetInputs(targets) {
  return Object.fromEntries(
    Object.entries(targets || DEFAULT_TARGETS).map(([key, value]) => [key, String(value ?? 700)])
  );
}

function resizeImageAsDataUrl(file, maxSide = 320, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Formato de imagen no válido.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxSide || height > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo preparar la imagen.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const { user, updateProfile, saveObjetivos } = useAuth();

  const initialTargets = user?.targets || DEFAULT_TARGETS;

  const [name, setName] = useState(user?.name || '');
  const [picture, setPicture] = useState(user?.picture || '');
  const [school, setSchool] = useState(user?.school || '');
  const [region, setRegion] = useState(user?.region || '');
  const [colegioId, setColegioId] = useState(
    user?.colegioId !== null && user?.colegioId !== undefined ? String(user.colegioId) : ''
  );
  const [colegios, setColegios] = useState([]);
  const [loadingColegios, setLoadingColegios] = useState(false);
  const [grade, setGrade] = useState(user?.gradeLevel || '4° Medio');
  const [targets, setTargets] = useState({ ...initialTargets });
  const [targetInputs, setTargetInputs] = useState(buildTargetInputs(initialTargets));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Estado objetivos académicos ─────────────────────────────────────────────
  const [showObjEditor,    setShowObjEditor]    = useState(false);
  const [universidades,    setUniversidades]    = useState([]);
  const [loadingUnis,      setLoadingUnis]      = useState(false);
  const [objUniId,         setObjUniId]         = useState('');
  const [objCarreras,      setObjCarreras]      = useState([]);
  const [loadingObjCar,    setLoadingObjCar]    = useState(false);
  const [uniSearch,        setUniSearch]        = useState('');
  const [objSelectedCar,   setObjSelectedCar]   = useState(null);
  const [savingObjetivos,  setSavingObjetivos]  = useState(false);
  const [objSaved,         setObjSaved]         = useState(false);
  // Secundarios en editor
  const [secObjs,          setSecObjs]          = useState(user?.objetivosSecundarios || []);
  const [addingSecIdx,     setAddingSecIdx]     = useState(-1);
  const [secUniId,         setSecUniId]         = useState('');
  const [secCarreras,      setSecCarreras]      = useState([]);
  const [secUniSearch,     setSecUniSearch]     = useState('');

  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoInfo, setPhotoInfo] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!region) {
      setColegios([]);
      setLoadingColegios(false);
      return () => {
        active = false;
      };
    }

    setLoadingColegios(true);
    api
      .getColegiosByRegion(region)
      .then((data) => {
        if (!active) return;
        setColegios(data || []);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[Settings:getColegiosByRegion]', err);
        setColegios([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingColegios(false);
      });

    return () => {
      active = false;
    };
  }, [region]);

  useEffect(() => {
    if (!colegioId || colegioId === 'none') return;
    const selected = colegios.find((colegio) => String(colegio.id) === colegioId);
    if (selected?.nombre) setSchool(selected.nombre);
  }, [colegioId, colegios]);

  const handleRegionChange = (nextRegion) => {
    setRegion(nextRegion);
    setColegioId('');

    if (!nextRegion) {
      setSchool(user?.school || '');
      return;
    }

    setSchool('');
  };

  const handleColegioChange = (nextColegioId) => {
    setColegioId(nextColegioId);

    if (!nextColegioId || nextColegioId === 'none') {
      setSchool('');
      return;
    }

    const selected = colegios.find((colegio) => String(colegio.id) === nextColegioId);
    setSchool(selected?.nombre || '');
  };

  const setTargetValue = (id, rawValue) => {
    const clamped = clampTarget(rawValue);
    setTargets((prev) => ({ ...prev, [id]: clamped }));
    setTargetInputs((prev) => ({ ...prev, [id]: String(clamped) }));
  };

  const handleTargetInputChange = (id, rawValue) => {
    if (!/^\d{0,4}$/.test(rawValue)) return;
    setTargetInputs((prev) => ({ ...prev, [id]: rawValue }));

    if (rawValue === '') return;
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return;
    setTargets((prev) => ({ ...prev, [id]: Math.min(TARGET_MAX, Math.max(TARGET_MIN, parsed)) }));
  };

  const commitTargetInput = (id) => {
    setTargetValue(id, targetInputs[id]);
  };

  const adjustTarget = (id, delta) => {
    const current = targets[id] ?? 700;
    setTargetValue(id, current + delta);
  };

  const persistPicture = async (nextPicture, successMessage) => {
    setPhotoError('');
    setPhotoInfo('');
    setSavingPhoto(true);
    try {
      await updateProfile({ picture: nextPicture });
      setPicture(nextPicture);
      setPhotoInfo(successMessage);
    } catch (err) {
      console.error('[Settings:persistPicture]', err);
      setPhotoError(err?.message || 'No se pudo guardar la foto en la base de datos.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = async () => {
    if (processingPhoto || savingPhoto) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    await persistPicture('', 'Foto eliminada.');
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setPhotoInfo('');

    if (!file.type.startsWith('image/')) {
      setPhotoError('Debes seleccionar una imagen válida.');
      e.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('La imagen supera 8MB. Elige una más liviana.');
      e.target.value = '';
      return;
    }

    setProcessingPhoto(true);
    try {
      const dataUrl = await resizeImageAsDataUrl(file);
      if (dataUrl.length > 220_000) {
        throw new Error('La imagen sigue siendo muy grande. Usa una imagen más pequeña.');
      }
      await persistPicture(dataUrl, 'Foto guardada en tu perfil.');
    } catch (err) {
      console.error('[Settings:photo]', err);
      setPhotoError(err?.message || 'No se pudo cargar la foto.');
    } finally {
      setProcessingPhoto(false);
      e.target.value = '';
    }
  };

  // Cargar universidades cuando se abre el editor
  useEffect(() => {
    if (!showObjEditor || universidades.length > 0) return;
    setLoadingUnis(true);
    api.getUniversidades()
      .then(setUniversidades)
      .catch(() => {})
      .finally(() => setLoadingUnis(false));
  }, [showObjEditor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar carreras al seleccionar universidad en objetivo principal
  useEffect(() => {
    if (!objUniId) { setObjCarreras([]); return; }
    setLoadingObjCar(true);
    api.getCarrerasByUniversidad(objUniId)
      .then(setObjCarreras)
      .catch(() => setObjCarreras([]))
      .finally(() => setLoadingObjCar(false));
  }, [objUniId]);

  // Cargar carreras de secundario
  useEffect(() => {
    if (!secUniId) { setSecCarreras([]); return; }
    api.getCarrerasByUniversidad(secUniId).then(setSecCarreras).catch(() => setSecCarreras([]));
  }, [secUniId]);

  const unisFiltradas = universidades.filter(u =>
    u.nombre.toLowerCase().includes(uniSearch.toLowerCase()) ||
    u.abbr?.toLowerCase().includes(uniSearch.toLowerCase())
  );

  const objUniSeleccionada = universidades.find(u => u.id === objUniId);

  const handleSaveObjetivos = async () => {
    setSavingObjetivos(true);
    try {
      const uni = universidades.find(u => u.id === objUniId);
      const principal = objSelectedCar
        ? {
            carrera_id:         objSelectedCar.id,
            universidad_id:     objUniId,
            carrera_nombre:     objSelectedCar.nombre,
            universidad_nombre: uni?.nombre || objUniId,
            puntaje_corte:      objSelectedCar.puntaje_corte,
            ponderaciones:      objSelectedCar.ponderaciones,
          }
        : user?.objetivoPrincipal || null;
      await saveObjetivos(principal, secObjs.filter(Boolean));
      setObjSaved(true);
      setTimeout(() => { setObjSaved(false); setShowObjEditor(false); }, 1800);
    } catch (err) {
      console.error('[Settings:saveObjetivos]', err);
    } finally {
      setSavingObjetivos(false);
    }
  };

  const addSecundario = (carrera, uniId) => {
    const uni = universidades.find(u => u.id === uniId);
    const obj = {
      carrera_id:         carrera.id,
      universidad_id:     uniId,
      carrera_nombre:     carrera.nombre,
      universidad_nombre: uni?.nombre || uniId,
      puntaje_corte:      carrera.puntaje_corte,
      ponderaciones:      carrera.ponderaciones,
    };
    setSecObjs(prev => {
      const next = [...prev];
      if (addingSecIdx >= 0) next[addingSecIdx] = obj;
      else next.push(obj);
      return next.slice(0, 2);
    });
    setAddingSecIdx(-1);
    setSecUniId('');
    setSecCarreras([]);
    setSecUniSearch('');
  };

  const averageTarget = Math.round(
    Object.values(targets).reduce((sum, value) => sum + value, 0) /
      Math.max(Object.values(targets).length, 1)
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');

    const rawColegioId = colegioId && colegioId !== 'none' ? Number(colegioId) : null;
    const normalizedColegioId = Number.isFinite(rawColegioId) ? rawColegioId : null;

    try {
      await updateProfile({
        name,
        school,
        region: region || null,
        colegioId: normalizedColegioId,
        gradeLevel: grade,
        targets,
        targetScore: averageTarget,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('[Settings:save]', err);
      setSaveError(err?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 py-8 max-w-3xl space-y-8">
      <div className="fade-up delay-1">
        <h1 className="font-display text-3xl font-light" style={{ color: '#0c1f3d' }}>
          Configuración <em>del perfil</em>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(12,31,61,0.45)' }}>
          Personaliza tus datos y metas PAES.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 fade-up delay-2">
        <div
          className="p-6 rounded-3xl"
          style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <User size={16} style={{ color: '#1d4ed8' }} />
            <h2 className="font-display text-lg font-semibold" style={{ color: '#0c1f3d' }}>
              Datos personales
            </h2>
          </div>

          {user?.email && (
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Cuenta Google
              </label>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(59,130,246,0.05)',
                  border: '1.5px solid rgba(59,130,246,0.12)',
                  color: 'rgba(12,31,61,0.6)',
                }}
              >
                {user.picture && (
                  <img src={user.picture} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                )}
                {user.email}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
              Foto de perfil
            </label>
            <div className="flex items-center gap-4">
              {picture ? (
                <img
                  src={picture}
                  alt="Foto de perfil"
                  className="w-14 h-14 rounded-full object-cover"
                  style={{ border: '1.5px solid rgba(12,31,61,0.12)' }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1.5px solid rgba(59,130,246,0.2)' }}
                >
                  {name?.trim()?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePickPhoto}
                  disabled={processingPhoto || savingPhoto}
                  className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                  style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}
                >
                  {(processingPhoto || savingPhoto) ? 'Guardando...' : 'Cargar foto'}
                </button>
                {picture && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={processingPhoto || savingPhoto}
                    className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="mt-1.5 text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>
              Se guarda automáticamente al seleccionarla.
            </p>
            {photoInfo && (
              <p className="mt-1 text-xs" style={{ color: '#059669' }}>
                {photoInfo}
              </p>
            )}
            {photoError && (
              <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>
                {photoError}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Nombre completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Región
              </label>
              <select
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none cursor-pointer"
                style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
              >
                <option value="">Selecciona tu región</option>
                {REGIONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {region && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
                  Colegio / Institución
                </label>
                <select
                  value={colegioId}
                  onChange={(e) => handleColegioChange(e.target.value)}
                  disabled={loadingColegios}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none cursor-pointer disabled:cursor-wait"
                  style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
                >
                  <option value="">{loadingColegios ? 'Cargando colegios...' : 'Selecciona tu colegio (opcional)'}</option>
                  <option value="none">No tengo colegio / Independiente</option>
                  {colegios.map((colegio) => (
                    <option key={colegio.id} value={String(colegio.id)}>
                      {colegio.nombre}
                      {colegio.comuna ? ` - ${colegio.comuna}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!region && school && (
              <div
                className="px-3 py-2 rounded-xl text-xs"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', color: 'rgba(12,31,61,0.55)' }}
              >
                Colegio actual guardado: {school}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(12,31,61,0.5)' }}>
                Curso
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none cursor-pointer"
                style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
              >
                {['1° Medio', '2° Medio', '3° Medio', '4° Medio', 'Egresado'].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Panel Objetivos Académicos ── */}
        <div className="p-6 rounded-3xl" style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)' }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap size={16} style={{ color: '#1d4ed8' }} />
              <h2 className="font-display text-lg font-semibold" style={{ color: '#0c1f3d' }}>
                Objetivo académico
              </h2>
            </div>
            <button
              type="button"
              onClick={() => { setShowObjEditor(e => !e); setSecObjs(user?.objetivosSecundarios || []); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}
            >
              {showObjEditor ? 'Cerrar' : 'Editar'}
            </button>
          </div>

          {/* Objetivo principal actual */}
          {user?.objetivoPrincipal ? (
            <div className="p-3 rounded-xl mb-3"
              style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.15)' }}>
              <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>Principal</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: '#0c1f3d' }}>
                {user.objetivoPrincipal.carrera_nombre}
              </p>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>
                {user.objetivoPrincipal.universidad_nombre}
                {user.objetivoPrincipal.puntaje_corte ? ` · Corte: ${user.objetivoPrincipal.puntaje_corte} pts` : ''}
              </p>
            </div>
          ) : (
            <p className="text-xs mb-3" style={{ color: 'rgba(12,31,61,0.4)' }}>
              No has configurado un objetivo. Define tu carrera y universidad meta para personalizar tu plan de estudio.
            </p>
          )}

          {/* Secundarios actuales */}
          {(user?.objetivosSecundarios || []).map((sec, i) => sec ? (
            <div key={i} className="p-2.5 rounded-xl mb-2"
              style={{ background: 'rgba(12,31,61,0.03)', border: '1px solid rgba(12,31,61,0.07)' }}>
              <p className="text-xs font-semibold" style={{ color: 'rgba(12,31,61,0.5)' }}>Secundaria {i + 1}</p>
              <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{sec.carrera_nombre}</p>
              <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>{sec.universidad_nombre}</p>
            </div>
          ) : null)}

          {/* Editor inline */}
          {showObjEditor && (
            <div className="mt-4 border-t pt-4 space-y-4" style={{ borderColor: 'rgba(12,31,61,0.08)' }}>
              <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>Cambiar objetivo principal</p>

              {/* Buscador universidad */}
              {!objSelectedCar && (
                <>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(12,31,61,0.4)' }} />
                    <input
                      value={uniSearch}
                      onChange={e => { setUniSearch(e.target.value); setObjUniId(''); }}
                      placeholder="Buscar universidad…"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
                      style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }}
                    />
                  </div>
                  {loadingUnis ? (
                    <div className="py-3 text-center"><Loader2 size={14} className="animate-spin inline" style={{ color: '#1d4ed8' }} /></div>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {unisFiltradas.slice(0, 10).map(u => (
                        <button key={u.id} type="button"
                          onClick={() => { setObjUniId(u.id); setUniSearch(''); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-blue-50 transition-colors"
                          style={{ background: objUniId === u.id ? 'rgba(29,78,216,0.08)' : 'transparent', border: objUniId === u.id ? '1.5px solid rgba(29,78,216,0.25)' : '1.5px solid transparent' }}>
                          <span className="text-base">{u.logo}</span>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{u.abbr || u.nombre}</p>
                            <p className="text-xs" style={{ color: 'rgba(12,31,61,0.4)' }}>{u.ciudad}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Carreras */}
              {objUniId && !objSelectedCar && (
                <>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setObjUniId('')} className="text-xs" style={{ color: '#1d4ed8' }}>← Volver</button>
                    <span className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{objUniSeleccionada?.abbr}</span>
                  </div>
                  {loadingObjCar ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#1d4ed8' }} />
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {objCarreras.map(c => (
                        <button key={c.id} type="button" onClick={() => setObjSelectedCar(c)}
                          className="w-full flex justify-between items-center px-3 py-2 rounded-xl text-xs hover:bg-blue-50 transition-colors"
                          style={{ color: '#0c1f3d', border: '1px solid rgba(12,31,61,0.07)' }}>
                          <span className="font-medium">{c.nombre}</span>
                          <span style={{ color: 'rgba(12,31,61,0.4)' }}>{c.puntaje_corte} pts</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {objSelectedCar && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(29,78,216,0.08)', border: '1.5px solid rgba(29,78,216,0.2)' }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{objSelectedCar.nombre}</p>
                    <p className="text-xs" style={{ color: 'rgba(12,31,61,0.5)' }}>{objUniSeleccionada?.nombre}</p>
                  </div>
                  <button type="button" onClick={() => { setObjSelectedCar(null); setObjUniId(''); }}><X size={13} style={{ color: 'rgba(12,31,61,0.4)' }} /></button>
                </div>
              )}

              {/* Secundarios */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(12,31,61,0.6)' }}>Opciones secundarias</p>
                {secObjs.map((sec, i) => sec ? (
                  <div key={i} className="flex items-center justify-between px-2.5 py-2 rounded-xl mb-1.5"
                    style={{ background: 'rgba(12,31,61,0.03)', border: '1px solid rgba(12,31,61,0.07)' }}>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>{sec.carrera_nombre}</p>
                      <p className="text-xs" style={{ color: 'rgba(12,31,61,0.45)' }}>{sec.universidad_nombre}</p>
                    </div>
                    <button type="button" onClick={() => setSecObjs(prev => prev.map((s, j) => j === i ? null : s).filter(Boolean))}>
                      <X size={12} style={{ color: 'rgba(12,31,61,0.35)' }} />
                    </button>
                  </div>
                ) : null)}

                {secObjs.filter(Boolean).length < 2 && addingSecIdx === -1 && (
                  <button type="button" onClick={() => setAddingSecIdx(secObjs.filter(Boolean).length)}
                    className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                    + Agregar secundaria
                  </button>
                )}

                {addingSecIdx >= 0 && (
                  <div className="mt-2 p-2.5 rounded-xl" style={{ background: '#f8faff', border: '1.5px solid rgba(12,31,61,0.08)' }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: '#0c1f3d' }}>Nueva secundaria</p>
                      <button type="button" onClick={() => { setAddingSecIdx(-1); setSecUniId(''); }}><X size={12} style={{ color: 'rgba(12,31,61,0.4)' }} /></button>
                    </div>
                    <div className="relative mb-1.5">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(12,31,61,0.4)' }} />
                      <input value={secUniSearch} onChange={e => { setSecUniSearch(e.target.value); setSecUniId(''); }}
                        placeholder="Universidad…" className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: 'white', border: '1.5px solid rgba(12,31,61,0.1)', color: '#0c1f3d' }} />
                    </div>
                    {!secUniId ? (
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {universidades.filter(u => u.nombre.toLowerCase().includes(secUniSearch.toLowerCase())).slice(0, 6).map(u => (
                          <button key={u.id} type="button" onClick={() => setSecUniId(u.id)}
                            className="w-full text-left px-2 py-1 rounded text-xs hover:bg-blue-50" style={{ color: '#0c1f3d' }}>
                            {u.logo} {u.abbr || u.nombre}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        <button type="button" onClick={() => setSecUniId('')} className="text-xs mb-1" style={{ color: '#1d4ed8' }}>← Volver</button>
                        {secCarreras.map(c => (
                          <button key={c.id} type="button" onClick={() => addSecundario(c, secUniId)}
                            className="w-full flex justify-between px-2 py-1 rounded text-xs hover:bg-blue-50" style={{ color: '#0c1f3d' }}>
                            <span className="font-medium truncate">{c.nombre}</span>
                            <span style={{ color: 'rgba(12,31,61,0.4)' }}>{c.puntaje_corte}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button type="button" onClick={handleSaveObjetivos} disabled={savingObjetivos}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-60"
                style={{ background: objSaved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#0c1f3d,#1d4ed8)' }}>
                {savingObjetivos ? <><Loader2 size={13} className="animate-spin inline mr-1.5" />Guardando…</> : objSaved ? '✓ Objetivos guardados' : 'Guardar objetivos'}
              </button>
            </div>
          )}
        </div>

        {/* ── Panel Metas de puntaje ── */}
        <div
          className="p-6 rounded-3xl"
          style={{ background: 'white', boxShadow: '0 2px 20px rgba(12,31,61,0.06)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Target size={16} style={{ color: '#1d4ed8' }} />
              <h2 className="font-display text-lg font-semibold" style={{ color: '#0c1f3d' }}>
                Metas de puntaje
              </h2>
            </div>
            <div
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}
            >
              Promedio meta: {averageTarget} pts
            </div>
          </div>
          <p className="text-xs mb-5" style={{ color: 'rgba(12,31,61,0.45)' }}>
            Ahora puedes ajustar con slider, botones +/- o escribir el número directamente.
          </p>
          <div className="space-y-5">
            {exams.map((exam) => {
              const currentTarget = targets[exam.id] || 700;
              return (
                <div key={exam.id} className="p-4 rounded-2xl" style={{ background: '#f8faff', border: '1px solid rgba(12,31,61,0.07)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg">{exam.icon}</span>
                    <p className="text-sm font-semibold flex-1" style={{ color: '#0c1f3d' }}>
                      {exam.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustTarget(exam.id, -TARGET_STEP)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'white', border: '1px solid rgba(12,31,61,0.12)', color: '#0c1f3d' }}
                        aria-label={`Bajar meta de ${exam.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={targetInputs[exam.id] ?? String(currentTarget)}
                        onChange={(e) => handleTargetInputChange(exam.id, e.target.value)}
                        onBlur={() => commitTargetInput(exam.id)}
                        className="w-20 px-3 py-3 rounded-xl text-sm font-semibold text-center outline-none"
                        style={{ background: 'white', border: `1.5px solid ${exam.color}40`, color: exam.color }}
                        aria-label={`Meta numérica para ${exam.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => adjustTarget(exam.id, TARGET_STEP)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'white', border: '1px solid rgba(12,31,61,0.12)', color: '#0c1f3d' }}
                        aria-label={`Subir meta de ${exam.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={TARGET_MIN}
                    max={TARGET_MAX}
                    step={TARGET_STEP}
                    value={currentTarget}
                    onChange={(e) => setTargetValue(exam.id, e.target.value)}
                    className="w-full"
                    aria-label={`Slider de meta para ${exam.name}`}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_TARGETS.map((preset) => (
                      <button
                        key={`${exam.id}_${preset}`}
                        type="button"
                        onClick={() => setTargetValue(exam.id, preset)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: currentTarget === preset ? `${exam.color}20` : 'white',
                          border: `1px solid ${currentTarget === preset ? exam.color : 'rgba(12,31,61,0.12)'}`,
                          color: currentTarget === preset ? exam.color : 'rgba(12,31,61,0.6)',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {saveError && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {saveError}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || processingPhoto || savingPhoto}
          className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-white transition-all hover:scale-105 disabled:opacity-70 disabled:cursor-wait"
          style={{
            background: saved
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #0c1f3d, #1d4ed8)',
          }}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Guardando...
            </>
          ) : saved ? (
            <>
              <CheckCircle size={16} /> Guardado ✓
            </>
          ) : (
            <>
              <Save size={16} /> Guardar cambios
            </>
          )}
        </button>
      </form>
    </div>
  );
}
