import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../api';

const AuthContext = createContext(null);

const EXAM_IDS = ['lectora', 'm1', 'm2', 'historia', 'ciencias'];

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
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [streak, setStreak] = useState({ current: 0, best: 0, totalDays: 0, lastActivity: '', history: {} });
  const [planner, setPlanner] = useState({ weekId: '', planId: 'standard', progress: {} });
  const [leaderboard, setLeaderboard] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  const loadUserData = useCallback(async (email) => {
    try {
      const profile = await api.getUserProfile(email);
      if (!profile) {
        await supabase.auth.signOut();
        return;
      }
      setUser(profile);

      const data = await api.getUserData(email);
      setSessions(data.sessions || []);

      const raw = data.streak || {};
      const normalized = {
        current: Number(raw.current) || 0,
        best: Number(raw.best) || 0,
        totalDays: Number(raw.totalDays) || 0,
        lastActivity: raw.lastActivity || '',
        history: raw.history || {},
      };
      const next = computeNextStreak(normalized);
      setStreak(next);
      if (JSON.stringify(next) !== JSON.stringify(normalized)) {
        api.updateStreak(email, next).catch(() => {});
      }

      setPlanner(data.planner || { weekId: '', planId: 'standard', progress: {} });
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
        await loadUserData(session.user.email);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSessions([]);
        setStreak({ current: 0, best: 0, totalDays: 0, lastActivity: '', history: {} });
        setPlanner({ weekId: '', planId: 'standard', progress: {} });
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
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw new Error(error.message);

        await api.createUserProfile({ email, nombre, anioNacimiento, situacion, region, colegioId });

        if (data.session) await loadUserData(email);

        return { needsEmailVerification: !data.session };
      } finally {
        setAuthLoading(false);
      }
    },
    [loadUserData]
  );

  const login = useCallback(async ({ email, password }) => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Debes verificar tu correo antes de ingresar. Revisa tu bandeja de entrada.');
        }
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contrasena incorrectos. Verifica tus datos.');
        }
        throw new Error(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

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
            current: prev.current + 1,
            best: Math.max(prev.best, prev.current + 1),
            lastActivity: today,
            totalDays: prev.totalDays + 1,
            history: { ...prev.history, [today]: true },
          };
        } else {
          next = {
            ...prev,
            current: 1,
            lastActivity: today,
            totalDays: prev.totalDays + 1,
            history: { ...prev.history, [today]: true },
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

  const savePlannerProgress = useCallback(
    async (weekId, planId, progress) => {
      if (!user) return;
      api.savePlannerProgress(user.email, weekId, planId, progress).catch(() => {});
      setPlanner({ weekId, planId, progress });
    },
    [user]
  );

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
    const stats = {};
    EXAM_IDS.forEach((id) => {
      const examSessions = sessions.filter((s) => s.examId === id);
      stats[id] = {
        attempted: examSessions.length,
        correct: examSessions.reduce((sum, s) => sum + (Number(s.correct) || 0), 0),
        lastScore: examSessions.length > 0 ? Number(examSessions[examSessions.length - 1].score) : 0,
        trend: examSessions.slice(-5).map((s) => Number(s.score)),
      };
    });
    return stats;
  }, [sessions]);

  const recentActivity = useMemo(() => {
    return [...sessions].reverse().slice(0, 5);
  }, [sessions]);

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
        login,
        logout,
        register,
        resetPassword,
        updateProfile,
        saveSession,
        savePlannerProgress,
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
