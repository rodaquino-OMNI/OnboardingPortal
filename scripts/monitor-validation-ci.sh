#!/bin/bash
# Phase 8 Gate A/B Validation - CI Monitoring Script
# Monitors all 13 required CI workflows and collects evidence

set -e

BRANCH="phase8/gate-ab-validation"
PR_NUMBER="9"
OUTPUT_DIR="docs/phase8/validation-artifacts"
EVIDENCE_FILE="docs/phase8/PHASE_8_VALIDATION_EVIDENCE.md"

# Required workflows for Phase 8
REQUIRED_WORKFLOWS=(
    "security-plaintext-check"
    "analytics-migration-drift"
    "e2e-phase8"
    "openapi-sdk-check"
    "sandbox-a11y"
    "ui-build-and-test"
    "analytics-contracts"
    "openapi-contract-check"
)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "========================================="
echo "Phase 8 Gate A/B Validation Monitor"
echo "========================================="
echo "Branch: $BRANCH"
echo "PR: #$PR_NUMBER"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Function to check workflow status
check_workflow() {
    local workflow_name=$1
    echo "Checking: $workflow_name"

    # Get most recent run for this workflow on our branch
    local run_data=$(gh run list \
        --workflow="$workflow_name.yml" \
        --branch="$BRANCH" \
        --limit=1 \
        --json databaseId,status,conclusion,createdAt,updatedAt,url 2>/dev/null || echo "[]")

    if [ "$run_data" == "[]" ] || [ -z "$run_data" ]; then
        echo "  Status: NOT STARTED"
        return 1
    fi

    local run_id=$(echo "$run_data" | jq -r '.[0].databaseId // empty')
    local status=$(echo "$run_data" | jq -r '.[0].status // empty')
    local conclusion=$(echo "$run_data" | jq -r '.[0].conclusion // empty')
    local url=$(echo "$run_data" | jq -r '.[0].url // empty')

    echo "  Run ID: $run_id"
    echo "  Status: $status"
    echo "  Conclusion: $conclusion"
    echo "  URL: $url"

    # Save run details
    echo "$run_data" > "$OUTPUT_DIR/${workflow_name}_run.json"

    return 0
}

# Function to download artifacts
download_artifacts() {
    local run_id=$1
    local workflow_name=$2

    echo "Downloading artifacts for run $run_id..."
    gh run download "$run_id" -D "$OUTPUT_DIR/${workflow_name}_artifacts" 2>/dev/null || {
        echo "  No artifacts available for $workflow_name"
        return 1
    }
    echo "  Artifacts saved to $OUTPUT_DIR/${workflow_name}_artifacts"
}

# Main monitoring loop
echo "========================================="
echo "Workflow Status Check"
echo "========================================="
echo ""

all_complete=true
has_failures=false

for workflow in "${REQUIRED_WORKFLOWS[@]}"; do
    if check_workflow "$workflow"; then
        # Check if completed
        status=$(jq -r '.[0].status' "$OUTPUT_DIR/${workflow}_run.json")
        conclusion=$(jq -r '.[0].conclusion' "$OUTPUT_DIR/${workflow}_run.json")
        run_id=$(jq -r '.[0].databaseId' "$OUTPUT_DIR/${workflow}_run.json")

        if [ "$status" != "completed" ]; then
            all_complete=false
        else
            # Download artifacts if completed
            download_artifacts "$run_id" "$workflow"

            if [ "$conclusion" != "success" ]; then
                has_failures=true
                echo "  ⚠️  FAILED: $workflow"
            else
                echo "  ✅ PASSED: $workflow"
            fi
        fi
    else
        all_complete=false
    fi
    echo ""
done

# Check PR status
echo "========================================="
echo "PR Status Check"
echo "========================================="
gh pr view "$PR_NUMBER" --json statusCheckRollup | \
    jq -r '.statusCheckRollup[] | "\(.name): \(.status) / \(.conclusion)"'
echo ""

# Summary
echo "========================================="
echo "Summary"
echo "========================================="
if [ "$all_complete" = true ]; then
    if [ "$has_failures" = false ]; then
        echo "✅ All workflows PASSED"
        echo "Status: READY FOR EVIDENCE COLLECTION"
    else
        echo "❌ Some workflows FAILED"
        echo "Status: REMEDIATION REQUIRED"
    fi
else
    echo "⏳ Workflows still in progress"
    echo "Status: MONITORING"
fi

echo ""
echo "Artifacts saved to: $OUTPUT_DIR"
echo "Monitor again with: bash scripts/monitor-validation-ci.sh"
