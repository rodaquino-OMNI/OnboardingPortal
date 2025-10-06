# Security Checklist

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Pre-Deployment Mandatory

---

## Table of Contents

1. [Pre-Deployment Security Checklist](#1-pre-deployment-security-checklist)
2. [HIPAA Compliance Verification](#2-hipaa-compliance-verification)
3. [LGPD Compliance Verification](#3-lgpd-compliance-verification)
4. [Secret Rotation Procedures](#4-secret-rotation-procedures)
5. [Incident Response Runbook](#5-incident-response-runbook)

---

## 1. Pre-Deployment Security Checklist

### 1.1 Authentication & Authorization (ADR-002)

**Cookie-Based Auth**:
- [ ] CSRF protection enabled (`VerifyCsrfToken` middleware active)
- [ ] Session cookies have `HttpOnly`, `Secure`, `SameSite=Lax` flags
- [ ] Session timeout configured (120 minutes max)
- [ ] Session fingerprinting active (`SessionFingerprintMiddleware`)
- [ ] Fingerprint mismatch alerts configured

**JWT Auth**:
- [ ] JWT secret is cryptographically secure (>256 bits)
- [ ] JWT expiry set to reasonable time (1 hour for access, 7 days for refresh)
- [ ] Refresh tokens stored securely (hashed in database)
- [ ] Token revocation mechanism implemented
- [ ] JWT algorithm set to `HS256` or `RS256` (not `none`)

**Social OAuth**:
- [ ] OAuth state parameter validated (CSRF protection)
- [ ] OAuth redirect URIs whitelisted
- [ ] Access tokens never logged or exposed in URLs
- [ ] OAuth provider (Google, Facebook) apps verified

**Multi-Role Access Control**:
- [ ] Role middleware enforces least privilege (`UnifiedRoleMiddleware`)
- [ ] Beneficiaries cannot access admin routes (tested: `AUTH-018`)
- [ ] Company admins see only their tenant data (tested: `AUTH-020`)
- [ ] Admin panel requires MFA (if implemented)

### 1.2 Data Protection (ADR-004)

**Encryption at Rest**:
- [ ] PHI/PII fields encrypted in database (`EncryptionService` active)
- [ ] Encryption keys stored in AWS Secrets Manager (not `.env`)
- [ ] Key rotation schedule documented (see Section 4.3)
- [ ] Backup encryption verified

**Encryption in Transit**:
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] TLS 1.2+ required (no SSLv3, TLS 1.0/1.1)
- [ ] Certificate valid and not self-signed
- [ ] HSTS header enabled (`max-age=31536000; includeSubDomains`)

**Data Anonymization**:
- [ ] User IDs hashed in analytics events (`hash_abc123` format)
- [ ] No PHI/PII in logs (verified with grep scan)
- [ ] Error messages don't leak sensitive data (stack traces disabled in prod)

**File Uploads**:
- [ ] File type validation (whitelist: JPEG, PNG, PDF)
- [ ] File size limits enforced (max 5MB)
- [ ] Files uploaded to isolated S3 bucket (not web-accessible)
- [ ] Virus scanning enabled (ClamAV or AWS GuardDuty)
- [ ] Filename sanitization (no path traversal: `../../etc/passwd`)

### 1.3 Input Validation

**SQL Injection**:
- [ ] All queries use parameterized statements (no raw SQL with user input)
- [ ] `SqlInjectionProtection` middleware active
- [ ] Database user has minimal privileges (no `DROP`, `ALTER`)

**XSS (Cross-Site Scripting)**:
- [ ] All user input escaped in Blade templates (`{{ }}`, not `{!! !!}`)
- [ ] React components sanitize dangerouslySetInnerHTML
- [ ] CSP (Content Security Policy) header configured:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
  ```

**Command Injection**:
- [ ] No shell commands use user input (or use `escapeshellarg()`)
- [ ] File operations use whitelist of allowed paths

**LDAP Injection**:
- [ ] Not applicable (no LDAP integration)

**XML External Entity (XXE)**:
- [ ] XML parsing disabled or uses safe parser (libxml_disable_entity_loader)

### 1.4 Security Headers

- [ ] `X-Frame-Options: DENY` (prevent clickjacking)
- [ ] `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
- [ ] `X-XSS-Protection: 1; mode=block` (legacy XSS protection)
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: geolocation=(), microphone=(), camera=()`

**Verify**:
```bash
curl -I https://onboarding.example.com | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"
```

### 1.5 Rate Limiting & DDoS Protection

**API Endpoints**:
- [ ] Rate limiting configured (60 req/min per IP for authenticated, 10/min for public)
- [ ] Throttling on login endpoint (5 attempts/min, then 15-min lockout)
- [ ] Gamification endpoints rate-limited (tested: `GAM-API-003`)

**Infrastructure**:
- [ ] Cloudflare/AWS WAF enabled
- [ ] DDoS protection configured (layer 3/4 and 7)
- [ ] Fail2Ban configured for SSH (if applicable)

### 1.6 Dependency Security

**PHP Dependencies**:
- [ ] `composer audit` passes with 0 critical/high vulnerabilities
- [ ] No dependencies with known CVEs (check Snyk/Dependabot)
- [ ] Dependencies updated in last 6 months

**JavaScript Dependencies**:
- [ ] `npm audit --production` passes with 0 critical/high
- [ ] No outdated packages with security patches available
- [ ] Dependabot alerts resolved

**Docker Images**:
- [ ] Base images from official sources (php:8.2-fpm, node:18-alpine)
- [ ] Images scanned with Trivy (no high/critical vulnerabilities)

### 1.7 Secrets Management

**Environment Variables**:
- [ ] No secrets in `.env.example` (only placeholders)
- [ ] `.env` file gitignored
- [ ] Production secrets stored in AWS Secrets Manager
- [ ] Secrets rotation schedule documented (Section 4)

**API Keys**:
- [ ] AWS credentials use IAM roles (not hardcoded keys)
- [ ] SendGrid API key has minimal scope (send-only)
- [ ] Google OAuth client secret rotated in last 90 days

**Database Credentials**:
- [ ] Database password is 32+ characters, alphanumeric + symbols
- [ ] Database user has minimal privileges (no `SUPER` or `FILE`)

### 1.8 Logging & Monitoring

**Security Logs**:
- [ ] Authentication failures logged (level: WARNING)
- [ ] Authorization failures logged (level: ERROR)
- [ ] Session fingerprint mismatches logged (level: CRITICAL)
- [ ] Rapid progression fraud flags logged (level: CRITICAL)

**Log Protection**:
- [ ] Logs don't contain PHI/PII (verified with regex scan)
- [ ] Logs stored in append-only S3 bucket
- [ ] Log retention: 90 days (compliance requirement)

**Alerting**:
- [ ] Slack/email alerts for CRITICAL logs
- [ ] CloudWatch alarms for 5xx error rate spike (>1%)
- [ ] Anomaly detection for unusual login patterns

### 1.9 Secure Development

**Code Review**:
- [ ] All PRs require security review (GitHub CODEOWNERS)
- [ ] Security-critical files flagged (auth, encryption, payment)

**Static Analysis**:
- [ ] PHPStan/Psalm runs in CI (no level 5+ errors)
- [ ] ESLint security plugin enabled
- [ ] SonarQube/CodeQL scans pass

**Secret Scanning**:
- [ ] GitGuardian pre-commit hook installed
- [ ] GitHub secret scanning enabled
- [ ] No secrets in commit history (verified with git-secrets)

---

## 2. HIPAA Compliance Verification

### 2.1 Administrative Safeguards

- [ ] **Security Management Process**: Documented in `/docs/SECURITY_POLICY.md`
- [ ] **Assigned Security Responsibility**: CISO/Security Lead identified
- [ ] **Workforce Security**: Employee background checks completed
- [ ] **Information Access Management**: Role-based access control (ADR-002)
- [ ] **Security Awareness Training**: Annual training completed (certificate on file)
- [ ] **Security Incident Procedures**: Runbook documented (Section 5)

### 2.2 Physical Safeguards

- [ ] **Facility Access Controls**: AWS data centers ISO 27001 certified
- [ ] **Workstation Use**: Company laptops encrypted (FileVault/BitLocker)
- [ ] **Workstation Security**: Screen locks after 5 min inactivity
- [ ] **Device/Media Controls**: Old hard drives destroyed (certificate of destruction)

### 2.3 Technical Safeguards

- [ ] **Access Control**: Unique user IDs, automatic logoff (120 min), encryption (ADR-004)
- [ ] **Audit Controls**: CloudWatch logs all PHI access (who, what, when)
- [ ] **Integrity**: Checksums for file uploads, version control for code
- [ ] **Person/Entity Authentication**: MFA for admin accounts
- [ ] **Transmission Security**: TLS 1.2+ for all PHI transmission

### 2.4 HIPAA Data Handling

**Protected Health Information (PHI)**:
- [ ] Health questionnaire answers encrypted in DB
- [ ] Document uploads (medical records) stored in encrypted S3
- [ ] PHI never sent in query params or URLs
- [ ] PHI access logged in audit trail

**Business Associate Agreements (BAAs)**:
- [ ] BAA signed with AWS (for S3, RDS, CloudWatch)
- [ ] BAA signed with SendGrid (for email notifications)
- [ ] BAA signed with Textract (for OCR)

---

## 3. LGPD Compliance Verification

### 3.1 Lawful Basis for Processing

- [ ] **Consent**: Users explicitly consent to data processing (checkbox on registration)
- [ ] **Contract Performance**: Onboarding necessary for health plan enrollment
- [ ] **Legitimate Interest**: Fraud detection (documented in privacy policy)

### 3.2 Data Subject Rights

**Right to Access**:
- [ ] Users can download their data (`GET /api/lgpd/export`)
- [ ] Export includes: profile, health data, documents, gamification data
- [ ] Export format: JSON (machine-readable)

**Right to Rectification**:
- [ ] Users can edit profile data (`PUT /api/profile`)
- [ ] Changes logged in audit trail

**Right to Erasure (Right to be Forgotten)**:
- [ ] Users can request deletion (`POST /api/lgpd/delete`)
- [ ] Deletion request queued (manual review for legal holds)
- [ ] Data deleted within 30 days (or legal hold expires)

**Right to Object**:
- [ ] Users can opt-out of marketing emails (unsubscribe link)
- [ ] Users can disable gamification notifications (settings panel)

**Right to Data Portability**:
- [ ] Export format compatible with other systems (JSON)

### 3.3 Data Minimization

- [ ] Only collect data necessary for onboarding (no "nice to have" fields)
- [ ] Optional fields clearly marked (not required)
- [ ] Data retention policy: 5 years (or legal requirement)

### 3.4 Security Measures (Article 46)

- [ ] Encryption at rest and in transit (ADR-004)
- [ ] Pseudonymization in analytics (hashed user IDs)
- [ ] Access controls (role-based, least privilege)

### 3.5 Data Processing Records

- [ ] Processing activities documented (`/docs/DATA_PROCESSING_RECORD.md`)
- [ ] Record includes: purpose, categories of data, recipients, retention period

### 3.6 Privacy Policy

- [ ] Privacy policy published at `/privacy-policy`
- [ ] Policy written in clear, plain language (no legalese)
- [ ] Policy updated annually (or when processing changes)
- [ ] Users accept policy on registration (checkbox)

---

## 4. Secret Rotation Procedures

### 4.1 Schedule

| Secret Type | Rotation Frequency | Owner | Next Rotation |
|-------------|-------------------|-------|---------------|
| **Database Password** | 90 days | DevOps Lead | 2025-12-30 |
| **JWT Secret** | 180 days | Backend Lead | 2026-03-30 |
| **AWS Access Keys** | 90 days (or use IAM roles) | DevOps Lead | 2025-12-30 |
| **SendGrid API Key** | 180 days | Backend Lead | 2026-03-30 |
| **Google OAuth Secret** | 365 days | Product Manager | 2026-09-30 |
| **Encryption Keys** | 180 days | Security Lead | 2026-03-30 |

### 4.2 Rotation Checklist (Database Password)

**Pre-Rotation**:
- [ ] Schedule maintenance window (2 AM on Sunday)
- [ ] Notify team in #engineering channel
- [ ] Backup current password in 1Password

**Rotation**:
1. Generate new password:
   ```bash
   openssl rand -base64 32
   ```
2. Update AWS Secrets Manager:
   ```bash
   aws secretsmanager update-secret \
     --secret-id prod/db/password \
     --secret-string "NEW_PASSWORD"
   ```
3. Update RDS password:
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier prod-onboarding \
     --master-user-password "NEW_PASSWORD" \
     --apply-immediately
   ```
4. Restart application pods:
   ```bash
   kubectl rollout restart deployment/onboarding-backend
   ```

**Post-Rotation**:
- [ ] Verify application health (`/api/health` returns 200)
- [ ] Check error logs for auth failures
- [ ] Delete old password from 1Password after 7 days

### 4.3 Rotation Checklist (Encryption Keys)

**Pre-Rotation**:
- [ ] Export encrypted data to temporary storage
- [ ] Schedule maintenance window (4 hours)

**Rotation**:
1. Generate new key:
   ```bash
   php artisan key:generate --show
   ```
2. Add new key to Secrets Manager (as `APP_KEY_NEW`)
3. Decrypt data with old key, re-encrypt with new key:
   ```bash
   php artisan encryption:rotate-keys
   ```
4. Update `APP_KEY` to new value
5. Restart application

**Post-Rotation**:
- [ ] Verify all encrypted fields readable
- [ ] Test file upload/download
- [ ] Delete old key after 30 days

---

## 5. Incident Response Runbook

### 5.1 Incident Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P0 (Critical)** | Data breach, system down | 15 min | PHI leaked, database compromised |
| **P1 (High)** | Security vulnerability, degraded service | 1 hour | XSS exploit, elevated error rate |
| **P2 (Medium)** | Non-critical bug, performance issue | 4 hours | Slow query, minor UI bug |
| **P3 (Low)** | Feature request, cosmetic issue | 24 hours | Typo in UI, enhancement request |

### 5.2 Data Breach Response (P0)

**1. Detection (0-15 min)**:
- [ ] Incident detected via:
  - Security alert (CloudWatch, Sentry)
  - User report
  - External notification (security researcher)
- [ ] Create incident ticket: `INCIDENT-YYYY-MM-DD-001`
- [ ] Notify Incident Commander (on-call engineer)

**2. Containment (15-60 min)**:
- [ ] Identify scope:
  - What data was accessed/exfiltrated?
  - How many users affected?
  - Attack vector (SQL injection, XSS, phishing)?
- [ ] Isolate affected systems:
  - Disable compromised accounts
  - Revoke API keys
  - Block malicious IPs (WAF rule)
- [ ] Preserve evidence:
  - Take server snapshots (AWS EBS)
  - Export logs to S3 (immutable storage)
  - Screenshot attacker activity

**3. Eradication (1-4 hours)**:
- [ ] Patch vulnerability:
  - Deploy fix to staging
  - Test thoroughly
  - Deploy to production (emergency release)
- [ ] Rotate all secrets (Section 4)
- [ ] Force password reset for affected users

**4. Recovery (4-8 hours)**:
- [ ] Restore from clean backup (if data corrupted)
- [ ] Re-enable affected systems
- [ ] Monitor for re-infection (24h surveillance)

**5. Notification (24-72 hours)**:
- [ ] **HIPAA Breach Notification** (if PHI affected):
  - Notify affected users within 60 days (email)
  - Notify HHS within 60 days (if >500 users)
  - Notify media (if >500 users)
- [ ] **LGPD Breach Notification** (if Brazilian residents affected):
  - Notify ANPD within 72 hours
  - Notify affected users (email)
- [ ] **Internal Notification**:
  - Executive team (within 4 hours)
  - All employees (within 24 hours)
  - Customer success team (script for user inquiries)

**6. Post-Incident Review (1-2 weeks)**:
- [ ] Root cause analysis (RCA document)
- [ ] Corrective actions:
  - Security patches
  - Process improvements
  - Training updates
- [ ] Update runbook with lessons learned

### 5.3 Incident Communication Templates

**User Notification Email** (PHI Breach):
```
Subject: Important Security Notice - Your Health Information

Dear [User Name],

We are writing to inform you of a security incident that may have affected your personal health information.

**What Happened:**
On [DATE], we discovered that [DESCRIPTION OF INCIDENT]. We immediately took steps to secure our systems and are working with cybersecurity experts to investigate.

**What Information Was Involved:**
The following information may have been accessed: [LIST: name, email, health questionnaire answers, etc.]

**What We're Doing:**
- We have patched the security vulnerability
- We have enhanced our monitoring systems
- We are offering [CREDIT MONITORING/IDENTITY PROTECTION] at no cost

**What You Can Do:**
- Monitor your accounts for suspicious activity
- Change your password immediately: [LINK]
- Enroll in credit monitoring: [LINK]

We sincerely apologize for this incident and are committed to protecting your information.

For questions, contact: security@example.com or 1-800-SECURITY

Sincerely,
[CISO/CEO Name]
```

### 5.4 Communication Channels

**Internal**:
- **Slack**: `#security-incidents` (for coordination)
- **Zoom**: War room for P0/P1 incidents
- **Email**: security@example.com (for external reports)

**External**:
- **Users**: Email (SendGrid)
- **Regulators**: Official email/portal
  - HHS: https://ocrportal.hhs.gov/ocr/breach/
  - ANPD (Brazil): https://www.gov.br/anpd/

---

## What Could Go Wrong?

### Scenario 1: Secret Leaked in Git Commit
**Detection**: GitGuardian alert
**Response**:
1. Rotate secret immediately (Section 4)
2. Force-push to remove from history (if <24h old)
3. Scan production logs for unauthorized use

### Scenario 2: SQL Injection Exploit
**Detection**: WAF alert, unusual DB queries in logs
**Response**:
1. Block attacker IP (WAF rule)
2. Review `SqlInjectionProtection` middleware
3. Audit all queries for parameterization
4. Deploy patch within 1 hour

### Scenario 3: Ransomware Attack
**Detection**: Files encrypted, ransom note
**Response**:
1. Isolate affected servers (disconnect from network)
2. Restore from backup (daily snapshots in S3)
3. Notify law enforcement (FBI IC3)
4. **Do NOT pay ransom** (company policy)

---

## How We'll Know

### Security Metrics Dashboard

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Security Scan Pass Rate** | 100% | OWASP ZAP, Trivy | <100% |
| **Dependency Vulnerabilities** | 0 high/critical | npm audit, composer audit | >0 |
| **Failed Login Attempts** | <100/day | CloudWatch logs | >500/day |
| **Fraud Flags** | <5/day | Gamification fraud detection | >20/day |
| **Incident Response Time** | <15 min (P0) | PagerDuty SLA | >30 min |

---

**End of Security Checklist**
