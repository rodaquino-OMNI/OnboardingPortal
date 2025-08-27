#!/usr/bin/env node

/**
 * Master Validation Test Runner
 * Executes all validation tests and generates comprehensive reports
 */

const path = require('path');
const fs = require('fs').promises;

// Import all test classes
const ExtensionVersionTester = require('./extension/version-lock-test.js');
const MCPServerTester = require('./mcp/server-stability-test.js');
const ShellConnectionTester = require('./shell/connection-stability-test.js');
const SystemHealthMonitor = require('./monitoring/system-health-monitor.js');

class MasterValidationRunner {
    constructor() {
        this.results = {
            startTime: Date.now(),
            endTime: null,
            totalDuration: null,
            testSuites: {},
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            systemHealth: null
        };
        
        this.testSuites = [
            { name: 'extension', class: ExtensionVersionTester, description: 'Extension Version Management' },
            { name: 'mcp', class: MCPServerTester, description: 'MCP Server Stability' },
            { name: 'shell', class: ShellConnectionTester, description: 'Shell Connection Stability' }
        ];
    }

    async runAllValidationTests() {
        console.log('🚀 STARTING COMPREHENSIVE VALIDATION TEST SUITE');
        console.log('=' .repeat(80));
        console.log(`📅 Start Time: ${new Date().toISOString()}`);
        console.log(`🧪 Test Suites: ${this.testSuites.length}`);
        console.log('=' .repeat(80));

        try {
            // Start system health monitoring
            await this.startHealthMonitoring();

            // Run all test suites
            await this.executeTestSuites();

            // Stop health monitoring and get final status
            await this.stopHealthMonitoring();

            // Generate final comprehensive report
            await this.generateMasterReport();

            // Display final results
            this.displayFinalResults();

        } catch (error) {
            console.error('❌ Master validation failed:', error.message);
            this.results.masterError = error.message;
        } finally {
            this.results.endTime = Date.now();
            this.results.totalDuration = this.results.endTime - this.results.startTime;
        }

        return this.results;
    }

    async startHealthMonitoring() {
        console.log('\n🏥 Starting System Health Monitoring');
        console.log('-' .repeat(50));
        
        try {
            this.healthMonitor = new SystemHealthMonitor({
                interval: 10000 // 10 second intervals during testing
            });
            
            // Set up event listeners
            this.healthMonitor.on('alert', (alert) => {
                console.log(`🚨 HEALTH ALERT: ${alert.type} - ${alert.message}`);
            });
            
            await this.healthMonitor.startMonitoring();
            console.log('✅ Health monitoring active');
            
        } catch (error) {
            console.log('⚠️ Could not start health monitoring:', error.message);
        }
    }

    async stopHealthMonitoring() {
        console.log('\n🏥 Stopping System Health Monitoring');
        console.log('-' .repeat(50));
        
        try {
            if (this.healthMonitor) {
                await this.healthMonitor.stopMonitoring();
                this.results.systemHealth = {
                    finalStatus: this.healthMonitor.getHealthStatus(),
                    metrics: this.healthMonitor.getMetrics(20),
                    alerts: this.healthMonitor.getAlerts(50)
                };
                console.log('✅ Health monitoring stopped, data collected');
            }
        } catch (error) {
            console.log('⚠️ Error stopping health monitoring:', error.message);
        }
    }

    async executeTestSuites() {
        console.log('\n🧪 EXECUTING ALL TEST SUITES');
        console.log('=' .repeat(60));

        for (const suite of this.testSuites) {
            await this.executeTestSuite(suite);
        }
    }

    async executeTestSuite(suite) {
        console.log(`\n\n📋 RUNNING: ${suite.description}`);
        console.log('🔸' .repeat(40));
        
        const suiteStartTime = Date.now();
        
        try {
            const tester = new suite.class();
            const suiteResults = await tester.runAllTests();
            
            const suiteDuration = Date.now() - suiteStartTime;
            
            // Process suite results
            const suiteData = {
                name: suite.name,
                description: suite.description,
                status: 'COMPLETED',
                duration: suiteDuration,
                results: suiteResults,
                summary: this.processSuiteResults(suiteResults)
            };
            
            this.results.testSuites[suite.name] = suiteData;
            
            // Update master summary
            this.updateMasterSummary(suiteData.summary);
            
            console.log(`\n📊 ${suite.description} Summary:`);
            console.log(`✅ Passed: ${suiteData.summary.passed}`);
            console.log(`❌ Failed: ${suiteData.summary.failed}`);
            console.log(`⚠️ Warnings: ${suiteData.summary.warnings}`);
            console.log(`⏱️ Duration: ${suiteDuration}ms`);
            
        } catch (error) {
            console.error(`❌ Test suite '${suite.name}' failed:`, error.message);
            
            const suiteData = {
                name: suite.name,
                description: suite.description,
                status: 'FAILED',
                duration: Date.now() - suiteStartTime,
                error: error.message,
                results: [],
                summary: { passed: 0, failed: 1, warnings: 0, total: 1 }
            };
            
            this.results.testSuites[suite.name] = suiteData;
            this.updateMasterSummary(suiteData.summary);
        }
    }

