# Security Scan Remediation Checklist
## Run ID: 18289020567

**Status**: In Progress
**Created**: 2025-10-21
**Target Completion**: 2025-10-28

---

## Priority 0: Critical Fixes (Complete This Week)

### ✅ Investigation Complete
- [x] Analyzed all 6 security workflow files
- [x] Identified root causes (structural mismatch post-refactoring)
- [x] Confirmed NO actual security vulnerabilities
- [x] Created investigation report
- [x] Created quick fixes guide
- [x] Created remediation checklist

### 🔧 Code Changes Required

#### [ ] Fix 1.1: Update NPM Audit Paths
**Owner**: DevOps Team
**Effort**: 5 minutes
**Files**:
- [ ] `.github/workflows/security-scan.yml` (line 116)
  - Update `working-directory: ./omni-portal/frontend` → `./apps/web`
- [ ] `.github/workflows/security-audit.yml` (line 67)
  - Update `working-directory: omni-portal/frontend` → `apps/web`
- [ ] `.github/workflows/security-audit.yml` (after line 70)
  - Add UI package audit job for `packages/ui`
- [ ] `.github/workflows/security-audit.yml` (line 82-85)
  - Update artifact paths to include `apps/web/` and `packages/ui/`

**Verification**:
```bash
# Test locally
cd apps/web && npm audit --audit-level=moderate
cd ../packages/ui && npm audit --audit-level=moderate
```

**Acceptance Criteria**:
- [ ] NPM audit runs against `apps/web/`
- [ ] NPM audit runs against `packages/ui/`
- [ ] No path-related errors in workflow logs

---

#### [ ] Fix 1.2: Update CodeQL Configuration
**Owner**: Security Team
**Effort**: 5 minutes
**Files**:
- [ ] `.github/codeql/codeql-config.yml` (lines 32-38)
  - Update frontend paths from `omni-portal/frontend/` to `apps/web/src/`
  - Add `packages/ui/src/` path
  - Keep backend paths unchanged

**Verification**:
```bash
# Verify paths exist
test -d apps/web/src/app && echo "✓ Path exists"
test -d apps/web/src/components && echo "✓ Path exists"
test -d packages/ui/src && echo "✓ Path exists"
```

**Acceptance Criteria**:
- [ ] CodeQL scans `apps/web/src/` directory
- [ ] CodeQL scans `packages/ui/src/` directory
- [ ] CodeQL analysis completes without path errors
- [ ] Security findings include frontend code

---

#### [ ] Fix 1.3: Disable Docker Security Scans
**Owner**: DevOps Team
**Effort**: 10 minutes
**Rationale**: No Dockerfiles present; re-enable when containerizing

**Files**:
- [ ] `.github/workflows/security-scan.yml` (line 34)
  - Add `if: false` to `docker-scan` job
  - Add comment explaining why disabled
- [ ] `.github/workflows/security-audit.yml` (line 136)
  - Add `if: false` to `container-security` job
  - Add comment explaining why disabled
- [ ] `.github/workflows/iac-scan.yml` (line 93)
  - Add `if: false` to `docker-scan` job
  - Add comment explaining why disabled

**Comment Template**:
```yaml
if: false  # DISABLED: No Dockerfiles present in codebase. Re-enable when containerizing.
```

**Acceptance Criteria**:
- [ ] Docker scan jobs are skipped (not failed)
- [ ] Workflow logs show "Job skipped" for Docker scans
- [ ] No Docker-related errors in workflow output

---

### 📋 Testing & Validation

#### [ ] Local Testing Before Commit
**Owner**: Developer implementing fixes
**Checklist**:
- [ ] Validate YAML syntax: `yamllint .github/workflows/security-*.yml`
- [ ] Verify paths exist (see commands in quick fixes guide)
- [ ] Run local npm audits successfully
- [ ] Run local composer audit successfully
- [ ] Review git diff for unintended changes

#### [ ] Git Commit
**Owner**: Developer implementing fixes
**Tasks**:
- [ ] Stage workflow changes: `git add .github/workflows/`
- [ ] Stage CodeQL config: `git add .github/codeql/`
- [ ] Create descriptive commit message (template below)
- [ ] Push to feature branch
- [ ] Create pull request

