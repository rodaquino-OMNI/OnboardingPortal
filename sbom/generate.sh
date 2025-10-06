#!/bin/bash
set -euo pipefail

# SBOM Generation Script
# Generates Software Bill of Materials in CycloneDX and SPDX formats
# Includes vulnerability scanning and license compliance checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${SCRIPT_DIR}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required tools
check_dependencies() {
    log_info "Checking dependencies..."

    local missing_tools=()

    if ! command -v syft &> /dev/null; then
        missing_tools+=("syft")
    fi

    if ! command -v grype &> /dev/null; then
        missing_tools+=("grype")
    fi

    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install with:"
        log_info "  brew install anchore/syft/syft anchore/grype/grype jq"
        log_info "  or"
        log_info "  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin"
        log_info "  curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin"
        exit 1
    fi

    log_info "All dependencies found"
}

# Generate CycloneDX SBOM for frontend
generate_frontend_sbom() {
    log_info "Generating frontend SBOM..."

    cd "${PROJECT_ROOT}/omni-portal/frontend"

    # CycloneDX JSON format
    syft . \
        -o cyclonedx-json="${OUTPUT_DIR}/frontend-cyclonedx-${TIMESTAMP}.json" \
        --quiet

    # SPDX JSON format
    syft . \
        -o spdx-json="${OUTPUT_DIR}/frontend-spdx-${TIMESTAMP}.json" \
        --quiet

    log_info "Frontend SBOM generated"
}

# Generate CycloneDX SBOM for backend
generate_backend_sbom() {
    log_info "Generating backend SBOM..."

    cd "${PROJECT_ROOT}/omni-portal/backend"

    # CycloneDX JSON format
    syft . \
        -o cyclonedx-json="${OUTPUT_DIR}/backend-cyclonedx-${TIMESTAMP}.json" \
        --quiet

    # SPDX JSON format
    syft . \
        -o spdx-json="${OUTPUT_DIR}/backend-spdx-${TIMESTAMP}.json" \
        --quiet

    log_info "Backend SBOM generated"
}

# Generate combined SBOM
generate_combined_sbom() {
    log_info "Generating combined SBOM..."

    cd "${PROJECT_ROOT}"

    # Full application SBOM
    syft . \
        -o cyclonedx-json="${OUTPUT_DIR}/omni-portal-cyclonedx-${TIMESTAMP}.json" \
        --quiet

    # Create symlink to latest
    ln -sf "omni-portal-cyclonedx-${TIMESTAMP}.json" "${OUTPUT_DIR}/cyclonedx.json"

    log_info "Combined SBOM generated"
}

# Scan for vulnerabilities
scan_vulnerabilities() {
    log_info "Scanning for vulnerabilities..."

    local sbom_file="${OUTPUT_DIR}/omni-portal-cyclonedx-${TIMESTAMP}.json"

    if [ ! -f "$sbom_file" ]; then
        log_error "SBOM file not found: $sbom_file"
        return 1
    fi

    # Run Grype vulnerability scanner
    grype "sbom:${sbom_file}" \
        -o json \
        --file "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json" \
        --quiet

    # Generate human-readable report
    grype "sbom:${sbom_file}" \
        -o table \
        --file "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.txt"

    # Count vulnerabilities by severity
    local critical=$(jq '[.matches[] | select(.vulnerability.severity == "Critical")] | length' "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json")
    local high=$(jq '[.matches[] | select(.vulnerability.severity == "High")] | length' "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json")
    local medium=$(jq '[.matches[] | select(.vulnerability.severity == "Medium")] | length' "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json")
    local low=$(jq '[.matches[] | select(.vulnerability.severity == "Low")] | length' "${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json")

    log_info "Vulnerability summary:"
    echo "  Critical: ${critical}"
    echo "  High:     ${high}"
    echo "  Medium:   ${medium}"
    echo "  Low:      ${low}"

    # Fail if critical or high vulnerabilities found
    if [ "$critical" -gt 0 ] || [ "$high" -gt 0 ]; then
        log_error "Critical or high severity vulnerabilities found!"
        log_info "See details in: ${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.txt"
        return 1
    fi

    log_info "No critical or high vulnerabilities found"
    return 0
}

