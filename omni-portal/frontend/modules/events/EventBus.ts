/**
 * EventBus - Central event system to replace effect chains
 * Provides decoupled, event-driven architecture
 */

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EventPayload {
  [key: string]: any;
}

export interface Event<T = EventPayload> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  priority: EventPriority;
  source?: string;
  metadata?: {
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    [key: string]: any;
  };
}

export interface EventHandler<T = EventPayload> {
  id: string;
  event: string | RegExp;
  handler: (event: Event<T>) => void | Promise<void>;
  priority: EventPriority;
  once?: boolean;
  filter?: (event: Event<T>) => boolean;
}

export interface EventBusOptions {
  maxListeners?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  errorHandler?: (error: Error, event: Event) => void;
}

/**
 * EventBus implementation - Singleton pattern
 */
export class EventBus {
  private static instance: EventBus;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();
  private eventQueue: Event[] = [];
  private processing = false;
  private metrics = {
    eventsEmitted: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    averageProcessingTime: 0
  };
  private options: EventBusOptions;

  private constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: 100,
      enableLogging: process.env.NODE_ENV === 'development',
      enableMetrics: true,
      errorHandler: (error, event) => {
        console.error(`[EventBus] Error processing event ${event.type}:`, error);
      },
      ...options
    };
  }

  static getInstance(options?: EventBusOptions): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(options);
    }
    return EventBus.instance;
  }

  /**
   * Emit an event
   */
  emit<T = EventPayload>(
    type: string,
    payload: T,
    options?: {
      priority?: EventPriority;
      source?: string;
      metadata?: Record<string, any>;
    }
  ): string {
    const event: Event<T> = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: Date.now(),
      priority: options?.priority || 'normal',
      source: options?.source || this.getCallerInfo(),
      metadata: options?.metadata
    };

    if (this.options.enableLogging) {
      console.log(`[EventBus] Emitting: ${type}`, { payload, priority: event.priority });
    }

    this.metrics.eventsEmitted++;
    this.enqueueEvent(event);
    this.processQueue();

    return event.id;
  }

  /**
   * Subscribe to events
   */
  on<T = EventPayload>(
    eventPattern: string | RegExp,
    handler: (event: Event<T>) => void | Promise<void>,
    options?: {
      priority?: EventPriority;
      once?: boolean;
      filter?: (event: Event<T>) => boolean;
    }
  ): () => void {
    const eventHandler: EventHandler<T> = {
      id: this.generateHandlerId(),
      event: eventPattern,
      handler,
      priority: options?.priority || 'normal',
      once: options?.once,
      filter: options?.filter
    };

    // Add to appropriate handler set
    if (typeof eventPattern === 'string') {
      if (!this.handlers.has(eventPattern)) {
        this.handlers.set(eventPattern, new Set());
      }
      
      const handlers = this.handlers.get(eventPattern)!;
      if (handlers.size >= (this.options.maxListeners || 100)) {
        console.warn(`[EventBus] Max listeners (${this.options.maxListeners}) reached for event: ${eventPattern}`);
      }
      
      handlers.add(eventHandler as EventHandler);
    } else {
      // RegExp pattern - add to wildcard handlers
      this.wildcardHandlers.add(eventHandler as EventHandler);
    }

    // Return unsubscribe function
    return () => this.off(eventHandler.id);
  }

  /**
   * Subscribe to event once
   */
  once<T = EventPayload>(
    eventPattern: string | RegExp,
    handler: (event: Event<T>) => void | Promise<void>,
    options?: {
      priority?: EventPriority;
      filter?: (event: Event<T>) => boolean;
    }
  ): () => void {
    return this.on(eventPattern, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe from events
   */
  off(handlerId: string): void {
    // Remove from regular handlers
    this.handlers.forEach((handlers) => {
      handlers.forEach((handler) => {
        if (handler.id === handlerId) {
          handlers.delete(handler);
        }
      });
    });

    // Remove from wildcard handlers
    this.wildcardHandlers.forEach((handler) => {
      if (handler.id === handlerId) {
        this.wildcardHandlers.delete(handler);
      }
    });
  }

  /**
   * Clear all handlers for an event
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
      this.wildcardHandlers.clear();
    }
  }

  /**
   * Wait for an event
   */
  async waitFor<T = EventPayload>(
    eventPattern: string | RegExp,
    timeout = 5000,
    filter?: (event: Event<T>) => boolean
  ): Promise<Event<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for event: ${eventPattern}`));
      }, timeout);

      const unsubscribe = this.once<T>(
        eventPattern,
        (event) => {
          clearTimeout(timer);
          resolve(event);
        },
        { filter }
      );
    });
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.eventQueue.length > 0) {
      // Sort by priority
      this.eventQueue.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }

    this.processing = false;
  }

  /**
   * Process single event
   */
  private async processEvent(event: Event): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Get matching handlers
      const handlers = this.getMatchingHandlers(event);

      // Sort handlers by priority
      handlers.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Execute handlers
      for (const handler of handlers) {
        try {
          // Check filter
          if (handler.filter && !handler.filter(event)) {
            continue;
          }

          // Execute handler
          await Promise.resolve(handler.handler(event));

          // Remove if once
          if (handler.once) {
            this.off(handler.id);
          }
        } catch (error) {
          this.metrics.eventsFailed++;
          if (this.options.errorHandler) {
            this.options.errorHandler(error as Error, event);
          }
        }
      }

      this.metrics.eventsProcessed++;
      this.updateAverageProcessingTime(performance.now() - startTime);

    } catch (error) {
      this.metrics.eventsFailed++;
      if (this.options.errorHandler) {
        this.options.errorHandler(error as Error, event);
      }
    }
  }

  /**
   * Get handlers matching an event
   */
  private getMatchingHandlers(event: Event): EventHandler[] {
    const handlers: EventHandler[] = [];

    // Get exact match handlers
    const exactHandlers = this.handlers.get(event.type);
    if (exactHandlers) {
      handlers.push(...Array.from(exactHandlers));
    }

    // Get wildcard handlers
    this.wildcardHandlers.forEach((handler) => {
      const pattern = handler.event;
      if (pattern instanceof RegExp && pattern.test(event.type)) {
        handlers.push(handler);
      }
    });

    return handlers;
  }

  /**
   * Enqueue event
   */
  private enqueueEvent(event: Event): void {
    this.eventQueue.push(event);

    // Limit queue size to prevent memory issues
    if (this.eventQueue.length > 1000) {
      console.warn('[EventBus] Event queue size exceeds 1000, dropping oldest events');
      this.eventQueue = this.eventQueue.slice(-500);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique handler ID
   */
  private generateHandlerId(): string {
    return `hdl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get caller information
   */
  private getCallerInfo(): string {
    try {
      const stack = new Error().stack;
      const callerLine = stack?.split('\n')[3];
      const match = callerLine?.match(/at\s+(\S+)/);
      return match?.[1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(time: number): void {
    const current = this.metrics.averageProcessingTime;
    const count = this.metrics.eventsProcessed;
    this.metrics.averageProcessingTime = (current * (count - 1) + time) / count;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      eventsEmitted: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * Get handler count
   */
  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.handlers.get(eventType)?.size || 0;
    }
    
    let count = this.wildcardHandlers.size;
    this.handlers.forEach(handlers => {
      count += handlers.size;
    });
    return count;
  }

  /**
   * Debug: Get event queue
   */
  getEventQueue(): Event[] {
    return [...this.eventQueue];
  }

  /**
   * Clear event queue
   */
  clearEventQueue(): void {
    this.eventQueue = [];
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();

// Export common event types
export const EventTypes = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_STATE_CHANGED: 'auth.state.changed',
  AUTH_TOKEN_REFRESH: 'auth.token.refresh',
  AUTH_SESSION_EXPIRED: 'auth.session.expired',
  
  // User
  USER_PROFILE_UPDATED: 'user.profile.updated',
  USER_PREFERENCES_CHANGED: 'user.preferences.changed',
  USER_DELETED: 'user.deleted',
  
  // Navigation
  NAVIGATION_ROUTE_CHANGE: 'navigation.route.change',
  NAVIGATION_GUARD_CHECK: 'navigation.guard.check',
  NAVIGATION_REDIRECT: 'navigation.redirect',
  
  // Health
  HEALTH_QUESTIONNAIRE_START: 'health.questionnaire.start',
  HEALTH_QUESTIONNAIRE_PROGRESS: 'health.questionnaire.progress',
  HEALTH_QUESTIONNAIRE_COMPLETE: 'health.questionnaire.complete',
  HEALTH_ANSWER_SAVED: 'health.answer.saved',
  
  // API
  API_REQUEST_START: 'api.request.start',
  API_REQUEST_SUCCESS: 'api.request.success',
  API_REQUEST_FAILURE: 'api.request.failure',
  API_UNAUTHORIZED: 'api.unauthorized',
  
  // UI
  UI_MODAL_OPEN: 'ui.modal.open',
  UI_MODAL_CLOSE: 'ui.modal.close',
  UI_NOTIFICATION_SHOW: 'ui.notification.show',
  UI_LOADING_START: 'ui.loading.start',
  UI_LOADING_END: 'ui.loading.end',
  
  // Errors
  ERROR_BOUNDARY_TRIGGERED: 'error.boundary.triggered',
  ERROR_UNCAUGHT: 'error.uncaught',
  ERROR_API: 'error.api',
  
  // Performance
  PERFORMANCE_METRIC: 'performance.metric',
  PERFORMANCE_WARNING: 'performance.warning',
  PERFORMANCE_CRITICAL: 'performance.critical'
} as const;