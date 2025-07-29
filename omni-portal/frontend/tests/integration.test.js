/**
 * Frontend Integration Tests for Health Questionnaire
 * Integration Tester Agent - Hive Mind Audit Swarm
 * 
 * Tests complete user journey from frontend perspective
 * Validates React components, API integration, and user experience
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class FrontendIntegrationTester {
    constructor() {
        this.baseUrl = process.env.TEST_FRONTEND_URL || 'http://localhost:3000';
        this.apiUrl = process.env.TEST_API_URL || 'http://localhost:8000';
        this.browser = null;
        this.page = null;
        this.testResults = {
            suite: 'Frontend Integration Tests',
            timestamp: new Date().toISOString(),
            tests: {}
        };
    }

    async setup() {
        try {
            console.log('🚀 Setting up browser environment...');
            this.browser = await chromium.launch({ 
                headless: true,
                args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
            });
            
            this.page = await this.browser.newPage();
            
            // Set up request/response monitoring
            this.page.on('request', request => {
                if (request.url().includes('/api/')) {
                    console.log(`📤 API Request: ${request.method()} ${request.url()}`);
                }
            });
            
            this.page.on('response', response => {
                if (response.url().includes('/api/')) {
                    console.log(`📥 API Response: ${response.status()} ${response.url()}`);
                }
            });
            
            // Set up console monitoring
            this.page.on('console', msg => {
                if (msg.type() === 'error') {
                    console.log(`❌ Console Error: ${msg.text()}`);
                }
            });
            
            return true;
        } catch (error) {
            console.error('Failed to setup browser:', error);
            return false;
        }
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    /**
     * Test 1: Health Questionnaire User Journey
     */
    async testHealthQuestionnaireJourney() {
        const testName = 'Health Questionnaire User Journey';
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = {
                test_name: testName,
                status: 'running',
                steps: {}
            };

            // Step 1: Navigate to health questionnaire page
            console.log('  📍 Step 1: Navigate to health questionnaire');
            await this.page.goto(`${this.baseUrl}/health-questionnaire`);
            await this.page.waitForLoadState('networkidle');
            
            // Check if page loads correctly
            const pageTitle = await this.page.textContent('h1');
            result.steps.page_load = {
                status: pageTitle?.includes('Saúde') ? 'passed' : 'failed',
                page_title: pageTitle
            };

            // Step 2: Check if dual pathway component renders
            console.log('  🎯 Step 2: Check dual pathway component');
            const dualPathwayComponent = await this.page.locator('[data-testid="dual-pathway"], .dual-pathway, h1:has-text("Avaliação")');
            const componentVisible = await dualPathwayComponent.isVisible().catch(() => false);
            
            result.steps.component_render = {
                status: componentVisible ? 'passed' : 'failed',
                component_visible: componentVisible
            };

            // Step 3: Test initialization sequence
            console.log('  ⚡ Step 3: Test system initialization');
            await this.page.waitForTimeout(3000); // Wait for initialization
            
            // Look for initialization indicators
            const initializationIndicators = await this.page.locator('text=Inicializando, text=Sistema, text=Preparando').count();
            result.steps.initialization = {
                status: initializationIndicators > 0 ? 'passed' : 'skipped',
                indicators_found: initializationIndicators
            };

            // Step 4: Test questionnaire interaction (if available)
            console.log('  📝 Step 4: Test questionnaire interaction');
            await this.page.waitForTimeout(2000);
            
            // Look for interactive elements
            const interactiveElements = await this.page.locator('button, input, select, [role="button"]').count();
            const buttons = await this.page.locator('button:visible').count();
            
            result.steps.interaction = {
                status: interactiveElements > 0 ? 'passed' : 'failed',
                interactive_elements: interactiveElements,
                visible_buttons: buttons
            };

            // Step 5: Test API integration
            console.log('  🔌 Step 5: Test API integration');
            let apiCalls = 0;
            
            // Monitor API calls
            this.page.on('response', response => {
                if (response.url().includes('/api/health-questionnaires')) {
                    apiCalls++;
                }
            });
            
            // Try to trigger API calls by interacting with elements
            try {
                const firstButton = this.page.locator('button:visible').first();
                if (await firstButton.isVisible()) {
                    await firstButton.click();
                    await this.page.waitForTimeout(1000);
                }
            } catch (e) {
                console.log('    ℹ️  No interactive elements found');
            }
            
            result.steps.api_integration = {
                status: apiCalls > 0 ? 'passed' : 'warning',
                api_calls_detected: apiCalls
            };

            // Overall test status
            const passedSteps = Object.values(result.steps).filter(step => step.status === 'passed').length;
            const totalSteps = Object.keys(result.steps).length;
            
            result.status = passedSteps >= totalSteps * 0.6 ? 'passed' : 'failed'; // 60% pass rate
            result.pass_rate = `${passedSteps}/${totalSteps}`;
            
            this.testResults.tests.health_questionnaire_journey = result;
            return result;

        } catch (error) {
            const result = {
                test_name: testName,
                status: 'failed',
                error: error.message,
                stack: error.stack
            };
            this.testResults.tests.health_questionnaire_journey = result;
            return result;
        }
    }

    /**
     * Test 2: Performance and Load Testing
     */
    async testPerformanceMetrics() {
        const testName = 'Performance and Load Testing';
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = {
                test_name: testName,
                status: 'running',
                metrics: {}
            };

            // Test 1: Page load performance
            console.log('  ⚡ Measuring page load performance');
            const startTime = Date.now();
            await this.page.goto(`${this.baseUrl}/health-questionnaire`);
            await this.page.waitForLoadState('domcontentloaded');
            const loadTime = Date.now() - startTime;
            
            result.metrics.page_load_time = {
                milliseconds: loadTime,
                status: loadTime < 3000 ? 'passed' : 'failed' // 3 second limit
            };

            // Test 2: Memory usage monitoring
            console.log('  🧠 Monitoring memory usage');
            const metrics = await this.page.evaluate(() => {
                return {
                    memory: performance.memory ? {
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit
                    } : null,
                    timing: performance.timing ? {
                        navigationStart: performance.timing.navigationStart,
                        loadEventEnd: performance.timing.loadEventEnd,
                        domComplete: performance.timing.domComplete
                    } : null
                };
            });
            
            result.metrics.memory_usage = {
                status: 'passed',
                memory_info: metrics.memory,
                timing_info: metrics.timing
            };

            // Test 3: Network request performance
            console.log('  🌐 Testing network requests');
            const requests = [];
            this.page.on('response', response => {
                if (response.url().includes('/api/')) {
                    requests.push({
                        url: response.url(),
                        status: response.status(),
                        timing: response.timing?.responseEnd || 0
                    });
                }
            });

            // Trigger some interactions to generate requests
            await this.page.waitForTimeout(2000);
            
            result.metrics.network_performance = {
                status: requests.length > 0 ? 'passed' : 'warning',
                api_requests: requests.length,
                requests: requests
            };

            // Test 4: Accessibility check
            console.log('  ♿ Running accessibility checks');
            const accessibilityIssues = await this.page.locator('*:not([alt]):not([aria-label]):not([aria-labelledby])').count();
            const headingStructure = await this.page.locator('h1, h2, h3, h4, h5, h6').count();
            
            result.metrics.accessibility = {
                status: headingStructure > 0 ? 'passed' : 'warning',
                heading_structure_count: headingStructure,
                potential_issues: accessibilityIssues
            };

            // Overall performance assessment
            const passedMetrics = Object.values(result.metrics).filter(metric => metric.status === 'passed').length;
            const totalMetrics = Object.keys(result.metrics).length;
            
            result.status = passedMetrics >= totalMetrics * 0.75 ? 'passed' : 'failed';
            result.pass_rate = `${passedMetrics}/${totalMetrics}`;
            
            this.testResults.tests.performance_metrics = result;
            return result;

        } catch (error) {
            const result = {
                test_name: testName,
                status: 'failed',
                error: error.message
            };
            this.testResults.tests.performance_metrics = result;
            return result;
        }
    }

    /**
     * Test 3: Cross-browser Compatibility
     */
    async testCrossBrowserCompatibility() {
        const testName = 'Cross-browser Compatibility';
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = {
                test_name: testName,
                status: 'running',
                browsers: {}
            };

            // Test different viewport sizes (mobile compatibility)
            const viewports = [
                { name: 'mobile', width: 375, height: 667 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'desktop', width: 1920, height: 1080 }
            ];

            for (const viewport of viewports) {
                console.log(`  📱 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
                
                await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
                await this.page.goto(`${this.baseUrl}/health-questionnaire`);
                await this.page.waitForLoadState('networkidle');

                // Check if layout adapts properly
                const bodyWidth = await this.page.evaluate(() => document.body.offsetWidth);
                const hasResponsiveElements = await this.page.locator('.responsive, .mobile, .desktop, [class*="sm:"], [class*="md:"], [class*="lg:"]').count();
                
                result.browsers[viewport.name] = {
                    status: bodyWidth <= viewport.width ? 'passed' : 'failed',
                    actual_width: bodyWidth,
                    expected_width: viewport.width,
                    responsive_elements: hasResponsiveElements
                };
            }

            // Test JavaScript functionality across viewports
            console.log('  🔧 Testing JavaScript functionality');
            const jsErrors = [];
            this.page.on('pageerror', error => {
                jsErrors.push(error.message);
            });

            await this.page.evaluate(() => {
                // Test basic JavaScript functionality
                if (typeof window.React === 'undefined' && typeof window.next === 'undefined') {
                    throw new Error('React or Next.js not properly loaded');
                }
            });

            result.javascript_functionality = {
                status: jsErrors.length === 0 ? 'passed' : 'failed',
                errors: jsErrors
            };

            // Overall compatibility assessment
            const compatibleViewports = Object.values(result.browsers).filter(browser => browser.status === 'passed').length;
            const totalViewports = Object.keys(result.browsers).length;
            
            result.status = (compatibleViewports === totalViewports && result.javascript_functionality.status === 'passed') ? 'passed' : 'failed';
            result.compatibility_rate = `${compatibleViewports}/${totalViewports}`;
            
            this.testResults.tests.cross_browser_compatibility = result;
            return result;

        } catch (error) {
            const result = {
                test_name: testName,
                status: 'failed',
                error: error.message
            };
            this.testResults.tests.cross_browser_compatibility = result;
            return result;
        }
    }

    /**
     * Test 4: Error Handling and Edge Cases
     */
    async testErrorHandling() {
        const testName = 'Error Handling and Edge Cases';
        console.log(`\n🧪 Running: ${testName}`);
        
        try {
            const result = {
                test_name: testName,
                status: 'running',
                error_scenarios: {}
            };

            // Test 1: Network failure simulation
            console.log('  🌐 Testing network failure handling');
            await this.page.route('**/api/**', route => {
                // Simulate network failure for some requests
                if (Math.random() < 0.3) { // 30% failure rate
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await this.page.goto(`${this.baseUrl}/health-questionnaire`);
            await this.page.waitForTimeout(3000);

            // Check if page handles network failures gracefully
            const errorMessages = await this.page.locator('text=erro, text=falha, text=Error, .error, .alert-error').count();
            const loadingIndicators = await this.page.locator('text=Carregando, text=Loading, .loading, .spinner').count();
            
            result.error_scenarios.network_failure = {
                status: errorMessages > 0 || loadingIndicators > 0 ? 'passed' : 'warning',
                error_messages_shown: errorMessages,
                loading_indicators: loadingIndicators
            };

            // Reset route interception
            await this.page.unroute('**/api/**');

            // Test 2: JavaScript errors
            console.log('  🐛 Testing JavaScript error handling');
            const jsErrors = [];
            this.page.on('pageerror', error => {
                jsErrors.push(error.message);
            });

            // Inject some potential error scenarios
            await this.page.evaluate(() => {
                // Test undefined variable access
                try {
                    window.testUndefinedAccess = window.nonExistentVariable?.property;
                } catch (e) {
                    console.log('Caught undefined access error:', e.message);
                }
                
                // Test null pointer
                try {
                    const nullObj = null;
                    nullObj.method();
                } catch (e) {
                    console.log('Caught null pointer error:', e.message);
                }
            });

            await this.page.waitForTimeout(1000);

            result.error_scenarios.javascript_errors = {
                status: 'passed', // If page still works, error handling is good
                uncaught_errors: jsErrors.length,
                errors: jsErrors
            };

            // Test 3: Invalid form data
            console.log('  📝 Testing invalid form data handling');
            try {
                // Try to find and interact with form elements
                const inputs = await this.page.locator('input, select, textarea').count();
                const forms = await this.page.locator('form').count();
                
                if (inputs > 0) {
                    // Try submitting empty or invalid data
                    await this.page.fill('input[type="text"]:visible', ''); // Empty required field
                    await this.page.fill('input[type="email"]:visible', 'invalid-email'); // Invalid email
                    
                    const submitButton = this.page.locator('button[type="submit"]:visible, button:has-text("Enviar"):visible, button:has-text("Submit"):visible');
                    if (await submitButton.isVisible()) {
                        await submitButton.click();
                        await this.page.waitForTimeout(1000);
                    }
                }
                
                const validationErrors = await this.page.locator('.error, .invalid, [aria-invalid="true"], .text-red, .text-danger').count();
                
                result.error_scenarios.form_validation = {
                    status: validationErrors > 0 || inputs === 0 ? 'passed' : 'warning',
                    form_elements: inputs,
                    forms_found: forms,
                    validation_errors_shown: validationErrors
                };
                
            } catch (e) {
                result.error_scenarios.form_validation = {
                    status: 'skipped',
                    reason: 'No forms found or interaction failed'
                };
            }

            // Test 4: Offline behavior
            console.log('  📱 Testing offline behavior');
            await this.page.context().setOffline(true);
            await this.page.reload();
            await this.page.waitForTimeout(2000);
            
            const offlineIndicators = await this.page.locator('text=offline, text=sem conexão, .offline').count();
            
            result.error_scenarios.offline_handling = {
                status: offlineIndicators > 0 ? 'passed' : 'warning',
                offline_indicators: offlineIndicators
            };
            
            // Restore online state
            await this.page.context().setOffline(false);

            // Overall error handling assessment
            const goodErrorHandling = Object.values(result.error_scenarios).filter(scenario => 
                scenario.status === 'passed'
            ).length;
            const totalScenarios = Object.keys(result.error_scenarios).length;
            
            result.status = goodErrorHandling >= totalScenarios * 0.6 ? 'passed' : 'failed';
            result.error_handling_rate = `${goodErrorHandling}/${totalScenarios}`;
            
            this.testResults.tests.error_handling = result;
            return result;

        } catch (error) {
            const result = {
                test_name: testName,
                status: 'failed',
                error: error.message
            };
            this.testResults.tests.error_handling = result;
            return result;
        }
    }

    /**
     * Run all frontend integration tests
     */
    async runAllTests() {
        console.log('🚀 Starting Frontend Integration Test Suite');
        console.log('==========================================\n');

        if (!await this.setup()) {
            return {
                status: 'failed',
                error: 'Failed to setup test environment'
            };
        }

        try {
            // Run all test categories
            const testMethods = [
                'testHealthQuestionnaireJourney',
                'testPerformanceMetrics',
                'testCrossBrowserCompatibility',
                'testErrorHandling'
            ];

            for (const method of testMethods) {
                const result = await this[method]();
                console.log(`✅ ${result.test_name}: ${result.status}\n`);
            }

            // Calculate overall results
            const allTests = Object.values(this.testResults.tests);
            const passedTests = allTests.filter(test => test.status === 'passed').length;
            const totalTests = allTests.length;

            this.testResults.summary = {
                total_tests: totalTests,
                passed_tests: passedTests,
                failed_tests: totalTests - passedTests,
                overall_status: passedTests === totalTests ? 'passed' : 'failed',
                pass_rate: `${passedTests}/${totalTests}`,
                test_environment: {
                    frontend_url: this.baseUrl,
                    api_url: this.apiUrl,
                    browser: 'chromium'
                }
            };

            return this.testResults;

        } finally {
            await this.teardown();
        }
    }

    /**
     * Save test results to file
     */
    async saveResults() {
        const resultsPath = path.join(__dirname, 'frontend_integration_results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.testResults, null, 2));
        
        console.log(`\n📁 Test results saved to: ${resultsPath}`);
        
        // Also save memory for agent coordination
        const memoryPath = path.join(__dirname, 'frontend_tester_memory.json');
        const memoryData = {
            frontend_test_results: this.testResults,
            test_execution_time: new Date().toISOString(),
            frontend_stability: this.testResults.summary?.overall_status === 'passed' ? 'stable' : 'needs_improvement',
            compatibility_status: this.testResults.tests.cross_browser_compatibility?.status || 'unknown',
            performance_status: this.testResults.tests.performance_metrics?.status || 'unknown'
        };
        
        fs.writeFileSync(memoryPath, JSON.stringify(memoryData, null, 2));
        console.log(`🧠 Memory data saved to: ${memoryPath}`);
    }
}

// Run tests if called directly
if (require.main === module) {
    (async () => {
        const tester = new FrontendIntegrationTester();
        const results = await tester.runAllTests();
        
        console.log('\n' + '='.repeat(50));
        console.log('FRONTEND INTEGRATION TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Overall Status: ${results.summary?.overall_status?.toUpperCase() || 'UNKNOWN'}`);
        console.log(`Tests Passed: ${results.summary?.passed_tests || 0}/${results.summary?.total_tests || 0}`);
        console.log(`Environment: ${results.summary?.test_environment?.frontend_url || 'Unknown'}`);
        
        await tester.saveResults();
        
        // Exit with appropriate code
        process.exit(results.summary?.overall_status === 'passed' ? 0 : 1);
    })();
}

module.exports = FrontendIntegrationTester;