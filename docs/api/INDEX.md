# API Documentation Index

This directory contains OpenAPI specifications for all public APIs in the OnboardingPortal system.

## Available API Specifications

### Health Questionnaire API
**File:** `openapi-health-questionnaire.yml`
**Version:** 1.0.0
**Base Path:** `/api/v1/health`
**Status:** Active (Feature Flag: `sliceC_health`)

**Description:**
RESTful API for health questionnaire management with PHI encryption and compliance. Provides endpoints for retrieving questionnaire schemas, creating/updating responses, and accessing response metadata.

**Endpoints:**
- `GET /api/v1/health/schema` - Get questionnaire schema
- `POST /api/v1/health/response` - Create or submit response
- `GET /api/v1/health/response/{id}` - Get response metadata
- `PATCH /api/v1/health/response/{id}` - Update draft response

**Security:**
- Authentication: Laravel Sanctum (JWT Bearer)
- PHI Protection: AES-256-GCM encryption at rest
- Rate Limiting: 10 submissions/hour per user
- Audit Logging: All PHI access logged

**Documentation:**
- [OpenAPI Specification](./openapi-health-questionnaire.yml)
- [Phase 6 Gate 1 Validation](../phase6/GATE1_CONTRACT_PARITY_EVIDENCE.md)

---

## API Standards

### Versioning
- All APIs use `/api/v{version}` path prefix
- Current version: `v1`
- Breaking changes require version increment

### Authentication
- **Method:** JWT via Laravel Sanctum
- **Header:** `Authorization: Bearer {token}`
- **Obtain Token:** `POST /api/v1/auth/login`
- **Token Lifecycle:** 24 hours (configurable)

### Response Format
All responses follow standardized JSON structure:

**Success:**
```json
{
  "data": { ... },
  "metadata": { ... }
}
```

**Error:**
```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "errors": { ... }  // Field-level validation errors
}
```

### Status Codes
- `200 OK` - Successful GET/PATCH
- `201 Created` - Successful POST
- `400 Bad Request` - Invalid request format
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (duplicate)
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Rate Limiting
- **Headers:**
  - `X-RateLimit-Limit` - Request limit
  - `X-RateLimit-Remaining` - Remaining requests
  - `Retry-After` - Seconds until retry (429 responses)
- **Limits:** Endpoint-specific (documented in OpenAPI specs)

### Feature Flags
- Feature-gated endpoints require specific flags
- Feature flags passed via middleware: `feature.flag:{flag_name}`
- Override header: `X-Feature-Flag` (admin only)

### PHI Protection
- **Encryption:** AES-256-GCM at rest
- **Zero PHI in Responses:** All API responses exclude encrypted PHI
- **Audit Logging:** All PHI access logged with:
  - User ID
  - Action type
  - Resource ID
  - IP address
  - Timestamp
  - PHI accessed flag

### Compliance
- **LGPD:** Full compliance with data protection regulations
- **Audit Trail:** Comprehensive logging for all operations
- **Data Retention:** Configurable per data type
- **Right to Erasure:** Supported via dedicated endpoints

---

## Development Workflow

### 1. Contract-First Development
1. Update OpenAPI specification
2. Validate against implementation
3. Generate client SDKs
4. Implement endpoints
5. Run contract tests

### 2. Documentation Updates
- Update OpenAPI spec for all API changes
- Run drift validation (Gate 1)
- Update this INDEX.md
- Commit both spec and implementation

### 3. Testing
- Unit tests for controllers
- Integration tests for full flows
- Contract tests against OpenAPI spec
- Security tests (PHI exclusion, auth)

### 4. Validation Gates
- **Gate 1:** Contract Parity Validation
  - Verify OpenAPI spec matches implementation
  - PHI exclusion check
  - Security scheme validation
  - SDK freshness check

---

## Tools

### OpenAPI Validation
```bash
# Validate spec format
npx @apidevtools/swagger-cli validate docs/api/openapi-health-questionnaire.yml

# Generate contract tests
npx openapi-to-postman -s docs/api/openapi-health-questionnaire.yml -o tests/postman/health.json

# Generate TypeScript client
npx openapi-typescript docs/api/openapi-health-questionnaire.yml --output apps/web/src/types/api/health.ts
```

### Contract Testing
```bash
# Run contract tests
npm run test:contract -- health-questionnaire

# Validate drift
npm run validate:api-drift
```

### Local Testing
```bash
# Start API server
cd omni-portal/backend && php artisan serve

# Test endpoints (requires auth token)
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/health/schema
```

---

## Changelog

### 2025-10-06
- **Added:** Health Questionnaire API v1.0.0
- **Feature:** PHI-encrypted questionnaire management
- **Security:** Rate limiting, audit logging, feature flags
- **Compliance:** LGPD-compliant PHI handling

---

## Support

**API Issues:** Create issue in repository with `api` label
**Documentation:** See individual OpenAPI specs for detailed endpoint documentation
**Security Concerns:** Contact security team immediately for PHI-related issues
