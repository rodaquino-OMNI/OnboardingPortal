#!/bin/bash

# Fix Frontend Path References in GitHub Workflows
# Changes: omni-portal/frontend → apps/web

set -e

echo "🔧 Fixing frontend path references in GitHub workflows..."

# Array of files to fix
FILES=(
    ".github/workflows/ci-cd.yml"
    ".github/workflows/docker-ci-cd.yml"
    ".github/workflows/e2e-phase8.yml"
    ".github/workflows/monolith.yml"
)

TOTAL_CHANGES=0

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: $file"

        # Count occurrences before
        BEFORE=$(grep -c "omni-portal/frontend" "$file" || true)

        # Perform replacement
        sed -i 's|omni-portal/frontend|apps/web|g' "$file"

        # Count occurrences after (should be 0)
        AFTER=$(grep -c "omni-portal/frontend" "$file" || true)

        CHANGED=$((BEFORE - AFTER))
        TOTAL_CHANGES=$((TOTAL_CHANGES + CHANGED))

        echo "  ✅ Fixed $CHANGED references"
    else
        echo "  ⚠️  File not found: $file"
    fi
done

echo ""
echo "✅ Total references fixed: $TOTAL_CHANGES"
echo "🎉 All frontend paths updated successfully!"
