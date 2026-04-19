-- ═══════════════════════════════════════════════════════════════════
-- Migración: Modo Ensayo Seguro — columnas de integridad académica
-- Ejecuta esto en: proyecto Supabase → SQL Editor → Run
-- Es seguro correr varias veces (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

alter table sesiones
  add column if not exists security_events   jsonb default '[]',
  add column if not exists security_warnings int   default 0;
