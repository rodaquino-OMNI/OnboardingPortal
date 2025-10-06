# Sprint 2B: Analytics Infrastructure Blueprint

**Status:** PLANNING PHASE
**Planner:** Hive Mind Collective
**Memory Key:** `hive/planning/analytics_design`
**Date:** 2025-10-01

---

## 1. Analytics Emitter Architecture

### 1.1 Core Design Principles

```typescript
/**
 * Analytics Emitter - Tree-shakeable, type-safe event tracking
 *
 * Design Goals:
 * - AJV strict mode validation (dev/test: throw, prod: drop + log)
 * - Zero PII leakage
 * - Tree-shakeable modules
 * - Full TypeScript type safety
 * - Runtime validation with compile-time types
 * - Sentry integration for dropped events (prod only)
 */
```

### 1.2 Module Structure

```
apps/web/src/lib/analytics/
├── index.ts                    # Public API (tree-shakeable exports)
├── emitter.ts                  # Core event emitter
├── validator.ts                # AJV validation wrapper
├── types.ts                    # TypeScript types (generated from schemas)
├── config.ts                   # Environment-based config
└── sentry-logger.ts            # Production error logging (no PII)

apps/web/src/lib/schemas/
├── index.ts                    # Schema registry
├── gamification/
│   ├── points-earned.schema.json
│   ├── level-up.schema.json
│   └── badge-unlocked.schema.json
├── onboarding/
│   ├── registration-started.schema.json
│   ├── registration-step-completed.schema.json
│   └── registration-completed.schema.json
└── documents/
    ├── document-uploaded.schema.json
    ├── document-approved.schema.json
    └── document-rejected.schema.json
```

### 1.3 Emitter API Design

```typescript
// apps/web/src/lib/analytics/emitter.ts

import Ajv, { ValidateFunction } from 'ajv';
import { schemas } from '../schemas';
import { logInvalidEvent } from './sentry-logger';
import type { AnalyticsEvent, EventName } from './types';

class AnalyticsEmitter {
  private ajv: Ajv;
  private validators: Map<EventName, ValidateFunction>;
  private isProduction: boolean;

  constructor(config: { environment: string }) {
    this.isProduction = config.environment === 'production';

    // AJV with strict mode
    this.ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false, // Don't modify payloads
      useDefaults: false,
    });

    this.validators = new Map();
    this.compileSchemas();
  }

  private compileSchemas(): void {
    for (const [eventName, schema] of Object.entries(schemas)) {
      const validator = this.ajv.compile(schema);
      this.validators.set(eventName as EventName, validator);
    }
  }

  /**
   * Track analytics event with runtime validation
   *
   * @param eventName - Event type (must match schema)
   * @param payload - Event payload (validated against schema)
   * @throws ValidationError in dev/test environments
   */
  track<T extends EventName>(
    eventName: T,
    payload: AnalyticsEvent[T]
  ): void {
    const validator = this.validators.get(eventName);

    if (!validator) {
      const error = new Error(`Unknown event type: ${eventName}`);
      this.handleValidationFailure(eventName, payload, error);
      return;
    }

    const isValid = validator(payload);

    if (!isValid) {
      const error = new Error(
        `Invalid payload for ${eventName}: ${JSON.stringify(validator.errors)}`
      );
      this.handleValidationFailure(eventName, payload, error);
      return;
    }

    // Send to analytics backend
    this.send(eventName, payload);
  }

  private handleValidationFailure(
    eventName: string,
    payload: unknown,
    error: Error
  ): void {
    if (this.isProduction) {
      // Production: drop event, log to Sentry (no PII)
      logInvalidEvent({
        eventName,
        errorMessage: error.message,
        // DO NOT include payload in production logs
      });
    } else {
      // Dev/Test: throw error immediately
      throw error;
    }
  }

  private send(eventName: string, payload: unknown): void {
    // Integration with analytics backend (PostHog, Amplitude, etc.)
    console.log(`[Analytics] ${eventName}`, payload);
  }
}

export const analytics = new AnalyticsEmitter({
  environment: import.meta.env.MODE,
});
```

### 1.4 Type-Safe Public API

