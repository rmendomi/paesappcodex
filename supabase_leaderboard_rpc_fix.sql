-- ═══════════════════════════════════════════════════════════════════════
-- PAES Prep · Fix de Ranking Global (RLS-safe)
-- Ejecuta en: Supabase > SQL Editor > Run
--
-- Objetivo:
-- 1) Exponer ranking público agregado sin filtrar por usuario autenticado.
-- 2) Evitar leer tablas completas desde el cliente cuando RLS está activo.
-- ═══════════════════════════════════════════════════════════════════════

-- Índice útil para agregación del ranking
create index if not exists sesiones_user_score_idx
  on public.sesiones (user_email, score);

-- Función RPC: devuelve solo datos agregados del ranking
create or replace function public.get_public_leaderboard(p_limit integer default 20)
returns table (
  email text,
  name text,
  school text,
  avg_score integer,
  streak integer,
  sessions integer,
  xp integer,
  rank integer
)
language sql
security definer
set search_path = public
as $$
  with session_agg as (
    select
      s.user_email,
      round(avg(s.score)::numeric)::int as avg_score,
      count(*)::int as sessions
    from public.sesiones s
    where s.user_email is not null
      and s.score is not null
    group by s.user_email
  ),
  base as (
    select
      u.email,
      coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as name,
      coalesce(u.school, '') as school,
      coalesce(sa.avg_score, 0) as avg_score,
      coalesce(st.current, 0) as streak,
      coalesce(sa.sessions, 0) as sessions
    from public.usuarios u
    left join session_agg sa on sa.user_email = u.email
    left join public.streak st on st.user_email = u.email
  ),
  ranked as (
    select
      b.email,
      b.name,
      b.school,
      b.avg_score,
      b.streak,
      b.sessions,
      (b.sessions * 100 + b.avg_score + b.streak * 10)::int as xp,
      row_number() over (
        order by
          (b.sessions * 100 + b.avg_score + b.streak * 10) desc,
          b.avg_score desc,
          b.email asc
      )::int as rank
    from base b
  )
  select
    r.email,
    r.name,
    r.school,
    r.avg_score,
    r.streak,
    r.sessions,
    r.xp,
    r.rank
  from ranked r
  order by r.rank
  limit greatest(coalesce(p_limit, 20), 1);
$$;

revoke all on function public.get_public_leaderboard(integer) from public;
grant execute on function public.get_public_leaderboard(integer) to authenticated;
grant execute on function public.get_public_leaderboard(integer) to anon;

