# Threat Model

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production-Ready

---

## Table of Contents

1. [STRIDE Analysis](#1-stride-analysis)
2. [Attack Trees](#2-attack-trees)
3. [Control Mapping](#3-control-mapping)
4. [Data Classification](#4-data-classification)
5. [Threat Scenarios](#5-threat-scenarios)

---

## 1. STRIDE Analysis

### 1.1 Onboarding Flow

#### 1.1.1 Spoofing Identity

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-001: Account Takeover** | Attacker guesses weak password | - Access to PHI<br>- Fraudulent onboarding | Medium | - Password complexity rules<br>- Rate limiting on login (ADR-002)<br>- MFA (optional) | Medium |
| **T-002: Session Hijacking** | Attacker steals session cookie | - Impersonate user<br>- Access dashboard | High | - HttpOnly, Secure flags on cookies<br>- Session fingerprinting (ADR-002)<br>- Short session timeout (120 min) | Low |
| **T-003: OAuth Account Hijacking** | Attacker intercepts OAuth callback | - Link attacker's Google account to victim's profile | High | - OAuth state parameter validation<br>- HTTPS enforced<br>- Redirect URI whitelist | Low |

#### 1.1.2 Tampering

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-004: Gamification Point Manipulation** | Attacker modifies API request to award 10,000 points | - Unfair leaderboard<br>- Fraud detection bypass | Medium | - Server-side validation<br>- Point award idempotency (GAMIFICATION_SPEC)<br>- Fraud detection (rapid progression) | Low |
| **T-005: Document Upload Bypass** | Attacker uploads malicious file (PHP backdoor) | - Remote code execution<br>- Server compromise | High | - File type whitelist (JPEG, PNG, PDF only)<br>- Virus scanning (ClamAV)<br>- Isolated S3 storage (ADR-004) | Low |
| **T-006: SQL Injection** | Attacker injects `'; DROP TABLE users; --` in form field | - Database deletion<br>- Data exfiltration | High | - Parameterized queries (Laravel Eloquent)<br>- `SqlInjectionProtection` middleware<br>- Database user minimal privileges | Very Low |

#### 1.1.3 Repudiation

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-007: Audit Log Tampering** | Admin deletes audit logs to cover fraud | - No accountability<br>- Compliance violation | Low | - Append-only S3 bucket for logs<br>- CloudWatch Logs (immutable)<br>- Audit log integrity checksums | Very Low |
| **T-008: User Denies Action** | User claims "I didn't upload that document" | - Dispute resolution delay | Medium | - IP address logging<br>- Session fingerprint<br>- Timestamp on all actions | Low |

#### 1.1.4 Information Disclosure

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-009: PHI Exposure in Logs** | Health questionnaire answers logged in plaintext | - HIPAA violation<br>- User privacy breach | Medium | - No PHI in logs (verified with regex scan)<br>- Encrypted logs in transit/rest<br>- Log access restricted to admins | Very Low |
| **T-010: Error Message Leakage** | Stack trace reveals database schema | - Attacker learns system internals | Medium | - Generic error messages in production<br>- `APP_DEBUG=false`<br>- Custom error pages | Low |
| **T-011: Timing Attack on Login** | Response time differs for valid vs invalid email | - Email enumeration | Low | - Constant-time password hashing<br>- Same response time for valid/invalid | Very Low |

#### 1.1.5 Denial of Service

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-012: Credential Stuffing** | Attacker tries 1M username/password combos | - Service unavailable<br>- Legitimate users blocked | High | - Rate limiting (5 attempts/min per IP)<br>- CAPTCHA after 3 failures<br>- Cloudflare DDoS protection | Low |
| **T-013: API Abuse** | Attacker floods `/api/gamification/points` with requests | - Database overload<br>- Slow response times | Medium | - Rate limiting (60 req/min per user)<br>- API throttling<br>- Auto-scaling (AWS ECS) | Low |
| **T-014: Algorithmic Complexity Attack** | Attacker uploads 100MB JSON (deeply nested) | - Server CPU spike<br>- Out of memory | Low | - Request size limit (5MB)<br>- JSON depth limit (10 levels)<br>- Timeout on parsing (5s) | Very Low |

#### 1.1.6 Elevation of Privilege

| Threat | Attack Scenario | Impact | Likelihood | Controls | Risk |
|--------|----------------|--------|------------|----------|------|
| **T-015: Horizontal Privilege Escalation** | Beneficiary accesses another beneficiary's profile | - Privacy breach<br>- Data theft | Medium | - Authorization checks (`UnifiedRoleMiddleware`)<br>- User ID validation<br>- Tenant isolation (ADR-003) | Low |
| **T-016: Vertical Privilege Escalation** | Beneficiary accesses admin panel | - System compromise<br>- Mass data exfiltration | High | - Role-based access control (RBAC)<br>- Admin routes protected<br>- Audit logging of admin actions | Very Low |
| **T-017: IDOR (Insecure Direct Object Reference)** | Attacker changes `document_id=123` to `124` in URL | - Access other users' documents | High | - Authorization on every request<br>- No sequential IDs (use UUIDs)<br>- Ownership validation | Low |

---

### 1.2 Document Upload & OCR

#### STRIDE Summary

| Threat Type | Count | High Risk | Controls |
|-------------|-------|-----------|----------|
| **Spoofing** | 1 | 0 | File metadata validation |
| **Tampering** | 3 | 2 | Virus scanning, file type whitelist |
| **Repudiation** | 1 | 0 | Audit logging |
| **Information Disclosure** | 2 | 1 | Encrypted storage, OCR sanitization |
| **Denial of Service** | 2 | 1 | File size limits, rate limiting |
| **Elevation of Privilege** | 1 | 0 | S3 bucket policies |

**Detailed Threats**:

| Threat ID | Threat | Attack Scenario | Impact | Controls | Risk |
|-----------|--------|----------------|--------|----------|------|
| **T-018** | Malicious File Upload | Attacker uploads PHP backdoor as "RG.jpg" | Remote code execution | - File extension validation<br>- Magic number check<br>- Virus scanning | Low |
| **T-019** | XXE (XML External Entity)** | Attacker uploads SVG with XXE payload | File read, SSRF | - No XML/SVG parsing<br>- Whitelist: JPEG, PNG, PDF only | Very Low |
| **T-020** | Zip Bomb | Attacker uploads 42KB zip that expands to 4GB | Disk space exhaustion | - Uncompressed size check<br>- No archive processing | Very Low |
| **T-021** | OCR Data Injection | Attacker crafts document with JS in text | XSS in OCR results | - OCR output sanitization<br>- No rendering of extracted text in HTML | Low |
| **T-022** | Document Access Bypass | Attacker guesses S3 URL for another user's document | Privacy breach | - S3 bucket not public<br>- Signed URLs (expire in 1 hour)<br>- Ownership validation | Low |

---

### 1.3 Gamification System

#### STRIDE Summary

| Threat Type | Count | High Risk | Controls |
|-------------|-------|-----------|----------|
| **Spoofing** | 1 | 0 | Session validation |
| **Tampering** | 4 | 1 | Server-side validation, idempotency |
| **Repudiation** | 1 | 0 | Point history audit log |
| **Information Disclosure** | 1 | 0 | Pseudonymous leaderboards |
| **Denial of Service** | 1 | 0 | Rate limiting |
| **Elevation of Privilege** | 2 | 0 | Role checks, tenant isolation |

**Detailed Threats**:

| Threat ID | Threat | Attack Scenario | Impact | Controls | Risk |
|-----------|--------|----------------|--------|----------|------|
| **T-023** | Bot Farming (Fake Accounts) | Attacker creates 1000 accounts, earns max points on each | Leaderboard pollution, fraud | - CAPTCHA on registration<br>- Email verification<br>- Rapid progression detection (GAMIFICATION_SPEC) | Medium |
| **T-024** | Replay Attack (Duplicate Point Award) | Attacker replays POST request to earn points twice | Unfair advantage | - Idempotency keys<br>- Nonce validation<br>- Database unique constraints | Low |
| **T-025** | Race Condition (Double Spend) | Attacker submits 2 parallel requests to spend same points | Point balance goes negative | - Database row-level locks<br>- Atomic transactions<br>- Optimistic concurrency control | Low |
| **T-026** | Leaderboard Manipulation | Attacker creates fake profile to occupy top spot | Trust erosion, fraud | - Fraud score threshold (>80 = hidden from leaderboard)<br>- Manual review queue<br>- Leaderboard opt-in only | Low |
| **T-027** | Badge Showcase Social Engineering | Attacker shares fake badge image claiming "VIP Status" | Phishing, brand damage | - Watermark on shareable images<br>- Verification URL in image<br>- Educate users on scams | Low |

---

## 2. Attack Trees

### 2.1 Account Takeover

```
┌─────────────────────────────────────┐
│   GOAL: Take Over User Account     │
└─────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────┐   ┌───────▼─────────┐
│ Steal      │   │ Exploit         │
│ Credentials│   │ Session         │
└────┬───────┘   └───────┬─────────┘
     │                   │
 ┌───┴────┐         ┌────┴─────┐
 │        │         │          │
┌▼──────┐┌▼───────┐┌▼────────┐┌▼─────────┐
│Phishing││Keylogger││MITM     ││XSS       │
│Email   ││on User ││Proxy    ││Cookie    │
│        ││Device  ││         ││Theft     │
└────────┘└────────┘└─────────┘└──────────┘
 [Medium]  [Low]     [Low]      [Low]

 Controls:
 - User education (phishing awareness)
 - Password manager (anti-keylogger)
 - HTTPS + HSTS (prevent MITM)
 - HttpOnly cookies (prevent XSS theft)
```

**Attack Path Analysis**:

| Path | Steps | Difficulty | Controls Effectiveness |
|------|-------|------------|------------------------|
| **Phishing → Account Access** | 1. Send fake login page<br>2. User enters credentials<br>3. Attacker logs in | Medium (social engineering) | - MFA reduces success<br>- User education reduces click rate |
| **XSS → Cookie Theft** | 1. Find XSS vulnerability<br>2. Inject script to steal cookie<br>3. Use cookie to hijack session | High (finding XSS in 2025 is hard) | - CSP header blocks inline scripts<br>- HttpOnly flag prevents JS access |

---

### 2.2 Data Exfiltration (PHI)

```
┌──────────────────────────────────────┐
│  GOAL: Exfiltrate PHI (Health Data)  │
└──────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────┐   ┌───────▼─────────┐
│ Direct     │   │ Indirect        │
│ Database   │   │ Access          │
│ Access     │   │                 │
└────┬───────┘   └───────┬─────────┘
     │                   │
 ┌───┴────┐         ┌────┴─────┐
 │        │         │          │
┌▼──────┐┌▼───────┐┌▼────────┐┌▼─────────┐
│SQL     ││Stolen  ││API      ││Backup    │
│Injection││DB      ││Abuse    ││Theft     │
│        ││Creds   ││         ││          │
└────────┘└────────┘└─────────┘└──────────┘
 [Very Low][Low]     [Low]      [Low]

 Controls:
 - Parameterized queries (SQL injection)
 - Secrets Manager + rotation (stolen creds)
 - Rate limiting + RBAC (API abuse)
 - Encrypted backups + access logs (backup theft)
```

---

## 3. Control Mapping

### 3.1 ADR-002: Unified Authentication Controls

| Threat ID | Threat | ADR-002 Control | Implementation Status | Effectiveness |
|-----------|--------|-----------------|----------------------|---------------|
| **T-001** | Weak Password | Password complexity rules (8+ chars, uppercase, number, symbol) | ✅ Implemented | High |
| **T-002** | Session Hijacking | Session fingerprinting (IP + User-Agent hash) | ✅ Implemented | High |
| **T-003** | OAuth Hijacking | OAuth state parameter validation | ✅ Implemented | High |
| **T-015** | Horizontal Privilege Escalation | User ID validation in `UnifiedRoleMiddleware` | ✅ Implemented | High |
| **T-016** | Vertical Privilege Escalation | Role-based access control (RBAC) | ✅ Implemented | High |

**Additional Controls from ADR-002**:
- ✅ CSRF protection (`VerifyCsrfToken` middleware)
- ✅ JWT expiry (1 hour access, 7 days refresh)
- ✅ Cookie flags (HttpOnly, Secure, SameSite)
- ✅ MFA (optional, for admin accounts)

---

### 3.2 ADR-004: Data Privacy Controls

| Threat ID | Threat | ADR-004 Control | Implementation Status | Effectiveness |
|-----------|--------|-----------------|----------------------|---------------|
| **T-009** | PHI in Logs | Regex scan to detect PHI patterns | ✅ Implemented | Medium (manual review required) |
| **T-021** | OCR Data Injection | OCR output sanitization (escape HTML) | ✅ Implemented | High |
| **T-022** | Document Access Bypass | Encrypted S3 storage + signed URLs | ✅ Implemented | High |
| **T-009** | PHI Transmission | TLS 1.2+ for all API requests | ✅ Implemented | High |

**Additional Controls from ADR-004**:
- ✅ Database field encryption (PHI fields use Laravel's `encrypted` cast)
- ✅ Encryption keys in AWS Secrets Manager
- ✅ Key rotation schedule (180 days)
- ✅ Pseudonymization in analytics (hashed user IDs)

---

### 3.3 GAMIFICATION_SPEC Controls

| Threat ID | Threat | GAMIFICATION_SPEC Control | Implementation Status | Effectiveness |
|-----------|--------|---------------------------|----------------------|---------------|
| **T-023** | Bot Farming | Rapid progression detection (>1500 pts in <3 min) | ✅ Implemented | High |
| **T-024** | Replay Attack | Idempotency keys on point award endpoint | ✅ Implemented | High |
| **T-025** | Race Condition | Database row-level locks on points table | ✅ Implemented | High |
| **T-026** | Leaderboard Manipulation | Fraud score threshold (>80 = hidden) | ✅ Implemented | Medium (false positives possible) |

**Additional Controls from GAMIFICATION_SPEC**:
- ✅ No random rewards (ethical constraint)
- ✅ No loss aversion manipulation (no "you'll lose X")
- ✅ Opt-in leaderboards (privacy by default)
- ✅ Pseudonymous display names

---

## 4. Data Classification

### 4.1 Data Categories (per ADR-004)

| Data Type | Classification | Examples | Encryption | Retention | Access |
|-----------|---------------|----------|------------|-----------|--------|
| **PHI (Protected Health Information)** | **CRITICAL** | Health questionnaire answers, medical documents | ✅ At rest + in transit | 5 years (HIPAA) | Beneficiary, authorized admins only |
| **PII (Personally Identifiable Info)** | **HIGH** | Name, CPF, RG, email, phone, address | ✅ At rest + in transit | 5 years (LGPD) | Beneficiary, authorized admins, company admins (own tenant) |
| **Authentication Credentials** | **CRITICAL** | Passwords (hashed), JWT tokens, session IDs | ✅ Hashed (bcrypt) + encrypted | Session: 120 min<br>Refresh: 7 days | System only (never displayed) |
| **Gamification Data** | **LOW** | Points, levels, badges, streaks | ❌ No encryption needed | Indefinite (or user deletion) | Beneficiary, public (leaderboard, opt-in) |
| **Audit Logs** | **MEDIUM** | User actions, IP addresses, timestamps | ✅ In transit (to CloudWatch) | 90 days (compliance) | Admins, security team |
| **Analytics Events** | **MEDIUM** | Hashed user IDs, action types, timestamps | ❌ Pseudonymized (no PHI/PII) | 2 years | Product team, data analysts |

### 4.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                  USER (Beneficiary)                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (TLS 1.2+)
                       ▼
┌─────────────────────────────────────────────────────┐
│             NGINX (Reverse Proxy)                   │
│  - SSL Termination                                  │
│  - Rate Limiting                                    │
│  - WAF Rules                                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         Laravel Backend (PHP-FPM)                   │
│  - Authentication (ADR-002)                         │
│  - Authorization (RBAC)                             │
│  - Input Validation                                 │
│  - Encryption/Decryption                            │
└─────┬─────────┬─────────┬─────────┬─────────────────┘
      │         │         │         │
      │         │         │         │
      ▼         ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐
│  MySQL  │ │  Redis  │ │   S3    │ │ CloudWatch  │
│  (RDS)  │ │ (Cache) │ │(Documents)│ │   Logs      │
│         │ │         │ │         │ │             │
│ ✅ Encrypted│ ❌ No PHI│ ✅ Encrypted│ ✅ Encrypted │
│ At Rest │ │         │ │ At Rest │ │ In Transit  │
└─────────┘ └─────────┘ └─────────┘ └─────────────┘
```

**Trust Boundaries**:
1. **User ↔ NGINX**: TLS encryption (untrusted → trusted network)
2. **NGINX ↔ Laravel**: Internal network (trusted)
3. **Laravel ↔ MySQL/Redis/S3**: Encrypted at rest (trusted, but defense-in-depth)

---

## 5. Threat Scenarios

### 5.1 Scenario 1: Credential Stuffing Attack

**Attacker Profile**: Script kiddie with leaked credential database

**Attack Steps**:
1. Attacker obtains 1M username/password combos from data breach (LinkedIn 2021)
2. Uses automated tool (SentryMBA) to try credentials on `/api/auth/login`
3. Rate limiting blocks IP after 5 failed attempts
4. Attacker rotates through 100 proxy IPs
5. Cloudflare DDoS protection detects pattern, blocks all proxy IPs

**Outcome**: Attack mitigated, 0 accounts compromised

**Controls Effectiveness**:
- ✅ Rate limiting (5 attempts/min per IP): **High** - Slowed attack significantly
- ✅ CAPTCHA after 3 failures: **High** - Blocked automated tools
- ✅ Cloudflare DDoS protection: **High** - Blocked proxy network

**Lessons Learned**:
- Consider CAPTCHA on first login attempt (not just after failures)
- Alert security team when >100 IPs fail login in 1 hour

---

### 5.2 Scenario 2: Gamification Fraud Ring

**Attacker Profile**: Organized fraud ring selling "boosted" accounts

**Attack Steps**:
1. Attackers create 50 fake accounts with disposable emails
2. Use automated script to complete onboarding in <3 minutes each
3. Earn 2,500 points per account (max points)
4. Sell "Platinum Level" accounts on dark web for $50 each

**Detection**:
- Fraud detection flags 48 of 50 accounts (>1500 pts in <3 min)
- 2 accounts slip through (completed in 3.5 minutes, below threshold)

**Response**:
1. Admin reviews flagged accounts in `/admin/fraud-reviews`
2. Notices pattern: All from same IP block, same browser fingerprint
3. Bulk-disables all 50 accounts
4. Adjusts fraud threshold to 1200 pts in <5 min

**Outcome**: Attack detected and mitigated, threshold tuned

**Controls Effectiveness**:
- ✅ Rapid progression detection: **High** - Caught 96% of fraud
- ⚠️ Manual review queue: **Medium** - Required 2 hours of admin time
- ❌ IP-based detection: **Low** - Not implemented (added post-incident)

**Lessons Learned**:
- Implement IP-based fraud scoring (penalize multiple accounts from same IP)
- Add device fingerprinting (FingerprintJS) for better bot detection

---

### 5.3 Scenario 3: Insider Threat (Rogue Admin)

**Attacker Profile**: Disgruntled employee with admin access

**Attack Steps**:
1. Rogue admin logs into `/admin/users`
2. Exports all user data (10,000 beneficiaries) to CSV
3. CSV includes PHI (health questionnaire answers)
4. Admin deletes audit logs to cover tracks
5. Admin leaks data to competitor

**Detection**:
- CloudWatch Logs still contain export event (append-only, admin can't delete)
- Security team notices unusual export at 2 AM (outside business hours)

**Response**:
1. Incident Commander alerts CISO
2. Revoke admin's access immediately
3. Forensic analysis: CSV export contained 10,000 rows, downloaded to personal laptop
4. Legal team notified (HIPAA breach, >500 users affected)
5. HHS and affected users notified within 60 days

**Outcome**: Breach contained, regulatory compliance maintained

**Controls Effectiveness**:
- ✅ Audit logging (CloudWatch): **High** - Detected breach within 12 hours
- ✅ Append-only logs: **High** - Prevented evidence destruction
- ❌ Anomaly detection: **Low** - Not implemented (would have alerted in real-time)
- ❌ Data Loss Prevention (DLP): **Low** - Not implemented (would have blocked CSV export)

**Lessons Learned**:
- Implement DLP to block bulk data exports outside business hours
- Add anomaly detection for unusual admin activity (ML-based)
- Require multi-party approval for bulk exports (2-person rule)

---

## What Could Go Wrong?

### Scenario A: False Positive Fraud Flag

**Risk**: Legitimate user flagged as fraud, can't complete onboarding
**Mitigation**:
- Manual review queue with 24h SLA
- Appeal process (email support@example.com)
- Tunable fraud threshold (adjust based on false positive rate)

### Scenario B: Zero-Day Exploit in Dependency

**Risk**: Critical vulnerability in Laravel or Next.js
**Mitigation**:
- Dependabot auto-updates for security patches
- Subscribe to security mailing lists (Laravel Security, GitHub Security Advisories)
- Virtual patching via WAF (Cloudflare) as temporary fix

### Scenario C: Social Engineering Attack

**Risk**: Attacker convinces support agent to reset MFA for admin account
**Mitigation**:
- Multi-factor verification for support requests (callback to registered phone)
- Audit log of all support actions
- Annual social engineering training for support team

---

## How We'll Know

### Threat Detection Metrics

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Failed Login Rate** | <1% of total logins | CloudWatch Logs | >5% in 1 hour |
| **Fraud Flags per Day** | <5 | Gamification fraud detection | >20 in 24 hours |
| **Anomalous Admin Actions** | 0 | CloudWatch anomaly detection (ML) | Any anomaly detected |
| **Security Scan Failures** | 0 | OWASP ZAP, Trivy | >0 high/critical |
| **Incident Response Time (P0)** | <15 min | PagerDuty SLA | >30 min |

### Security Dashboard (Grafana)

**Panels**:
1. **Authentication Failures** (line graph, 7-day trend)
2. **Fraud Flags** (bar chart, by day)
3. **OWASP ZAP Findings** (gauge, 0 = green)
4. **Dependency Vulnerabilities** (gauge, 0 = green)
5. **Incident Response Times** (histogram, p50/p95/p99)

---

**End of Threat Model**
