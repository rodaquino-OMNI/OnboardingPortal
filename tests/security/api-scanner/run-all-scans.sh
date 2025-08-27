#!/bin/bash

# API Security Scanner Suite
# Runs all security scans and generates comprehensive report

echo "🔒 API Security Scanner Suite"
echo "============================="
echo "Starting comprehensive security analysis..."
echo ""

# Create reports directory
mkdir -p reports
cd reports

# Check if PHP is available
if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed or not in PATH"
    exit 1
fi

# Check if API server is running
echo "🔍 Checking if API server is running..."
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ API server is running"
else
    echo "⚠️  API server not responding at localhost:8000"
    echo "   Please start the server with: php artisan serve"
    echo "   Or update the base URL in the scanner scripts"
    echo ""
fi

echo "📋 Running security scans..."
echo ""

# 1. Endpoint Mapping and Analysis
echo "🎯 [1/5] Running endpoint mapping and security analysis..."
php ../endpoint-mapper.php
if [ $? -eq 0 ]; then
    echo "✅ Endpoint mapping completed"
else
    echo "❌ Endpoint mapping failed"
fi
echo ""

# 2. Data Exposure Scanning
echo "🔍 [2/5] Running data exposure analysis..."
php ../data-exposure-scanner.php
if [ $? -eq 0 ]; then
    echo "✅ Data exposure analysis completed"
else
    echo "❌ Data exposure analysis failed"
fi
echo ""

# 3. Input Validation Testing
echo "🧪 [3/5] Running input validation security tests..."
php ../input-validation-tester.php
if [ $? -eq 0 ]; then
    echo "✅ Input validation testing completed"
else
    echo "❌ Input validation testing failed"
fi
echo ""

# 4. File Upload Security Testing
echo "📎 [4/5] Running file upload security tests..."
php ../file-upload-security-tester.php
if [ $? -eq 0 ]; then
    echo "✅ File upload security testing completed"
else
    echo "❌ File upload security testing failed"
fi
echo ""

# 5. Generate Master Report
echo "📊 [5/5] Generating comprehensive master report..."
php ../api-security-master-report.php
if [ $? -eq 0 ]; then
    echo "✅ Master report generated successfully"
else
    echo "❌ Master report generation failed"
fi
echo ""

# Summary
echo "📋 Security Scan Summary"
echo "========================"
echo ""

# Check which reports were generated
reports_generated=0
total_reports=4

if [ -f "api-security-report.json" ]; then
    echo "✅ Endpoint security report: api-security-report.json"
    reports_generated=$((reports_generated + 1))
else
    echo "❌ Missing endpoint security report"
fi

if [ -f "data-exposure-report.json" ]; then
    echo "✅ Data exposure report: data-exposure-report.json"
    reports_generated=$((reports_generated + 1))
else
    echo "❌ Missing data exposure report"
fi

if [ -f "input-validation-report.json" ]; then
    echo "✅ Input validation report: input-validation-report.json"
    reports_generated=$((reports_generated + 1))
else
    echo "❌ Missing input validation report"
fi

if [ -f "file-upload-security-report.json" ]; then
    echo "✅ File upload security report: file-upload-security-report.json"
    reports_generated=$((reports_generated + 1))
else
    echo "❌ Missing file upload security report"
fi

if [ -f "api-security-master-report.json" ]; then
    echo "✅ Master report: api-security-master-report.json"
    echo "✅ HTML report: api-security-master-report.html"
else
    echo "❌ Missing master report"
fi

echo ""
echo "📊 Scan Coverage: $reports_generated/$total_reports reports generated"

# Display quick summary if master report exists
if [ -f "api-security-master-report.json" ]; then
    echo ""
    echo "🎯 Quick Summary:"
    
    # Extract key metrics from master report
    score=$(grep -o '"score":[0-9]*' api-security-master-report.json | head -1 | cut -d':' -f2)
    risk_level=$(grep -o '"risk_level":"[^"]*"' api-security-master-report.json | head -1 | cut -d'"' -f4)
    total_vulns=$(grep -o '"total_vulnerabilities":[0-9]*' api-security-master-report.json | head -1 | cut -d':' -f2)
    
    if [ ! -z "$score" ]; then
        echo "   Security Score: $score/100"
    fi
    
    if [ ! -z "$risk_level" ]; then
        echo "   Risk Level: $risk_level"
    fi
    
    if [ ! -z "$total_vulns" ]; then
        echo "   Total Vulnerabilities: $total_vulns"
    fi
    
    echo ""
    echo "📄 View detailed report: api-security-master-report.html"
fi

echo ""
echo "🏁 Security scan suite completed!"
echo ""
echo "📁 All reports saved in: $(pwd)"
echo ""
echo "Next steps:"
echo "  1. Review the master report (api-security-master-report.html)"
echo "  2. Address critical and high-severity vulnerabilities first"
echo "  3. Implement recommended security measures"
echo "  4. Re-run scans after fixes to verify improvements"
echo "  5. Integrate these scans into your CI/CD pipeline"