```typescript
// apps/web/src/lib/analytics/index.ts

export { analytics } from './emitter';
export type { AnalyticsEvent, EventName } from './types';

// Tree-shakeable event helpers
export const trackPointsEarned = (payload: AnalyticsEvent['points_earned']) =>
  analytics.track('points_earned', payload);

export const trackLevelUp = (payload: AnalyticsEvent['level_up']) =>
  analytics.track('level_up', payload);

export const trackBadgeUnlocked = (payload: AnalyticsEvent['badge_unlocked']) =>
  analytics.track('badge_unlocked', payload);

export const trackRegistrationStarted = (payload: AnalyticsEvent['registration_started']) =>
  analytics.track('registration_started', payload);

export const trackRegistrationCompleted = (payload: AnalyticsEvent['registration_completed']) =>
  analytics.track('registration_completed', payload);

export const trackDocumentUploaded = (payload: AnalyticsEvent['document_uploaded']) =>
  analytics.track('document_uploaded', payload);

export const trackDocumentApproved = (payload: AnalyticsEvent['document_approved']) =>
  analytics.track('document_approved', payload);

export const trackDocumentRejected = (payload: AnalyticsEvent['document_rejected']) =>
  analytics.track('document_rejected', payload);
```

### 1.5 Sentry Logger (Production Only)

```typescript
// apps/web/src/lib/analytics/sentry-logger.ts

import * as Sentry from '@sentry/browser';

interface InvalidEventLog {
  eventName: string;
  errorMessage: string;
  // NEVER include payload - may contain PII
}

export function logInvalidEvent(log: InvalidEventLog): void {
  // Only log in production to Sentry
  if (import.meta.env.MODE === 'production') {
    Sentry.captureMessage('Analytics Event Validation Failed', {
      level: 'warning',
      tags: {
        event_name: log.eventName,
      },
      extra: {
        error_message: log.errorMessage,
        // NO payload - PII protection
      },
    });
  }
}
```

---

## 2. JSON Schema Structure

### 2.1 Schema Organization

All schemas follow JSON Schema Draft-07 with strict validation rules.

### 2.2 Gamification Schemas

