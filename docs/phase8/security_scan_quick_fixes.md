# Security Scan Quick Fixes - Run ID 18289020567

## IMMEDIATE ACTION REQUIRED

**Status**: All failures are configuration issues, NOT security vulnerabilities
**Impact**: Security scans not running properly
**Priority**: P0 - Fix this week

---

## TL;DR - What's Wrong?

The codebase was refactored (commit d58fbf9) moving frontend from `omni-portal/frontend/` to `apps/web/`, but security workflows still reference old paths.

**Result**:
- ✅ Security Guards PASSED (no browser storage, no archive imports, UI purity maintained)
- ❌ NPM audits FAILED (wrong path to package.json)
- ❌ Docker scans FAILED (no Dockerfiles)
- ⚠️ DAST scans SKIPPED (no staging URL configured)

---

## Fix #1: Update NPM Audit Paths (5 minutes)

### File: `.github/workflows/security-scan.yml`

**Line 116** - Change:
```yaml
# FROM:
      - name: Run npm audit for frontend
        working-directory: ./omni-portal/frontend

# TO:
      - name: Run npm audit for frontend
        working-directory: ./apps/web
```

### File: `.github/workflows/security-audit.yml`

**Line 67** - Change:
```yaml
# FROM:
      - name: Run NPM Security Audit (Frontend)
        working-directory: omni-portal/frontend

# TO:
      - name: Run NPM Security Audit (Frontend)
        working-directory: apps/web
```

**Line 76** - Add UI package audit:
```yaml
      - name: Run NPM Security Audit (UI Package)
        working-directory: packages/ui
        run: |
          npm audit --audit-level=moderate --json > npm-audit-ui.json || true
          cat npm-audit-ui.json

      - name: Upload Audit Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-audit-results
          path: |
            omni-portal/backend/composer-audit.json
            apps/web/npm-audit.json
            packages/ui/npm-audit-ui.json
            npm-audit-root.json
```

---

## Fix #2: Update CodeQL Paths (5 minutes)

### File: `.github/codeql/codeql-config.yml`

**Lines 32-38** - Change:
```yaml
# FROM:
paths:
  - omni-portal/backend/app/
  - omni-portal/backend/routes/
  - omni-portal/backend/config/
  - omni-portal/frontend/app/
  - omni-portal/frontend/components/
  - omni-portal/frontend/lib/
  - omni-portal/frontend/hooks/

# TO:
paths:
  - omni-portal/backend/app/
  - omni-portal/backend/routes/
  - omni-portal/backend/config/
  - apps/web/src/app/
  - apps/web/src/components/
  - apps/web/src/lib/
  - apps/web/src/hooks/
  - apps/web/src/containers/
  - packages/ui/src/
```

---

## Fix #3: Disable Docker Scans Temporarily (10 minutes)

No Dockerfiles exist in the codebase. Disable these jobs until containers are needed.

### File: `.github/workflows/security-scan.yml`

**Line 34** - Add `if: false`:
```yaml
  docker-scan:
    name: Docker Image Security Scan
    runs-on: ubuntu-latest
    if: false  # DISABLED: No Dockerfiles present - re-enable when containerizing
    strategy:
      matrix:
        service: [backend, frontend]
```

### File: `.github/workflows/security-audit.yml`

**Line 136** - Add `if: false`:
```yaml
  container-security:
    name: Container Security Analysis
    runs-on: ubuntu-latest
    if: false  # DISABLED: No Dockerfiles present - re-enable when containerizing
    permissions:
      contents: read
      security-events: write
```

### File: `.github/workflows/iac-scan.yml`

**Line 93** - Add `if: false`:
```yaml
  docker-scan:
    name: Docker Security Scan
    runs-on: ubuntu-latest
    if: false  # DISABLED: No Dockerfiles present - re-enable when containerizing
```

---

## Fix #4: Create ZAP Configuration (15 minutes)

DAST scans reference `.zap/rules.tsv` which doesn't exist.

```bash
mkdir -p .zap
```

### File: `.zap/rules.tsv`
```tsv
# ZAP Scanning Rules for AUSTA Onboarding Portal
# Format: RULE_ID	THRESHOLD	[IGNORE_REGEX]

# Ignore static assets
10049	OFF	.*\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf)$

# Healthcare-specific adjustments
10015	MEDIUM	# CSRF detection (handled by Laravel)
10021	MEDIUM	# X-Content-Type-Options
10095	LOW	.*/api/login
10095	LOW	.*/api/register
90029	HIGH	# API rate limiting test
```

### File: `.zap/README.md`
```markdown
# ZAP Security Scanning Configuration

Custom OWASP ZAP rules for security scanning.

## Files
- `rules.tsv` - Alert threshold rules

## Testing Locally
```bash
zap-baseline.py -t https://staging.example.com -c rules.tsv
```
```

---

## Fix #5: Configure GitHub Secrets (When Staging Ready)

