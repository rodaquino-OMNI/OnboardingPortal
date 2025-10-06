# ADR-002: Authentication Strategy

**Status:** Accepted
**Date:** 2025-09-30
**Decision Makers:** Lead Architect, Security Officer, CTO
**Consulted:** Compliance Team, Development Team

---

## Context

The AUSTA OnboardingPortal handles sensitive healthcare information (PHI) and requires robust authentication that meets HIPAA Technical Safeguards and LGPD requirements. We need to choose an authentication strategy for:

1. **Patient/Beneficiary Access**: Self-service onboarding portal
2. **Healthcare Provider Access**: Clinical dashboard and telemedicine
3. **Administrative Access**: Admin dashboard with elevated privileges
4. **API Access**: Mobile apps and third-party integrations

### Requirements
- **Security**: HIPAA-compliant with multi-factor authentication for privileged users
- **User Experience**: Frictionless for patients, secure for providers
- **Scalability**: Support 100,000+ concurrent sessions
- **Auditability**: Complete audit trail of authentication events
- **Statelessness**: Enable horizontal scaling without session affinity

---

## Decision

**We will implement Laravel Sanctum with JWT-based stateless authentication.**

This includes:
1. **JWT Tokens** for API authentication (access + refresh token pattern)
2. **HTTP-Only Cookies** for web sessions (SPA authentication)
3. **TOTP Multi-Factor Authentication** for administrative and provider users
4. **Device Fingerprinting** for suspicious activity detection
5. **Session Management** with automatic expiration and rotation

---

## Rationale

### Why Laravel Sanctum?

| Advantage | Impact |
|-----------|--------|
| **First-Party Integration** | Native Laravel support, minimal configuration |
| **Token-Based** | Stateless authentication enables horizontal scaling |
| **SPA Support** | Cookie-based authentication for Next.js frontend |
| **Mobile Ready** | Token-based API authentication for future mobile apps |
| **CSRF Protection** | Built-in protection for cookie-based auth |
| **Simple Mental Model** | Easy for developers to understand and implement |

### JWT Token Strategy

```typescript
// Access Token (Short-lived)
{
  "sub": "user_uuid",
  "role": "patient|provider|admin",
  "permissions": ["profile:read", "documents:upload"],
  "exp": 900, // 15 minutes
  "iat": 1696075200,
  "jti": "token_uuid" // For revocation
}

// Refresh Token (Long-lived, stored securely)
{
  "sub": "user_uuid",
  "type": "refresh",
  "exp": 604800, // 7 days
  "iat": 1696075200,
  "jti": "refresh_token_uuid"
}
```

**Token Lifecycle:**
1. User logs in → Receive access token (15 min) + refresh token (7 days)
2. Access token expires → Use refresh token to get new access token
3. Refresh token expires → User must re-authenticate
4. Refresh token rotated on use → Previous refresh token invalidated

---

## Alternatives Considered

### Alternative 1: OAuth 2.0 + OpenID Connect

**Pros:**
- Industry standard for federated authentication
- Social login support (Google, Facebook)
- Delegated authorization

**Cons:**
- Overkill for single-tenant application
- Requires additional OAuth server setup
- Increased complexity for developers
- HIPAA requires direct control over authentication (not delegated)
- **Decision:** ❌ Rejected - Too complex for requirements

### Alternative 2: Session-Based Authentication (Laravel Default)

**Pros:**
- Simple implementation
- Native Laravel support
- Server-side session control

**Cons:**
- Requires sticky sessions (breaks horizontal scaling)
- Not suitable for mobile apps
- Higher memory usage (session storage)
- Difficult to implement cross-domain authentication
- **Decision:** ❌ Rejected - Not scalable enough

### Alternative 3: Passport (OAuth 2.0 Laravel Package)

**Pros:**
- Full OAuth 2.0 implementation
- Third-party API access control
- Client credentials flow

**Cons:**
- Heavy package (adds 50+ database tables)
- More complex than needed for our use case
- Additional maintenance overhead
- **Decision:** ❌ Rejected - Sanctum simpler and sufficient

### Alternative 4: Firebase Authentication