#### points_earned.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "points_earned",
  "title": "Points Earned Event",
  "description": "User earned points for completing an action",
  "type": "object",
  "required": ["user_id", "action_type", "points", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid",
      "description": "User UUID (not PII)"
    },
    "action_type": {
      "type": "string",
      "enum": [
        "registration_complete",
        "profile_complete",
        "health_question_answered",
        "document_uploaded",
        "document_approved",
        "interview_scheduled",
        "interview_attended",
        "onboarding_complete"
      ],
      "description": "Type of action that earned points"
    },
    "points": {
      "type": "integer",
      "minimum": 1,
      "maximum": 500,
      "description": "Points awarded"
    },
    "bonus_type": {
      "type": "string",
      "enum": ["early_completion", "thoroughness", "punctuality", "zero_errors"],
      "description": "Optional bonus type"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp"
    },
    "metadata": {
      "type": "object",
      "description": "Additional context (no PII allowed)",
      "additionalProperties": false,
      "properties": {
        "session_id": { "type": "string" },
        "device_type": { "type": "string", "enum": ["desktop", "mobile", "tablet"] }
      }
    }
  }
}
```

#### level_up.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "level_up",
  "title": "Level Up Event",
  "description": "User advanced to a new level",
  "type": "object",
  "required": ["user_id", "previous_level", "new_level", "total_points", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "previous_level": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "new_level": {
      "type": "integer",
      "minimum": 2,
      "maximum": 5
    },
    "total_points": {
      "type": "integer",
      "minimum": 0
    },
    "level_name": {
      "type": "string",
      "enum": ["iniciante", "bronze", "prata", "ouro", "platina"]
    },
    "benefits_unlocked": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of benefits unlocked at this level"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### badge_unlocked.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "badge_unlocked",
  "title": "Badge Unlocked Event",
  "description": "User unlocked a new badge",
  "type": "object",
  "required": ["user_id", "badge_id", "badge_name", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "badge_id": {
      "type": "string",
      "description": "Badge identifier"
    },
    "badge_name": {
      "type": "string",
      "enum": [
        "first_steps",
        "health_champion",
        "document_master",
        "punctual_professional",
        "speed_demon",
        "perfectionist"
      ]
    },
    "badge_icon": {
      "type": "string",
      "description": "Badge emoji or icon identifier"
    },
    "unlock_criteria": {
      "type": "string",
      "description": "What triggered the badge unlock"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### 2.3 Onboarding Schemas

#### registration_started.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "registration_started",
  "title": "Registration Started Event",
  "description": "User began registration process",
  "type": "object",
  "required": ["session_id", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Anonymous session ID"
    },
    "referral_source": {
      "type": "string",
      "description": "UTM source or referral"
    },
    "device_type": {
      "type": "string",
      "enum": ["desktop", "mobile", "tablet"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### registration_step_completed.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "registration_step_completed",
  "title": "Registration Step Completed Event",
  "description": "User completed a step in multi-step registration",
  "type": "object",
  "required": ["user_id", "step_number", "step_name", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "step_number": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "step_name": {
      "type": "string",
      "enum": [
        "basic_info",
        "contact_info",
        "health_questionnaire",
        "document_upload",
        "review_submit"
      ]
    },
    "completion_time_ms": {
      "type": "integer",
      "minimum": 0,
      "description": "Time spent on this step in milliseconds"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### registration_completed.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "registration_completed",
  "title": "Registration Completed Event",
  "description": "User successfully completed registration",
  "type": "object",
  "required": ["user_id", "total_time_ms", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "total_time_ms": {
      "type": "integer",
      "minimum": 0,
      "description": "Total registration time in milliseconds"
    },
    "steps_completed": {
      "type": "integer",
      "minimum": 1
    },
    "email_verified": {
      "type": "boolean"
    },
    "lgpd_consent": {
      "type": "boolean"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### 2.4 Document Schemas

#### document_uploaded.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "document_uploaded",
  "title": "Document Uploaded Event",
  "description": "User uploaded a document for verification",
  "type": "object",
  "required": ["user_id", "document_id", "document_type", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_type": {
      "type": "string",
      "enum": ["cpf", "rg", "cnh", "health_card", "proof_residence", "other"]
    },
    "file_size_bytes": {
      "type": "integer",
      "minimum": 0
    },
    "file_format": {
      "type": "string",
      "enum": ["pdf", "jpg", "jpeg", "png"]
    },
    "upload_source": {
      "type": "string",
      "enum": ["camera", "file_picker", "drag_drop"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### document_approved.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "document_approved",
  "title": "Document Approved Event",
  "description": "Document passed verification",
  "type": "object",
  "required": ["user_id", "document_id", "document_type", "review_time_ms", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_type": {
      "type": "string",
      "enum": ["cpf", "rg", "cnh", "health_card", "proof_residence", "other"]
    },
    "review_time_ms": {
      "type": "integer",
      "minimum": 0,
      "description": "Time from upload to approval"
    },
    "auto_approved": {
      "type": "boolean",
      "description": "Whether document was auto-approved by OCR/AI"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### document_rejected.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "document_rejected",
  "title": "Document Rejected Event",
  "description": "Document failed verification",
  "type": "object",
  "required": ["user_id", "document_id", "document_type", "rejection_reason", "timestamp"],
  "additionalProperties": false,
  "properties": {
    "user_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_id": {
      "type": "string",
      "format": "uuid"
    },
    "document_type": {
      "type": "string",
      "enum": ["cpf", "rg", "cnh", "health_card", "proof_residence", "other"]
    },
    "rejection_reason": {
      "type": "string",
      "enum": [
        "blurry_image",
        "incomplete_document",
        "expired_document",
        "unreadable_text",
        "wrong_document_type",
        "other"
      ]
    },
    "can_resubmit": {
      "type": "boolean"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

---

## 3. TypeScript Type Generation

### 3.1 Generated Types File

```typescript
// apps/web/src/lib/analytics/types.ts
// THIS FILE IS AUTO-GENERATED FROM JSON SCHEMAS - DO NOT EDIT MANUALLY

export type EventName =
  | 'points_earned'
  | 'level_up'
  | 'badge_unlocked'
  | 'registration_started'
  | 'registration_step_completed'
  | 'registration_completed'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected';

