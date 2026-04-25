import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { buildProgressStats, createDiagnosticSessions } from '../lib/progress';
import { api } from '../api';

const AuthContext = createContext(null);

const DEFAULT_STREAK  = { current: 0, best: 0, totalDays: 0, lastActivity: '', history: {} };
const DEFAULT_PLANNER = { weekId: '', planId: 'standard', progress: {}, planContent: null, generatedBy: 'heuristic' };

// ── Cache localStorage (hidratación instantánea al recargar) ─────────────────
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

function getCached(email) {
  try {
    const raw = localStorage.getItem(`paes_cache_${email}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCached(email, data) {
  try {
    localStorage.setItem(`paes_cache_${email}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* cuota llena, ignorar */ }
}

function clearCached(email) {
  try { localStorage.removeItem(`paes_cache_${email}`); } catch { }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

function computeNextStreak(s) {
  const today = todayStr();
  if (s.lastActivity === today) return s;
  if (s.lastActivity === yesterdayStr()) {
    return {
      ...s,
      current: (s.current || 0) + 1,
      best: Math.max(s.best || 0, (s.current || 0) + 1),
      lastActivity: today,
      totalDays: (s.totalDays || 0) + 1,
      history: { ...s.history, [today]: true },
    };
  }
  if (!s.lastActivity) return { ...s, current: 0, lastActivity: '' };
  return { ...s, current: 0 };
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [sessions,  setSessions]  = useState([]);
  const [streak,    setStreak]    = useState(DEFAULT_STREAK);
  const [planner,   setPlanner]   = useState(DEFAULT_PLANNER);
  const [leaderboard, setLeaderboard] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  // Evita que SIGNED_IN dispare loadUserData → signOut durante register()
  const isRegistering = useRef(false);

  const loadUserData = useCallback(async (email) => {
    // 1. Hidratar desde cache inmediatamente (UX instantáneo al recargar)
    const cached = getCached(email);
    if (cached) {
      if (cached.user)    setUser(cached.user);
      if (cached.sessions) setSessions(cached.sessions);
      if (cached.streak)  setStreak(cached.streak);
      if (cached.planner) setPlanner(cached.planner);
    }

    // 2. Fetch datos frescos desde Supabase — en paralelo para reducir latencia
    try {
      const [profile, data] = await Promise.all([
        api.getUserProfile(email),
        api.getUserData(email),
      ]);
      if (!profile) {
        await supabase.auth.signOut();
        return;
      }
      setUser(profile);

      const freshSessions = data.sessions || [];
      setSessions(freshSessions);

      const raw = data.streak || {};
      const normalized = {
        current:      Number(raw.current)    || 0,
        best:         Number(raw.best)       || 0,
        totalDays:    Number(raw.totalDays)  || 0,
        lastActivity: raw.lastActivity       || '',
        history:      raw.history            || {},
      };
      const next = computeNextStreak(normalized);
      setStreak(next);
      if (JSON.stringify(next) !== JSON.stringify(normalized)) {
        api.updateStreak(email, next).catch(() => {});
      }

      const freshPlanner = data.planner || DEFAULT_PLANNER;
      setPlanner(freshPlanner);

      // 3. Actualizar cache con datos frescos
      setCached(email, { user: profile, sessions: freshSessions, streak: next, planner: freshPlanner });
    } catch (err) {
      console.error('[AuthContext] loadUserData:', err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (event === 'INITIAL_SESSION') {
        try {
          if (session?.user?.email) await loadUserData(session.user.email);
        } finally {
          if (active) setAuthLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Saltar durante register() para evitar race condition profile→signOut
        if (!isRegistering.current) {
          try {
            await loadUserData(session.user.email);
          } finally {
            // authLoading puede estar en true si viene del flujo login().
            // Solo aquí lo ponemos en false una vez que el perfil está cargado.
            if (active) setAuthLoading(false);
          }
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSessions([]);
        setStreak(DEFAULT_STREAK);
        setPlanner(DEFAULT_PLANNER);
        setLeaderboard([]);
        if (active) setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const register = useCallback(
    async ({ email, password, nombre, anioNacimiento, situacion, region, colegioId }) => {
      isRegistering.current = true;
      setAuthLoading(true);
      try {
        const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });

        // Si solo falló el envío del email (usuario SÍ fue creado), continuar
        // Cubre mensajes de Supabase built-in SMTP y Resend
        const emailSendFailed = error && (
          error?.message?.toLowerCase().includes('sending confirmation email') ||
          error?.message?.toLowerCase().includes('error sending email') ||
          error?.message?.toLowerCase().includes('failed to send') ||
          error?.message?.toLowerCase().includes('email') && (error?.status === 500 || error?.code === 500)
        );
        if (error && !emailSendFailed) throw new Error(error.message);

        await api.createUserProfile({ email, nombre, anioNacimiento, situacion, region, colegioId });

        // Si el SMTP/Resend falló pero el usuario fue creado, intentar login directo
        if (emailSendFailed) {
          const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
          if (loginData?.session) {
            await loadUserData(email);
            return { needsEmailVerification: false };
          }
          // Resend puede haber enviado el correo aunque Supabase retornó 500 → mostrar pantalla de verificación
          return { needsEmailVerification: true };
        }

        if (data.session) await loadUserData(email);

        return { needsEmailVerification: !data.session };
      } finally {
        isRegistering.current = false;
        setAuthLoading(false);
      }
    },
    [loadUserData]
  );

  const login = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    let success = false;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message || '';
        const code = error.code || error.status || '';
        if (msg.includes('Email not confirmed') || code === 'email_not_confirmed') {
          throw new Error('Debes verificar tu correo antes de ingresar. Revisa tu bandeja de entrada.');
        }
        if (
          msg.includes('Invalid login credentials') ||
          msg.includes('invalid_credentials') ||
          code === 'invalid_credentials'
        ) {
          throw new Error('Correo o contraseña incorrectos. Verifica tus datos.');
        }
        throw new Error(msg || 'No se pudo iniciar sesión. Intenta de nuevo.');
      }
      // Supabase retornó OK pero sin sesión (edge case)
      if (!data?.session) {
        throw new Error('No se pudo iniciar sesión. Intenta de nuevo.');
      }
      // Éxito: mantener authLoading=true hasta que el handler SIGNED_IN
      // complete loadUserData y dispare la navegación desde App.jsx
      success = true;
    } finally {
      if (!success) setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (user?.email) clearCached(user.email);
    await supabase.auth.signOut();
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updateProfile = useCallback(
    async (data) => {
      if (!user) return;
      await api.updateProfile({ email: user.email, ...data });
      setUser((prev) => ({ ...prev, ...data }));
    },
    [user]
  );

  const saveSession = useCallback(
    async (sessionData) => {
      if (!user) return;
      const date = new Date().toISOString();
      const newSession = { userEmail: user.email, ...sessionData, date };

      await api.saveSession(newSession);
      setSessions((prev) => [...prev, newSession]);

      setStreak((prev) => {
        const today = todayStr();
        if (prev.lastActivity === today) return prev;

        const yday = yesterdayStr();
        let next;

        if (prev.lastActivity === yday) {
          next = {
            ...prev,
            current:      prev.current + 1,
            best:         Math.max(prev.best, prev.current + 1),
            lastActivity: today,
            totalDays:    prev.totalDays + 1,
            history:      { ...prev.history, [today]: true },
          };
        } else {
          next = {
            ...prev,
            current:      1,
            lastActivity: today,
            totalDays:    prev.totalDays + 1,
            history:      { ...prev.history, [today]: true },
          };
        }

        api.updateStreak(user.email, next).catch((err) => {
          console.error('[AuthContext] updateStreak:', err);
        });
        return next;
      });
    },
    [user]
  );

  // Guardar progreso de checkboxes + contenido del plan
  const savePlannerProgress = useCallback(
    async (weekId, planId, progress, planContent) => {
      if (!user) return;
      api.savePlannerWithContent(user.email, weekId, planId, progress, planContent || planner.planContent).catch(() => {});
      setPlanner((prev) => ({
        ...prev,
        weekId,
        planId,
        progress,
        planContent: planContent !== undefined ? planContent : prev.planContent,
      }));
    },
    [user, planner.planContent]
  );

  // Guardar objetivos académicos
  const saveObjetivos = useCallback(
    async (principal, secundarios) => {
      if (!user) return;
      await api.saveObjetivos(user.email, principal, secundarios);
      setUser((prev) => ({
        ...prev,
        objetivoPrincipal:    principal,
        objetivosSecundarios: secundarios,
      }));
    },
    [user]
  );

  // Guardar resultados de diagnóstico
  const saveDiagnostico = useCallback(
    async (resultados) => {
      if (!user) return;
      const result = await api.saveDiagnostico(user.email, resultados);
      setUser((prev) => ({ ...prev, diagnosticoCompletado: true }));
      setSessions((prev) => [
        ...prev,
        ...createDiagnosticSessions(user.email, resultados, result?.version, result?.completedAt),
      ]);
      return result;
    },
    [user]
  );

  // Marcar onboarding como completado
  const completeOnboarding = useCallback(async (durationSeconds) => {
    if (!user) return;
    await api.completeOnboarding(user.email, durationSeconds);
    setUser((prev) => ({ ...prev, onboardingCompletado: true }));
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await api.getLeaderboard();
      setLeaderboard(r.leaderboard || []);
    } catch (err) {
      console.error('[AuthContext] fetchLeaderboard:', err);
      setLeaderboard([]);
    }
  }, []);

  const progressStats = useMemo(() => {
    return buildProgressStats(sessions);
  }, [sessions]);

  const recentActivity = useMemo(() => {
    return [...sessions].reverse().slice(0, 5);
  }, [sessions]);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        sessions,
        streak,
        planner,
        leaderboard,
        authLoading,
        progressStats,
        recentActivity,
        isAdmin,
        login,
        logout,
        register,
        resetPassword,
        updateProfile,
        saveSession,
        savePlannerProgress,
        saveObjetivos,
        saveDiagnostico,
        completeOnboarding,
        fetchLeaderboard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