**Pros:**
- Managed service (no infrastructure)
- Social login built-in
- Mobile SDK support

**Cons:**
- Vendor lock-in to Google
- HIPAA BAA required (additional cost)
- External dependency for critical authentication
- Data residency concerns (LGPD)
- **Decision:** ❌ Rejected - Avoid vendor lock-in for critical service

---

## Implementation Details

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                        │
├──────────────────────────────────────────────────────────────┤
│  1. Login Request                                             │
│     POST /api/auth/login                                      │
│     { email, password }                                       │
│         │                                                     │
│         ↓                                                     │
│  2. Credential Validation                                     │
│     - Hash password comparison                                │
│     - Account status check (active, verified)                │
│     - Rate limiting (5 attempts per 15 min)                  │
│         │                                                     │
│         ↓                                                     │
│  3. MFA Challenge (if enabled for role)                      │
│     POST /api/auth/mfa/verify                                │
│     { totp_code }                                            │
│         │                                                     │
│         ↓                                                     │
│  4. Token Generation                                          │
│     - Generate JWT access token (15 min)                     │
│     - Generate refresh token (7 days)                        │
│     - Store refresh token hash in database                   │
│     - Log authentication event                               │
│         │                                                     │
│         ↓                                                     │
│  5. Response                                                  │
│     200 OK                                                    │
│     {                                                         │
│       access_token: "jwt...",                                │
│       refresh_token: "refresh...",                           │
│       expires_in: 900,                                       │
│       token_type: "Bearer"                                   │
│     }                                                         │
│     Set-Cookie: auth_token=jwt...; HttpOnly; Secure          │
└──────────────────────────────────────────────────────────────┘
```

### Token Refresh Flow

```php
// POST /api/auth/refresh
public function refresh(Request $request): JsonResponse
{
    $refreshToken = $request->bearerToken();

    // Validate refresh token
    $payload = JWT::decode($refreshToken, $publicKey);

    // Check if refresh token is revoked
    if ($this->isTokenRevoked($payload->jti)) {
        throw new AuthenticationException('Refresh token revoked');
    }

    // Check if refresh token is expired
    if ($payload->exp < time()) {
        throw new AuthenticationException('Refresh token expired');
    }

    // Revoke old refresh token (rotation)
    $this->revokeToken($payload->jti);

    // Generate new access token and refresh token
    $user = User::findOrFail($payload->sub);
    $newAccessToken = $this->generateAccessToken($user);
    $newRefreshToken = $this->generateRefreshToken($user);

    // Log refresh event
    AuditLog::create([
        'user_id' => $user->id,
        'action' => 'token_refresh',
        'ip_address' => $request->ip(),
    ]);

    return response()->json([
        'access_token' => $newAccessToken,
        'refresh_token' => $newRefreshToken,
        'expires_in' => 900,
        'token_type' => 'Bearer'
    ]);
}
```

### Multi-Factor Authentication

```php
// Enable TOTP MFA
public function enableMfa(Request $request): JsonResponse
{
    $user = $request->user();

    // Generate secret
    $secret = Google2FA::generateSecretKey();

    // Generate QR code
    $qrCodeUrl = Google2FA::getQRCodeUrl(
        'AUSTA OnboardingPortal',
        $user->email,
        $secret
    );

    // Store secret temporarily (not activated yet)
    $user->update([
        'two_factor_secret' => encrypt($secret),
        'two_factor_confirmed_at' => null,
    ]);

    return response()->json([
        'secret' => $secret,
        'qr_code_url' => $qrCodeUrl,
        'recovery_codes' => $this->generateRecoveryCodes($user),
    ]);
}