**Commit Message Template**:
```
fix(security): Align security scans with refactored codebase structure

- Update NPM audit paths from omni-portal/frontend/ to apps/web/
- Add NPM audit for packages/ui/ package
- Update CodeQL paths to scan actual frontend code locations
- Temporarily disable Docker scans (no Dockerfiles present)

Root Cause: Commit d58fbf9 refactored frontend location but security
workflows were not updated to reflect new structure.

Fixes: Security scan failures in GitHub Actions Run ID 18289020567

Testing:
- Verified paths exist locally
- Ran npm audit in apps/web/ and packages/ui/ successfully
- Ran composer audit in omni-portal/backend/ successfully
- Validated YAML syntax

References: docs/phase8/security_scan_investigation.md
```

- [ ] Commit created
- [ ] Pushed to remote
- [ ] PR created and linked

#### [ ] CI/CD Validation
**Owner**: DevOps Team
**Tasks**:
- [ ] Trigger security-scan.yml workflow
- [ ] Monitor workflow execution
- [ ] Verify npm-audit job completes successfully
- [ ] Verify CodeQL job completes successfully
- [ ] Verify Docker jobs are skipped (not failed)
- [ ] Review security scan results in GitHub Security tab

**Success Metrics**:
- [ ] 0 path-related errors
- [ ] 0 Docker-related failures (jobs should skip)
- [ ] NPM audit completes for both apps/web and packages/ui
- [ ] CodeQL analysis includes frontend files

---

## Priority 1: High Priority (Complete Within 1 Week)

### 🔧 Configuration Files

#### [ ] Fix 2.1: Create ZAP Configuration
**Owner**: Security Team
**Effort**: 15 minutes
**Tasks**:
- [ ] Create `.zap/` directory
- [ ] Create `.zap/rules.tsv` with baseline rules
- [ ] Create `.zap/README.md` with documentation
- [ ] Test ZAP rules locally (if possible)
- [ ] Commit and push

**Files to Create**:
```bash
mkdir -p .zap
# Create rules.tsv (see quick fixes guide)
# Create README.md (see quick fixes guide)
```

**Acceptance Criteria**:
- [ ] `.zap/rules.tsv` exists
- [ ] `.zap/README.md` documents rules
- [ ] DAST workflow references correct path
- [ ] No file-not-found errors in DAST workflow

---

#### [ ] Fix 2.2: Configure GitHub Secrets
**Owner**: DevOps Lead / Security Team
**Effort**: 30 minutes
**Dependencies**: Staging environment must be available

**Secrets to Configure**:
1. [ ] **STAGING_URL**
   - Navigate to: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `STAGING_URL`
   - Value: `https://staging.austa.com.br` (or actual staging URL)
   - Verify: Run DAST workflow and check logs

2. [ ] **TEST_TOKEN**
   - Generate token from staging backend (see guide)
   - Add as repository secret
   - Set expiration: 90 days
   - Document token rotation schedule

**Token Generation**:
```bash
# On staging server
php artisan tinker
>>> $user = App\Models\User::factory()->create([
...   'email' => 'security-test@austa.internal',
...   'name' => 'Security Scanner',
... ]);
>>> $token = $user->createToken('security-scan', ['read'])->plainText;
>>> echo $token;
```

**Documentation**:
- [ ] Document token creation date
- [ ] Set calendar reminder for rotation (monthly)
- [ ] Document test user credentials in secure location
- [ ] Add token to password manager / secrets vault

**Acceptance Criteria**:
- [ ] STAGING_URL secret exists and is valid
- [ ] TEST_TOKEN secret exists and authenticates successfully
- [ ] DAST scans run against staging environment
- [ ] API security tests authenticate properly
- [ ] No "secret not found" errors in logs

**If Staging Not Ready**:
- [ ] Document as "Blocked - awaiting staging environment"
- [ ] Create ticket to track staging setup
- [ ] Set reminder to configure secrets once staging is live

---

## Priority 2: Medium Priority (Complete Within 1 Month)

### 🔧 Dependency Management

#### [ ] Fix 3.2: Review Composer Dependencies
**Owner**: Backend Team Lead
**Effort**: 2 hours
**Tasks**:
- [ ] Review current `composer.json` (only 3 runtime dependencies)
- [ ] Identify missing production packages
- [ ] Add recommended Laravel packages (see investigation report)
- [ ] Test locally after adding dependencies
- [ ] Run `composer audit` to verify no vulnerabilities
- [ ] Update workflow if needed

**Recommended Additions**:
```json
{
  "require": {
    "php": "^8.2",
    "laravel/framework": "^11.0",
    "laravel/sanctum": "^4.0",
    "laravel/tinker": "^2.8",          // REPL for debugging
    "predis/predis": "^2.0",           // Redis support
    "guzzlehttp/guzzle": "^7.5"        // HTTP client
  },
  "require-dev": {
    "phpunit/phpunit": "^12.4",
    "mockery/mockery": "^1.6",
    "fakerphp/faker": "^1.23",
    "laravel/pint": "^1.0",            // Code formatting
    "nunomaduro/larastan": "^2.0",     // Static analysis
    "phpstan/phpstan": "^1.10"         // PHPStan
  }
}
```

