/**
 * useUnifiedState - React hook for accessing unified state
 * Provides type-safe access to all state domains
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { unifiedState, StateDomain } from '../UnifiedStateAdapter';

/**
 * Hook for accessing and updating unified state
 */
export function useUnifiedState<T = any>(
  domain: StateDomain,
  key: string,
  defaultValue?: T
): [T | undefined, (value: T) => void, () => void] {
  const [value, setValue] = useState<T | undefined>(() => {
    return unifiedState.get<T>(domain, key) ?? defaultValue;
  });

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = unifiedState.subscribe(`${domain}.${key}`, (newValue) => {
      setValue(newValue ?? defaultValue);
    });

    // Get initial value
    const currentValue = unifiedState.get<T>(domain, key);
    if (currentValue !== undefined) {
      setValue(currentValue);
    }

    return unsubscribe;
  }, [domain, key, defaultValue]);

  // Update function
  const update = useCallback((newValue: T) => {
    unifiedState.set(domain, key, newValue);
    setValue(newValue);
  }, [domain, key]);

  // Remove function
  const remove = useCallback(() => {
    unifiedState.remove(domain, key);
    setValue(defaultValue);
  }, [domain, key, defaultValue]);

  return [value, update, remove];
}

/**
 * Hook for accessing entire domain state
 */
export function useUnifiedDomain<T extends Record<string, any>>(
  domain: StateDomain
): {
  data: T;
  set: (key: string, value: any) => void;
  remove: (key: string) => void;
  clear: () => void;
} {
  const [data, setData] = useState<T>(() => {
    return unifiedState.getAll(domain) as T;
  });

  // Subscribe to all changes in domain
  useEffect(() => {
    const subscriptions: (() => void)[] = [];
    
    // Subscribe to existing keys
    Object.keys(data).forEach(key => {
      const unsubscribe = unifiedState.subscribe(`${domain}.${key}`, () => {
        setData(unifiedState.getAll(domain) as T);
      });
      subscriptions.push(unsubscribe);
    });

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [domain]);

  const set = useCallback((key: string, value: any) => {
    unifiedState.set(domain, key, value);
    setData(prev => ({ ...prev, [key]: value }));
  }, [domain]);

  const remove = useCallback((key: string) => {
    unifiedState.remove(domain, key);
    setData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  }, [domain]);

  const clear = useCallback(() => {
    unifiedState.clear(domain);
    setData({} as T);
  }, [domain]);

  return { data, set, remove, clear };
}

/**
 * Hook for auth state specifically
 */
export function useAuthState() {
  const [user, setUser] = useUnifiedState('auth', 'user');
  const [token, setToken] = useUnifiedState('auth', 'token');
  const [isAuthenticated, setIsAuthenticated] = useUnifiedState('auth', 'isAuthenticated', false);

  const login = useCallback((userData: any, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
  }, [setUser, setToken, setIsAuthenticated]);

  const logout = useCallback(() => {
    unifiedState.clear('auth');
  }, []);

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout
  };
}

/**
 * Hook for UI state
 */
export function useUIState() {
  const { data, set, remove } = useUnifiedDomain<{
    modal?: string;
    drawer?: boolean;
    loading?: boolean;
    error?: string;
  }>('ui');

  const showModal = useCallback((modalId: string) => {
    set('modal', modalId);
  }, [set]);

  const hideModal = useCallback(() => {
    remove('modal');
  }, [remove]);

  const setLoading = useCallback((loading: boolean) => {
    set('loading', loading);
  }, [set]);

  const setError = useCallback((error: string | null) => {
    if (error) {
      set('error', error);
    } else {
      remove('error');
    }
  }, [set, remove]);

  return {
    ...data,
    showModal,
    hideModal,
    setLoading,
    setError
  };
}

/**
 * Hook for session state
 */
export function useSessionState<T = any>(key: string, defaultValue?: T) {
  return useUnifiedState<T>('session', key, defaultValue);
}

/**
 * Hook for user preferences
 */
export function useUserPreferences() {
  const { data, set } = useUnifiedDomain<{
    theme?: 'light' | 'dark';
    language?: string;
    notifications?: boolean;
  }>('user');

  const updatePreference = useCallback((key: string, value: any) => {
    set(`preferences.${key}`, value);
  }, [set]);

  return {
    preferences: data,
    updatePreference
  };
}

/**
 * Hook for health questionnaire state
 */
export function useHealthState() {
  const { data, set, remove, clear } = useUnifiedDomain<{
    currentStep?: number;
    answers?: Record<string, any>;
    progress?: number;
    sessionId?: string;
  }>('health');

  const saveAnswer = useCallback((questionId: string, answer: any) => {
    const answers = data.answers || {};
    set('answers', { ...answers, [questionId]: answer });
  }, [data.answers, set]);

  const nextStep = useCallback(() => {
    set('currentStep', (data.currentStep || 0) + 1);
  }, [data.currentStep, set]);

  const previousStep = useCallback(() => {
    set('currentStep', Math.max(0, (data.currentStep || 0) - 1));
  }, [data.currentStep, set]);

  const resetSession = useCallback(() => {
    clear();
  }, [clear]);

  return {
    ...data,
    saveAnswer,
    nextStep,
    previousStep,
    resetSession
  };
}

/**
 * Hook for gamification state
 */
export function useGamificationState() {
  const [points, setPoints] = useUnifiedState<number>('gamification', 'points', 0);
  const [level, setLevel] = useUnifiedState<number>('gamification', 'level', 1);
  const [achievements, setAchievements] = useUnifiedState<string[]>('gamification', 'achievements', []);

  const addPoints = useCallback((amount: number) => {
    const newPoints = (points || 0) + amount;
    setPoints(newPoints);
    
    // Auto-level up every 100 points
    const newLevel = Math.floor(newPoints / 100) + 1;
    if (newLevel > (level || 1)) {
      setLevel(newLevel);
    }
  }, [points, level, setPoints, setLevel]);

  const unlockAchievement = useCallback((achievementId: string) => {
    const current = achievements || [];
    if (!current.includes(achievementId)) {
      setAchievements([...current, achievementId]);
    }
  }, [achievements, setAchievements]);

  return {
    points: points || 0,
    level: level || 1,
    achievements: achievements || [],
    addPoints,
    unlockAchievement
  };
}

/**
 * Debug hook for monitoring state changes
 */
export function useStateDebugger() {
  const [snapshot, setSnapshot] = useState(() => unifiedState.getSnapshot());

  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshot(unifiedState.getSnapshot());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return snapshot;
}