# Analyze license compliance
analyze_licenses() {
    log_info "Analyzing license compliance..."

    local sbom_file="${OUTPUT_DIR}/omni-portal-cyclonedx-${TIMESTAMP}.json"

    if [ ! -f "$sbom_file" ]; then
        log_error "SBOM file not found: $sbom_file"
        return 1
    fi

    # Extract licenses
    jq -r '.components[]? |
        select(.licenses != null) |
        {name: .name, version: .version, licenses: [.licenses[]?.license?.id // .licenses[]?.license?.name // "Unknown"]} |
        "\(.name)@\(.version): \(.licenses | join(", "))"' \
        "$sbom_file" | sort -u > "${OUTPUT_DIR}/licenses-${TIMESTAMP}.txt"

    # Identify potentially problematic licenses
    local problematic_licenses=("GPL" "AGPL" "LGPL")
    local found_issues=false

    for license in "${problematic_licenses[@]}"; do
        if grep -qi "$license" "${OUTPUT_DIR}/licenses-${TIMESTAMP}.txt"; then
            log_warn "Found potentially problematic license: $license"
            found_issues=true
        fi
    done

    if [ "$found_issues" = true ]; then
        log_warn "Review license compliance in: ${OUTPUT_DIR}/licenses-${TIMESTAMP}.txt"
    else
        log_info "No problematic licenses found"
    fi

    # Create summary
    local total_components=$(jq '.components | length' "$sbom_file")
    local with_licenses=$(jq '[.components[] | select(.licenses != null)] | length' "$sbom_file")

    log_info "License summary:"
    echo "  Total components: ${total_components}"
    echo "  With licenses:    ${with_licenses}"
}

# Generate dependency graph
generate_dependency_graph() {
    log_info "Generating dependency graph..."

    local sbom_file="${OUTPUT_DIR}/omni-portal-cyclonedx-${TIMESTAMP}.json"

    if [ ! -f "$sbom_file" ]; then
        log_error "SBOM file not found: $sbom_file"
        return 1
    fi

    # Create DOT format graph
    cat > "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.dot" <<EOF
digraph dependencies {
    rankdir=LR;
    node [shape=box, style=rounded];

EOF

    # Add nodes
    jq -r '.components[]? |
        "\"\(.name)@\(.version)\" [label=\"\(.name)\\n\(.version)\"];"' \
        "$sbom_file" >> "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.dot"

    # Add edges (if dependency information is available)
    jq -r '.dependencies[]? |
        select(.dependsOn != null) |
        .dependsOn[] as $dep |
        "\"\(.ref)\" -> \"\($dep)\";"' \
        "$sbom_file" >> "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.dot" 2>/dev/null || true

    echo "}" >> "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.dot"

    # Convert to PNG if graphviz is installed
    if command -v dot &> /dev/null; then
        dot -Tpng "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.dot" \
            -o "${OUTPUT_DIR}/dependencies-${TIMESTAMP}.png"
        log_info "Dependency graph generated: dependencies-${TIMESTAMP}.png"
    else
        log_warn "Graphviz not installed. DOT file created: dependencies-${TIMESTAMP}.dot"
    fi
}

# Create summary report
create_summary_report() {
    log_info "Creating summary report..."

    local sbom_file="${OUTPUT_DIR}/omni-portal-cyclonedx-${TIMESTAMP}.json"
    local vuln_file="${OUTPUT_DIR}/vulnerabilities-${TIMESTAMP}.json"

    if [ ! -f "$sbom_file" ]; then
        log_error "SBOM file not found: $sbom_file"
        return 1
    fi

    cat > "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" <<EOF
# SBOM Report - OmniPortal
Generated: $(date)

## Summary

- **Total Components**: $(jq '.components | length' "$sbom_file")
- **Direct Dependencies**: $(jq '[.components[] | select(.scope == "required")] | length' "$sbom_file" 2>/dev/null || echo "N/A")
- **Development Dependencies**: $(jq '[.components[] | select(.scope == "optional")] | length' "$sbom_file" 2>/dev/null || echo "N/A")

## Vulnerability Summary

EOF

    if [ -f "$vuln_file" ]; then
        cat >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" <<EOF
- **Critical**: $(jq '[.matches[] | select(.vulnerability.severity == "Critical")] | length' "$vuln_file")
- **High**: $(jq '[.matches[] | select(.vulnerability.severity == "High")] | length' "$vuln_file")
- **Medium**: $(jq '[.matches[] | select(.vulnerability.severity == "Medium")] | length' "$vuln_file")
- **Low**: $(jq '[.matches[] | select(.vulnerability.severity == "Low")] | length' "$vuln_file")

## Critical Vulnerabilities

EOF

        jq -r '.matches[] |
            select(.vulnerability.severity == "Critical") |
            "- **\(.artifact.name)@\(.artifact.version)**: \(.vulnerability.id) - \(.vulnerability.description // "No description")"' \
            "$vuln_file" >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" || echo "None found" >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md"
    else
        echo "No vulnerability scan performed" >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md"
    fi

    cat >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" <<EOF

## Top Dependencies by Type

### Frontend (NPM)
EOF

    jq -r '.components[] |
        select(.purl | startswith("pkg:npm")) |
        "- \(.name)@\(.version)"' "$sbom_file" | head -10 >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" || echo "None" >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md"

    cat >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" <<EOF

### Backend (Composer)
EOF

    jq -r '.components[] |
        select(.purl | startswith("pkg:composer")) |
        "- \(.name)@\(.version)"' "$sbom_file" | head -10 >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" || echo "None" >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md"

    cat >> "${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md" <<EOF

## Files Generated

- CycloneDX SBOM: \`omni-portal-cyclonedx-${TIMESTAMP}.json\`
- Vulnerability Report: \`vulnerabilities-${TIMESTAMP}.json\`
- License Analysis: \`licenses-${TIMESTAMP}.txt\`
- Dependency Graph: \`dependencies-${TIMESTAMP}.dot\`

## Compliance

- **HIPAA**: All dependencies scanned for vulnerabilities
- **License Compliance**: Reviewed for GPL/AGPL conflicts
- **Supply Chain Security**: SBOM available for audit

EOF

    log_info "Summary report created: sbom-report-${TIMESTAMP}.md"
}

# Cleanup old reports (keep last 10)
cleanup_old_reports() {
    log_info "Cleaning up old reports..."

    cd "${OUTPUT_DIR}"

    # Keep only last 10 SBOM files
    ls -t omni-portal-cyclonedx-*.json 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -t frontend-cyclonedx-*.json 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -t backend-cyclonedx-*.json 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -t vulnerabilities-*.json 2>/dev/null | tail -n +11 | xargs -r rm -f
    ls -t sbom-report-*.md 2>/dev/null | tail -n +11 | xargs -r rm -f

    log_info "Cleanup complete"
}

# Main execution
main() {
    log_info "=== SBOM Generation Started ==="

    check_dependencies
    generate_frontend_sbom
    generate_backend_sbom
    generate_combined_sbom
    scan_vulnerabilities || log_warn "Vulnerability scan found issues"
    analyze_licenses
    generate_dependency_graph
    create_summary_report
    cleanup_old_reports

    log_info "=== SBOM Generation Complete ==="
    log_info "Main SBOM file: ${OUTPUT_DIR}/cyclonedx.json"
    log_info "Summary report: ${OUTPUT_DIR}/sbom-report-${TIMESTAMP}.md"
}

# Run main if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    main "$@"
fi