**Acceptance Criteria**:
- [ ] Composer.json includes necessary production packages
- [ ] `composer audit` runs successfully
- [ ] No high/critical vulnerabilities reported
- [ ] Application functions correctly with new dependencies

---

#### [ ] Fix 3.3: Enhance Composer Audit Workflow
**Owner**: DevOps Team
**Effort**: 15 minutes
**Tasks**:
- [ ] Update `security-audit.yml` to audit both prod and dev dependencies
- [ ] Upload both audit reports as artifacts
- [ ] Test workflow runs successfully

**File**: `.github/workflows/security-audit.yml` (line 59-64)

**Acceptance Criteria**:
- [ ] Both production and dev dependencies audited
- [ ] Separate artifacts for prod vs dev audit results
- [ ] More comprehensive security coverage

---

### 🐳 Container Security (Optional - Only if Containerizing)

#### [ ] Fix 3.1: Create Production Dockerfiles
**Owner**: DevOps Team
**Effort**: 4-6 hours
**Status**: OPTIONAL - Only implement if containerization is planned

**Tasks**:
- [ ] Create `omni-portal/backend/Dockerfile` (see investigation report for template)
- [ ] Create `apps/web/Dockerfile` (see investigation report for template)
- [ ] Test Docker builds locally
- [ ] Verify applications run in containers
- [ ] Push test containers to registry
- [ ] Re-enable Docker security scan jobs
- [ ] Run full security pipeline

**Acceptance Criteria**:
- [ ] Backend Dockerfile builds successfully
- [ ] Frontend Dockerfile builds successfully
- [ ] Containers pass Trivy security scans
- [ ] Applications function correctly in containers
- [ ] Docker security scan jobs re-enabled and passing

**Decision Point**:
- [ ] **YES - Containerizing**: Proceed with Dockerfile creation
- [ ] **NO - Not containerizing**: Mark as "Not Applicable" and leave Docker scans disabled

---

## Monitoring & Maintenance

### 📊 Ongoing Monitoring

#### [ ] Set Up Security Scan Monitoring
**Owner**: DevOps Lead
**Tasks**:
- [ ] Configure Slack/email notifications for security scan failures
- [ ] Create security dashboard (GitHub Projects or similar)
- [ ] Document escalation procedures
- [ ] Set up weekly security scan reviews

**Notification Example**:
```yaml
# Add to security-audit.yml security-report job
- name: Notify on Failure
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -H 'Content-Type: application/json' \
      -d '{"text":"🔒 Security scan failed - Run ${{ github.run_id }}"}'
```

---

### 📅 Regular Reviews

#### [ ] Weekly Tasks
**Owner**: DevOps Team
- [ ] Review security scan results
- [ ] Triage new vulnerabilities
- [ ] Update dependencies if needed

#### [ ] Monthly Tasks
**Owner**: Security Team
- [ ] Rotate TEST_TOKEN secret
- [ ] Review and update ZAP rules
- [ ] Update security documentation
- [ ] Review this remediation checklist

#### [ ] Quarterly Tasks
**Owner**: Security Team + Management
- [ ] Full security audit
- [ ] Penetration testing
- [ ] HIPAA/LGPD compliance review
- [ ] Third-party security assessment

---

## Success Criteria

### ✅ P0 Fixes Complete When:
- [ ] All npm audit jobs run successfully against correct paths
- [ ] CodeQL scans all frontend and backend code
- [ ] Docker scan jobs are disabled (not failing)
- [ ] Security scan workflow completes without path errors
- [ ] GitHub Security tab shows results for all enabled scans

### ✅ P1 Fixes Complete When:
- [ ] ZAP configuration exists and is used by DAST scans
- [ ] GitHub secrets configured (or documented as blocked)
- [ ] DAST scans run against staging (if available)
- [ ] API security tests authenticate successfully (if staging available)

### ✅ P2 Fixes Complete When:
- [ ] Composer dependencies reviewed and updated
- [ ] Composer audit scans both prod and dev dependencies
- [ ] Decision made on containerization (yes/no)
- [ ] If containerizing: Dockerfiles created and scans enabled

