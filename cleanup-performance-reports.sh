#!/bin/bash

# Performance Reports Cleanup Script
# Removes excessive performance report files and sets up proper management

echo "🧹 Cleaning up performance reports..."

REPORTS_DIR="omni-portal/frontend/__tests__/performance/reports"

if [ -d "$REPORTS_DIR" ]; then
    # Count existing reports
    REPORT_COUNT=$(find "$REPORTS_DIR" -name "performance-report-*.json" | wc -l)
    echo "📊 Found $REPORT_COUNT performance report files"
    
    if [ $REPORT_COUNT -gt 10 ]; then
        echo "🗑️ Removing old performance reports (keeping 10 most recent)..."
        
        # Keep only the 10 most recent files
        find "$REPORTS_DIR" -name "performance-report-*.json" -type f -printf '%T@ %p\n' | \
        sort -nr | \
        tail -n +11 | \
        cut -d' ' -f2- | \
        xargs rm -f
        
        REMAINING_COUNT=$(find "$REPORTS_DIR" -name "performance-report-*.json" | wc -l)
        DELETED_COUNT=$((REPORT_COUNT - REMAINING_COUNT))
        echo "✅ Deleted $DELETED_COUNT reports, kept $REMAINING_COUNT most recent"
    else
        echo "✅ Report count is acceptable ($REPORT_COUNT files)"
    fi
else
    echo "❌ Reports directory not found: $REPORTS_DIR"
fi

echo "🔧 Setting up .gitignore rules..."

# Add performance reports to .gitignore if not already present
if ! grep -q "performance-report-.*\.json" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Performance test reports (auto-generated)" >> .gitignore
    echo "**/performance/reports/performance-report-*.json" >> .gitignore
    echo "✅ Added performance reports to .gitignore"
else
    echo "✅ .gitignore already configured for performance reports"
fi

echo ""
echo "💡 To generate performance reports in development:"
echo "   export SAVE_PERFORMANCE_REPORTS=true"
echo "   npm test -- --testPathPattern=performance"
echo ""
echo "📄 Reports will be automatically saved in CI/CD environments"
echo "🎯 Cleanup complete!"