### Required Secrets

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Example Value | Purpose |
|-------------|---------------|---------|
| `STAGING_URL` | `https://staging.austa.com.br` | DAST scan target |
| `TEST_TOKEN` | `[generated-token]` | API authentication for security tests |

### Generate TEST_TOKEN (Laravel backend)
```bash
php artisan tinker
>>> $user = App\Models\User::factory()->create(['email' => 'security-test@austa.internal']);
>>> $token = $user->createToken('security-scan', ['read'])->plainText;
>>> echo $token;
```

**Note**: Create limited-permission test user, rotate token monthly.

---

## Verification Commands

After making fixes, test locally:

```bash
# 1. Verify paths exist
test -d apps/web/src && echo "✓ Frontend exists"
test -f apps/web/package.json && echo "✓ Frontend package.json exists"
test -d packages/ui/src && echo "✓ UI package exists"

# 2. Run local audits
cd apps/web && npm audit --audit-level=moderate
cd ../packages/ui && npm audit --audit-level=moderate
cd ../../omni-portal/backend && composer audit

# 3. Validate workflow syntax
yamllint .github/workflows/security-*.yml

# 4. Trigger workflow
git add .github/ .zap/
git commit -m "fix(security): Update security scan paths and disable Docker scans"
git push

# 5. Watch run
gh run watch
```

---

## Expected Outcome After Fixes

### ✅ Should PASS:
- NPM audit (apps/web)
- NPM audit (packages/ui)
- Composer audit
- Trivy filesystem scan
- TruffleHog secrets scan
- CodeQL analysis (full coverage)
- Security Guards (all 4)
- PHI/PII plaintext check
- Checkov IaC scan

### ⏸️ Will SKIP (Temporarily Disabled):
- Docker image scans (no Dockerfiles)
- Container security scans

### ⚠️ May SKIP (Need Configuration):
- DAST scans (need STAGING_URL)
- API security tests (need TEST_TOKEN)
- ZAP full scan (need staging environment)

---

## Estimated Time

| Fix | Time | Priority |
|-----|------|----------|
| Fix #1: NPM paths | 5 min | P0 |
| Fix #2: CodeQL paths | 5 min | P0 |
| Fix #3: Disable Docker | 10 min | P0 |
| Fix #4: ZAP config | 15 min | P1 |
| Fix #5: GitHub secrets | 30 min | P1 (when staging ready) |
| **TOTAL** | **35-65 min** | |

---

## Quick Copy-Paste Commands

### 1. Create ZAP config
```bash
mkdir -p .zap
cat > .zap/rules.tsv << 'EOF'
# ZAP Scanning Rules
10049	OFF	.*\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf)$
10015	MEDIUM
10021	MEDIUM
10095	LOW	.*/api/login
10095	LOW	.*/api/register
90029	HIGH
EOF
```

### 2. Verify structure
```bash
echo "Checking structure..."
ls -d apps/web packages/ui omni-portal/backend
echo "Checking files..."
ls apps/web/package.json packages/ui/package.json omni-portal/backend/composer.json
```

### 3. Test audits locally
```bash
echo "Testing NPM audits..."
(cd apps/web && npm audit --audit-level=moderate)
(cd packages/ui && npm audit --audit-level=moderate)
echo "Testing Composer audit..."
(cd omni-portal/backend && composer audit)
```

### 4. Commit fixes
```bash
git add .github/workflows/security-*.yml
git add .github/codeql/codeql-config.yml
git add .zap/
git commit -m "fix(security): Align security scans with refactored codebase structure

- Update NPM audit paths to apps/web and packages/ui
- Update CodeQL paths to scan actual frontend code
- Temporarily disable Docker scans (no Dockerfiles)
- Add ZAP configuration for DAST scans

Fixes security scan failures in Run ID 18289020567"
git push
```

---

## Troubleshooting

### If npm audit still fails:
```bash
# Check package.json exists
ls -la apps/web/package.json

# Try running manually
cd apps/web && npm ci && npm audit
```

### If CodeQL fails:
```bash
# Verify paths in config
cat .github/codeql/codeql-config.yml | grep -A 10 "^paths:"

# Check files exist
ls apps/web/src/app
ls packages/ui/src
```

### If workflows don't trigger:
```bash
# Check branch protection rules
gh api repos/:owner/:repo/branches/main/protection

# Manually trigger
gh workflow run security-scan.yml
```

---

## Next Steps After Quick Fixes

### Week 2-4:
1. Create Dockerfiles for containerization (if needed)
2. Re-enable Docker security scans
3. Set up staging environment
4. Configure STAGING_URL and TEST_TOKEN secrets

### Monthly:
1. Review security scan results
2. Update dependencies
3. Rotate TEST_TOKEN
4. Review and update ZAP rules

### Quarterly:
1. Full security audit
2. Penetration testing
3. Compliance review (HIPAA/LGPD)
4. Update security documentation

---

## Questions?

See full investigation report: `docs/phase8/security_scan_investigation.md`

**Contact**:
- DevOps issues: devops@austa.com.br
- Security concerns: security@austa.com.br

---

*Last Updated: 2025-10-21*
