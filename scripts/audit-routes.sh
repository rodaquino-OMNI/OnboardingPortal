#!/bin/bash

set -e

# Route Audit Script - Compare Laravel routes with OpenAPI spec
# Usage: ./scripts/audit-routes.sh

ROUTES_FILE="/tmp/laravel-routes.json"
SPEC_FILE="docs/API_SPEC.yaml"
OUTPUT_FILE="/tmp/route-audit-report.txt"

echo "=== Route Audit Report ===" > "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check if routes file exists
if [ ! -f "$ROUTES_FILE" ]; then
    echo "ERROR: Laravel routes file not found at $ROUTES_FILE"
    echo "Run: cd omni-portal/backend && php artisan route:list --json > /tmp/laravel-routes.json"
    exit 1
fi

# Check if OpenAPI spec exists
if [ ! -f "$SPEC_FILE" ]; then
    echo "ERROR: OpenAPI spec not found at $SPEC_FILE"
    exit 1
fi

# Extract API routes from Laravel (only /api/* routes)
echo "Extracting Laravel API routes..." >> "$OUTPUT_FILE"
API_ROUTES=$(jq -r '.[] | select(.uri | startswith("api/")) | .uri' "$ROUTES_FILE" | sort | uniq)
echo "Found $(echo "$API_ROUTES" | wc -l) API routes in Laravel" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract paths from OpenAPI spec
echo "Extracting OpenAPI paths..." >> "$OUTPUT_FILE"
if command -v yq &> /dev/null; then
    SPEC_PATHS=$(yq eval '.paths | keys | .[]' "$SPEC_FILE" | sed 's|^/||' | sort)
    echo "Found $(echo "$SPEC_PATHS" | wc -l) paths in OpenAPI spec" >> "$OUTPUT_FILE"
else
    echo "WARNING: yq not installed, using grep fallback" >> "$OUTPUT_FILE"
    SPEC_PATHS=$(grep -E '^\s+/api/' "$SPEC_FILE" | sed 's/://g' | sed 's/^[ \t]*//' | sed 's|^/||' | sort)
    echo "Found $(echo "$SPEC_PATHS" | wc -l) paths in OpenAPI spec (grep method)" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Find routes in Laravel but not in OpenAPI spec
echo "=== Routes in Laravel but NOT in OpenAPI spec ===" >> "$OUTPUT_FILE"
MISSING_IN_SPEC=0
while IFS= read -r route; do
    # Remove api/ prefix for comparison
    route_path="${route#api/}"
    # Convert Laravel {param} to OpenAPI {param} format
    route_normalized=$(echo "$route_path" | sed 's/{[^}]*}/{id}/g')

    if ! echo "$SPEC_PATHS" | grep -qF "$route_normalized"; then
        echo "  - $route" >> "$OUTPUT_FILE"
        ((MISSING_IN_SPEC++))
    fi
done <<< "$API_ROUTES"

if [ $MISSING_IN_SPEC -eq 0 ]; then
    echo "  None - All Laravel routes are documented" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Find paths in OpenAPI spec but not in Laravel routes
echo "=== Paths in OpenAPI spec but NOT in Laravel ===" >> "$OUTPUT_FILE"
MISSING_IN_LARAVEL=0
while IFS= read -r path; do
    # Remove api/ prefix for comparison
    path_normalized="${path#api/}"
    # Convert OpenAPI {param} to Laravel {param} format
    path_laravel=$(echo "api/$path_normalized" | sed 's/{id}/{[^}]*}/g')

    if ! echo "$API_ROUTES" | grep -qE "^$path_laravel$"; then
        echo "  - $path" >> "$OUTPUT_FILE"
        ((MISSING_IN_LARAVEL++))
    fi
done <<< "$SPEC_PATHS"

if [ $MISSING_IN_LARAVEL -eq 0 ]; then
    echo "  None - All OpenAPI paths are implemented" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Summary
echo "=== Summary ===" >> "$OUTPUT_FILE"
echo "Total Laravel API routes: $(echo "$API_ROUTES" | wc -l)" >> "$OUTPUT_FILE"
echo "Total OpenAPI paths: $(echo "$SPEC_PATHS" | wc -l)" >> "$OUTPUT_FILE"
echo "Routes missing in OpenAPI spec: $MISSING_IN_SPEC" >> "$OUTPUT_FILE"
echo "Paths missing in Laravel: $MISSING_IN_LARAVEL" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Display report
cat "$OUTPUT_FILE"

# Exit with error if discrepancies found
if [ $MISSING_IN_SPEC -gt 0 ] || [ $MISSING_IN_LARAVEL -gt 0 ]; then
    echo ""
    echo "ERROR: Route/contract discrepancies detected!"
    echo "Please ensure all Laravel routes are documented in OpenAPI spec and vice versa."
    exit 1
fi

echo "SUCCESS: All routes are properly documented and implemented"
exit 0