    processSuiteResults(results) {
        if (!Array.isArray(results)) {
            return { passed: 0, failed: 0, warnings: 0, total: 0 };
        }
        
        const summary = {
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            warnings: results.filter(r => r.status === 'WARNING').length,
            total: results.length
        };
        
        return summary;
    }

    updateMasterSummary(suiteSummary) {
        this.results.summary.totalTests += suiteSummary.total;
        this.results.summary.passed += suiteSummary.passed;
        this.results.summary.failed += suiteSummary.failed;
        this.results.summary.warnings += suiteSummary.warnings;
    }

    async generateMasterReport() {
        console.log('\n📋 GENERATING MASTER VALIDATION REPORT');
        console.log('=' .repeat(60));
        
        const masterReport = {
            metadata: {
                reportType: 'MASTER_VALIDATION_REPORT',
                generatedAt: new Date().toISOString(),
                duration: this.results.totalDuration,
                testEnvironment: {
                    platform: process.platform,
                    nodeVersion: process.version,
                    architecture: process.arch,
                    workingDirectory: process.cwd()
                }
            },
            executionSummary: {
                totalTestSuites: this.testSuites.length,
                completedSuites: Object.keys(this.results.testSuites).length,
                overallStatus: this.determineOverallStatus(),
                ...this.results.summary
            },
            testSuiteResults: this.results.testSuites,
            systemHealthAnalysis: this.results.systemHealth,
            recommendations: this.generateRecommendations(),
            nextSteps: this.generateNextSteps()
        };

        // Save master report
        const reportPath = path.join(__dirname, 'monitoring/master-validation-report.json');
        await fs.writeFile(reportPath, JSON.stringify(masterReport, null, 2));
        
        // Generate human-readable summary
        await this.generateHumanReadableReport(masterReport);
        
        console.log(`📄 Master report saved: ${reportPath}`);
        
        return masterReport;
    }

    async generateHumanReadableReport(masterReport) {
        const reportLines = [
            '# COMPREHENSIVE VALIDATION TEST RESULTS',
            '=' .repeat(80),
            '',
            `**Generated:** ${masterReport.metadata.generatedAt}`,
            `**Duration:** ${Math.round(masterReport.metadata.duration / 1000)}s`,
            `**Platform:** ${masterReport.metadata.testEnvironment.platform} ${masterReport.metadata.testEnvironment.architecture}`,
            `**Node Version:** ${masterReport.metadata.testEnvironment.nodeVersion}`,
            '',
            '## 📊 EXECUTIVE SUMMARY',
            '',
            `**Overall Status:** ${masterReport.executionSummary.overallStatus}`,
            `**Test Suites:** ${masterReport.executionSummary.completedSuites}/${masterReport.executionSummary.totalTestSuites}`,
            `**Total Tests:** ${masterReport.executionSummary.totalTests}`,
            `**✅ Passed:** ${masterReport.executionSummary.passed}`,
            `**❌ Failed:** ${masterReport.executionSummary.failed}`,
            `**⚠️ Warnings:** ${masterReport.executionSummary.warnings}`,
            '',
            '## 🧪 TEST SUITE BREAKDOWN',
            ''
        ];

        // Add detailed test suite results
        for (const [suiteName, suiteData] of Object.entries(masterReport.testSuiteResults)) {
            const successRate = suiteData.summary.total > 0 
                ? Math.round((suiteData.summary.passed / suiteData.summary.total) * 100) 
                : 0;
            
            reportLines.push(`### ${suiteData.description}`);
            reportLines.push(`- **Status:** ${suiteData.status}`);
            reportLines.push(`- **Success Rate:** ${successRate}%`);
            reportLines.push(`- **Duration:** ${suiteData.duration}ms`);
            reportLines.push(`- **Results:** ${suiteData.summary.passed}✅ ${suiteData.summary.failed}❌ ${suiteData.summary.warnings}⚠️`);
            reportLines.push('');
        }

        // Add system health summary
        if (masterReport.systemHealthAnalysis) {
            reportLines.push('## 🏥 SYSTEM HEALTH ANALYSIS');
            reportLines.push('');
            reportLines.push(`**Final Status:** ${masterReport.systemHealthAnalysis.finalStatus.overall}`);
            reportLines.push(`**Health Alerts:** ${masterReport.systemHealthAnalysis.alerts.length}`);
            reportLines.push(`**Metrics Collected:** ${masterReport.systemHealthAnalysis.metrics.length}`);
            reportLines.push('');
        }

        // Add recommendations
        reportLines.push('## 🎯 RECOMMENDATIONS');
        reportLines.push('');
        masterReport.recommendations.forEach(rec => {
            reportLines.push(`- ${rec}`);
        });
        reportLines.push('');

        // Add next steps
        reportLines.push('## 📋 NEXT STEPS');
        reportLines.push('');
        masterReport.nextSteps.forEach(step => {
            reportLines.push(`1. ${step}`);
        });

        const humanReadableReport = reportLines.join('\n');
        const readableReportPath = path.join(__dirname, 'monitoring/validation-report-summary.md');
        await fs.writeFile(readableReportPath, humanReadableReport);
        
        console.log(`📋 Human-readable report: ${readableReportPath}`);
    }

