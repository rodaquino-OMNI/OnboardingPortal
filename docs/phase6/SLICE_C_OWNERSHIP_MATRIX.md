# Slice C: Health Questionnaire - Phase 6 Ownership Matrix

**Document Version:** 1.0
**Created:** 2025-10-06
**Last Updated:** 2025-10-06
**Status:** Active

---

## Role Assignments

### Release Engineer (RE)
**Primary Owner:** [Name TBD]
**Backup:** [Name TBD]
**Responsibilities:**
- Orchestrate CI/branch protections
- Confirm all required checks pass
- Coordinate staged rollouts (20%→50%→100%)
- Manage feature flag `sliceC_health_questionnaire`
- Execute rollback procedures if stop conditions trigger

**Deliverables:**
- SLICE_C_PREDEPLOY_CHECKS.md
- STAGING_CANARY_EVIDENCE.md
- PROD_CANARY_EVIDENCE.md

**Contact:**
- Slack: #health-questionnaire-deploy
- PagerDuty: health-deploy-oncall
- Email: [email]

---

### DevOps Lead (DO)
**Primary Owner:** [Name TBD]
**Backup:** [Name TBD]
**Responsibilities:**
- Activate Prometheus/Grafana dashboards
- Configure AlertManager routing (PagerDuty/Slack/Email/SMS)
- Validate rollback procedures (<20s requirement)
- Own SLOs: p95 <500ms, error <1%, ingestion ≥99.5%
- Maintain incident runbooks

**Deliverables:**
- MONITORING_ACTIVATION_EVIDENCE.md
- POST_DEPLOY_VALIDATION_REPORT.md (co-owned with SEC/QA)

**SLO Accountability:**
| Metric | Target | Owner |
|--------|--------|-------|
| p95 latency | <500ms | DO |
| Error rate | <1% | DO |
| Analytics ingestion | ≥99.5% | DO |
| PHI guard violations | 0 | SEC |

**Contact:**
- Slack: #health-questionnaire-ops
- PagerDuty: health-ops-oncall
- Email: [email]

---

### Security Officer / DPO (SEC)
**Primary Owner:** [Name TBD - DPO]
**Backup:** [Name TBD - CISO]
**Responsibilities:**
- Enforce PHI guards (PHIEncryptionGuard, AnalyticsPayloadValidator, ResponseAPIGuard)
- DPIA adherence validation
- Approve privacy evidence pack
- Audit DSAR endpoints (access, erasure, portability)
- Monitor `health_phi_guard_violations_total` (must remain 0)
- PII detector validation (count = 0 throughout rollout)

**Deliverables:**
- PHI Guard Validation Report (pre-deploy)
- DSAR Endpoint Audit (pre-deploy)
- DPO/Compliance Sign-off (post-deploy)

**Stop Condition Authority:**
- SEC can HALT deployment if ANY plaintext PHI detected
- SEC can HALT if analytics schema failure >0.3% of events

**Contact:**
- Slack: #security-compliance
- Email: dpo@austa.com, ciso@austa.com
- Escalation: CTO, Legal Counsel

---

### QA / E2E Lead (QA)
**Primary Owner:** [Name TBD]
**Backup:** [Name TBD]
**Responsibilities:**
- Execute unit/component/E2E/a11y test suites
- Manage flake quarantine (no flaky tests in required checks)
- Publish test artifacts (coverage reports, Playwright HTML reports)
- Validate coverage thresholds: FE ≥85%, BE ≥85%, critical ≥90%
- Run accessibility smoke tests during staging canary
- Mutation testing coordination (MSI ≥60% or waiver approval)

**Deliverables:**
- Test Coverage Reports (HTML + JSON)
- Playwright E2E Reports
- Accessibility Audit (WCAG 2.1 AA)
- Mutation Testing Report

**Quality Gates:**
| Gate | Threshold | Blocker? |
|------|-----------|----------|
| Frontend coverage | ≥85% | Yes |
| Backend coverage | ≥85% | Yes |
| Critical paths | ≥90% | Yes |
| Mutation MSI | ≥60% | Yes (waivable) |
| A11y violations | 0 | Yes |

**Contact:**
- Slack: #health-questionnaire-qa
- Email: [email]

---

### Lead Architect (ARCH)
**Primary Owner:** [Name TBD]
**Backup:** [Name TBD]
**Responsibilities:**
- Verify ADR-001 through ADR-004 compliance
- Contract/spec parity validation (OpenAPI drift = 0)
- Approve architectural variances (if any)
- UI purity enforcement (no orchestration/network/storage in @austa/ui)
- Review module boundaries and immutable audit logs