### ✅ Project Complete When:
- [ ] All enabled security scans pass
- [ ] No configuration-related failures
- [ ] Monitoring and alerting in place
- [ ] Documentation updated
- [ ] Team trained on new workflow paths

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation | Owner |
|------|--------|------------|------------|-------|
| Fixes introduce new bugs | High | Low | Thorough testing before merge | DevOps |
| Staging env not available | Medium | Medium | Document as blocked, proceed with other fixes | DevOps Lead |
| Dockerfiles cause build failures | Medium | Medium | Only implement if containerization needed | DevOps |
| New vulnerabilities found post-fix | High | Low | Have remediation process ready | Security |
| Team unfamiliar with new paths | Low | Medium | Update documentation, conduct training | Tech Lead |

---

## Communication Plan

### Internal Communication

#### [ ] Notify Development Team
**When**: After P0 fixes committed
**Medium**: Slack #engineering channel
**Message Template**:
```
🔒 Security Scan Fixes Deployed

We've updated security workflows to match our new codebase structure.

What changed:
- NPM audits now scan apps/web/ and packages/ui/
- CodeQL now covers all frontend code
- Docker scans temporarily disabled (no containers yet)

Impact: Better security coverage, fewer false failures

Docs: docs/phase8/security_scan_investigation.md
Questions: #security channel
```

#### [ ] Notify Security Team
**When**: After all P0/P1 fixes complete
**Medium**: Email
**Include**: Investigation report, remediation status, next steps

#### [ ] Notify Management
**When**: After validation complete
**Medium**: Weekly status report
**Include**: Summary of findings (no actual vulnerabilities), fixes implemented, ongoing monitoring plan

---

## Documentation Updates

### [ ] Update Security Documentation
**Owner**: Security Team
**Tasks**:
- [ ] Update security scanning runbook with new paths
- [ ] Document ZAP configuration
- [ ] Document GitHub secrets management
- [ ] Update onboarding docs for new developers

### [ ] Update DevOps Documentation
**Owner**: DevOps Team
**Tasks**:
- [ ] Update CI/CD workflow documentation
- [ ] Document security scan troubleshooting
- [ ] Update architecture diagrams with current structure

---

## Lessons Learned

### [ ] Post-Implementation Review
**When**: 1 week after P0 fixes complete
**Attendees**: DevOps, Security, Tech Lead
**Agenda**:
- [ ] Review what went well
- [ ] Review what could be improved
- [ ] Document lessons learned
- [ ] Update processes to prevent similar issues

**Questions to Address**:
1. How can we ensure workflows are updated during refactoring?
2. Should we add tests for workflow configuration?
3. Can we automate path validation?
4. What early warning signs did we miss?

---

## Appendix: Quick Commands

### Verify Fixes
```bash
# Check paths
test -d apps/web && echo "✓ Frontend path exists"
test -f apps/web/package.json && echo "✓ Frontend package.json exists"
test -d packages/ui && echo "✓ UI package exists"

# Test audits
cd apps/web && npm audit --audit-level=moderate
cd ../packages/ui && npm audit --audit-level=moderate
cd ../../omni-portal/backend && composer audit

# Validate YAML
yamllint .github/workflows/security-*.yml
```

### Trigger Workflows
```bash
# Manually trigger security scan
gh workflow run security-scan.yml --ref $(git branch --show-current)

# Watch workflow run
gh run watch

# View latest run
gh run list --workflow=security-scan.yml --limit 1
```

### View Security Results
```bash
# List security advisories
gh api /repos/:owner/:repo/code-scanning/alerts

# Download artifacts from run
gh run download RUN_ID

# View SARIF results
gh api /repos/:owner/:repo/code-scanning/sarifs/SARIF_ID
```

---

## Sign-Off

### P0 Fixes (Critical)
- [ ] **Implemented By**: _________________ Date: _________
- [ ] **Reviewed By**: _________________ Date: _________
- [ ] **Tested By**: _________________ Date: _________
- [ ] **Approved By**: _________________ Date: _________

### P1 Fixes (High)
- [ ] **Implemented By**: _________________ Date: _________
- [ ] **Reviewed By**: _________________ Date: _________
- [ ] **Approved By**: _________________ Date: _________

### P2 Fixes (Medium)
- [ ] **Implemented By**: _________________ Date: _________
- [ ] **Reviewed By**: _________________ Date: _________
- [ ] **Approved By**: _________________ Date: _________

---

**Document Status**: Living Document - Update as remediation progresses
**Next Review**: Weekly until complete, then quarterly
**Version**: 1.0
**Last Updated**: 2025-10-21

---

*End of Remediation Checklist*
