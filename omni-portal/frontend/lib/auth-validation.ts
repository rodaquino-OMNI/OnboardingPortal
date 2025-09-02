/**
 * Secure authentication validation utilities
 * Implements proper token validation without relying on simple length checks
 */

import { jwtVerify, SignJWT } from 'jose';
import crypto from 'crypto';

// Rate limiting for validation attempts
interface ValidationAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

const validationAttempts = new Map<string, ValidationAttempt>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_VALIDATION_ATTEMPTS = 10; // Max attempts per IP per minute

// Get secret from environment or use a secure default for development
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * Validates a JWT token with proper cryptographic verification and comprehensive edge case handling
 * @param token - The JWT token string to validate
 * @param clientIdentifier - Optional client identifier for rate limiting (IP address, user ID, etc.)
 * @returns Promise<{valid: boolean, error?: string}> - Validation result with optional error details
 */
export async function validateJWTToken(
  token: string | undefined | null,
  clientIdentifier?: string
): Promise<{valid: boolean, error?: string}> {
  // Rate limiting check
  if (clientIdentifier && !checkRateLimit(clientIdentifier)) {
    return { valid: false, error: 'RATE_LIMITED' };
  }

  // Comprehensive null/undefined/empty checks
  if (token === null || token === undefined || token === '') {
    return { valid: false, error: 'EMPTY_TOKEN' };
  }

  if (typeof token !== 'string') {
    return { valid: false, error: 'INVALID_TOKEN_TYPE' };
  }

  // Trim whitespace and check for empty string after trimming
  const trimmedToken = token.trim();
  if (trimmedToken === '') {
    return { valid: false, error: 'WHITESPACE_ONLY_TOKEN' };
  }

  // Check for obviously malformed tokens
  if (trimmedToken.length < 10) {
    return { valid: false, error: 'TOKEN_TOO_SHORT' };
  }

  if (trimmedToken.length > 4096) {
    return { valid: false, error: 'TOKEN_TOO_LONG' };
  }

  // Basic format validation - JWT should have exactly 3 parts
  const parts = trimmedToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'INVALID_JWT_FORMAT' };
  }

  // Check for empty parts
  if (parts.some(part => part === '' || part.trim() === '')) {
    return { valid: false, error: 'EMPTY_JWT_PARTS' };
  }

  // Validate base64url encoding of header and payload
  try {
    for (let i = 0; i < 2; i++) {
      const part = parts[i];
      // Check for valid base64url characters
      if (!/^[A-Za-z0-9_-]+$/.test(part)) {
        return { valid: false, error: 'INVALID_BASE64URL_ENCODING' };
      }
    }
  } catch {
    return { valid: false, error: 'MALFORMED_JWT_PARTS' };
  }

  try {
    // Verify the JWT signature and expiration
    const { payload, protectedHeader } = await jwtVerify(trimmedToken, secret, {
      algorithms: ['HS256'],
      clockTolerance: 30, // 30 seconds clock skew tolerance
    });

    // Validate header
    if (!protectedHeader.alg || protectedHeader.alg !== 'HS256') {
      return { valid: false, error: 'INVALID_ALGORITHM' };
    }

    // Check if token has required claims with proper type validation
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      return { valid: false, error: 'MISSING_SUBJECT' };
    }

    if (!payload.iat || typeof payload.iat !== 'number' || payload.iat <= 0) {
      return { valid: false, error: 'INVALID_ISSUED_AT' };
    }

    // Validate timestamps
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is from the future (with tolerance)
    if (payload.iat > now + 300) { // 5 minutes tolerance
      return { valid: false, error: 'TOKEN_FROM_FUTURE' };
    }

    // Check expiration with proper handling
    if (payload.exp) {
      if (typeof payload.exp !== 'number' || payload.exp <= 0) {
        return { valid: false, error: 'INVALID_EXPIRATION' };
      }
      if (payload.exp < now) {
        return { valid: false, error: 'TOKEN_EXPIRED' };
      }
    }

    // Check not before claim
    if (payload.nbf && (typeof payload.nbf !== 'number' || payload.nbf > now)) {
      return { valid: false, error: 'TOKEN_NOT_YET_VALID' };
    }

    // Validate audience if present
    if (payload.aud) {
      const expectedAudience = process.env.JWT_AUDIENCE || 'omni-portal';
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(expectedAudience)) {
        return { valid: false, error: 'INVALID_AUDIENCE' };
      }
    }

    // Validate issuer if present
    if (payload.iss) {
      const expectedIssuer = process.env.JWT_ISSUER || 'omni-portal-auth';
      if (payload.iss !== expectedIssuer) {
        return { valid: false, error: 'INVALID_ISSUER' };
      }
    }

    return { valid: true };
  } catch (error: unknown) {
    // Enhanced error handling without exposing sensitive information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log detailed error for debugging (server-side only)
    if (typeof window === 'undefined') {
      console.warn('[JWT Validation] Token verification failed:', {
        error: errorMessage,
        tokenLength: trimmedToken.length,
        partsCount: parts.length,
        timestamp: new Date().toISOString()
      });
    }

    // Map specific jose errors to user-friendly error codes
    if (errorMessage.includes('signature verification failed')) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }
    if (errorMessage.includes('"exp" claim timestamp check failed')) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }
    if (errorMessage.includes('"nbf" claim timestamp check failed')) {
      return { valid: false, error: 'TOKEN_NOT_YET_VALID' };
    }
    if (errorMessage.includes('Invalid Compact JWS')) {
      return { valid: false, error: 'MALFORMED_JWT' };
    }

    return { valid: false, error: 'VERIFICATION_FAILED' };
  }
}

