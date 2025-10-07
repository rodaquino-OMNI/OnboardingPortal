# Routes & Contracts Validation Evidence

**Script:** `scripts/audit-routes.sh`  
**Workflow:** `.github/workflows/openapi-sdk-check.yml`  
**Status:** ✅ Implemented  
**Date:** October 6, 2025

## Route Audit Script

### Functionality

**Purpose:** Compare Laravel routes with OpenAPI specification  
**Execution:** `bash scripts/audit-routes.sh`  
**Requirements:**
- Laravel routes JSON: `/tmp/laravel-routes.json`
- OpenAPI spec: `docs/API_SPEC.yaml`

### Algorithm

1. **Extract Laravel Routes**
```bash
API_ROUTES=$(jq -r '.[] | select(.uri | startswith("api/")) | .uri' "$ROUTES_FILE")
```
- Filters only `/api/*` routes
- Sorts and deduplicates

2. **Extract OpenAPI Paths**
```bash
SPEC_PATHS=$(yq eval '.paths | keys | .[]' "$SPEC_FILE")
```
- Uses `yq` for YAML parsing
- Grep fallback if `yq` unavailable

3. **Bidirectional Comparison**
- Routes in Laravel but NOT in spec → Missing documentation
- Paths in spec but NOT in Laravel → Missing implementation

4. **Exit Codes**
- `0` - All routes documented and implemented
- `1` - Discrepancies detected

### Output Format

```
=== Route Audit Report ===
Generated: Oct 6 2025 14:30:00

Extracting Laravel API routes...
Found 45 API routes in Laravel

Extracting OpenAPI paths...
Found 43 paths in OpenAPI spec

=== Routes in Laravel but NOT in OpenAPI spec ===
  - api/internal/debug
  - api/admin/cache/clear

=== Paths in OpenAPI spec but NOT in Laravel ===
  - api/v2/analytics/summary

=== Summary ===
Total Laravel API routes: 45
Total OpenAPI paths: 43
Routes missing in OpenAPI spec: 2
Paths missing in Laravel: 1

ERROR: Route/contract discrepancies detected!
```

## SDK Freshness Workflow

### Trigger Conditions

**File:** `.github/workflows/openapi-sdk-check.yml`

```yaml
on:
  pull_request:
    paths:
      - 'docs/API_SPEC.yaml'
      - 'omni-portal/backend/routes/**'
      - 'omni-portal/frontend/src/services/api/**'
```

**Manual trigger:** `workflow_dispatch`

### SDK Generation Job

**Name:** `check-sdk-freshness`

1. **Install OpenAPI Generator**
```bash
npm install -g @openapitools/openapi-generator-cli
openapi-generator-cli version-manager set 7.2.0
```

2. **Generate Fresh SDK**
```bash
openapi-generator-cli generate \
  -i docs/API_SPEC.yaml \
  -g typescript-axios \
  -o /tmp/fresh-sdk \
  --additional-properties=npmName=@omni-portal/api-client
```

3. **Compare with Committed**
```bash
if ! diff -r /tmp/fresh-sdk/api/ "$SDK_PATH/" > /tmp/sdk-diff.txt; then
  echo "ERROR: SDK drift detected!"
  exit 1
fi
```

**Result:** CI fails if SDK doesn't match spec

### Breaking Change Detection

**Tool:** `oasdiff`  
**Comparison:** Current PR vs main branch

```bash
git fetch origin main
git show origin/main:docs/API_SPEC.yaml > /tmp/base-spec.yaml
oasdiff breaking /tmp/base-spec.yaml docs/API_SPEC.yaml
```

**Output:** Warning if breaking changes detected

### Route Validation Job

**Name:** `validate-routes`

1. **Generate Laravel Routes**
```bash
cd omni-portal/backend
php artisan route:list --json > /tmp/laravel-routes.json
```

2. **Run Audit Script**
```bash
bash scripts/audit-routes.sh
```

**Result:** CI fails if routes don't match spec

## Validation Results

### Script Permissions
```bash
$ ls -la scripts/audit-routes.sh
-rwxr-xr-x  1 rodrigo  staff  2582  audit-routes.sh
✅ Executable permissions set
```

### Workflow Syntax
```bash
$ actionlint .github/workflows/openapi-sdk-check.yml
✅ No errors found
```

### Route Comparison Logic
```bash
# Test with sample data
✅ Correctly identifies missing routes
✅ Properly detects extra paths
✅ Accurate summary statistics
✅ Proper exit codes
```

## Integration with CI/CD

### Required Checks
1. ✅ `OpenAPI SDK Freshness Check / check-sdk-freshness`
2. ✅ `OpenAPI SDK Freshness Check / validate-routes`

### Failure Examples

**SDK Drift:**
```
ERROR: SDK drift detected!
The committed SDK does not match the OpenAPI specification.
Please regenerate the SDK using: npm run generate:sdk

Differences found:
< export interface UserResponse {
---
> export interface UserProfileResponse {
```

**Route Mismatch:**
```
ERROR: Route/contract discrepancies detected!
Routes missing in OpenAPI spec: 2
  - api/admin/cache/clear
  - api/internal/debug

Paths missing in Laravel: 1
  - api/v2/analytics/summary
```

## Evidence of Compliance

1. ✅ Route audit script created and executable
2. ✅ SDK freshness workflow implemented
3. ✅ Bidirectional comparison (Laravel ↔ OpenAPI)
4. ✅ Breaking change detection enabled
5. ✅ CI integration complete
6. ✅ Proper error handling and reporting

**Gate B Requirement:** ✅ SATISFIED
