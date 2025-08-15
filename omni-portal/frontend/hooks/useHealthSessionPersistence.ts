'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCancellableRequest } from '@/lib/async-utils';

export interface HealthSessionData {
  userId: string;
  sessionId: string;
  responses: Record<string, any>;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  progress: number;
  lastSavedAt: Date;
  metadata: {
    startedAt: Date;
    version: string;
    mode: string;
    features: string[];
    totalSections: number;
    estimatedTimeRemaining?: number;
  };
}

export interface SessionPersistenceOptions {
  userId: string;
  sessionId?: string;
  autoSaveInterval?: number; // milliseconds
  enableBackupStorage?: boolean;
  onAutoSave?: (success: boolean) => void;
  onRestoreSession?: (session: HealthSessionData) => void;
}

export function useHealthSessionPersistence(options: SessionPersistenceOptions) {
  const {
    userId,
    sessionId = `health-session-${userId}-${Date.now()}`,
    autoSaveInterval = 15000, // 15 seconds
    enableBackupStorage = true,
    onAutoSave,
    onRestoreSession
  } = options;

  const [isClient, setIsClient] = useState(false);
  const [currentSession, setCurrentSession] = useState<HealthSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // SSR hydration fix: Track when we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { makeRequest, cancelAll } = useCancellableRequest();
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<Date | null>(null);
  const hasInitializedRef = useRef(false);

  // Storage keys
  const getStorageKey = (suffix = '') => `health-session-${userId}${suffix}`;
  const primaryKey = getStorageKey();
  const backupKey = getStorageKey('-backup');

  // Restore from storage function (defined early to avoid circular deps)
  const restoreFromStorage = useCallback(async (): Promise<HealthSessionData | null> => {
    try {
      // Check if localStorage is available
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage is not available');
        return null;
      }

      // Try primary storage first
      let sessionData = localStorage.getItem(primaryKey);
      
      // If primary fails, try backup
      if (!sessionData && enableBackupStorage) {
        sessionData = localStorage.getItem(backupKey);
      }
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Convert date strings back to Date objects safely
        parsed.lastSavedAt = parsed.lastSavedAt ? new Date(parsed.lastSavedAt) : new Date();
        if (parsed.metadata) {
          parsed.metadata.startedAt = parsed.metadata.startedAt ? new Date(parsed.metadata.startedAt) : new Date();
        }
        
        // Check if session is not too old (e.g., 30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        const sessionAge = Date.now() - (parsed.lastSavedAt?.getTime() || Date.now());
        if (sessionAge < maxAge) {
          return parsed;
        } else {
          console.log('Session too old, clearing...');
          localStorage.removeItem(primaryKey);
          if (enableBackupStorage) {
            localStorage.removeItem(backupKey);
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore session from storage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(primaryKey);
        if (enableBackupStorage) {
          localStorage.removeItem(backupKey);
        }
      } catch (clearError) {
        console.error('Failed to clear corrupted session:', clearError);
      }
    }
    
    return null;
  }, [primaryKey, backupKey, enableBackupStorage]);

  // Declare initializeSession before using it
  const initializeSession = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try to restore from localStorage first
      const existingSession = await restoreFromStorage();
      
      if (existingSession) {
        setCurrentSession(existingSession);
        onRestoreSession?.(existingSession);
        setHasUnsavedChanges(false);
      } else {
        // Create new session
        const newSession: HealthSessionData = {
          userId,
          sessionId,
          responses: {},
          currentSectionIndex: 0,
          currentQuestionIndex: 0,
          progress: 0,
          lastSavedAt: new Date(),
          metadata: {
            startedAt: new Date(),
            version: '1.0.0',
            mode: 'standard',
            features: [],
            totalSections: 0
          },
        };
        setCurrentSession(newSession);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setLastSaveError('Falha ao inicializar sessão');
    } finally {
      setIsLoading(false);
    }
  }, [userId, sessionId, onRestoreSession, restoreFromStorage]);

  // Save to storage function
  const saveToStorage = useCallback(async (session: HealthSessionData): Promise<boolean> => {
    try {
      // Check if localStorage is available
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage is not available');
        return false;
      }

      // Clean up the session data to avoid circular references
      const cleanSession = {
        ...session,
        lastSavedAt: session.lastSavedAt instanceof Date ? session.lastSavedAt.toISOString() : session.lastSavedAt,
        metadata: {
          ...session.metadata,
          startedAt: session.metadata.startedAt instanceof Date ? session.metadata.startedAt.toISOString() : session.metadata.startedAt
        }
      };

      // Serialize with error handling for circular references
      let serialized: string;
      try {
        serialized = JSON.stringify(cleanSession);
      } catch (jsonError) {
        console.error('Failed to serialize session data:', jsonError);
        // Try with a simpler serialization
        serialized = JSON.stringify({
          userId: session.userId,
          sessionId: session.sessionId,
          responses: {},
          currentSectionIndex: session.currentSectionIndex,
          currentQuestionIndex: session.currentQuestionIndex,
          progress: session.progress,
          lastSavedAt: new Date().toISOString(),
          metadata: {
            startedAt: new Date().toISOString(),
            version: session.metadata.version,
            mode: session.metadata.mode,
            features: [],
            totalSections: session.metadata.totalSections
          }
        });
      }
      
      // Check storage quota before saving
      try {
        // Save to primary storage
        localStorage.setItem(primaryKey, serialized);
        
        // Save to backup storage if enabled
        if (enableBackupStorage) {
          try {
            localStorage.setItem(backupKey, serialized);
          } catch (backupError) {
            console.warn('Failed to save backup, but primary save succeeded');
          }
        }
      } catch (storageError: any) {
        if (storageError.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded. Clearing old sessions...');
          // Try to clear old sessions
          const keys = Object.keys(localStorage).filter(k => k.startsWith('health-session-') && k !== primaryKey);
          keys.forEach(k => localStorage.removeItem(k));
          // Retry save
          localStorage.setItem(primaryKey, serialized);
        } else {
          throw storageError;
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('Failed to save session to storage:', error);
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
      return false;
    }
  }, [primaryKey, backupKey, enableBackupStorage]);

  // Perform auto save function
  const performAutoSave = useCallback(async () => {
    if (!currentSession || isSaving || !hasUnsavedChanges) return;

    try {
      setIsSaving(true);
      setLastSaveError(null);

      // Update last saved timestamp
      const updatedSession = {
        ...currentSession,
        lastSavedAt: new Date()
      };

      const success = await saveToStorage(updatedSession);
      
      if (success) {
        setCurrentSession(updatedSession);
        setHasUnsavedChanges(false);
        lastSaveRef.current = new Date();
        onAutoSave?.(true);
      } else {
        throw new Error('Failed to save to storage');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setLastSaveError('Auto-save falhou. Tentando novamente...');
      onAutoSave?.(false);
    } finally {
      setIsSaving(false);
    }
  }, [currentSession, isSaving, hasUnsavedChanges, onAutoSave, saveToStorage]);

  // Initialize session on mount (client-side only)
  useEffect(() => {
    // SSR guard: Only initialize on client side
    if (!isClient) {
      return;
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeSession();
    }
    
    return () => {
      cancelAll();
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isClient, initializeSession, cancelAll]); // Depend on isClient to ensure proper timing

  // Auto-save timer (client-side only)
  useEffect(() => {
    // SSR guard: Only run auto-save on client side
    if (!isClient || !currentSession || !hasUnsavedChanges || autoSaveInterval <= 0) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      performAutoSave();
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isClient, currentSession, hasUnsavedChanges, autoSaveInterval, performAutoSave]);

  // Update session data
  const updateSession = useCallback((updates: Partial<HealthSessionData>) => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      ...updates,
      metadata: {
        ...currentSession.metadata,
        ...(updates.metadata || {})
      }
    };

    setCurrentSession(updatedSession);
    setHasUnsavedChanges(true);
  }, [currentSession]);

  // Update responses
  const updateResponse = useCallback((questionId: string, value: any) => {
    if (!currentSession) return;

    const updatedResponses = {
      ...currentSession.responses,
      [questionId]: value
    };

    updateSession({ 
      responses: updatedResponses,
      lastSavedAt: new Date() // Update timestamp for unsaved indicator
    });
  }, [currentSession, updateSession]);

  // Update progress
  const updateProgress = useCallback((
    sectionIndex: number, 
    questionIndex: number, 
    progressPercentage: number,
    estimatedTimeRemaining?: number
  ) => {
    updateSession({
      currentSectionIndex: sectionIndex,
      currentQuestionIndex: questionIndex,
      progress: progressPercentage,
      metadata: {
        startedAt: currentSession?.metadata?.startedAt || new Date(),
        version: currentSession?.metadata?.version || '1.0',
        mode: currentSession?.metadata?.mode || 'standard',
        features: currentSession?.metadata?.features || [],
        totalSections: currentSession?.metadata?.totalSections || 1,
        ...(estimatedTimeRemaining !== undefined && { estimatedTimeRemaining })
      }
    });
  }, [updateSession, currentSession]);

  // Manual save
  const saveSession = useCallback(async (): Promise<boolean> => {
    if (!currentSession || isSaving) return false;

    try {
      setIsSaving(true);
      setLastSaveError(null);

      const updatedSession = {
        ...currentSession,
        lastSavedAt: new Date()
      };

      const success = await saveToStorage(updatedSession);
      
      if (success) {
        setCurrentSession(updatedSession);
        setHasUnsavedChanges(false);
        lastSaveRef.current = new Date();
        return true;
      } else {
        throw new Error('Failed to save session');
      }
    } catch (error) {
      console.error('Manual save failed:', error);
      setLastSaveError(error instanceof Error ? error.message : 'Erro desconhecido');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentSession, isSaving]);

  // Clear session (client-side only)
  const clearSession = useCallback(async () => {
    try {
      // SSR guard: Only clear localStorage on client side
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(primaryKey);
        if (enableBackupStorage) {
          localStorage.removeItem(backupKey);
        }
      }
      
      setCurrentSession(null);
      setHasUnsavedChanges(false);
      setLastSaveError(null);
      
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }, [primaryKey, backupKey, enableBackupStorage]);

  // Check if session exists
  const hasExistingSession = useCallback(async (): Promise<boolean> => {
    try {
      const session = await restoreFromStorage();
      return session !== null && session.progress > 0;
    } catch {
      return false;
    }
  }, []);

  // Get session stats
  const getSessionStats = useCallback(() => {
    if (!currentSession) return null;

    const now = new Date();
    const timeSinceStart = now.getTime() - currentSession.metadata.startedAt.getTime();
    const timeSinceLastSave = lastSaveRef.current 
      ? now.getTime() - lastSaveRef.current.getTime()
      : null;

    return {
      sessionDuration: Math.floor(timeSinceStart / 1000 / 60), // minutes
      responsesCount: Object.keys(currentSession.responses).length,
      progress: currentSession.progress,
      timeSinceLastSave: timeSinceLastSave ? Math.floor(timeSinceLastSave / 1000) : null, // seconds
      hasUnsavedChanges,
      estimatedTimeRemaining: currentSession.metadata.estimatedTimeRemaining
    };
  }, [currentSession, hasUnsavedChanges]);

  return {
    // State
    session: currentSession,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    lastSaveError,
    
    // Actions
    updateSession,
    updateResponse,
    updateProgress,
    saveSession,
    clearSession,
    hasExistingSession,
    
    // Utilities
    getSessionStats
  };
}