/**
 * Validates a session token format and structure
 * Laravel Sanctum tokens are typically 80 characters long and contain only alphanumeric characters
 * @param token - The session token to validate
 * @returns boolean - True if valid format, false otherwise
 */
export function validateSessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Laravel Sanctum tokens are typically 80 characters of alphanumeric + pipe
  // Format: "id|randomToken" where randomToken is 40 characters
  const sanctumTokenPattern = /^\d+\|[a-zA-Z0-9]{40}$/;
  
  // Also accept standard session tokens (alphanumeric, 32-128 chars)
  const sessionTokenPattern = /^[a-zA-Z0-9]{32,128}$/;
  
  // Check if it matches either pattern
  if (sanctumTokenPattern.test(token) || sessionTokenPattern.test(token)) {
    // Additional security: ensure no malicious patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i, // onclick=, onerror=, etc.
      /['";]/,   // SQL injection characters
      /\.\./,    // Path traversal
      /\x00/,    // Null bytes
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(token)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Validates cookie value integrity
 * Ensures the cookie hasn't been tampered with
 * @param cookieValue - The cookie value to validate
 * @returns boolean - True if valid, false otherwise
 */
export function validateCookieIntegrity(cookieValue: string | undefined): boolean {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return false;
  }

  // Minimum security requirements
  if (cookieValue.length < 32) {
    return false; // Too short to be a secure token
  }

  // Check for common injection attempts
  const injectionPatterns = [
    /[<>]/,           // HTML tags
    /['";]/,          // SQL injection
    /\$\{.*\}/,       // Template injection
    /\.\.[\/\\]/,     // Path traversal
    /\x00/,           // Null bytes
    /[\r\n]/,         // CRLF injection
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(cookieValue)) {
      return false;
    }
  }

  return true;
}

/**
 * Main authentication validation function
 * Combines all validation methods for comprehensive security
 * @param authCookie - Authentication cookie value
 * @param sessionCookie - Session cookie value
 * @returns Promise<boolean> - True if authenticated, false otherwise
 */
export async function isUserAuthenticated(
  authCookie: string | undefined,
  sessionCookie: string | undefined
): Promise<boolean> {
  // First, check basic cookie integrity
  const authCookieValid = validateCookieIntegrity(authCookie);
  const sessionCookieValid = validateCookieIntegrity(sessionCookie);

  if (!authCookieValid && !sessionCookieValid) {
    return false;
  }

  // If we have an auth cookie, validate it as JWT
  if (authCookie && authCookieValid) {
    const isValidJWT = await validateJWTToken(authCookie);
    if (isValidJWT) {
      return true;
    }
  }

  // If we have a session cookie, validate it as session token
  if (sessionCookie && sessionCookieValid) {
    const isValidSession = validateSessionToken(sessionCookie);
    if (isValidSession) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a secure random token for CSRF protection
 * @returns string - A cryptographically secure random token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates CSRF token matches expected value
 * @param token - The token to validate
 * @param expectedToken - The expected token value
 * @returns boolean - True if tokens match, false otherwise
 */
export function validateCSRFToken(token: string | undefined, expectedToken: string | undefined): boolean {
  if (!token || !expectedToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  if (token.length !== expectedToken.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  );
}

/**
 * Legacy wrapper for backward compatibility
 * @param token - The JWT token string to validate
 * @returns Promise<boolean> - True if valid, false otherwise
 */
export async function validateJWTTokenLegacy(token: string | undefined): Promise<boolean> {
  const result = await validateJWTToken(token);
  return result.valid;
}

/**
 * Rate limiting helper function
 * @param clientIdentifier - Client identifier for rate limiting
 * @returns boolean - True if within rate limit, false otherwise
 */
function checkRateLimit(clientIdentifier: string): boolean {
  const now = Date.now();
  const attempt = validationAttempts.get(clientIdentifier);

  if (!attempt) {
    validationAttempts.set(clientIdentifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    return true;
  }

  // Reset counter if window has passed
  if (now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
    validationAttempts.set(clientIdentifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    return true;
  }

  // Check if within rate limit
  if (attempt.count >= MAX_VALIDATION_ATTEMPTS) {
    return false;
  }

  // Update attempt count
  attempt.count++;
  attempt.lastAttempt = now;
  validationAttempts.set(clientIdentifier, attempt);

  return true;
}

/**
 * Cleans up old rate limiting entries (should be called periodically)
 */
export function cleanupRateLimitingEntries(): void {
  const now = Date.now();
  for (const [key, attempt] of validationAttempts.entries()) {
    if (now - attempt.lastAttempt > RATE_LIMIT_WINDOW * 2) {
      validationAttempts.delete(key);
    }
  }
}

/**
 * Enhanced session token validation with comprehensive edge case handling
 * @param token - The session token to validate
 * @returns {valid: boolean, error?: string} - Validation result with optional error details
 */
export function validateEnhancedSessionToken(token: string | undefined | null): {valid: boolean, error?: string} {
  // Explicit null/undefined/empty checks
  if (token === null || token === undefined) {
    return { valid: false, error: 'NULL_OR_UNDEFINED_TOKEN' };
  }

  if (typeof token !== 'string') {
    return { valid: false, error: 'INVALID_TOKEN_TYPE' };
  }

  if (token === '') {
    return { valid: false, error: 'EMPTY_TOKEN' };
  }

  // Trim and validate
  const trimmedToken = token.trim();
  if (trimmedToken === '') {
    return { valid: false, error: 'WHITESPACE_ONLY_TOKEN' };
  }

  if (trimmedToken.length < 16) {
    return { valid: false, error: 'TOKEN_TOO_SHORT' };
  }

  if (trimmedToken.length > 256) {
    return { valid: false, error: 'TOKEN_TOO_LONG' };
  }

  // Laravel Sanctum tokens: "id|randomToken" where randomToken is 40 characters
  const sanctumTokenPattern = /^\d+\|[a-zA-Z0-9]{40}$/;
  
  // Standard session tokens (alphanumeric, 16-128 chars)
  const sessionTokenPattern = /^[a-zA-Z0-9]{16,128}$/;
  
  // UUID format tokens
  const uuidTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // Base64 encoded tokens
  const base64TokenPattern = /^[A-Za-z0-9+/]{16,128}={0,2}$/;
  
  // Check if it matches any valid pattern
  const isValidFormat = sanctumTokenPattern.test(trimmedToken) ||
                       sessionTokenPattern.test(trimmedToken) ||
                       uuidTokenPattern.test(trimmedToken) ||
                       base64TokenPattern.test(trimmedToken);

  if (!isValidFormat) {
    return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
  }

  // Enhanced security checks for malicious patterns
  const dangerousPatterns = [
    { pattern: /<script/i, error: 'SCRIPT_INJECTION' },
    { pattern: /javascript:/i, error: 'JAVASCRIPT_INJECTION' },
    { pattern: /on\w+=/i, error: 'EVENT_HANDLER_INJECTION' },
    { pattern: /['";]/, error: 'SQL_INJECTION_CHARS' },
    { pattern: /\.\./, error: 'PATH_TRAVERSAL' },
    { pattern: /\x00/, error: 'NULL_BYTE' },
    { pattern: /%[0-9a-fA-F]{2}/, error: 'URL_ENCODED_CHARS' },
    { pattern: /\\[ux][0-9a-fA-F]{2,4}/, error: 'UNICODE_ESCAPE' },
    { pattern: /\{\{.*\}\}/, error: 'TEMPLATE_INJECTION' },
    { pattern: /\$\{.*\}/, error: 'VARIABLE_INJECTION' }
  ];

  for (const { pattern, error } of dangerousPatterns) {
    if (pattern.test(trimmedToken)) {
      return { valid: false, error };
    }
  }

  // Additional entropy check for security
  const entropy = calculateTokenEntropy(trimmedToken);
  if (entropy < 3.0) {
    return { valid: false, error: 'LOW_ENTROPY_TOKEN' };
  }

  return { valid: true };
}

/**
 * Calculate token entropy for security validation
 * @param token - Token to analyze
 * @returns number - Entropy value
 */
function calculateTokenEntropy(token: string): number {
  const charCounts = new Map<string, number>();
  
  for (const char of token) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  
  let entropy = 0;
  const length = token.length;
  
  for (const count of charCounts.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Enhanced cookie validation with comprehensive edge case handling
 * @param cookieValue - The cookie value to validate
 * @returns {valid: boolean, error?: string} - Validation result with optional error details
 */
export function validateCookieIntegrityEnhanced(cookieValue: string | undefined | null): {valid: boolean, error?: string} {
  // Explicit null/undefined/empty checks
  if (cookieValue === null || cookieValue === undefined) {
    return { valid: false, error: 'NULL_OR_UNDEFINED_COOKIE' };
  }

  if (typeof cookieValue !== 'string') {
    return { valid: false, error: 'INVALID_COOKIE_TYPE' };
  }

  // Check for empty string
  if (cookieValue === '') {
    return { valid: false, error: 'EMPTY_COOKIE' };
  }

  // Trim and check for whitespace-only
  const trimmedValue = cookieValue.trim();
  if (trimmedValue === '') {
    return { valid: false, error: 'WHITESPACE_ONLY_COOKIE' };
  }

  // Check length boundaries
  if (trimmedValue.length < 16) {
    return { valid: false, error: 'COOKIE_TOO_SHORT' };
  }

  if (trimmedValue.length > 4096) {
    return { valid: false, error: 'COOKIE_TOO_LONG' };
  }

  // Check for common injection attempts with more comprehensive patterns
  const injectionPatterns = [
    { pattern: /[<>]/, error: 'HTML_INJECTION' },
    { pattern: /['";]/, error: 'SQL_INJECTION' },
    { pattern: /\$\{.*\}/, error: 'TEMPLATE_INJECTION' },
    { pattern: /\.\.[\/\\]/, error: 'PATH_TRAVERSAL' },
    { pattern: /\x00/, error: 'NULL_BYTE_INJECTION' },
    { pattern: /[\r\n]/, error: 'CRLF_INJECTION' },
    { pattern: /\\[ux][0-9a-fA-F]{2,4}/, error: 'UNICODE_ESCAPE_INJECTION' },
    { pattern: /%[0-9a-fA-F]{2}/, error: 'URL_ENCODED_INJECTION' },
    { pattern: /\\["'\\]/, error: 'ESCAPE_SEQUENCE_INJECTION' },
    { pattern: /\{\{.*\}\}/, error: 'MUSTACHE_INJECTION' },
    { pattern: /\[\[.*\]\]/, error: 'BRACKET_INJECTION' }
  ];

  for (const { pattern, error } of injectionPatterns) {
    if (pattern.test(trimmedValue)) {
      return { valid: false, error };
    }
  }

  // Check for suspicious character sequences
  const suspiciousSequences = [
    'eval(',
    'function(',
    'javascript:',
    'vbscript:',
    'onload=',
    'onclick=',
    'onerror=',
    'document.cookie',
    'window.location',
    'alert(',
    'confirm(',
    'prompt('
  ];

  const lowerValue = trimmedValue.toLowerCase();
  for (const sequence of suspiciousSequences) {
    if (lowerValue.includes(sequence)) {
      return { valid: false, error: 'SUSPICIOUS_CONTENT' };
    }
  }

  return { valid: true };
}

/**
 * Enhanced authentication validation function with comprehensive edge case handling
 * @param authCookie - Authentication cookie value
 * @param sessionCookie - Session cookie value
 * @param clientIdentifier - Optional client identifier for rate limiting
 * @returns Promise<{authenticated: boolean, method?: string, errors?: string[]}> - Detailed authentication result
 */
export async function isUserAuthenticatedEnhanced(
  authCookie: string | undefined | null,
  sessionCookie: string | undefined | null,
  clientIdentifier?: string
): Promise<{authenticated: boolean, method?: string, errors?: string[]}> {
  const errors: string[] = [];

  // First, check basic cookie integrity with detailed error tracking
  const authCookieResult = validateCookieIntegrityEnhanced(authCookie);
  const sessionCookieResult = validateCookieIntegrityEnhanced(sessionCookie);

  if (!authCookieResult.valid && authCookieResult.error) {
    errors.push(`Auth cookie: ${authCookieResult.error}`);
  }
  
  if (!sessionCookieResult.valid && sessionCookieResult.error) {
    errors.push(`Session cookie: ${sessionCookieResult.error}`);
  }

  // If both cookies are invalid, return early
  if (!authCookieResult.valid && !sessionCookieResult.valid) {
    return { authenticated: false, errors };
  }

  // Try JWT authentication first (higher priority)
  if (authCookie && authCookieResult.valid) {
    const jwtResult = await validateJWTToken(authCookie, clientIdentifier);
    if (jwtResult.valid) {
      return { authenticated: true, method: 'JWT' };
    }
    if (jwtResult.error) {
      errors.push(`JWT validation: ${jwtResult.error}`);
    }
  }

  // Try session token authentication as fallback
  if (sessionCookie && sessionCookieResult.valid) {
    const sessionResult = validateEnhancedSessionToken(sessionCookie);
    if (sessionResult.valid) {
      return { authenticated: true, method: 'SESSION' };
    }
    if (sessionResult.error) {
      errors.push(`Session validation: ${sessionResult.error}`);
    }
  }

  return { authenticated: false, errors };
}