**ADR Compliance Checklist:**
- [ ] ADR-001: Modular boundaries intact, thin controllers
- [ ] ADR-002: httpOnly cookies, MFA for privileged, zero browser PHI storage
- [ ] ADR-003: UI package purity, orchestration in app layer only
- [ ] ADR-004: AES-256-GCM encryption, redacted risk scores, no PHI in logs

**Deliverables:**
- ADR Compliance Report (pre-deploy)
- Variance Approval Log (if needed)

**Contact:**
- Slack: #architecture-review
- Email: [email]

---

### Product / UX (PM/UX)
**Primary Owner:** [Name TBD - PM]
**Co-Owner:** [Name TBD - UX]
**Responsibilities:**
- Validate abandonment metrics (≤30% threshold)
- Sign off on UX/a11y outcomes
- Monitor user journey completion rates
- Approve progressive disclosure flows
- Coordinate user communications during rollout

**Success Metrics:**
| Metric | Target | Owner |
|--------|--------|-------|
| Abandonment rate | ≤30% | PM/UX |
| Journey completion | ≥70% | PM/UX |
| A11y compliance | WCAG 2.1 AA | UX |

**Deliverables:**
- UX Validation Report
- User Journey Metrics Dashboard

**Contact:**
- Slack: #product-health
- Email: [email]

---

## Escalation Matrix

### Critical Issues (PHI violation, stop condition triggered)
1. **Immediate:** RE executes rollback (<20s)
2. **Alert:** SEC notified via PagerDuty (1 min)
3. **Escalate:** CTO + CISO + DPO conference call (5 min)
4. **Document:** Incident timeline captured (15 min)
5. **RCA:** Root cause analysis within 24h

### High Priority (SLO breach, test failures)
1. **Alert:** DO + RE notified (Slack)
2. **Assess:** 15-minute triage call
3. **Escalate:** If unresolved in 1 hour → CTO

### Medium Priority (elevated abandonment, minor performance degradation)
1. **Alert:** PM/UX + DO notified
2. **Monitor:** 4-hour observation window
3. **Escalate:** If trend continues → daily standup

---

## Decision Authority

| Decision Type | Authority | Required Approvals |
|---------------|-----------|-------------------|
| **Proceed to Staging Canary** | RE | ARCH (ADR check), SEC (PHI check), QA (coverage) |
| **Staging Stage A→B** | RE + DO | Metrics green |
| **Staging Stage B→C** | RE + DO | Metrics green |
| **Production Go/No-Go** | CTO | CISO, DPO, ARCH, Product, DevOps |
| **Production Stage 1→2** | RE + DO + SEC | SLOs green, PHI guards 0 |
| **Production Stage 2→3** | RE + DO + SEC | SLOs green, PHI guards 0 |
| **Emergency Rollback** | RE or DO | None (execute immediately) |
| **Mutation Testing Waiver** | ARCH | CTO, time-boxed expiry required |

---

## Communication Channels

| Channel | Purpose | Members |
|---------|---------|---------|
| `#health-questionnaire-deploy` | Deployment coordination | RE, DO, SEC, QA, ARCH |
| `#health-questionnaire-ops` | Operations/monitoring | DO, RE, SEC |
| `#health-questionnaire-qa` | Testing/quality | QA, RE, ARCH |
| `#security-compliance` | PHI/compliance issues | SEC, DPO, CISO, Legal |
| `#architecture-review` | ADR compliance | ARCH, RE, Senior Devs |
| `#product-health` | Product metrics/UX | PM, UX, RE |

**War Room (Incident):** `#incident-sliceC-health` (created on-demand)

---

## Sign-off Record

| Role | Name | Acknowledgment | Date |
|------|------|----------------|------|
| Release Engineer | [Name] | [ ] | YYYY-MM-DD |
| DevOps Lead | [Name] | [ ] | YYYY-MM-DD |
| Security/DPO | [Name] | [ ] | YYYY-MM-DD |
| QA Lead | [Name] | [ ] | YYYY-MM-DD |
| Lead Architect | [Name] | [ ] | YYYY-MM-DD |
| Product Manager | [Name] | [ ] | YYYY-MM-DD |
| UX Lead | [Name] | [ ] | YYYY-MM-DD |

**Next Review Date:** 2025-10-13 (7 days post-deployment)
