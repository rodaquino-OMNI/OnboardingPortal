#!/bin/bash

# Fix Node.js Versions in GitHub Workflows
# Changes: Node 18 → Node 20

set -e

echo "🔧 Fixing Node.js versions in GitHub workflows..."

# Fix docker-ci-cd.yml (line 172, 510)
echo "Processing: .github/workflows/docker-ci-cd.yml"
sed -i "s/node-version: '18.19.0'/node-version: '20'/g" .github/workflows/docker-ci-cd.yml
echo "  ✅ Updated Node version to 20"

# Fix security-audit.yml (line 57)
echo "Processing: .github/workflows/security-audit.yml"
sed -i "s/node-version: '18.19.0'/node-version: '20'/g" .github/workflows/security-audit.yml
echo "  ✅ Updated Node version to 20"

# Fix security-scan.yml (line 113)
echo "Processing: .github/workflows/security-scan.yml"
sed -i "s/node-version: '18'/node-version: '20'/g" .github/workflows/security-scan.yml
echo "  ✅ Updated Node version to 20"

echo ""
echo "🎉 All Node.js versions updated to 20!"
