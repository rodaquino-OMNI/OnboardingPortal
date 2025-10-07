# Branch Protection Required Checks

**Date:** October 6, 2025  
**Sprint:** 2C Cleanup  
**Purpose:** CI/CD quality gates enforcement

## Required Checks Configuration

Add these checks to branch protection rules for `main` and `develop` branches:

### E2E Testing
- [ ] `Phase 8 E2E Tests / e2e-tests (chromium)`
- [ ] `Phase 8 E2E Tests / e2e-tests (firefox)`
- [ ] `Phase 8 E2E Tests / e2e-summary`

### SDK & Contracts
- [ ] `OpenAPI SDK Freshness Check / check-sdk-freshness`
- [ ] `OpenAPI SDK Freshness Check / validate-routes`

### Frontend Quality
- [ ] `UI Build and Test / build-ui-package`
- [ ] `UI Build and Test / unit-tests`
- [ ] `UI Build and Test / component-tests`
- [ ] `UI Build and Test / type-check`
- [ ] `UI Build and Test / lint`
- [ ] `UI Build and Test / bundle-analysis`

### Backend Quality
- [ ] `CI/CD Pipeline / backend-test`
- [ ] `CI/CD Pipeline / frontend-test`

### Security & Analytics
- [ ] `Security Guards / security-tests`
- [ ] `Analytics Contracts / contract-tests`

## GitHub Settings Path

```
Repository Settings → Branches → Branch protection rules → main
```

### Configuration Steps

1. **Navigate to branch protection:**
   - Settings → Branches
   - Click "Add rule" or edit existing rule
   - Branch name pattern: `main`

2. **Enable required checks:**
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

3. **Select checks:**
   - Search for each check name above
   - Click to add to required list
   - Total: 15 required checks

4. **Additional settings:**
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ⚠️ Allow administrators to bypass (optional)

## Quality Gates Matrix

| Gate | Check | Threshold | Failure Action |
|------|-------|-----------|----------------|
| E2E | Flake rate | <5% | Block merge |
| Coverage | Lines | ≥85% | Block merge |
| Coverage | Functions | ≥85% | Block merge |
| Coverage | Branches | ≥80% | Block merge |
| Coverage | Statements | ≥85% | Block merge |
| Backend | Coverage | ≥70% | Block merge |
| Analytics | Coverage | ≥90% | Block merge |
| SDK | Drift | None | Block merge |
| Routes | Mismatch | None | Block merge |
| TypeScript | Errors | 0 | Block merge |
| ESLint | Errors | 0 | Block merge |
| PHPStan | Level | 5 | Block merge |

## Enforcement Timeline

### Immediate (Sprint 2C)
- E2E CI workflow
- SDK freshness checks
- Route validation
- Coverage enforcement

### Phase 9
- Performance budgets
- Security scanning
- Dependency audits

## Bypass Procedures

### Emergency Hotfixes
1. Create hotfix branch from `main`
2. Apply minimal fix
3. Request admin bypass approval
4. Merge with audit trail
5. Retroactively add tests
6. Create follow-up PR for quality gates

### Documented Exceptions
- Infrastructure changes (CI config updates)
- Dependency bumps (with manual testing)
- Documentation only changes

## Monitoring

### Weekly Review
- Check bypass usage
- Review failed checks patterns
- Identify common blockers
- Adjust thresholds if needed

### Monthly Audit
- Quality metrics trends
- Gate effectiveness analysis
- False positive rate
- Developer experience feedback

## Rollback Plan

If gates cause excessive blocking:

1. **Phase 1:** Convert to warnings (1 week)
2. **Phase 2:** Analyze failure patterns
3. **Phase 3:** Adjust thresholds
4. **Phase 4:** Re-enable as required

## Evidence of Implementation

```bash
# Verify workflows exist
ls -la .github/workflows/
✅ e2e-phase8.yml
✅ openapi-sdk-check.yml
✅ ui-build-and-test.yml
✅ ci-cd.yml

# Verify executable scripts
ls -la scripts/
✅ audit-routes.sh (executable)

# Verify configurations
ls -la omni-portal/backend/
✅ phpunit.xml
```

## Success Criteria

- [x] All 15 checks identified
- [x] Workflows implemented and functional
- [x] Thresholds documented
- [x] Bypass procedures defined
- [x] Monitoring plan established

**Status:** ✅ READY FOR IMPLEMENTATION
