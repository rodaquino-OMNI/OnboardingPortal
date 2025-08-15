/**
 * useEventBus - React hooks for event-driven architecture
 * Replaces cascading useEffect chains with clean event handling
 */

import { useEffect, useCallback, useRef } from 'react';
import { eventBus, Event, EventPayload, EventPriority, EventTypes } from '../EventBus';

/**
 * Hook for subscribing to events
 */
export function useEventListener<T = EventPayload>(
  eventPattern: string | RegExp,
  handler: (event: Event<T>) => void | Promise<void>,
  deps: React.DependencyList = []
) {
  const handlerRef = useRef(handler);
  
  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const wrappedHandler = (event: Event<T>) => {
      handlerRef.current(event);
    };

    const unsubscribe = eventBus.on<T>(eventPattern, wrappedHandler);
    
    return unsubscribe;
  }, [eventPattern, ...deps]);
}

/**
 * Hook for emitting events
 */
export function useEventEmitter() {
  const emit = useCallback(<T = EventPayload>(
    type: string,
    payload: T,
    options?: {
      priority?: EventPriority;
      metadata?: Record<string, any>;
    }
  ) => {
    return eventBus.emit(type, payload, {
      ...options,
      source: 'react-component'
    });
  }, []);

  return emit;
}

/**
 * Hook for request-response pattern with events
 */
export function useEventRequest<TRequest = any, TResponse = any>(
  requestEvent: string,
  responseEvent: string,
  timeout = 5000
) {
  const emit = useEventEmitter();
  
  const request = useCallback(async (
    payload: TRequest,
    correlationId?: string
  ): Promise<TResponse> => {
    const id = correlationId || Math.random().toString(36).substr(2, 9);
    
    // Emit request
    emit(requestEvent, { ...payload, correlationId: id });
    
    // Wait for response
    try {
      const response = await eventBus.waitFor<TResponse>(
        responseEvent,
        timeout,
        (event) => event.metadata?.correlationId === id
      );
      
      return response.payload;
    } catch (error) {
      throw new Error(`Request timeout: ${requestEvent}`);
    }
  }, [requestEvent, responseEvent, timeout, emit]);

  return request;
}

/**
 * Hook for authentication events
 */
export function useAuthEvents() {
  const emit = useEventEmitter();

  const onLogin = useCallback((handler: (event: Event<{ user: any; token: string }>) => void) => {
    const unsubscribe = eventBus.on(EventTypes.AUTH_LOGIN, handler);
    return unsubscribe;
  }, []);

  const onLogout = useCallback((handler: (event: Event) => void) => {
    const unsubscribe = eventBus.on(EventTypes.AUTH_LOGOUT, handler);
    return unsubscribe;
  }, []);

  const onSessionExpired = useCallback((handler: (event: Event) => void) => {
    const unsubscribe = eventBus.on(EventTypes.AUTH_SESSION_EXPIRED, handler);
    return unsubscribe;
  }, []);

  const emitLogin = useCallback((user: any, token: string) => {
    emit(EventTypes.AUTH_LOGIN, { user, token }, { priority: 'high' });
  }, [emit]);

  const emitLogout = useCallback(() => {
    emit(EventTypes.AUTH_LOGOUT, {}, { priority: 'high' });
  }, [emit]);

  return {
    onLogin,
    onLogout,
    onSessionExpired,
    emitLogin,
    emitLogout
  };
}

/**
 * Hook for navigation events
 */
export function useNavigationEvents() {
  const emit = useEventEmitter();

  useEventListener(EventTypes.NAVIGATION_ROUTE_CHANGE, (event) => {
    // Handle route changes without cascading effects
    console.log('[Navigation] Route changed:', event.payload);
  });

  const navigate = useCallback((path: string, options?: any) => {
    emit(EventTypes.NAVIGATION_ROUTE_CHANGE, { path, ...options });
  }, [emit]);

  const checkGuard = useCallback(async (path: string): Promise<boolean> => {
    const id = Math.random().toString(36).substr(2, 9);
    
    emit(EventTypes.NAVIGATION_GUARD_CHECK, { path, correlationId: id });
    
    try {
      const response = await eventBus.waitFor<{ allowed: boolean }>(
        'navigation.guard.response',
        2000,
        (event) => event.metadata?.correlationId === id
      );
      
      return response.payload.allowed;
    } catch {
      return false; // Deny by default on timeout
    }
  }, [emit]);

  return {
    navigate,
    checkGuard
  };
}

/**
 * Hook for health questionnaire events
 */