export interface AnalyticsEvent {
  points_earned: {
    user_id: string;
    action_type:
      | 'registration_complete'
      | 'profile_complete'
      | 'health_question_answered'
      | 'document_uploaded'
      | 'document_approved'
      | 'interview_scheduled'
      | 'interview_attended'
      | 'onboarding_complete';
    points: number;
    bonus_type?: 'early_completion' | 'thoroughness' | 'punctuality' | 'zero_errors';
    timestamp: string;
    metadata?: {
      session_id?: string;
      device_type?: 'desktop' | 'mobile' | 'tablet';
    };
  };

  level_up: {
    user_id: string;
    previous_level: number;
    new_level: number;
    total_points: number;
    level_name: 'iniciante' | 'bronze' | 'prata' | 'ouro' | 'platina';
    benefits_unlocked?: string[];
    timestamp: string;
  };

  badge_unlocked: {
    user_id: string;
    badge_id: string;
    badge_name:
      | 'first_steps'
      | 'health_champion'
      | 'document_master'
      | 'punctual_professional'
      | 'speed_demon'
      | 'perfectionist';
    badge_icon?: string;
    unlock_criteria?: string;
    timestamp: string;
  };

  registration_started: {
    session_id: string;
    referral_source?: string;
    device_type?: 'desktop' | 'mobile' | 'tablet';
    timestamp: string;
  };

  registration_step_completed: {
    user_id: string;
    step_number: number;
    step_name:
      | 'basic_info'
      | 'contact_info'
      | 'health_questionnaire'
      | 'document_upload'
      | 'review_submit';
    completion_time_ms?: number;
    timestamp: string;
  };

  registration_completed: {
    user_id: string;
    total_time_ms: number;
    steps_completed?: number;
    email_verified?: boolean;
    lgpd_consent?: boolean;
    timestamp: string;
  };

  document_uploaded: {
    user_id: string;
    document_id: string;
    document_type: 'cpf' | 'rg' | 'cnh' | 'health_card' | 'proof_residence' | 'other';
    file_size_bytes?: number;
    file_format?: 'pdf' | 'jpg' | 'jpeg' | 'png';
    upload_source?: 'camera' | 'file_picker' | 'drag_drop';
    timestamp: string;
  };

  document_approved: {
    user_id: string;
    document_id: string;
    document_type: 'cpf' | 'rg' | 'cnh' | 'health_card' | 'proof_residence' | 'other';
    review_time_ms: number;
    auto_approved?: boolean;
    timestamp: string;
  };

