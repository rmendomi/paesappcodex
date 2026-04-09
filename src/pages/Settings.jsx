import { useEffect, useRef, useState } from 'react';
import { Save, User, Target, CheckCircle, Loader2, Plus, Minus } from 'lucide-react';
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
  const { user, updateProfile } = useAuth();

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
