/**
 * Analytics Emitter - Core Infrastructure
 * Sprint 2B - Analytics Infrastructure Development
 *
 * Provides type-safe, schema-validated analytics event emission with AJV strict validation.
 * Ensures no PII/PHI data is transmitted and all events conform to ANALYTICS_SPEC v1.0.0
 */

import Ajv, { JSONSchemaType, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import crypto from 'crypto';

import type {
  AnalyticsEvent,
  AnalyticsConfig,
  AnalyticsValidationError,
  BaseAnalyticsEvent,
  AnalyticsContext,
} from './types';

// Import schemas
import baseEventSchema from './schemas/base-event.schema.json';
import pointsEarnedSchema from './schemas/gamification.points_earned.schema.json';
import levelUpSchema from './schemas/gamification.level_up.schema.json';
import badgeUnlockedSchema from './schemas/gamification.badge_unlocked.schema.json';
import registrationStartedSchema from './schemas/auth.registration_started.schema.json';
import registrationCompletedSchema from './schemas/auth.registration_completed.schema.json';
import emailVerifiedSchema from './schemas/auth.email_verified.schema.json';
import uploadCompletedSchema from './schemas/documents.upload_completed.schema.json';
import documentsApprovedSchema from './schemas/documents.approved.schema.json';
import uploadFailedSchema from './schemas/documents.upload_failed.schema.json';

export class AnalyticsEmitter {
  private ajv: Ajv;
  private config: AnalyticsConfig;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      endpoint: '/api/analytics/track',
      batchSize: 10,
      flushInterval: 5000, // 5 seconds
      maxRetries: 3,
      strictValidation: true,
      ...config,
    };

    // Initialize AJV with strict validation
    this.ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false,
      useDefaults: false,
      validateFormats: true,
    });

    // Add format validation
    addFormats(this.ajv);

    // Register all schemas
    this.registerSchemas();

    // Start flush timer if enabled
    if (this.config.enabled && this.config.flushInterval) {
      this.startFlushTimer();
    }
  }

  /**
   * Register all analytics event schemas with AJV
   */
  private registerSchemas(): void {
    try {
      // Register base schema first
      this.ajv.addSchema(baseEventSchema, 'base-event');

      // Register all event-specific schemas
      const schemas = [
        pointsEarnedSchema,
        levelUpSchema,
        badgeUnlockedSchema,
        registrationStartedSchema,
        registrationCompletedSchema,
        emailVerifiedSchema,
        uploadCompletedSchema,
        documentsApprovedSchema,
        uploadFailedSchema,
      ];

      schemas.forEach((schema) => {
        this.ajv.addSchema(schema, schema.$id);
      });

      console.debug('[Analytics] All schemas registered successfully');
    } catch (error) {
      console.error('[Analytics] Schema registration failed:', error);
      throw new Error('Failed to initialize analytics schemas');
    }
  }

  /**
   * Track an analytics event with strict validation
   */
  public track(event: AnalyticsEvent): Promise<void> {
    if (!this.config.enabled) {
      console.debug('[Analytics] Tracking disabled, ignoring event:', event.event);
      return Promise.resolve();
    }

    try {
      // Validate event against its schema
      this.validateEvent(event);

      // Enrich event with context
      const enrichedEvent = this.enrichEvent(event);

      // Add to queue
      this.eventQueue.push(enrichedEvent);

      // Flush if batch size reached
      if (this.eventQueue.length >= (this.config.batchSize || 10)) {
        return this.flush();
      }

      return Promise.resolve();
    } catch (error) {
      console.error('[Analytics] Event tracking failed:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Validate event against its schema using AJV
   */
  private validateEvent(event: AnalyticsEvent): void {
    if (!this.config.strictValidation) {
      return;
    }

    const validator = this.ajv.getSchema(event.event);
    if (!validator) {
      throw new AnalyticsError(
        `Schema not found for event: ${event.event}`,
        'SCHEMA_NOT_FOUND',
        event
      );
    }

    const isValid = validator(event);
    if (!isValid) {
      const errors = this.formatValidationErrors(validator.errors || [], event.event);
      throw new AnalyticsError(
        `Event validation failed: ${errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_FAILED',
        event,
        errors
      );
    }

    // Additional PII/PHI validation
    this.validateNoPII(event);
  }

  /**
   * Validate that no PII/PHI data is present in the event
   */
  private validateNoPII(event: AnalyticsEvent): void {
    const eventStr = JSON.stringify(event);

    // Check for patterns that might indicate PII
    const piiPatterns = [
      /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, // CPF pattern
      /\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/, // RG pattern
      /\b[\w.-]+@[\w.-]+\.\w+\b/,     // Email pattern (except domains)
      /\b\(\d{2}\)\s?\d{4,5}-?\d{4}\b/, // Phone pattern
      /\b\d{5}-?\d{3}\b/,             // ZIP code pattern
    ];

    const foundPII = piiPatterns.find((pattern) => pattern.test(eventStr));
    if (foundPII) {
      throw new AnalyticsError(
        'Event contains potential PII/PHI data',
        'PII_DETECTED',
        event
      );
    }

    // Check user_id is properly hashed
    if (event.user_id && !event.user_id.startsWith('hash_')) {
      throw new AnalyticsError(
        'user_id must be hashed with hash_ prefix',
        'UNHASHED_USER_ID',
        event
      );
    }
  }

  /**
   * Enrich event with additional context
   */
  private enrichEvent(event: AnalyticsEvent): AnalyticsEvent {
    const now = new Date().toISOString();

    const enrichedContext: AnalyticsContext = {
      ...event.context,
      server_timestamp: now,
      environment: this.getEnvironment(),
    };

    // Add client-side context if available
    if (typeof window !== 'undefined') {
      enrichedContext.user_agent = navigator.userAgent;
      enrichedContext.screen_resolution = `${screen.width}x${screen.height}`;
      enrichedContext.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      enrichedContext.referrer = document.referrer || undefined;
    }

    return {
      ...event,
      schema_version: event.schema_version || '1.0.0',
      timestamp: event.timestamp || now,
      context: enrichedContext,
    };
  }

  /**
   * Get current environment
   */
  private getEnvironment(): string {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      return process.env.NODE_ENV;
    }
    if (typeof window !== 'undefined') {
      return window.location.hostname.includes('localhost') ? 'development' : 'production';
    }
    return 'unknown';
  }

  /**
   * Flush queued events to the analytics endpoint
   */
  public async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(events);
      console.debug(`[Analytics] Flushed ${events.length} events successfully`);
    } catch (error) {
      console.error('[Analytics] Failed to flush events:', error);
      // Re-queue events for retry (with limit)
      if (events.length <= (this.config.maxRetries || 3) * (this.config.batchSize || 10)) {
        this.eventQueue.unshift(...events);
      }
      throw error;
    }
  }

  /**
   * Send events to analytics endpoint
   */
  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      console.warn('[Analytics] No endpoint configured, events not sent');
      return;
    }

    const payload = {
      events,
      client_timestamp: new Date().toISOString(),
      batch_id: this.generateBatchId(),
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Analytics endpoint returned ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush().catch((error) => {
          console.error('[Analytics] Auto-flush failed:', error);
        });
      }
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flushing
   */
  public stopFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Format AJV validation errors
   */
  private formatValidationErrors(errors: ErrorObject[], eventType: string): AnalyticsValidationError[] {
    return errors.map((error) => ({
      event: eventType,
      field: error.instancePath || error.schemaPath,
      message: error.message || 'Validation failed',
      value: error.data,
    }));
  }

  /**
   * Hash sensitive data (for user IDs, IP addresses, etc.)
   */
  public static hashValue(value: string, prefix: string = 'hash'): string {
    const salt = process.env.ANALYTICS_SALT || 'default_salt_change_in_production';
    const hash = crypto.createHash('sha256').update(`${value}-${salt}`).digest('hex');
    return `${prefix}_${hash}`;
  }

  /**
   * Extract email domain from full email
   */
  public static extractEmailDomain(email: string): string {
    const [, domain] = email.split('@');
    return domain || 'unknown';
  }

  /**
   * Destroy emitter and clean up resources
   */
  public destroy(): void {
    this.stopFlush();
    this.eventQueue = [];
  }
}

/**
 * Custom error class for analytics validation errors
 */
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
    public event?: AnalyticsEvent,
    public validationErrors?: AnalyticsValidationError[]
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

// Singleton instance for convenience
let defaultEmitter: AnalyticsEmitter | null = null;

/**
 * Get or create default analytics emitter instance
 */
export function getAnalyticsEmitter(config?: Partial<AnalyticsConfig>): AnalyticsEmitter {
  if (!defaultEmitter) {
    defaultEmitter = new AnalyticsEmitter(config);
  }
  return defaultEmitter;
}

/**
 * Convenience function to track events using default emitter
 */
export function trackEvent(event: AnalyticsEvent): Promise<void> {
  return getAnalyticsEmitter().track(event);
}

/**
 * Convenience function to flush events using default emitter
 */
export function flushAnalytics(): Promise<void> {
  return getAnalyticsEmitter().flush();
}