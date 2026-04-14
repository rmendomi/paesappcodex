-- ═══════════════════════════════════════════════════════════════════
-- PAES App — Mejoras Planificador IA
-- Ejecutar en Supabase SQL Editor (en orden)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Ampliar tabla usuarios ──────────────────────────────────────
-- Objetivo académico principal: { carrera_id, universidad_id, carrera_nombre, universidad_nombre }
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS objetivo_principal     jsonb    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS objetivos_secundarios  jsonb    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completado  boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS diagnostico_completado boolean  DEFAULT false;

-- ── 2. Ampliar tabla planner ───────────────────────────────────────
-- Guardar el contenido completo del plan generado (7 días con sesiones y texto)
ALTER TABLE planner
  ADD COLUMN IF NOT EXISTS plan_content  jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS generated_by  text  DEFAULT 'heuristic';

-- ── 3. Tabla diagnostico ───────────────────────────────────────────
-- Almacena resultados del diagnóstico inicial por usuario.
-- Permite múltiples versiones (el usuario puede rehacer el diagnóstico).
CREATE TABLE IF NOT EXISTS diagnostico (
  id           uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   text                     NOT NULL REFERENCES usuarios(email) ON DELETE CASCADE,
  resultados   jsonb                    NOT NULL DEFAULT '{}',
  -- Estructura de resultados:
  -- { "lectora": { "correct": 1, "total": 2, "score_estimado": 550 },
  --   "m1": { "correct": 2, "total": 2, "score_estimado": 700 }, ... }
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  version      integer                  NOT NULL DEFAULT 1
);

-- Índice único: un registro por usuario por versión
CREATE UNIQUE INDEX IF NOT EXISTS diagnostico_user_version_idx
  ON diagnostico (user_email, version);

-- ── 4. Tabla universidades ─────────────────────────────────────────
-- Datos reales CRUCH 2024. Fuente: DEMRE / sitios oficiales de cada universidad.
-- Última actualización: 2024-11-01 (proceso admisión 2024).
CREATE TABLE IF NOT EXISTS universidades (
  id           text  PRIMARY KEY,          -- ej: 'puc', 'uchile', 'usach'
  nombre       text  NOT NULL,
  abbr         text,
  tipo         text,                        -- 'Estatal' | 'Privada CRUCH' | 'Privada'
  ciudad       text,
  acreditacion integer,                    -- años de acreditación CNA
  descripcion  text,
  color        text,
  logo         text,
  fuente       text DEFAULT 'DEMRE/CRUCH 2024',
  anio         integer DEFAULT 2024,
  actualizado_at date DEFAULT CURRENT_DATE
);

-- ── 5. Tabla carreras ──────────────────────────────────────────────
-- Carreras de cada universidad con ponderaciones PAES reales.
-- Fuente: DEMRE proceso admisión 2024.
CREATE TABLE IF NOT EXISTS carreras (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  universidad_id  text    NOT NULL REFERENCES universidades(id) ON DELETE CASCADE,
  nombre          text    NOT NULL,
  ponderaciones   jsonb   NOT NULL DEFAULT '{}',
  -- Estructura ponderaciones:
  -- { "nem": 0.1, "lectora": 0.2, "m1": 0.3, "m2": 0.3, "historia": 0.0, "ciencias": 0.1 }
  -- Las claves presentes son las que se ponderan. La suma DEBE ser 1.0.
  puntaje_corte   integer,
  vacantes        integer,
  fuente          text    DEFAULT 'DEMRE/CRUCH 2024',
  anio            integer DEFAULT 2024,
  actualizado_at  date    DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS carreras_universidad_id_idx ON carreras (universidad_id);
CREATE INDEX IF NOT EXISTS carreras_nombre_idx         ON carreras USING gin (to_tsvector('spanish', nombre));