export function useHealthEvents() {
  const emit = useEventEmitter();

  const emitProgress = useCallback((progress: number, currentStep: number) => {
    emit(EventTypes.HEALTH_QUESTIONNAIRE_PROGRESS, {
      progress,
      currentStep,
      timestamp: Date.now()
    });
  }, [emit]);

  const emitAnswer = useCallback((questionId: string, answer: any) => {
    emit(EventTypes.HEALTH_ANSWER_SAVED, {
      questionId,
      answer,
      timestamp: Date.now()
    });
  }, [emit]);

  const emitComplete = useCallback((data: any) => {
    emit(EventTypes.HEALTH_QUESTIONNAIRE_COMPLETE, data, {
      priority: 'high'
    });
  }, [emit]);

  // Listen for events without cascading effects
  useEventListener(EventTypes.HEALTH_ANSWER_SAVED, async (event) => {
    // Handle answer saved - no effect cascade
    console.log('[Health] Answer saved:', event.payload);
  });

  return {
    emitProgress,
    emitAnswer,
    emitComplete
  };
}

/**
 * Hook for API events
 */
export function useApiEvents() {
  const emit = useEventEmitter();

  const emitRequest = useCallback((endpoint: string, method: string) => {
    emit(EventTypes.API_REQUEST_START, { endpoint, method });
  }, [emit]);

  const emitSuccess = useCallback((endpoint: string, data: any) => {
    emit(EventTypes.API_REQUEST_SUCCESS, { endpoint, data });
  }, [emit]);

  const emitFailure = useCallback((endpoint: string, error: any) => {
    emit(EventTypes.API_REQUEST_FAILURE, { endpoint, error });
  }, [emit]);

  // Listen for unauthorized events globally
  useEventListener(EventTypes.API_UNAUTHORIZED, () => {
    // Handle unauthorized without effect cascade
    eventBus.emit(EventTypes.AUTH_SESSION_EXPIRED, {});
  });

  return {
    emitRequest,
    emitSuccess,
    emitFailure
  };
}

/**
 * Hook for UI events
 */
export function useUIEvents() {
  const emit = useEventEmitter();

  const showModal = useCallback((modalId: string, props?: any) => {
    emit(EventTypes.UI_MODAL_OPEN, { modalId, props });
  }, [emit]);

  const hideModal = useCallback((modalId: string) => {
    emit(EventTypes.UI_MODAL_CLOSE, { modalId });
  }, [emit]);

  const showNotification = useCallback((
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    emit(EventTypes.UI_NOTIFICATION_SHOW, { message, type });
  }, [emit]);

  const setLoading = useCallback((loading: boolean, context?: string) => {
    emit(loading ? EventTypes.UI_LOADING_START : EventTypes.UI_LOADING_END, {
      context
    });
  }, [emit]);

  return {
    showModal,
    hideModal,
    showNotification,
    setLoading
  };
}

/**
 * Hook for error events
 */
export function useErrorEvents() {
  const emit = useEventEmitter();

  const emitError = useCallback((error: Error, context?: string) => {
    emit(EventTypes.ERROR_UNCAUGHT, {
      message: error.message,
      stack: error.stack,
      context
    }, {
      priority: 'high'
    });
  }, [emit]);

  // Global error handler
  useEventListener(EventTypes.ERROR_UNCAUGHT, (event) => {
    console.error('[Error] Uncaught error:', event.payload);
    // Could send to error tracking service
  });

  return {
    emitError
  };
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceEvents() {
  const emit = useEventEmitter();
  const metricsRef = useRef<Map<string, number>>(new Map());

  const startMeasure = useCallback((label: string) => {
    metricsRef.current.set(label, performance.now());
  }, []);

  const endMeasure = useCallback((label: string) => {
    const start = metricsRef.current.get(label);
    if (!start) return;

    const duration = performance.now() - start;
    metricsRef.current.delete(label);

    emit(EventTypes.PERFORMANCE_METRIC, {
      label,
      duration,
      timestamp: Date.now()
    });

    // Emit warning if slow
    if (duration > 1000) {
      emit(EventTypes.PERFORMANCE_WARNING, {
        label,
        duration,
        message: `Slow operation: ${label} took ${duration.toFixed(2)}ms`
      });
    }

    return duration;
  }, [emit]);

  return {
    startMeasure,
    endMeasure
  };
}

/**
 * Hook for replacing cascading useEffects
 */
export function useEventDrivenFlow(
  flows: Array<{
    trigger: string | RegExp;
    action: (event: Event) => void | Promise<void>;
    priority?: EventPriority;
  }>
) {
  useEffect(() => {
    const unsubscribers = flows.map(flow =>
      eventBus.on(flow.trigger, flow.action, {
        priority: flow.priority
      })
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);
}

/**
 * Debug hook for monitoring events
 */
export function useEventDebugger(pattern?: string | RegExp) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handler = (event: Event) => {
      console.log('[EventDebugger]', {
        type: event.type,
        payload: event.payload,
        source: event.source,
        timestamp: new Date(event.timestamp).toISOString()
      });
    };

    const unsubscribe = eventBus.on(pattern || /.*/, handler, {
      priority: 'low'
    });

    return unsubscribe;
  }, [pattern]);
}