  document_rejected: {
    user_id: string;
    document_id: string;
    document_type: 'cpf' | 'rg' | 'cnh' | 'health_card' | 'proof_residence' | 'other';
    rejection_reason:
      | 'blurry_image'
      | 'incomplete_document'
      | 'expired_document'
      | 'unreadable_text'
      | 'wrong_document_type'
      | 'other';
    can_resubmit?: boolean;
    timestamp: string;
  };
}
```

---

## 4. Contract Fixtures & Tests

### 4.1 Test Directory Structure

```
tests/analytics/
├── fixtures/
│   ├── gamification/
│   │   ├── points-earned.valid.json
│   │   ├── points-earned.invalid.json
│   │   ├── level-up.valid.json
│   │   └── badge-unlocked.valid.json
│   ├── onboarding/
│   │   ├── registration-started.valid.json
│   │   ├── registration-completed.valid.json
│   │   └── registration-completed.invalid.json
│   └── documents/
│       ├── document-uploaded.valid.json
│       ├── document-approved.valid.json
│       └── document-rejected.valid.json
└── contracts.spec.ts
```

### 4.2 Valid Fixture Examples

```json
// tests/analytics/fixtures/gamification/points-earned.valid.json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "action_type": "document_uploaded",
  "points": 50,
  "bonus_type": "thoroughness",
  "timestamp": "2025-01-15T10:30:00Z",
  "metadata": {
    "session_id": "sess_abc123",
    "device_type": "mobile"
  }
}
```

```json
// tests/analytics/fixtures/onboarding/registration-completed.valid.json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_time_ms": 180000,
  "steps_completed": 5,
  "email_verified": true,
  "lgpd_consent": true,
  "timestamp": "2025-01-15T11:00:00Z"
}
```

### 4.3 Invalid Fixture Examples

```json
// tests/analytics/fixtures/gamification/points-earned.invalid.json
{
  "user_id": "not-a-uuid",
  "action_type": "invalid_action",
  "points": 9999,
  "timestamp": "invalid-date"
}
```

```json
// tests/analytics/fixtures/onboarding/registration-completed.invalid.json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_time_ms": -100,
  "email_verified": "yes",
  "timestamp": "2025-01-15T11:00:00Z"
}
```

### 4.4 Contract Test Suite

```typescript
// tests/analytics/contracts.spec.ts

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemas } from '../../apps/web/src/lib/schemas';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Analytics Contract Tests', () => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);

  // Compile all schemas
  const validators = new Map();
  for (const [eventName, schema] of Object.entries(schemas)) {
    validators.set(eventName, ajv.compile(schema));
  }

  describe('Valid Payloads', () => {
    const fixtureDir = join(__dirname, 'fixtures');
    const categories = readdirSync(fixtureDir);

    for (const category of categories) {
      const categoryPath = join(fixtureDir, category);
      const fixtures = readdirSync(categoryPath).filter(f =>
        f.endsWith('.valid.json')
      );

      for (const fixture of fixtures) {
        it(`should validate ${category}/${fixture}`, () => {
          const fixturePath = join(categoryPath, fixture);
          const payload = JSON.parse(readFileSync(fixturePath, 'utf-8'));

          // Extract event name from fixture file
          const eventName = fixture.replace('.valid.json', '').replace(/-/g, '_');
          const validator = validators.get(eventName);

          expect(validator).toBeDefined();
          const isValid = validator(payload);

          if (!isValid) {
            console.error('Validation errors:', validator.errors);
          }

          expect(isValid).toBe(true);
        });
      }
    }
  });

  describe('Invalid Payloads', () => {
    const fixtureDir = join(__dirname, 'fixtures');
    const categories = readdirSync(fixtureDir);

    for (const category of categories) {
      const categoryPath = join(fixtureDir, category);
      const fixtures = readdirSync(categoryPath).filter(f =>
        f.endsWith('.invalid.json')
      );

      for (const fixture of fixtures) {
        it(`should reject ${category}/${fixture}`, () => {
          const fixturePath = join(categoryPath, fixture);
          const payload = JSON.parse(readFileSync(fixturePath, 'utf-8'));

          const eventName = fixture.replace('.invalid.json', '').replace(/-/g, '_');
          const validator = validators.get(eventName);

          expect(validator).toBeDefined();
          const isValid = validator(payload);

          expect(isValid).toBe(false);
          expect(validator.errors).toBeDefined();
          expect(validator.errors.length).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('PII Protection', () => {
    it('should not allow PII fields in event payloads', () => {
      const piiFields = [
        'email', 'name', 'cpf', 'phone', 'address',
        'birth_date', 'ip_address', 'credit_card'
      ];

      for (const [eventName, schema] of Object.entries(schemas)) {
        const schemaProperties = schema.properties || {};
        const schemaKeys = Object.keys(schemaProperties);

        for (const piiField of piiFields) {
          expect(
            schemaKeys.includes(piiField),
            `Schema ${eventName} contains PII field: ${piiField}`
          ).toBe(false);
        }
      }
    });
  });

  describe('Schema Strictness', () => {
    it('should have additionalProperties: false for all schemas', () => {
      for (const [eventName, schema] of Object.entries(schemas)) {
        expect(
          schema.additionalProperties,
          `Schema ${eventName} should have additionalProperties: false`
        ).toBe(false);
      }
    });

    it('should have required fields defined', () => {
      for (const [eventName, schema] of Object.entries(schemas)) {
        expect(
          schema.required,
          `Schema ${eventName} should have required array`
        ).toBeDefined();
        expect(
          schema.required.length,
          `Schema ${eventName} should have at least one required field`
        ).toBeGreaterThan(0);
      }
    });

    it('should have timestamp as required field', () => {
      for (const [eventName, schema] of Object.entries(schemas)) {
        expect(
          schema.required.includes('timestamp'),
          `Schema ${eventName} should require timestamp field`
        ).toBe(true);
      }
    });
  });
});
```

---

## 5. CI Integration

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/analytics-contracts.yml

name: Analytics Contract Validation

on:
  pull_request:
    paths:
      - 'apps/web/src/lib/analytics/**'
      - 'apps/web/src/lib/schemas/**'
      - 'tests/analytics/**'
  push:
    branches: [main, develop]

jobs:
  contract-tests:
    name: Validate Analytics Contracts
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run contract tests
        run: npm run test:analytics-contracts

      - name: Generate contract report
        if: always()
        run: |
          npm run test:analytics-contracts -- --reporter=json > contract-report.json

      - name: Upload contract report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: contract-report
          path: contract-report.json

      - name: Validate schema strictness
        run: npm run validate:schemas

      - name: Check for PII in schemas
        run: npm run validate:no-pii

  type-generation:
    name: Verify Type Generation
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate types from schemas
        run: npm run generate:analytics-types

      - name: Check for type changes
        run: |
          if [[ -n $(git diff --stat apps/web/src/lib/analytics/types.ts) ]]; then
            echo "❌ Generated types are out of sync with schemas"
            echo "Run: npm run generate:analytics-types"
            exit 1
          fi

      - name: TypeScript compilation
        run: npm run typecheck
```

### 5.2 Package.json Scripts

```json
{
  "scripts": {
    "test:analytics-contracts": "vitest run tests/analytics/contracts.spec.ts",
    "validate:schemas": "node scripts/validate-schemas.js",
    "validate:no-pii": "node scripts/check-pii-in-schemas.js",
    "generate:analytics-types": "node scripts/generate-types-from-schemas.js"
  }
}
```

---

## 6. Schema Versioning Strategy

### 6.1 Versioning Approach

**Version Format:** `v{major}.{minor}.{patch}`

**Rules:**
- **MAJOR:** Breaking changes (remove required field, change field type)
- **MINOR:** Backward-compatible additions (new optional field, new enum value)
- **PATCH:** Fixes (typos, documentation, clarifications)

### 6.2 Schema Versioning Implementation

```typescript
// apps/web/src/lib/schemas/index.ts

export const schemas = {
  // Current stable versions
  'points_earned': require('./gamification/points-earned.v1.schema.json'),
  'level_up': require('./gamification/level-up.v1.schema.json'),
  'badge_unlocked': require('./gamification/badge-unlocked.v1.schema.json'),

  // Version-specific imports for backward compatibility
  'points_earned.v1': require('./gamification/points-earned.v1.schema.json'),
  'points_earned.v2': require('./gamification/points-earned.v2.schema.json'),
};

// Version registry
export const schemaVersions = {
  points_earned: { current: 'v1', deprecated: [] },
  level_up: { current: 'v1', deprecated: [] },
  badge_unlocked: { current: 'v1', deprecated: [] },
};
```

### 6.3 Migration Strategy

When introducing a breaking change:

1. Create new schema version: `event-name.v2.schema.json`
2. Update emitter to support both versions during transition
3. Add deprecation warning for old version
4. Document migration path in CHANGELOG
5. Remove old version after 3-month deprecation period

---

## 7. SDK Integration Design

### 7.1 Generated SDK Integration

The analytics system integrates with the OpenAPI-generated SDK from Sprint 1.5:

```typescript
// Integration with generated SDK types

import { components } from '@/lib/sdk/openapi-types';
import { trackPointsEarned, trackLevelUp } from '@/lib/analytics';

type GamificationResponse = components['schemas']['GamificationResponse'];

// Usage in React component
function useGamification() {
  const handlePointsEarned = (response: GamificationResponse) => {
    // Track analytics event with type safety
    trackPointsEarned({
      user_id: response.user_id,
      action_type: response.action_type,
      points: response.points_earned,
      timestamp: new Date().toISOString(),
    });
  };

  return { handlePointsEarned };
}
```

### 7.2 Automatic Tracking Hooks

```typescript
// apps/web/src/lib/analytics/hooks.ts

import { useEffect } from 'react';
import { api } from '@/lib/sdk/client';
import { trackPointsEarned, trackLevelUp, trackBadgeUnlocked } from './index';

/**
 * Auto-track gamification events from API responses
 */
export function useGamificationTracking() {
  useEffect(() => {
    // Intercept API responses and auto-track events
    api.interceptors.response.use((response) => {
      if (response.data?.gamification) {
        const gam = response.data.gamification;

        if (gam.points_earned) {
          trackPointsEarned({
            user_id: response.data.user_id,
            action_type: gam.action_type,
            points: gam.points_earned,
            timestamp: new Date().toISOString(),
          });
        }

        if (gam.level_up) {
          trackLevelUp({
            user_id: response.data.user_id,
            previous_level: gam.previous_level,
            new_level: gam.new_level,
            total_points: gam.total_points,
            level_name: gam.level_name,
            timestamp: new Date().toISOString(),
          });
        }

        if (gam.badge_unlocked) {
          trackBadgeUnlocked({
            user_id: response.data.user_id,
            badge_id: gam.badge_id,
            badge_name: gam.badge_name,
            badge_icon: gam.badge_icon,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return response;
    });
  }, []);
}
```

---

## 8. Security & PII Protection

### 8.1 PII Protection Rules

**NEVER ALLOWED in analytics events:**
- Email addresses
- Full names
- CPF/RG numbers
- Phone numbers
- IP addresses
- Physical addresses
- Birth dates
- Credit card numbers
- Any other personally identifiable information

**ALLOWED:**
- User UUIDs (non-reversible)
- Session IDs (anonymous)
- Timestamps
- Event types
- Aggregate counts
- Device types (generic)

### 8.2 Schema Validation for PII

```javascript
// scripts/check-pii-in-schemas.js

const fs = require('fs');
const path = require('path');

const PII_KEYWORDS = [
  'email', 'name', 'cpf', 'rg', 'phone', 'address',
  'birth_date', 'birthdate', 'ip_address', 'credit_card',
  'password', 'ssn', 'social_security'
];

function checkSchemaForPII(schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const properties = schema.properties || {};
  const foundPII = [];

  for (const key of Object.keys(properties)) {
    const lowerKey = key.toLowerCase();
    for (const piiKeyword of PII_KEYWORDS) {
      if (lowerKey.includes(piiKeyword)) {
        foundPII.push({ field: key, keyword: piiKeyword });
      }
    }
  }

  return foundPII;
}

// Run validation
const schemasDir = path.join(__dirname, '../apps/web/src/lib/schemas');
const violations = [];

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.schema.json')) {
      const pii = checkSchemaForPII(filePath);
      if (pii.length > 0) {
        violations.push({ schema: filePath, pii });
      }
    }
  }
}

walkDir(schemasDir);

if (violations.length > 0) {
  console.error('❌ PII VIOLATION DETECTED IN SCHEMAS:');
  violations.forEach(v => {
    console.error(`\n${v.schema}:`);
    v.pii.forEach(p => {
      console.error(`  - Field "${p.field}" contains PII keyword "${p.keyword}"`);
    });
  });
  process.exit(1);
} else {
  console.log('✅ No PII detected in schemas');
}
```

---

## 9. Development Workflow

### 9.1 Adding New Event Types

**Step 1:** Create JSON schema
```bash
apps/web/src/lib/schemas/category/event-name.schema.json
```

**Step 2:** Add to schema registry
```typescript
// apps/web/src/lib/schemas/index.ts
export const schemas = {
  // ...existing
  'new_event': require('./category/event-name.schema.json'),
};
```

**Step 3:** Generate TypeScript types
```bash
npm run generate:analytics-types
```

**Step 4:** Create valid/invalid fixtures
```bash
tests/analytics/fixtures/category/event-name.valid.json
tests/analytics/fixtures/category/event-name.invalid.json
```

**Step 5:** Run contract tests
```bash
npm run test:analytics-contracts
```

**Step 6:** Add helper function (optional)
```typescript
// apps/web/src/lib/analytics/index.ts
export const trackNewEvent = (payload: AnalyticsEvent['new_event']) =>
  analytics.track('new_event', payload);
```

### 9.2 Local Development Testing

```typescript
// Test in browser console (dev mode)
import { analytics } from '@/lib/analytics';

// This will THROW in dev mode if invalid
analytics.track('points_earned', {
  user_id: 'invalid-uuid', // ❌ Will throw validation error
  action_type: 'document_uploaded',
  points: 50,
  timestamp: new Date().toISOString(),
});

// Valid payload - will succeed
analytics.track('points_earned', {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  action_type: 'document_uploaded',
  points: 50,
  timestamp: new Date().toISOString(),
});
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create schema directory structure
- [ ] Implement all 9 JSON schemas
- [ ] Build AJV validation wrapper
- [ ] Create core emitter class
- [ ] Generate TypeScript types

### Phase 2: Testing Infrastructure (Week 1)
- [ ] Create fixture directory structure
- [ ] Write valid/invalid fixtures for all events
- [ ] Implement contract test suite
- [ ] Add PII validation script
- [ ] Setup CI pipeline

### Phase 3: Integration (Week 2)
- [ ] Integrate with generated SDK types
- [ ] Create auto-tracking hooks
- [ ] Add Sentry logging
- [ ] Test in dev environment
- [ ] Document usage patterns

### Phase 4: Production Readiness (Week 2)
- [ ] End-to-end testing
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Documentation finalization
- [ ] Team training

---

## 11. Success Metrics

**Code Quality:**
- 100% schema coverage with contract tests
- Zero PII fields in any schema
- All schemas pass strict AJV validation
- TypeScript compilation with zero errors

**Developer Experience:**
- Type-safe event tracking (compile-time errors)
- Clear validation errors in dev mode
- Fast feedback loop (<100ms validation)
- Comprehensive documentation

**Production Safety:**
- Invalid events dropped gracefully
- No PII leakage to analytics or logs
- Sentry alerts for validation failures
- Zero runtime crashes from analytics

---

## 12. Files to Create

```
apps/web/src/lib/
├── analytics/
│   ├── index.ts                 (Public API)
│   ├── emitter.ts               (Core emitter)
│   ├── validator.ts             (AJV wrapper)
│   ├── types.ts                 (Generated types)
│   ├── config.ts                (Config)
│   ├── sentry-logger.ts         (Sentry integration)
│   └── hooks.ts                 (React hooks)
│
├── schemas/
│   ├── index.ts                 (Schema registry)
│   ├── gamification/
│   │   ├── points-earned.schema.json
│   │   ├── level-up.schema.json
│   │   └── badge-unlocked.schema.json
│   ├── onboarding/
│   │   ├── registration-started.schema.json
│   │   ├── registration-step-completed.schema.json
│   │   └── registration-completed.schema.json
│   └── documents/
│       ├── document-uploaded.schema.json
│       ├── document-approved.schema.json
│       └── document-rejected.schema.json

tests/analytics/
├── contracts.spec.ts
└── fixtures/
    ├── gamification/
    │   ├── points-earned.valid.json
    │   ├── points-earned.invalid.json
    │   ├── level-up.valid.json
    │   └── badge-unlocked.valid.json
    ├── onboarding/
    │   ├── registration-started.valid.json
    │   ├── registration-completed.valid.json
    │   └── registration-completed.invalid.json
    └── documents/
        ├── document-uploaded.valid.json
        ├── document-approved.valid.json
        └── document-rejected.valid.json

scripts/
├── generate-types-from-schemas.js
├── validate-schemas.js
└── check-pii-in-schemas.js

.github/workflows/
└── analytics-contracts.yml
```

---

## 13. Dependencies to Install

```json
{
  "dependencies": {
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "@sentry/browser": "^7.99.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "vitest": "^1.2.0",
    "json-schema-to-typescript": "^13.1.0"
  }
}
```

---

## 14. Next Steps

**Immediate Actions:**
1. Review and approve this blueprint
2. Create GitHub issues for each phase
3. Assign developers to implementation tasks
4. Setup branch protection rules for analytics code
5. Schedule kickoff meeting with team

**Coordination:**
- Store this blueprint in hive memory: `hive/planning/analytics_design`
- Share with SDK generation team (Sprint 1.5)
- Coordinate with backend team for event payload alignment
- Setup code review process for schema changes

---

**Blueprint Status:** ✅ COMPLETE
**Ready for Implementation:** YES
**Estimated Timeline:** 2 weeks
**Team Size:** 2-3 developers

---

*Generated by Hive Mind Collective - Planner Agent*
*Date: 2025-10-01*
*Version: 1.0.0*