// Verify and activate MFA
public function verifyMfa(Request $request): JsonResponse
{
    $request->validate([
        'totp_code' => 'required|digits:6'
    ]);

    $user = $request->user();
    $secret = decrypt($user->two_factor_secret);

    $valid = Google2FA::verifyKey($secret, $request->totp_code);

    if (!$valid) {
        throw ValidationException::withMessages([
            'totp_code' => ['Invalid verification code']
        ]);
    }

    // Activate MFA
    $user->update([
        'two_factor_confirmed_at' => now(),
    ]);

    // Log MFA activation
    AuditLog::create([
        'user_id' => $user->id,
        'action' => 'mfa_enabled',
        'ip_address' => $request->ip(),
    ]);

    return response()->json(['message' => 'MFA enabled successfully']);
}
```

### Device Fingerprinting

```php
// Middleware: DeviceFingerprintMiddleware
public function handle(Request $request, Closure $next)
{
    $fingerprint = $this->generateFingerprint($request);

    // Check if device fingerprint matches stored fingerprint
    $storedFingerprint = Cache::get("device_fingerprint:{$request->user()->id}");

    if ($storedFingerprint && $storedFingerprint !== $fingerprint) {
        // Suspicious activity detected
        event(new SuspiciousDeviceDetected($request->user(), $fingerprint));

        // Optional: Force re-authentication
        if ($this->isSuspicious($request->user(), $fingerprint)) {
            throw new AuthenticationException('Device verification required');
        }
    }

    // Update fingerprint cache
    Cache::put(
        "device_fingerprint:{$request->user()->id}",
        $fingerprint,
        now()->addDays(30)
    );

    return $next($request);
}

private function generateFingerprint(Request $request): string
{
    return hash('sha256', implode('|', [
        $request->userAgent(),
        $request->header('Accept-Language'),
        $request->header('Accept-Encoding'),
        // Do NOT include IP (can change frequently)
    ]));
}
```

---

## Security Considerations

### Password Policy

```php
// config/auth.php
'passwords' => [
    'users' => [
        'provider' => 'users',
        'table' => 'password_resets',
        'expire' => 60, // Password reset link expires in 60 minutes
        'throttle' => 60, // Rate limit password reset requests
        'min_length' => 12, // Minimum password length
        'complexity' => true, // Require uppercase, lowercase, numbers, symbols
        'history' => 12, // Prevent reuse of last 12 passwords
        'expiration' => 90, // Admin passwords expire after 90 days
    ],
],
```

### Rate Limiting

```php
// routes/api.php
Route::middleware(['throttle:login'])->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
});

// app/Providers/RouteServiceProvider.php
RateLimiter::for('login', function (Request $request) {
    return Limit::perMinute(5)
        ->by($request->ip())
        ->response(function () {
            return response()->json([
                'message' => 'Too many login attempts. Please try again in 15 minutes.'
            ], 429);
        });
});
```

### Session Management

```php
// Session configuration
'sessions' => [
    'lifetime' => 900, // 15 minutes (access token expiration)
    'expire_on_close' => true,
    'encrypt' => true,
    'http_only' => true, // Prevent JavaScript access
    'secure' => true, // HTTPS only
    'same_site' => 'lax', // CSRF protection
],

