# OnboardingPortal Codebase Analysis - Action Checklist

**Generated:** 2025-10-22  
**Overall Health:** 62% → Target: 95%  
**Total Issues:** 38 (8 P0, 12 P1, 18 P2)

---

## CRITICAL BLOCKERS - DO IMMEDIATELY (P0)

### 1. Missing Model Definitions
- [ ] Create `omni-portal/backend/app/Models/QuestionnaireTemplate.php`
  - [ ] Include UUID primary key
  - [ ] Add necessary relationships
  - [ ] Create QuestionnaireTemplateFactory
- [ ] Create `omni-portal/backend/app/Models/HealthQuestionnaire.php`
  - [ ] Include UUID primary key
  - [ ] Add necessary relationships
  - [ ] Create HealthQuestionnaireFactory
- **Status:** Impact = Tests will fail with "Class not found"
- **Estimated Effort:** 1-2 hours

### 2. Fix Frontend Path References in Workflows
- [ ] Fix `.github/workflows/ci-cd.yml`
  - [ ] Line 103: `cache-dependency-path: omni-portal/frontend/package-lock.json` → `apps/web/package-lock.json`
  - [ ] Line 106: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 110: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 114: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 118: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 122: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 129: `./omni-portal/frontend/coverage/lcov.info` → `./apps/web/coverage/lcov.info`

- [ ] Fix `.github/workflows/docker-ci-cd.yml`
  - [ ] Line 174: `cache-dependency-path: omni-portal/frontend/package-lock.json` → `apps/web/package-lock.json`
  - [ ] Line 177: `omni-portal/frontend` → `apps/web`
  - [ ] Line 181: `omni-portal/frontend` → `apps/web`
  - [ ] Line 185: `omni-portal/frontend` → `apps/web`
  - [ ] Line 189: `omni-portal/frontend` → `apps/web`
  - [ ] Line 196: `omni-portal/frontend` → `apps/web`
  - [ ] Line 205: `omni-portal/frontend/coverage/lcov.info` → `apps/web/coverage/lcov.info`
  - [ ] Line 302: `./omni-portal/frontend` → `./apps/web`
  - [ ] Line 303: `./omni-portal/frontend/Dockerfile` → `./apps/web/Dockerfile`
  - [ ] Line 516: `omni-portal/frontend` → `apps/web`
  - [ ] Line 522: `omni-portal/frontend` → `apps/web`

- [ ] Fix `.github/workflows/e2e-phase8.yml`
  - [ ] Line 7: `'omni-portal/frontend/**'` → `'apps/web/**'`
  - [ ] Line 61: `cd omni-portal/frontend` → `cd apps/web`

- [ ] Fix `.github/workflows/monolith.yml`
  - [ ] Line 58: `omni-portal/frontend/package-lock.json` → `apps/web/package-lock.json`
  - [ ] Line 69: `cd omni-portal/frontend` → `cd apps/web`
  - [ ] Lines 73, 93, 96, 99, etc: All `omni-portal/frontend` → `apps/web`

- **Status:** 52+ references across 4 files
- **Estimated Effort:** 30 minutes

### 3. Create AuthController Tests
- [ ] Create `omni-portal/backend/tests/Feature/Api/AuthControllerTest.php`
- [ ] Test Cases:
  - [ ] test_user_can_login_with_valid_credentials
  - [ ] test_user_cannot_login_with_invalid_credentials
  - [ ] test_login_returns_sanctum_token
  - [ ] test_user_can_logout
  - [ ] test_authenticated_user_can_get_profile
  - [ ] test_unauthenticated_user_cannot_access_protected_routes
- **Status:** NO TEST - Core security feature
- **Estimated Effort:** 2-3 hours

### 4. Create MFAController Tests
- [ ] Create `omni-portal/backend/tests/Feature/Api/MFAControllerTest.php`
- [ ] Test Cases:
  - [ ] test_user_can_request_mfa_setup
  - [ ] test_qr_code_generation_works
  - [ ] test_user_can_verify_mfa_secret
  - [ ] test_user_can_submit_totp_code
  - [ ] test_invalid_totp_code_rejected
  - [ ] test_recovery_codes_generated
  - [ ] test_recovery_code_can_bypass_mfa
- **Status:** NO TEST - Security critical feature
- **Estimated Effort:** 2-3 hours

---

## HIGH PRIORITY ISSUES (P1)

### 5. Create Registration Flow Tests
- [ ] Create `omni-portal/backend/tests/Feature/Api/RegistrationFlowControllerTest.php`
  - [ ] test_user_can_start_registration
  - [ ] test_email_verification_required
  - [ ] test_user_cannot_register_with_existing_email
  - [ ] test_user_can_complete_registration
  - [ ] test_invalid_data_rejected
- [ ] Create `omni-portal/backend/tests/Feature/Api/OnboardingControllerTest.php`
  - [ ] test_user_can_view_onboarding_steps
  - [ ] test_user_can_complete_minimal_profile
  - [ ] test_profile_completion_validates_data
  - [ ] test_onboarding_completion_triggers_event

**Estimated Effort:** 3-4 hours

