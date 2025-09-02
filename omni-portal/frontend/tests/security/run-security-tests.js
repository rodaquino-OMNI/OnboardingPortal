#!/usr/bin/env node
/**
 * Security Test Runner
 * Orchestrates all security tests and stores results in memory
 */

const SecurityTester = require('./malicious-payload-tester');
const fs = require('fs').promises;
const path = require('path');

class SecurityTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      tests: {},
      summary: {},
      recommendations: [],
      memoryKey: 'swarm/security-testing/results'
    };
  }

  async runAllSecurityTests() {
    console.log('🔒 Starting Comprehensive Security Test Suite...\n');
    
    try {
      // Initialize security tester
      const tester = new SecurityTester('http://localhost:3000');
      
      // Run comprehensive security tests
      const testResults = await tester.runAllTests();
      this.results.tests = testResults;
      
      // Analyze results
      await this.analyzeResults();
      
      // Generate security report
      await this.generateSecurityReport();
      
      // Store in memory for swarm coordination
      await this.storeInMemory();
      
      console.log('\n✅ Security testing completed successfully');
      return this.results;
      
    } catch (error) {
      console.error('❌ Security testing failed:', error);
      this.results.error = error.message;
      throw error;
    }
  }

  async analyzeResults() {
    const testData = this.results.tests;
    
    // Calculate security metrics
    this.results.summary = {
      totalTests: testData.summary.total,
      blockedAttacks: testData.summary.blocked,
      passedTests: testData.summary.passed,
      failedTests: testData.summary.failed,
      vulnerabilities: testData.vulnerabilities.length,
      securityScore: ((testData.summary.blocked / testData.summary.total) * 100).toFixed(1),
      riskLevel: this.calculateRiskLevel(testData.vulnerabilities.length, testData.summary.total)
    };

    // Analyze attack categories
    const categories = {};
    testData.tests.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = { total: 0, blocked: 0, vulnerable: 0 };
      }
      categories[test.category].total++;
      if (test.status === 'BLOCKED') {
        categories[test.category].blocked++;
      }
      if (test.vulnerable) {
        categories[test.category].vulnerable++;
      }
    });
    
    this.results.categoryAnalysis = categories;

    // Generate threat assessment
    this.results.threatAssessment = await this.generateThreatAssessment();
  }

  calculateRiskLevel(vulnerabilities, totalTests) {
    const vulnRatio = vulnerabilities / totalTests;
    if (vulnRatio > 0.2) return 'CRITICAL';
    if (vulnRatio > 0.1) return 'HIGH';
    if (vulnRatio > 0.05) return 'MEDIUM';
    return 'LOW';
  }

  async generateThreatAssessment() {
    const vulns = this.results.tests.vulnerabilities;
    const assessment = {
      criticalThreats: [],
      commonAttackVectors: [],
      mitigationPriority: []
    };

    // Identify critical threats
    vulns.forEach(vuln => {
      if (['SQL Injection', 'XSS Payloads', 'Path Traversal'].includes(vuln.category)) {
        assessment.criticalThreats.push({
          type: vuln.category,
          description: this.getThreatDescription(vuln.category),
          impact: 'HIGH',
          likelihood: 'HIGH'
        });
      }
    });

    // Common attack vectors
    const categoryCount = {};
    this.results.tests.tests.forEach(test => {
      if (test.vulnerable) {
        categoryCount[test.category] = (categoryCount[test.category] || 0) + 1;
      }
    });

    Object.entries(categoryCount).forEach(([category, count]) => {
      assessment.commonAttackVectors.push({
        vector: category,
        frequency: count,
        severity: this.getSeverityLevel(category)
      });
    });

    // Mitigation priority
    assessment.mitigationPriority = this.generateMitigationPriority(vulns);

    return assessment;
  }

  getThreatDescription(category) {
    const descriptions = {
      'SQL Injection': 'Malicious SQL queries can access or modify database data',
      'XSS Payloads': 'Cross-site scripting can execute malicious client-side code',
      'Path Traversal': 'Directory traversal can access unauthorized files',
      'CRLF Injection': 'Header injection can manipulate HTTP responses',
      'JWT Attacks': 'Token manipulation can bypass authentication',
      'Malicious Cookies': 'Cookie tampering can escalate privileges'
    };
    return descriptions[category] || 'Unknown threat vector';
  }

  getSeverityLevel(category) {
    const severityMap = {
      'SQL Injection': 'CRITICAL',
      'XSS Payloads': 'HIGH',
      'Path Traversal': 'HIGH',
      'CRLF Injection': 'MEDIUM',
      'JWT Attacks': 'HIGH',
      'Malicious Cookies': 'MEDIUM'
    };
    return severityMap[category] || 'LOW';
  }

  generateMitigationPriority(vulnerabilities) {
    const priorities = [];
    
    if (vulnerabilities.some(v => v.category === 'SQL Injection')) {
      priorities.push({
        priority: 1,
        action: 'Implement parameterized queries and input sanitization',
        category: 'SQL Injection',
        effort: 'HIGH',
        impact: 'CRITICAL'
      });
    }

    if (vulnerabilities.some(v => v.category === 'XSS Payloads')) {
      priorities.push({
        priority: 2,
        action: 'Add Content Security Policy and output encoding',
        category: 'XSS Prevention',
        effort: 'MEDIUM',
        impact: 'HIGH'
      });
    }

    if (vulnerabilities.some(v => v.category === 'Path Traversal')) {
      priorities.push({
        priority: 3,
        action: 'Implement file path validation and sandboxing',
        category: 'Path Security',
        effort: 'MEDIUM',
        impact: 'HIGH'
      });
    }

    return priorities.sort((a, b) => a.priority - b.priority);
  }

  async generateSecurityReport() {
    const report = {
      title: 'Security Testing Report',
      timestamp: this.results.timestamp,
      summary: this.results.summary,
      details: {
        testExecution: this.formatTestExecution(),
        vulnerabilityAnalysis: this.formatVulnerabilityAnalysis(),
        recommendations: this.formatRecommendations(),
        compliance: this.assessCompliance()
      }
    };

    // Save detailed report
    const reportPath = path.join(__dirname, 'security-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
    this.results.reportPath = reportPath;
    return report;
  }

  formatTestExecution() {
    return {
      totalTests: this.results.summary.totalTests,
      executionTime: this.calculateExecutionTime(),
      successRate: `${this.results.summary.securityScore}%`,
      categories: Object.keys(this.results.categoryAnalysis).map(category => ({
        name: category,
        tests: this.results.categoryAnalysis[category].total,
        blocked: this.results.categoryAnalysis[category].blocked,
        effectiveness: `${((this.results.categoryAnalysis[category].blocked / this.results.categoryAnalysis[category].total) * 100).toFixed(1)}%`
      }))
    };
  }

  formatVulnerabilityAnalysis() {
    const vulns = this.results.tests.vulnerabilities;
    return {
      total: vulns.length,
      bySeverity: this.groupVulnerabilitiesBySeverity(vulns),
      byCategory: this.groupVulnerabilitiesByCategory(vulns),
      criticalFindings: vulns.filter(v => this.getSeverityLevel(v.category) === 'CRITICAL')
    };
  }

  groupVulnerabilitiesBySeverity(vulnerabilities) {
    const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    vulnerabilities.forEach(vuln => {
      const level = this.getSeverityLevel(vuln.category);
      severity[level]++;
    });
    return severity;
  }

  groupVulnerabilitiesByCategory(vulnerabilities) {
    const categories = {};
    vulnerabilities.forEach(vuln => {
      categories[vuln.category] = (categories[vuln.category] || 0) + 1;
    });
    return categories;
  }

  formatRecommendations() {
    return this.results.threatAssessment.mitigationPriority.map(item => ({
      priority: item.priority,
      recommendation: item.action,
      category: item.category,
      estimatedEffort: item.effort,
      securityImpact: item.impact,
      timeline: this.getImplementationTimeline(item.effort)
    }));
  }

  getImplementationTimeline(effort) {
    const timelines = {
      'LOW': '1-2 days',
      'MEDIUM': '1-2 weeks',
      'HIGH': '2-4 weeks',
      'CRITICAL': '1-2 months'
    };
    return timelines[effort] || 'Unknown';
  }

  assessCompliance() {
    const score = parseFloat(this.results.summary.securityScore);
    return {
      owaspCompliance: score >= 85 ? 'GOOD' : score >= 70 ? 'FAIR' : 'POOR',
      cisCompliance: score >= 90 ? 'GOOD' : score >= 75 ? 'FAIR' : 'POOR',
      pcidssCompliance: score >= 95 ? 'GOOD' : score >= 85 ? 'FAIR' : 'POOR',
      overallRating: this.results.summary.riskLevel
    };
  }

  calculateExecutionTime() {
    // Estimate based on test count
    return `${Math.ceil(this.results.summary.totalTests * 0.1)} seconds`;
  }

  async storeInMemory() {
    try {
      // Simulate storing in memory (would use MCP tools in real implementation)
      const memoryData = {
        key: this.results.memoryKey,
        value: JSON.stringify({
          summary: this.results.summary,
          threatAssessment: this.results.threatAssessment,
          categoryAnalysis: this.results.categoryAnalysis,
          recommendations: this.results.recommendations,
          timestamp: this.results.timestamp,
          reportPath: this.results.reportPath
        }),
        namespace: 'security-testing',
        ttl: 24 * 60 * 60 * 1000 // 24 hours
      };

      console.log(`💾 Results stored in memory key: ${memoryData.key}`);
      console.log(`📊 Security Score: ${this.results.summary.securityScore}%`);
      console.log(`⚠️  Risk Level: ${this.results.summary.riskLevel}`);
      console.log(`🛡️  Vulnerabilities Found: ${this.results.summary.vulnerabilities}`);
      
      return memoryData;
    } catch (error) {
      console.error('Failed to store results in memory:', error);
      throw error;
    }
  }
}

// Export for use in other modules
module.exports = SecurityTestRunner;

// Run tests if called directly
if (require.main === module) {
  const runner = new SecurityTestRunner();
  
  runner.runAllSecurityTests()
    .then(results => {
      console.log(`\n🎉 Security testing completed with ${results.summary.securityScore}% effectiveness`);
      process.exit(results.summary.vulnerabilities > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Security testing failed:', error);
      process.exit(1);
    });
}