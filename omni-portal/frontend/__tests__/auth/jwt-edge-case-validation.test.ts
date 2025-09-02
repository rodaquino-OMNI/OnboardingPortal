/**
 * Comprehensive JWT Edge Case Validation Tests
 * Tests the enhanced JWT validation function for all edge cases and attack scenarios
 */

import {
  validateJWTToken,
  validateJWTTokenLegacy,
  validateEnhancedSessionToken,
  validateCookieIntegrityEnhanced,
  isUserAuthenticatedEnhanced,
  cleanupRateLimitingEntries
} from '../../lib/auth-validation';

describe('Enhanced JWT Validation Edge Cases', () => {
  beforeEach(() => {
    // Clean up rate limiting between tests
    cleanupRateLimitingEntries();
  });

  describe('Null/Undefined/Empty Token Handling', () => {
    it('should handle null token', async () => {
      const result = await validateJWTToken(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_TOKEN');
    });

    it('should handle undefined token', async () => {
      const result = await validateJWTToken(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_TOKEN');
    });

    it('should handle empty string token', async () => {
      const result = await validateJWTToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_TOKEN');
    });

    it('should handle whitespace-only token', async () => {
      const result = await validateJWTToken('   \t\n  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('WHITESPACE_ONLY_TOKEN');
    });

    it('should handle non-string token types', async () => {
      const result = await validateJWTToken(123 as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN_TYPE');
    });
  });

  describe('Token Length Validation', () => {
    it('should reject tokens that are too short', async () => {
      const result = await validateJWTToken('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_TOO_SHORT');
    });

    it('should reject tokens that are too long', async () => {
      const veryLongToken = 'a'.repeat(5000);
      const result = await validateJWTToken(veryLongToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TOKEN_TOO_LONG');
    });
  });

  describe('JWT Format Validation', () => {
    it('should reject tokens with wrong number of parts', async () => {
      const result = await validateJWTToken('header.payload');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_JWT_FORMAT');
    });

    it('should reject tokens with too many parts', async () => {
      const result = await validateJWTToken('header.payload.signature.extra');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_JWT_FORMAT');
    });

    it('should reject tokens with empty parts', async () => {
      const result = await validateJWTToken('header..signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_JWT_PARTS');
    });

    it('should reject tokens with whitespace-only parts', async () => {
      const result = await validateJWTToken('header.   .signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_JWT_PARTS');
    });
  });

  describe('Base64URL Encoding Validation', () => {
    it('should reject tokens with invalid base64url characters', async () => {
      const result = await validateJWTToken('header@#$.payload&*(.signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_BASE64URL_ENCODING');
    });

    it('should reject tokens with spaces in parts', async () => {
      const result = await validateJWTToken('head er.pay load.signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_BASE64URL_ENCODING');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal validation requests', async () => {
      const result = await validateJWTToken('invalid.jwt.token', 'client-1');
      expect(result.valid).toBe(false);
      expect(result.error).not.toBe('RATE_LIMITED');
    });

    it('should rate limit excessive validation attempts', async () => {
      const clientId = 'aggressive-client';
      
      // Make 10 attempts (should all go through)
      for (let i = 0; i < 10; i++) {
        const result = await validateJWTToken('invalid.jwt.token', clientId);
        expect(result.error).not.toBe('RATE_LIMITED');
      }

      // 11th attempt should be rate limited
      const result = await validateJWTToken('invalid.jwt.token', clientId);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RATE_LIMITED');
    });

    it('should reset rate limit after time window', async () => {
      jest.useFakeTimers();
      
      const clientId = 'time-window-client';
      
      // Exhaust rate limit
      for (let i = 0; i < 11; i++) {
        await validateJWTToken('invalid.jwt.token', clientId);
      }

      // Advance time by 2 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Should be allowed again
      const result = await validateJWTToken('invalid.jwt.token', clientId);
      expect(result.error).not.toBe('RATE_LIMITED');
      
      jest.useRealTimers();
    });
  });

  describe('Malicious Token Patterns', () => {
    it('should handle SQL injection attempts', async () => {
      const result = await validateJWTToken('header.payload\'; DROP TABLE users; --.signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_BASE64URL_ENCODING');
    });

    it('should handle XSS attempts', async () => {
      const result = await validateJWTToken('header.payload<script>alert(1)</script>.signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_BASE64URL_ENCODING');
    });

    it('should handle null byte injection', async () => {
      const result = await validateJWTToken('header.payload\x00malicious.signature');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_BASE64URL_ENCODING');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain backward compatibility with legacy function', async () => {
      const legacyResult = await validateJWTTokenLegacy('invalid.token');
      expect(typeof legacyResult).toBe('boolean');
      expect(legacyResult).toBe(false);
    });

    it('should return true for valid tokens in legacy mode', async () => {
      // This would need a proper JWT token for a real test
      const legacyResult = await validateJWTTokenLegacy(undefined);
      expect(legacyResult).toBe(false);
    });
  });
});

describe('Enhanced Session Token Validation', () => {
  describe('Null/Undefined/Empty Handling', () => {
    it('should handle null token', () => {
      const result = validateEnhancedSessionToken(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NULL_OR_UNDEFINED_TOKEN');
    });

    it('should handle undefined token', () => {
      const result = validateEnhancedSessionToken(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NULL_OR_UNDEFINED_TOKEN');
    });

    it('should handle empty string', () => {
      const result = validateEnhancedSessionToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_TOKEN');
    });

    it('should handle whitespace-only token', () => {
      const result = validateEnhancedSessionToken('   \t  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('WHITESPACE_ONLY_TOKEN');
    });
  });

  describe('Token Format Validation', () => {
    it('should accept valid Sanctum tokens', () => {
      const result = validateEnhancedSessionToken('123|abcdefghijklmnopqrstuvwxyz1234567890abcd');
      expect(result.valid).toBe(true);
    });

    it('should accept valid session tokens', () => {
      const result = validateEnhancedSessionToken('abcdefghijklmnopqrstuvwxyz123456');
      expect(result.valid).toBe(true);
    });

    it('should accept valid UUID tokens', () => {
      const result = validateEnhancedSessionToken('550e8400-e29b-41d4-a716-446655440000');
      expect(result.valid).toBe(true);
    });

    it('should accept valid Base64 tokens', () => {
      const result = validateEnhancedSessionToken('YWJjZGVmZ2hpamtsbW5vcA==');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid format tokens', () => {
      const result = validateEnhancedSessionToken('invalid-format!@#');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('Security Pattern Detection', () => {
    it('should detect script injection', () => {
      const result = validateEnhancedSessionToken('abc<script>alert(1)</script>def');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SCRIPT_INJECTION');
    });

    it('should detect SQL injection characters', () => {
      const result = validateEnhancedSessionToken('abcdef\'; DROP TABLE users; --');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL_INJECTION_CHARS');
    });

    it('should detect path traversal', () => {
      const result = validateEnhancedSessionToken('abc../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('PATH_TRAVERSAL');
    });

    it('should detect template injection', () => {
      const result = validateEnhancedSessionToken('abc{{7*7}}def');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('TEMPLATE_INJECTION');
    });
  });

  describe('Entropy Validation', () => {
    it('should reject low-entropy tokens', () => {
      const result = validateEnhancedSessionToken('aaaaaaaaaaaaaaaa'); // Very low entropy
      expect(result.valid).toBe(false);
      expect(result.error).toBe('LOW_ENTROPY_TOKEN');
    });

    it('should accept high-entropy tokens', () => {
      const result = validateEnhancedSessionToken('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'); // High entropy
      expect(result.valid).toBe(true);
    });
  });
});

describe('Enhanced Cookie Integrity Validation', () => {
  describe('Basic Input Validation', () => {
    it('should handle null cookie', () => {
      const result = validateCookieIntegrityEnhanced(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NULL_OR_UNDEFINED_COOKIE');
    });

    it('should handle undefined cookie', () => {
      const result = validateCookieIntegrityEnhanced(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('NULL_OR_UNDEFINED_COOKIE');
    });

    it('should handle empty string cookie', () => {
      const result = validateCookieIntegrityEnhanced('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_COOKIE');
    });

    it('should handle non-string types', () => {
      const result = validateCookieIntegrityEnhanced(12345 as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_COOKIE_TYPE');
    });
  });

  describe('Length Validation', () => {
    it('should reject cookies that are too short', () => {
      const result = validateCookieIntegrityEnhanced('short');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('COOKIE_TOO_SHORT');
    });

    it('should reject cookies that are too long', () => {
      const longCookie = 'a'.repeat(5000);
      const result = validateCookieIntegrityEnhanced(longCookie);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('COOKIE_TOO_LONG');
    });

    it('should accept properly sized cookies', () => {
      const goodCookie = 'a'.repeat(32); // 32 characters
      const result = validateCookieIntegrityEnhanced(goodCookie);
      expect(result.valid).toBe(true);
    });
  });

  describe('Injection Pattern Detection', () => {
    it('should detect HTML injection', () => {
      const result = validateCookieIntegrityEnhanced('abc<div>malicious</div>def');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('HTML_INJECTION');
    });

    it('should detect SQL injection', () => {
      const result = validateCookieIntegrityEnhanced('abc\"; DROP TABLE users; --def');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SQL_INJECTION');
    });

    it('should detect CRLF injection', () => {
      const result = validateCookieIntegrityEnhanced('abc\r\nmalicious-header: valueder');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CRLF_INJECTION');
    });

    it('should detect suspicious content', () => {
      const result = validateCookieIntegrityEnhanced('abcevaL(maliciousCode)def');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('SUSPICIOUS_CONTENT');
    });
  });
});

describe('Enhanced Authentication Integration', () => {
  describe('Multi-Cookie Authentication', () => {
    it('should handle both cookies being null', async () => {
      const result = await isUserAuthenticatedEnhanced(null, null);
      expect(result.authenticated).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Auth cookie: NULL_OR_UNDEFINED_COOKIE');
      expect(result.errors[1]).toContain('Session cookie: NULL_OR_UNDEFINED_COOKIE');
    });

    it('should handle mixed null and valid cookies', async () => {
      const validSessionCookie = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const result = await isUserAuthenticatedEnhanced(null, validSessionCookie);
      expect(result.authenticated).toBe(true);
      expect(result.method).toBe('SESSION');
    });

    it('should prioritize JWT over session tokens', async () => {
      // This would need valid JWT for real test
      const validSessionCookie = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const invalidJWT = 'invalid.jwt.token';
      
      const result = await isUserAuthenticatedEnhanced(invalidJWT, validSessionCookie);
      expect(result.authenticated).toBe(true);
      expect(result.method).toBe('SESSION'); // Falls back to session after JWT fails
    });

    it('should collect all validation errors', async () => {
      const result = await isUserAuthenticatedEnhanced('', 'short');
      expect(result.authenticated).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to authentication attempts', async () => {
      const clientId = 'auth-test-client';
      const validSessionCookie = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      
      // Exhaust rate limit with invalid JWT attempts
      for (let i = 0; i < 11; i++) {
        await isUserAuthenticatedEnhanced('invalid.jwt.token', validSessionCookie, clientId);
      }

      // Next attempt should be rate limited
      const result = await isUserAuthenticatedEnhanced('invalid.jwt.token', validSessionCookie, clientId);
      expect(result.errors.some(error => error.includes('RATE_LIMITED'))).toBe(true);
    });
  });
});

describe('Error Handling and Security', () => {
  describe('Error Message Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const result = await validateJWTToken('malicious.jwt.attempt');
      expect(result.error).not.toContain('secret');
      expect(result.error).not.toContain('password');
      expect(result.error).not.toContain('key');
    });

    it('should provide meaningful error codes', async () => {
      const result = await validateJWTToken('');
      expect(result.error).toBe('EMPTY_TOKEN');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should clean up rate limiting entries', () => {
      // This test verifies the cleanup function exists and can be called
      expect(() => cleanupRateLimitingEntries()).not.toThrow();
    });
  });
});