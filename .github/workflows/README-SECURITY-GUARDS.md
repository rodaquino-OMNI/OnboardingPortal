# Sprint 2A Security Guards

## Overview
Four CI security guards enforcing architectural boundaries and security policies.

## Guards Implemented

### Guard 1: Forbidden Browser Storage in Sensitive Paths
- **Rule**: Auth and health modules MUST NOT use browser storage
- **Scanned Paths**:
  - `apps/*/src/auth/**`
  - `apps/*/src/health/**`
  - `apps/*/src/features/health/**`
- **Forbidden Patterns**: `localStorage`, `sessionStorage`, `IndexedDB`
- **Rationale**: ADR-002 - Tokens use httpOnly cookies, health data must not persist client-side

### Guard 2: No Imports from Archive
- **Rule**: No active code may import from `archive/` directory
- **Scanned Paths**: All `apps/**` and `packages/**`
- **Forbidden Patterns**: `from '*/archive/'`, `import * from '*/archive/'`
- **Rationale**: Archived code is legacy and must not be referenced

### Guard 3: UI Package Purity
- **Rule**: `packages/ui/**` MUST be pure presentation layer
- **Scanned Paths**: `packages/ui/src/**`
- **Forbidden Patterns**:
  - Storage: `localStorage`, `sessionStorage`, `IndexedDB`
  - Network: `fetch(`, `axios`, `XMLHttpRequest`
  - HTTP methods: `.post(`, `.get(`, `.put(`, `.delete(`
- **Rationale**: UI components receive data via props, not direct API calls

### Guard 4: Orchestration Boundary
- **Rule**: UI package MUST NOT import app-layer orchestration
- **Scanned Paths**: `packages/ui/src/**`
- **Forbidden Patterns**:
  - `from '@/hooks/use*'` (except `useToast`, `useMediaQuery`)
  - `from '@/services/api'`
  - `from '@/lib/'` (except types)
  - `import api from`
- **Rationale**: Maintain clear separation between presentation and orchestration layers

## Making Guards Required for Merge

### Option 1: Branch Protection Rules (Recommended)
1. Go to repository Settings > Branches
2. Edit branch protection rule for `main` (or create new)
3. Enable "Require status checks to pass before merging"
4. Search and select these checks:
   - `Guard 1 - No Browser Storage in Auth/Health`
   - `Guard 2 - No Imports from Archive`
   - `Guard 3 - UI Package Purity`
   - `Guard 4 - Orchestration Boundary`
   - `All Security Guards Summary`
5. Save changes

### Option 2: CODEOWNERS Enforcement
Add to `.github/CODEOWNERS`:
```
# Security-critical paths require guard approval
apps/**/auth/** @security-team
apps/**/health/** @security-team
packages/ui/** @frontend-team
.github/workflows/security-guards.yml @security-team
```

## Workflow Triggers
- **Pull Requests**: On changes to `apps/**` or `packages/**`
- **Push**: To `main` or `develop` branches

## Local Testing
Run guards locally before pushing:

```bash
# Test all guards
.github/workflows/test-security-guards.sh

# Or test individually:
# Guard 1
grep -r "localStorage\|sessionStorage" apps/*/src/auth apps/*/src/health 2>/dev/null

# Guard 2
grep -r "from.*archive/" apps packages 2>/dev/null

# Guard 3
grep -r "localStorage\|fetch(" packages/ui/src 2>/dev/null

# Guard 4
grep -r "from '@/hooks/use\|from '@/services/api'" packages/ui/src 2>/dev/null
```

## Violation Response
When a guard fails:
1. **Read the error message** - indicates which guard failed and why
2. **Check the violated file** - shown in grep output with line numbers
3. **Apply the fix** - follow the guidance in the error message
4. **Re-run locally** - verify fix before pushing
5. **Push again** - CI will re-run guards

## Example Violation Output

```
❌ GUARD 3 FAILED: UI package contains impure code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reason: packages/ui MUST be pure presentation layer
Rule: No storage APIs, no network calls in UI package
Fix: Move storage/network logic to app layer or orchestration hooks

packages/ui/src/components/UserProfile.tsx:45:  const data = localStorage.getItem('user')
```

## Guard Exemptions
If you need to exempt a file from a guard (rare):
1. Document the reason in ADR
2. Add exemption to workflow using `grep -v`
3. Get security team approval

## Maintenance
- Review guards quarterly
- Update patterns as architecture evolves
- Add new guards as needed for new policies
- Keep this documentation synchronized with workflow