### 6. Create MFAService Tests
- [ ] Create `omni-portal/backend/tests/Unit/Services/MFAServiceTest.php`
  - [ ] test_generate_secret_creates_valid_secret
  - [ ] test_get_qr_code_returns_image
  - [ ] test_verify_token_validates_totp
  - [ ] test_generate_recovery_codes
  - [ ] test_verify_recovery_code

**Estimated Effort:** 2-3 hours

### 7. Update Node.js Versions
- [ ] `.github/workflows/docker-ci-cd.yml`
  - [ ] Line 172: Change `'18.19.0'` to `'20'`
  - [ ] Line 510: Change `'18.19.0'` to `'20'`
- [ ] `.github/workflows/security-audit.yml`
  - [ ] Line 57: Change `'18.19.0'` to `'20'`
- [ ] `.github/workflows/security-scan.yml`
  - [ ] Line 113: Change `'18'` to `'20'`

**Estimated Effort:** 15 minutes

### 8. Create Gamification Tests
- [ ] Create `omni-portal/backend/tests/Feature/Api/GamificationControllerTest.php`
  - [ ] test_user_can_view_points_balance
  - [ ] test_user_can_view_badges
  - [ ] test_user_can_view_leaderboard
  - [ ] test_points_earned_after_actions
  - [ ] test_badges_awarded_correctly

**Estimated Effort:** 2-3 hours

---

## MEDIUM PRIORITY ISSUES (P2)

### 9. Create Additional Service Tests
- [ ] Create `omni-portal/backend/tests/Unit/Services/HealthQuestionnaireMetricsTest.php`
- [ ] Create `omni-portal/backend/tests/Unit/Modules/Health/Services/ExportServiceTest.php`
- [ ] Verify `omni-portal/backend/tests/Unit/DatabaseQueryValidatorTest.php` exists and is comprehensive

**Estimated Effort:** 2-3 hours

### 10. Create Model Factories
- [ ] Create `omni-portal/backend/database/factories/AuditLogFactory.php`
- [ ] Create `omni-portal/backend/database/factories/PointsTransactionFactory.php`
- [ ] Create `omni-portal/backend/database/factories/QuestionnaireFactory.php`
- [ ] Create `omni-portal/backend/database/factories/QuestionnaireResponseFactory.php`

**Estimated Effort:** 1-2 hours

### 11. Create Additional Controller Tests
- [ ] Create `omni-portal/backend/tests/Feature/Api/SliceBDocumentsControllerTest.php`
  - [ ] test_user_can_upload_document
  - [ ] test_document_validation
  - [ ] test_user_can_retrieve_documents
  - [ ] test_user_cannot_access_others_documents

**Estimated Effort:** 2-3 hours

---

## WORKFLOW STATUS REFERENCE

### Workflows with Issues
| Workflow | Issue Type | Lines | Severity |
|----------|-----------|-------|----------|
| ci-cd.yml | Old frontend path | 103, 106, 110, 114, 118, 122, 129 | P0 |
| docker-ci-cd.yml | Old frontend path + Node 18 | 172, 174, 177, 181, 185, 189, 196, 205, 302, 303, 510, 516, 522 | P0/P1 |
| e2e-phase8.yml | Old frontend path | 7, 61 | P0 |
| monolith.yml | Old frontend path | Multiple | P1 |
| security-audit.yml | Node 18 | 57 | P1 |
| security-scan.yml | Node 18 | 113 | P1 |

### Workflows OK
- analytics-contracts.yml
- analytics-migration-drift.yml
- dast-scan.yml
- iac-scan.yml
- openapi-sdk-check.yml
- phase-4-quality-gates.yml
- security-guards.yml
- security-plaintext-check.yml
- ui-build-and-test.yml

---

## PROGRESS TRACKING

### Phase 1: Critical Fixes (Target: Today - 6-8 hours)
- [ ] Missing models created
- [ ] Workflow paths fixed
- [ ] Node versions updated
- [ ] AuthController tests created
- [ ] MFAController tests created

### Phase 2: High Priority (Target: This Week - 8-10 hours)
- [ ] RegistrationFlowController tests created
- [ ] OnboardingController tests created
- [ ] MFAService tests created
- [ ] GamificationController tests created
- [ ] Additional service tests created

### Phase 3: Medium Priority (Target: Next Sprint - 4-6 hours)
- [ ] Model factories created
- [ ] SliceBDocumentsController tests created
- [ ] Documentation updated
- [ ] Process improvements documented

---

## COVERAGE TARGETS

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| Controllers | 25% (2/8) | 100% (8/8) | 75% |
| Services | 67% (8/12) | 100% (12/12) | 33% |
| Factories | 43% (3/7) | 100% (7/7) | 57% |
| **Overall** | **62%** | **95%** | **33%** |

---

## VERIFICATION CHECKLIST

Once all fixes are complete, verify:
- [ ] All 31 test files run successfully
- [ ] No "Class not found" errors
- [ ] All workflows pass with new paths
- [ ] Node 20 properly configured in all workflows
- [ ] Test coverage reports show improvements
- [ ] No hardcoded paths in workflow files
- [ ] Factories work with all models
- [ ] All controllers have minimum test coverage

---

**Document Last Updated:** 2025-10-22  
**Status:** Ready for implementation
