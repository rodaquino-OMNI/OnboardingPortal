/**
 * Analytics Validators - Utility Functions
 * Sprint 2B - Analytics Infrastructure Development
 *
 * Additional validation utilities for analytics events
 */

import type { AnalyticsEvent } from '../types';

/**
 * Validate that no personally identifiable information is present
 */
export function validateNoPII(data: any): string[] {
  const warnings: string[] = [];
  const dataStr = JSON.stringify(data);

  // Define PII patterns to check for
  const piiChecks = [
    {
      pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
      type: 'CPF',
    },
    {
      pattern: /\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/g,
      type: 'RG',
    },
    {
      pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/g,
      type: 'Email (use domain only)',
    },
    {
      pattern: /\b\(\d{2}\)\s?\d{4,5}-?\d{4}\b/g,
      type: 'Phone',
    },
    {
      pattern: /\b\d{5}-?\d{3}\b/g,
      type: 'ZIP Code',
    },
    {
      pattern: /\b[A-Z]{2,}\s+[A-Z]{2,}\b/g,
      type: 'Full Name (potential)',
    },
  ];

  for (const check of piiChecks) {
    const matches = dataStr.match(check.pattern);
    if (matches) {
      warnings.push(`Potential ${check.type} detected: ${matches.length} occurrence(s)`);
    }
  }

  return warnings;
}

/**
 * Validate event timestamp is recent and properly formatted
 */
export function validateTimestamp(timestamp: string): boolean {
  try {
    const eventTime = new Date(timestamp);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Check if timestamp is valid and within reasonable bounds
    return eventTime >= hourAgo && eventTime <= hourFromNow;
  } catch {
    return false;
  }
}

/**
 * Validate user ID is properly hashed
 */
export function validateHashedUserId(userId?: string): boolean {
  if (!userId) {
    return true; // Optional field
  }

  // Must start with 'hash_' and be followed by 64 hex characters
  return /^hash_[a-f0-9]{64}$/.test(userId);
}

/**
 * Validate session ID format
 */
export function validateSessionId(sessionId?: string): boolean {
  if (!sessionId) {
    return true; // Optional field
  }

  // Must start with 'sess_' and be followed by alphanumeric characters
  return /^sess_[a-zA-Z0-9]{10,}$/.test(sessionId);
}

/**
 * Validate event name follows namespace.action_object pattern
 */
export function validateEventName(eventName: string): boolean {
  return /^[a-z]+\.[a-z_]+$/.test(eventName);
}

/**
 * Validate IP address hash format
 */
export function validateIpAddressHash(ipHash?: string): boolean {
  if (!ipHash) {
    return true; // Optional field
  }

  // Must start with 'hash_' and be followed by 16 hex characters
  return /^hash_[a-f0-9]{16}$/.test(ipHash);
}

/**
 * Comprehensive event validation
 */
export function validateEvent(event: AnalyticsEvent): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!event.event) {
    errors.push('Event name is required');
  } else if (!validateEventName(event.event)) {
    errors.push('Event name must follow namespace.action_object pattern');
  }

  if (!event.schema_version) {
    errors.push('Schema version is required');
  }

  if (!event.timestamp) {
    errors.push('Timestamp is required');
  } else if (!validateTimestamp(event.timestamp)) {
    warnings.push('Timestamp appears to be outside reasonable bounds');
  }

  if (!event.platform) {
    errors.push('Platform is required');
  } else if (!['web', 'mobile', 'api'].includes(event.platform)) {
    errors.push('Platform must be web, mobile, or api');
  }

  // Validate optional fields
  if (!validateHashedUserId(event.user_id)) {
    errors.push('User ID must be properly hashed with hash_ prefix');
  }

  if (!validateSessionId(event.session_id)) {
    errors.push('Session ID must follow sess_[alphanumeric] pattern');
  }

  if (event.context?.ip_address_hash && !validateIpAddressHash(event.context.ip_address_hash)) {
    errors.push('IP address hash must be properly formatted');
  }

  // Check for PII
  const piiWarnings = validateNoPII(event);
  warnings.push(...piiWarnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize data by removing potential PII
 */
export function sanitizeData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip sensitive fields
    if (['cpf', 'rg', 'phone', 'email', 'password', 'name', 'address'].includes(key.toLowerCase())) {
      continue;
    }

    // Recursively sanitize objects
    sanitized[key] = sanitizeData(value);
  }

  return sanitized;
}

/**
 * Generate a unique tracking ID for correlation
 */
export function generateTrackingId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `track_${timestamp}_${random}`;
}