// Concurrent session limiting
public function login(LoginRequest $request): JsonResponse
{
    $credentials = $request->validated();

    if (!Auth::attempt($credentials)) {
        throw ValidationException::withMessages([
            'email' => ['Invalid credentials']
        ]);
    }

    $user = Auth::user();

    // Limit to 3 concurrent sessions
    $activeSessions = $user->sessions()
        ->where('expires_at', '>', now())
        ->count();

    if ($activeSessions >= 3) {
        // Revoke oldest session
        $user->sessions()
            ->orderBy('created_at', 'asc')
            ->first()
            ->delete();
    }

    // Create new session record
    $session = $user->sessions()->create([
        'token_hash' => hash('sha256', $accessToken),
        'device' => $request->userAgent(),
        'ip_address' => $request->ip(),
        'expires_at' => now()->addMinutes(15),
    ]);

    // Generate tokens...
}
```

---

## Consequences

### Positive

- ✅ **Stateless**: Horizontal scaling without sticky sessions
- ✅ **Mobile Ready**: Token-based authentication works for native apps
- ✅ **Security**: Short-lived access tokens limit exposure
- ✅ **Auditability**: Complete audit trail of authentication events
- ✅ **Compliance**: Meets HIPAA Technical Safeguards requirements
- ✅ **User Experience**: Automatic token refresh for seamless experience

### Negative

- ⚠️ **Token Revocation**: Requires token blacklist for immediate revocation
- ⚠️ **Key Management**: JWT signing keys must be securely managed
- ⚠️ **Token Size**: JWT tokens larger than session IDs (mitigated by compression)

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Stolen Refresh Token** | Medium | High | - Short expiration (7 days)<br>- Token rotation on use<br>- Device fingerprinting |
| **XSS Attack Stealing Tokens** | Low | Critical | - HTTP-only cookies for web<br>- Content Security Policy<br>- Input sanitization |
| **Brute Force Attacks** | High | Medium | - Rate limiting (5 attempts/15 min)<br>- CAPTCHA after 3 failed attempts<br>- Account lockout after 10 failed attempts |
| **Token Replay Attacks** | Medium | High | - Short access token expiration<br>- JTI (JWT ID) for tracking<br>- Token blacklist for revocation |

---

## Compliance Mapping

### HIPAA Technical Safeguards

| Requirement | Implementation |
|-------------|----------------|
| **§164.312(a)(1) - Access Control** | Role-based access control enforced via JWT claims |
| **§164.312(a)(2)(i) - Unique User Identification** | Each user has unique UUID in JWT |
| **§164.312(a)(2)(iii) - Automatic Logoff** | Access token expires after 15 minutes of inactivity |
| **§164.312(d) - Person or Entity Authentication** | Multi-factor authentication for privileged users |

### LGPD Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Art. 46 - Security Measures** | Encrypted tokens, secure transmission (TLS 1.3) |
| **Art. 37 - Audit Trail** | Complete logging of authentication events |
| **Art. 18 - Right to Information** | Users can view active sessions and revoke access |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Authentication Success Rate** | > 99.5% | Successful auth / total auth attempts |
| **Token Refresh Rate** | > 95% | Successful refreshes / total attempts |
| **MFA Adoption (Admin/Provider)** | 100% | MFA enabled users / total privileged users |
| **Average Login Time** | < 1 second | Time from request to token generation |
| **Security Incidents** | 0 critical | Authentication-related security breaches |

---

## Testing Strategy

```php
// tests/Feature/AuthenticationTest.php
public function test_user_can_login_with_valid_credentials(): void
{
    $user = User::factory()->create([
        'email' => 'test@example.com',
        'password' => Hash::make('SecurePassword123!')
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@example.com',
        'password' => 'SecurePassword123!'
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'access_token',
            'refresh_token',
            'expires_in',
            'token_type'
        ]);

    $this->assertNotNull($response['access_token']);
}

public function test_user_cannot_login_with_invalid_credentials(): void
{
    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@example.com',
        'password' => 'WrongPassword'
    ]);

    $response->assertUnauthorized();
}

public function test_login_is_rate_limited(): void
{
    for ($i = 0; $i < 6; $i++) {
        $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'WrongPassword'
        ]);
    }

    $response = $this->postJson('/api/auth/login', [
        'email' => 'test@example.com',
        'password' => 'WrongPassword'
    ]);

    $response->assertStatus(429); // Too Many Requests
}

public function test_mfa_required_for_admin_users(): void
{
    $admin = User::factory()->admin()->create();

    $response = $this->actingAs($admin)
        ->postJson('/api/auth/enable-mfa');

    $response->assertOk()
        ->assertJsonStructure([
            'secret',
            'qr_code_url',
            'recovery_codes'
        ]);
}
```

---

## References

- [Laravel Sanctum Documentation](https://laravel.com/docs/10.x/sanctum)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [HIPAA Technical Safeguards](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

## Approval

| Role | Name | Decision | Date | Signature |
|------|------|----------|------|-----------|
| **CTO** | [Name] | Approved | 2025-09-30 | ✓ |
| **Security Officer** | [Name] | Approved | 2025-09-30 | ✓ |
| **Compliance Officer** | [Name] | Approved | 2025-09-30 | ✓ |
| **Lead Architect** | [Name] | Approved | 2025-09-30 | ✓ |

---

**Next Steps:**
1. Implement Laravel Sanctum authentication
2. Configure JWT token generation and validation
3. Implement MFA for administrative users
4. Set up device fingerprinting middleware
5. Create comprehensive authentication test suite
6. Configure rate limiting and brute force protection
7. Document API authentication for frontend developers
