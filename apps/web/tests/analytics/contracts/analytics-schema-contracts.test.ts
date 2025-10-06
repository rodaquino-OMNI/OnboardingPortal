/**
 * Analytics Schema Contract Tests
 * Sprint 2B - Analytics Infrastructure
 *
 * Validates that all event fixtures conform to their JSON schemas using AJV strict validation.
 * Ensures no PII/PHI data is present and all events follow ANALYTICS_SPEC v1.0.0
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

// Schema imports
import baseEventSchema from '../../../lib/analytics/schemas/base-event.schema.json';
import pointsEarnedSchema from '../../../lib/analytics/schemas/gamification.points_earned.schema.json';
import levelUpSchema from '../../../lib/analytics/schemas/gamification.level_up.schema.json';
import badgeUnlockedSchema from '../../../lib/analytics/schemas/gamification.badge_unlocked.schema.json';
import registrationStartedSchema from '../../../lib/analytics/schemas/auth.registration_started.schema.json';
import registrationCompletedSchema from '../../../lib/analytics/schemas/auth.registration_completed.schema.json';
import emailVerifiedSchema from '../../../lib/analytics/schemas/auth.email_verified.schema.json';
import uploadCompletedSchema from '../../../lib/analytics/schemas/documents.upload_completed.schema.json';
import documentsApprovedSchema from '../../../lib/analytics/schemas/documents.approved.schema.json';
import uploadFailedSchema from '../../../lib/analytics/schemas/documents.upload_failed.schema.json';

// Fixture type definition
interface Fixture {
  name: string;
  valid: boolean;
  event: Record<string, any>;
}

describe('Analytics Schema Contract Tests', () => {
  let ajv: Ajv;

  beforeAll(() => {
    // Initialize AJV with strict validation - same config as production emitter
    ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false,
      useDefaults: false,
      validateFormats: true,
    });

    // Add format validation
    addFormats(ajv);

    // Register base schema
    ajv.addSchema(baseEventSchema, 'base-event');

    // Register all event schemas
    ajv.addSchema(pointsEarnedSchema, pointsEarnedSchema.$id);
    ajv.addSchema(levelUpSchema, levelUpSchema.$id);
    ajv.addSchema(badgeUnlockedSchema, badgeUnlockedSchema.$id);
    ajv.addSchema(registrationStartedSchema, registrationStartedSchema.$id);
    ajv.addSchema(registrationCompletedSchema, registrationCompletedSchema.$id);
    ajv.addSchema(emailVerifiedSchema, emailVerifiedSchema.$id);
    ajv.addSchema(uploadCompletedSchema, uploadCompletedSchema.$id);
    ajv.addSchema(documentsApprovedSchema, documentsApprovedSchema.$id);
    ajv.addSchema(uploadFailedSchema, uploadFailedSchema.$id);
  });

  /**
   * Helper function to load fixture files
   */
  function loadFixtures(filename: string): Fixture[] {
    const fixturePath = join(__dirname, '../fixtures', filename);
    const content = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Helper function to validate PII/PHI absence
   */
  function validateNoPII(event: Record<string, any>): { valid: boolean; violations: string[] } {
    const eventStr = JSON.stringify(event);
    const violations: string[] = [];

    // PII/PHI patterns to check
    const piiPatterns = [
      { pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, name: 'CPF number' },
      { pattern: /\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/, name: 'RG number' },
      { pattern: /\b[\w.-]+@[\w.-]+\.\w+\b/i, name: 'Email address' },
      { pattern: /\b\(\d{2}\)\s?\d{4,5}-?\d{4}\b/, name: 'Phone number' },
      { pattern: /\b\d{5}-?\d{3}\b/, name: 'ZIP code' },
    ];

    // Check for PII patterns
    for (const { pattern, name } of piiPatterns) {
      if (pattern.test(eventStr)) {
        // Exception for email_domain field - it should only contain domain
        if (name === 'Email address' && event.properties?.email_domain) {
          const emailDomain = event.properties.email_domain;
          if (!emailDomain.includes('@')) {
            continue; // Valid domain-only format
          }
        }
        violations.push(`Found potential ${name}`);
      }
    }

    // Check user_id is hashed if present
    if (event.user_id && !event.user_id.startsWith('hash_')) {
      violations.push('user_id must be hashed with hash_ prefix');
    }

    // Check approved_by is hashed if present
    if (event.properties?.approved_by && !event.properties.approved_by.startsWith('hash_')) {
      violations.push('approved_by must be hashed with hash_ prefix');
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Test suite generator for each event type
   */
  function testEventFixtures(
    eventType: string,
    fixtureFile: string,
    schemaId: string
  ) {
    describe(`${eventType} Contract Tests`, () => {
      let fixtures: Fixture[];
      let validator: ValidateFunction;

      beforeAll(() => {
        fixtures = loadFixtures(fixtureFile);
        const validatorOrSchema = ajv.getSchema(schemaId);
        if (!validatorOrSchema) {
          throw new Error(`Schema not found: ${schemaId}`);
        }
        validator = validatorOrSchema;
      });

      it('should have fixture file with valid and invalid test cases', () => {
        expect(fixtures.length).toBeGreaterThan(0);
        expect(fixtures.some((f) => f.valid)).toBe(true);
        expect(fixtures.some((f) => !f.valid)).toBe(true);
      });

      fixtures.forEach((fixture) => {
        if (fixture.valid) {
          it(`should validate: ${fixture.name}`, () => {
            const isValid = validator(fixture.event);

            if (!isValid) {
              console.error('Validation errors:', JSON.stringify(validator.errors, null, 2));
            }

            expect(isValid).toBe(true);
            expect(validator.errors).toBeNull();
          });

          it(`should have no PII/PHI: ${fixture.name}`, () => {
            const piiCheck = validateNoPII(fixture.event);

            if (!piiCheck.valid) {
              console.error('PII violations:', piiCheck.violations);
            }

            expect(piiCheck.valid).toBe(true);
            expect(piiCheck.violations).toEqual([]);
          });
        } else {
          it(`should reject invalid fixture: ${fixture.name}`, () => {
            const isValid = validator(fixture.event);

            expect(isValid).toBe(false);
            expect(validator.errors).not.toBeNull();
            expect(validator.errors!.length).toBeGreaterThan(0);
          });
        }
      });

      it('should have all valid fixtures with correct event type', () => {
        const validFixtures = fixtures.filter((f) => f.valid);
        validFixtures.forEach((fixture) => {
          expect(fixture.event.event).toBe(eventType);
        });
      });

      it('should have all valid fixtures with schema_version', () => {
        const validFixtures = fixtures.filter((f) => f.valid);
        validFixtures.forEach((fixture) => {
          expect(fixture.event.schema_version).toBe('1.0.0');
        });
      });

      it('should have all valid fixtures with required base fields', () => {
        const validFixtures = fixtures.filter((f) => f.valid);
        validFixtures.forEach((fixture) => {
          expect(fixture.event).toHaveProperty('timestamp');
          expect(fixture.event).toHaveProperty('platform');
          expect(fixture.event).toHaveProperty('properties');
          expect(fixture.event).toHaveProperty('context');

          // Validate timestamp is ISO 8601
          expect(() => new Date(fixture.event.timestamp)).not.toThrow();

          // Validate platform is valid enum
          expect(['web', 'mobile', 'api']).toContain(fixture.event.platform);
        });
      });
    });
  }

  // Run tests for all 9 event types
  testEventFixtures(
    'gamification.points_earned',
    'gamification.points_earned.fixture.json',
    'gamification.points_earned'
  );

  testEventFixtures(
    'gamification.level_up',
    'gamification.level_up.fixture.json',
    'gamification.level_up'
  );

  testEventFixtures(
    'gamification.badge_unlocked',
    'gamification.badge_unlocked.fixture.json',
    'gamification.badge_unlocked'
  );

  testEventFixtures(
    'auth.registration_started',
    'auth.registration_started.fixture.json',
    'auth.registration_started'
  );

  testEventFixtures(
    'auth.registration_completed',
    'auth.registration_completed.fixture.json',
    'auth.registration_completed'
  );

  testEventFixtures(
    'auth.email_verified',
    'auth.email_verified.fixture.json',
    'auth.email_verified'
  );

  testEventFixtures(
    'documents.upload_completed',
    'documents.upload_completed.fixture.json',
    'documents.upload_completed'
  );

  testEventFixtures(
    'documents.approved',
    'documents.approved.fixture.json',
    'documents.approved'
  );

  testEventFixtures(
    'documents.upload_failed',
    'documents.upload_failed.fixture.json',
    'documents.upload_failed'
  );

  // Additional cross-schema validation tests
  describe('Cross-Schema Validation', () => {
    it('should have consistent user_id hashing format across all events', () => {
      const allFixtureFiles = [
        'gamification.points_earned.fixture.json',
        'gamification.level_up.fixture.json',
        'gamification.badge_unlocked.fixture.json',
        'auth.registration_completed.fixture.json',
        'auth.email_verified.fixture.json',
        'documents.upload_completed.fixture.json',
        'documents.approved.fixture.json',
        'documents.upload_failed.fixture.json',
      ];

      allFixtureFiles.forEach((file) => {
        const fixtures = loadFixtures(file);
        fixtures
          .filter((f) => f.valid && f.event.user_id)
          .forEach((fixture) => {
            expect(fixture.event.user_id).toMatch(/^hash_[a-f0-9]{64}$/);
          });
      });
    });

    it('should have consistent context structure across all events', () => {
      const allFixtureFiles = [
        'gamification.points_earned.fixture.json',
        'auth.registration_started.fixture.json',
        'documents.upload_completed.fixture.json',
      ];

      allFixtureFiles.forEach((file) => {
        const fixtures = loadFixtures(file);
        fixtures
          .filter((f) => f.valid)
          .forEach((fixture) => {
            expect(fixture.event.context).toBeDefined();
            expect(typeof fixture.event.context).toBe('object');

            // Optional context fields should have correct types if present
            if (fixture.event.context.user_agent) {
              expect(typeof fixture.event.context.user_agent).toBe('string');
            }
            if (fixture.event.context.timezone) {
              expect(typeof fixture.event.context.timezone).toBe('string');
            }
            if (fixture.event.context.environment) {
              expect(typeof fixture.event.context.environment).toBe('string');
            }
          });
      });
    });

    it('should reject fixtures with additional properties not in schema', () => {
      const invalidEvent = {
        schema_version: '1.0.0',
        event: 'gamification.points_earned',
        timestamp: '2025-10-03T12:00:00.000Z',
        user_id: 'hash_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        platform: 'web',
        properties: {
          action_type: 'registration_completed',
          points_amount: 100,
          points_total_after: 100,
          extra_field_not_in_schema: 'should fail', // This should cause validation failure
        },
        context: {
          environment: 'production',
        },
      };

      const validator = ajv.getSchema('gamification.points_earned');
      expect(validator).toBeDefined();

      const isValid = validator!(invalidEvent);
      expect(isValid).toBe(false);
    });
  });

  // Performance and schema integrity tests
  describe('Schema Integrity and Performance', () => {
    it('should compile all schemas without errors', () => {
      const schemaIds = [
        'gamification.points_earned',
        'gamification.level_up',
        'gamification.badge_unlocked',
        'auth.registration_started',
        'auth.registration_completed',
        'auth.email_verified',
        'documents.upload_completed',
        'documents.approved',
        'documents.upload_failed',
      ];

      schemaIds.forEach((schemaId) => {
        const validator = ajv.getSchema(schemaId);
        expect(validator).toBeDefined();
        expect(typeof validator).toBe('function');
      });
    });

    it('should validate events quickly (performance check)', () => {
      const fixtures = loadFixtures('gamification.points_earned.fixture.json');
      const validFixture = fixtures.find((f) => f.valid);

      expect(validFixture).toBeDefined();

      const validator = ajv.getSchema('gamification.points_earned');
      expect(validator).toBeDefined();

      // Validate 1000 times and ensure it takes less than 100ms
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        validator!(validFixture!.event);
      }
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should validate 1000 events in under 100ms
    });

    it('should have all schemas with proper $id and title', () => {
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
        expect(schema.$id).toBeDefined();
        expect(schema.title).toBeDefined();
        expect(typeof schema.$id).toBe('string');
        expect(typeof schema.title).toBe('string');
      });
    });
  });
});