    determineOverallStatus() {
        const { failed, warnings, totalTests } = this.results.summary;
        
        if (failed > 0) {
            return 'FAILED';
        } else if (warnings > 0) {
            return 'WARNING';
        } else if (totalTests > 0) {
            return 'PASSED';
        } else {
            return 'NO_TESTS';
        }
    }

    generateRecommendations() {
        const recommendations = [];
        const { summary, testSuites } = this.results;
        
        if (summary.failed > 0) {
            recommendations.push('🔴 Address failed tests immediately - system stability at risk');
        }
        
        if (summary.warnings > 0) {
            recommendations.push('🟡 Investigate warning conditions - potential issues detected');
        }
        
        // Check specific test suite failures
        for (const [name, suite] of Object.entries(testSuites)) {
            if (suite.status === 'FAILED') {
                recommendations.push(`🔧 Fix ${suite.description} - critical component failure`);
            } else if (suite.summary.failed > 0) {
                recommendations.push(`⚠️ Review ${suite.description} failures - ${suite.summary.failed} tests failed`);
            }
        }
        
        // System health recommendations
        if (this.results.systemHealth && this.results.systemHealth.alerts.length > 0) {
            recommendations.push('🏥 Review system health alerts - performance issues detected');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ All validations passed - system is stable and ready for production');
        }
        
        return recommendations;
    }

    generateNextSteps() {
        const nextSteps = [];
        const { summary, testSuites } = this.results;
        
        if (summary.failed > 0) {
            nextSteps.push('Run individual test suites in verbose mode to get detailed failure information');
            nextSteps.push('Fix critical issues identified in failed tests');
            nextSteps.push('Re-run validation suite after fixes are applied');
        }
        
        if (summary.warnings > 0) {
            nextSteps.push('Review warning conditions and determine if action is needed');
        }
        
        // Always include these steps
        nextSteps.push('Set up continuous monitoring using the system health monitor');
        nextSteps.push('Schedule regular validation runs (daily/weekly based on change frequency)');
        nextSteps.push('Document any configuration changes that affect validation results');
        nextSteps.push('Share validation results with development team');
        
        return nextSteps;
    }

    displayFinalResults() {
        console.log('\n\n🎯 FINAL VALIDATION RESULTS');
        console.log('=' .repeat(80));
        
        const { summary } = this.results;
        const successRate = summary.totalTests > 0 
            ? Math.round((summary.passed / summary.totalTests) * 100) 
            : 0;
        
        console.log(`📊 Overall Status: ${this.determineOverallStatus()}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`🧪 Total Tests: ${summary.totalTests}`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⚠️ Warnings: ${summary.warnings}`);
        console.log(`⏱️ Total Duration: ${Math.round(this.results.totalDuration / 1000)}s`);
        
        console.log('\n🔍 Test Suite Status:');
        for (const [name, suite] of Object.entries(this.results.testSuites)) {
            const status = suite.status === 'COMPLETED' && suite.summary.failed === 0 ? '✅' : '❌';
            console.log(`${status} ${suite.description}: ${suite.summary.passed}/${suite.summary.total} tests passed`);
        }
        
        if (this.results.systemHealth) {
            console.log(`\n🏥 System Health: ${this.results.systemHealth.finalStatus.overall}`);
            console.log(`🚨 Health Alerts: ${this.results.systemHealth.alerts.length}`);
        }
        
        console.log('\n📋 Reports Generated:');
        console.log('- tests/validation/monitoring/master-validation-report.json');
        console.log('- tests/validation/monitoring/validation-report-summary.md');
        console.log('- Individual test suite reports in respective directories');
        
        console.log('\n🏁 VALIDATION SUITE COMPLETE');
        console.log('=' .repeat(80));
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new MasterValidationRunner();
    
    runner.runAllValidationTests()
        .then((results) => {
            const exitCode = results.summary.failed > 0 ? 1 : 0;
            process.exit(exitCode);
        })
        .catch((error) => {
            console.error('❌ Validation suite error:', error);
            process.exit(1);
        });
}

module.exports = MasterValidationRunner;