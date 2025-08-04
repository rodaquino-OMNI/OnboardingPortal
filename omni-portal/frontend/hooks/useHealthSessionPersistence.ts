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

  const [currentSession, setCurrentSession] = useState<HealthSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { makeRequest, cancelAll } = useCancellableRequest();
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<Date | null>(null);

  // Storage keys
  const getStorageKey = (suffix = '') => `health-session-${userId}${suffix}`;
  const primaryKey = getStorageKey();
  const backupKey = getStorageKey('-backup');

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
    return () => {
      cancelAll();
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [userId]);

  // Auto-save timer
  useEffect(() => {
    if (currentSession && hasUnsavedChanges && autoSaveInterval > 0) {
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
    }
  }, [currentSession, hasUnsavedChanges, autoSaveInterval]);

  const initializeSession = async () => {
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
            version: '2.0.0',
            mode: 'standard',
            features: [],
            totalSections: 0
          }
        };
        setCurrentSession(newSession);
        await saveToStorage(newSession);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const restoreFromStorage = async (): Promise<HealthSessionData | null> => {
    try {
      // Try primary storage first
      let sessionData = localStorage.getItem(primaryKey);
      
      // If primary fails, try backup
      if (!sessionData && enableBackupStorage) {
        sessionData = localStorage.getItem(backupKey);
      }
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Convert date strings back to Date objects
        parsed.lastSavedAt = new Date(parsed.lastSavedAt);
        parsed.metadata.startedAt = new Date(parsed.metadata.startedAt);
        
        // Check if session is not too old (e.g., 30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        if (Date.now() - parsed.lastSavedAt.getTime() < maxAge) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to restore session from storage:', error);
    }
    
    return null;
  };

  const saveToStorage = async (session: HealthSessionData): Promise<boolean> => {
    try {
      const serialized = JSON.stringify(session);
      
      // Save to primary storage
      localStorage.setItem(primaryKey, serialized);
      
      // Save to backup storage if enabled
      if (enableBackupStorage) {
        localStorage.setItem(backupKey, serialized);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save session to storage:', error);
      return false;
    }
  };

  const performAutoSave = async () => {
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
  };

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
        ...currentSession?.metadata,
        estimatedTimeRemaining
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

  // Clear session
  const clearSession = useCallback(async () => {
    try {
      localStorage.removeItem(primaryKey);
      if (enableBackupStorage) {
        localStorage.removeItem(backupKey);
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