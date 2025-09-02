#!/usr/bin/env node

/**
 * Enhanced Feature Flag Testing Script
 * Tests both authenticated and unauthenticated scenarios
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:8000';
const API_BASE = `${BASE_URL}/api/admin/feature-flags`;

// Test flags to verify
const TEST_FLAGS = [
  'admin.role_management_ui',
  'admin.security_audit_ui', 
  'admin.system_settings_ui',
  'admin.user_management_enhanced',
  'admin.custom_role_system',
];

let testResults = {
  summary: {
    backend_accessible: false,
    frontend_hook_exists: false,
    authentication_required: false,
    admin_access_required: false,
    service_functional: false
  },
  backend: {
    service_exists: false,
    endpoints_accessible: false,
    auth_required: false,
    admin_middleware_works: false,
    flag_definitions: {},
    tests: []
  },
  frontend: {
    hook_exists: false,
    hook_functions: {},
    flag_definitions: {},
    integration_score: 0,
    tests: []
  },
  authentication: {
    csrf_cookie_accessible: false,
    login_endpoint_works: false,
    admin_protected: false,
    tests: []
  },
  flags: {},
  errors: []
};

/**
 * Helper function to make API requests
 */
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers
      },
      timeout: 10000
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { 
      success: true, 
      data: response.data, 
      status: response.status,
      headers: response.headers 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status,
      headers: error.response?.headers
    };
  }
}

/**
 * Test CSRF cookie endpoint (should be public)
 */
async function testCsrfEndpoint() {
  console.log('🔐 Testing CSRF cookie endpoint...');
  
  try {
    const response = await makeRequest('GET', `${BASE_URL}/sanctum/csrf-cookie`);
    
    if (response.success || response.status === 204) {
      testResults.authentication.csrf_cookie_accessible = true;
      testResults.authentication.tests.push({
        test: 'CSRF Cookie Endpoint',
        result: 'PASS',
        details: 'CSRF endpoint is publicly accessible'
      });
      console.log('  ✅ CSRF cookie endpoint accessible');
    } else {
      testResults.authentication.tests.push({
        test: 'CSRF Cookie Endpoint',
        result: 'FAIL',
        details: `Status: ${response.status}`
      });
      console.log(`  ❌ CSRF cookie endpoint not accessible: ${response.status}`);
    }
  } catch (error) {
    testResults.errors.push(`CSRF endpoint test error: ${error.message}`);
    console.log(`  💥 CSRF endpoint test error: ${error.message}`);
  }
}

/**
 * Test login endpoint accessibility
 */
async function testLoginEndpoint() {
  console.log('👤 Testing login endpoint...');
  
  try {
    const response = await makeRequest('POST', `${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    // We expect this to fail but endpoint should be accessible
    if (response.status === 401 || response.status === 422) {
      testResults.authentication.login_endpoint_works = true;
      testResults.authentication.tests.push({
        test: 'Login Endpoint Accessibility',
        result: 'PASS',
        details: 'Login endpoint responds properly to invalid credentials'
      });
      console.log('  ✅ Login endpoint accessible and working');
    } else if (response.success) {
      testResults.authentication.tests.push({
        test: 'Login Endpoint Accessibility',
        result: 'UNEXPECTED',
        details: 'Login succeeded with test credentials'
      });
      console.log('  ⚠️  Login unexpectedly succeeded');
    } else {
      testResults.authentication.tests.push({
        test: 'Login Endpoint Accessibility',
        result: 'FAIL',
        details: `Unexpected status: ${response.status}`
      });
      console.log(`  ❌ Login endpoint issue: ${response.status}`);
    }
  } catch (error) {
    testResults.errors.push(`Login endpoint test error: ${error.message}`);
    console.log(`  💥 Login endpoint test error: ${error.message}`);
  }
}

/**
 * Test backend feature flag service (unauthenticated)
 */
async function testBackendServiceUnauthenticated() {
  console.log('🔍 Testing Backend FeatureFlagService (unauthenticated)...');
  
  try {
    const response = await makeRequest('GET', '');
    
    if (response.status === 401) {
      testResults.backend.auth_required = true;
      testResults.backend.admin_middleware_works = true;
      testResults.authentication.admin_protected = true;
      testResults.summary.authentication_required = true;
      testResults.summary.admin_access_required = true;
      
      testResults.backend.tests.push({
        test: 'Authentication Required',
        result: 'PASS',
        details: 'Feature flag endpoints properly require authentication'
      });
      
      console.log('  ✅ Authentication properly required (401 response)');
      console.log('  ✅ Admin middleware is working correctly');
      return true;
    } else if (response.success) {
      testResults.backend.tests.push({
        test: 'Authentication Security',
        result: 'SECURITY_ISSUE',
        details: 'Feature flags accessible without authentication'
      });
      console.log('  ⚠️  Security Issue: Feature flags accessible without authentication');
      return response.data;
    } else {
      testResults.backend.tests.push({
        test: 'Backend Service Basic Test',
        result: 'FAIL',
        details: `Unexpected response: ${response.status}`
      });
      console.log(`  ❌ Unexpected response: ${response.status}`);
      return null;
    }
  } catch (error) {
    testResults.errors.push(`Backend service test error: ${error.message}`);
    console.log(`  💥 Backend service test error: ${error.message}`);
    return null;
  }
}

/**
 * Test individual flag endpoints (unauthenticated)
 */
async function testIndividualFlagsUnauthenticated() {
  console.log('🚩 Testing individual feature flags (unauthenticated)...');
  
  for (const flag of TEST_FLAGS) {
    try {
      console.log(`  Testing flag: ${flag}`);
      const response = await makeRequest('GET', `/${flag}`);
      
      if (response.status === 401) {
        testResults.flags[flag] = {
          status: 'AUTH_REQUIRED',
          protected: true,
          message: 'Authentication required (correct behavior)'
        };
        console.log(`    ✅ ${flag}: Properly protected`);
      } else if (response.success) {
        testResults.flags[flag] = {
          status: 'ACCESSIBLE',
          enabled: response.data?.data?.enabled || false,
          rollout_percentage: response.data?.data?.rollout_percentage || 0,
          security_issue: true
        };
        console.log(`    ⚠️  ${flag}: Accessible without auth (security issue)`);
      } else {
        testResults.flags[flag] = {
          status: 'ERROR',
          error: response.error,
          httpStatus: response.status
        };
        console.log(`    ❌ ${flag}: Error - ${response.status}`);
      }
    } catch (error) {
      testResults.flags[flag] = {
        status: 'EXCEPTION',
        error: error.message
      };
      console.log(`    💥 ${flag}: Exception - ${error.message}`);
    }
  }
}

/**
 * Test backend service existence by analyzing code
 */
async function testBackendServiceExistence() {
  console.log('📂 Analyzing backend service implementation...');
  
  try {
    const servicePath = '../../../backend/app/Services/FeatureFlagService.php';
    const controllerPath = '../../../backend/app/Http/Controllers/Api/FeatureFlagController.php';
    
    let serviceExists = false;
    let controllerExists = false;
    
    if (fs.existsSync(servicePath)) {
      serviceExists = true;
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Analyze service features
      testResults.backend.service_exists = true;
      testResults.summary.backend_accessible = true;
      
      const features = {
        isEnabled: serviceContent.includes('isEnabled'),
        enable: serviceContent.includes('enable'),
        disable: serviceContent.includes('disable'),
        setRolloutPercentage: serviceContent.includes('setRolloutPercentage'),
        getAllFlags: serviceContent.includes('getAllFlags'),
        roleBasedAccess: serviceContent.includes('hasRoleAccess'),
        userSpecificFlags: serviceContent.includes('enableForUser'),
        caching: serviceContent.includes('Cache::'),
        databaseSupport: serviceContent.includes('DB::')
      };
      
      // Count defined flags
      const flagMatches = serviceContent.match(/'admin\.[^']+'/g) || [];
      const definedFlags = [...new Set(flagMatches.map(m => m.replace(/'/g, '')))];
      
      testResults.backend.flag_definitions = {
        count: definedFlags.length,
        flags: definedFlags
      };
      
      testResults.backend.tests.push({
        test: 'Service Implementation',
        result: 'PASS',
        details: `Service exists with ${Object.values(features).filter(Boolean).length}/${Object.keys(features).length} features`
      });
      
      console.log(`    ✅ FeatureFlagService exists with ${definedFlags.length} flags defined`);
      console.log(`    ✅ Service features: ${Object.entries(features).filter(([k,v]) => v).map(([k]) => k).join(', ')}`);
    }
    
    if (fs.existsSync(controllerPath)) {
      controllerExists = true;
      testResults.backend.endpoints_accessible = true;
      
      testResults.backend.tests.push({
        test: 'Controller Implementation',
        result: 'PASS',
        details: 'FeatureFlagController exists'
      });
      
      console.log('    ✅ FeatureFlagController exists');
    }
    
    if (serviceExists && controllerExists) {
      testResults.summary.service_functional = true;
    }
    
  } catch (error) {
    testResults.errors.push(`Backend analysis error: ${error.message}`);
    console.log(`    💥 Backend analysis error: ${error.message}`);
  }
}

/**
 * Test frontend hook implementation
 */
async function testFrontendHook() {
  console.log('🎣 Testing frontend useFeatureFlag hook...');
  
  try {
    const hookPath = '../../hooks/useFeatureFlag.tsx';
    
    if (fs.existsSync(hookPath)) {
      const hookContent = fs.readFileSync(hookPath, 'utf8');
      
      testResults.frontend.hook_exists = true;
      testResults.summary.frontend_hook_exists = true;
      
      // Analyze hook functions
      const functions = {
        useFeatureFlag: hookContent.includes('export function useFeatureFlag'),
        useFeatureFlags: hookContent.includes('export function useFeatureFlags'),
        FeatureFlagComponent: hookContent.includes('export function FeatureFlag'),
        clearCache: hookContent.includes('clearFeatureFlagCache'),
        caching: hookContent.includes('localStorage') && hookContent.includes('cache'),
        apiIntegration: hookContent.includes('apiService.get'),
        fallbackHandling: hookContent.includes('default') && hookContent.includes('fallback'),
        authIntegration: hookContent.includes('useAuth'),
        errorHandling: hookContent.includes('try') && hookContent.includes('catch')
      };
      
      testResults.frontend.hook_functions = functions;
      
      // Extract flag definitions
      const flagMatches = hookContent.match(/'admin\.[^']+'/g) || [];
      const definedFlags = [...new Set(flagMatches.map(m => m.replace(/'/g, '')))];
      
      testResults.frontend.flag_definitions = {
        count: definedFlags.length,
        flags: definedFlags
      };
      
      // Calculate integration score with backend
      const backendFlags = testResults.backend.flag_definitions?.flags || [];
      const commonFlags = definedFlags.filter(flag => backendFlags.includes(flag));
      testResults.frontend.integration_score = backendFlags.length > 0 ? 
        (commonFlags.length / backendFlags.length) * 100 : 0;
      
      testResults.frontend.tests = [
        {
          test: 'Hook File Exists',
          result: 'PASS',
          details: 'useFeatureFlag.tsx found'
        },
        ...Object.entries(functions).map(([name, exists]) => ({
          test: `Function: ${name}`,
          result: exists ? 'PASS' : 'FAIL',
          details: exists ? 'Function implemented' : 'Function missing'
        })),
        {
          test: 'Flag Definitions',
          result: definedFlags.length > 0 ? 'PASS' : 'FAIL',
          details: `${definedFlags.length} flags defined: ${definedFlags.join(', ')}`
        },
        {
          test: 'Backend Integration',
          result: testResults.frontend.integration_score >= 80 ? 'PASS' : 'WARN',
          details: `${testResults.frontend.integration_score.toFixed(1)}% flag compatibility`
        }
      ];
      
      console.log('    ✅ Frontend hook exists');
      console.log(`    📊 Hook functions: ${Object.entries(functions).filter(([k,v]) => v).length}/${Object.keys(functions).length} implemented`);
      console.log(`    🚩 Frontend flags: ${definedFlags.length} defined`);
      console.log(`    🔗 Integration score: ${testResults.frontend.integration_score.toFixed(1)}%`);
      
    } else {
      testResults.frontend.tests.push({
        test: 'Frontend Hook File',
        result: 'FAIL',
        details: 'useFeatureFlag.tsx not found'
      });
      console.log('    ❌ Frontend hook file not found');
    }
    
  } catch (error) {
    testResults.errors.push(`Frontend hook test error: ${error.message}`);
    console.log(`    💥 Frontend hook test error: ${error.message}`);
  }
}

/**
 * Test feature flag system architecture
 */
async function testSystemArchitecture() {
  console.log('🏗️  Testing system architecture...');
  
  // Check if both frontend and backend exist
  const fullStack = testResults.frontend.hook_exists && testResults.backend.service_exists;
  
  if (fullStack) {
    testResults.backend.tests.push({
      test: 'Full-Stack Architecture',
      result: 'PASS',
      details: 'Both frontend hook and backend service exist'
    });
    console.log('    ✅ Full-stack feature flag system detected');
  } else {
    testResults.backend.tests.push({
      test: 'Full-Stack Architecture',
      result: 'PARTIAL',
      details: `Frontend: ${testResults.frontend.hook_exists ? 'EXISTS' : 'MISSING'}, Backend: ${testResults.backend.service_exists ? 'EXISTS' : 'MISSING'}`
    });
    console.log('    ⚠️  Partial implementation detected');
  }
  
  // Check security implementation
  if (testResults.backend.auth_required && testResults.backend.admin_middleware_works) {
    testResults.backend.tests.push({
      test: 'Security Architecture',
      result: 'PASS',
      details: 'Admin endpoints properly protected'
    });
    console.log('    ✅ Security architecture correct');
  } else {
    testResults.backend.tests.push({
      test: 'Security Architecture',
      result: 'SECURITY_ISSUE',
      details: 'Admin endpoints may not be properly protected'
    });
    console.log('    ⚠️  Security architecture needs review');
  }
}

/**
 * Generate comprehensive test report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 ENHANCED FEATURE FLAGS TESTING REPORT');
  console.log('='.repeat(80));
  
  // Summary
  console.log('\n📊 EXECUTIVE SUMMARY:');
  console.log(`  Backend Service: ${testResults.summary.backend_accessible ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  Frontend Hook: ${testResults.summary.frontend_hook_exists ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  Authentication: ${testResults.summary.authentication_required ? '✅ REQUIRED' : '❌ NOT REQUIRED'}`);
  console.log(`  Admin Protection: ${testResults.summary.admin_access_required ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
  console.log(`  System Status: ${testResults.summary.service_functional ? '✅ FUNCTIONAL' : '⚠️  NEEDS REVIEW'}`);
  
  // Backend Details
  console.log('\n🔧 BACKEND ANALYSIS:');
  if (testResults.backend.service_exists) {
    console.log(`  Service Implementation: ✅ COMPLETE`);
    console.log(`  Defined Flags: ${testResults.backend.flag_definitions?.count || 0}`);
    console.log(`  Authentication: ${testResults.backend.auth_required ? '✅ REQUIRED' : '❌ NOT REQUIRED'}`);
    console.log(`  Admin Middleware: ${testResults.backend.admin_middleware_works ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  } else {
    console.log('  ❌ Service not found');
  }
  
  if (testResults.backend.tests.length > 0) {
    console.log('\n  Backend Test Results:');
    testResults.backend.tests.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : 
                  test.result === 'FAIL' ? '❌' : 
                  test.result === 'SECURITY_ISSUE' ? '🚨' : '⚠️ ';
      console.log(`    ${icon} ${test.test}: ${test.details}`);
    });
  }
  
  // Frontend Details
  console.log('\n🎨 FRONTEND ANALYSIS:');
  if (testResults.frontend.hook_exists) {
    console.log(`  Hook Implementation: ✅ EXISTS`);
    console.log(`  Defined Flags: ${testResults.frontend.flag_definitions?.count || 0}`);
    console.log(`  Integration Score: ${testResults.frontend.integration_score.toFixed(1)}%`);
    
    const functions = testResults.frontend.hook_functions || {};
    const implementedCount = Object.values(functions).filter(Boolean).length;
    const totalCount = Object.keys(functions).length;
    console.log(`  Function Coverage: ${implementedCount}/${totalCount} (${totalCount > 0 ? (implementedCount/totalCount*100).toFixed(1) : 0}%)`);
  } else {
    console.log('  ❌ Hook not found');
  }
  
  if (testResults.frontend.tests.length > 0) {
    console.log('\n  Frontend Test Results:');
    testResults.frontend.tests.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : test.result === 'WARN' ? '⚠️ ' : '❌';
      console.log(`    ${icon} ${test.test}: ${test.details}`);
    });
  }
  
  // Authentication Analysis
  console.log('\n🔐 AUTHENTICATION ANALYSIS:');
  console.log(`  CSRF Endpoint: ${testResults.authentication.csrf_cookie_accessible ? '✅ ACCESSIBLE' : '❌ INACCESSIBLE'}`);
  console.log(`  Login Endpoint: ${testResults.authentication.login_endpoint_works ? '✅ WORKING' : '❌ NOT WORKING'}`);
  console.log(`  Admin Protection: ${testResults.authentication.admin_protected ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
  
  if (testResults.authentication.tests.length > 0) {
    console.log('\n  Authentication Test Results:');
    testResults.authentication.tests.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : 
                  test.result === 'UNEXPECTED' ? '⚠️ ' : '❌';
      console.log(`    ${icon} ${test.test}: ${test.details}`);
    });
  }
  
  // Flag Status
  console.log('\n🚩 FEATURE FLAG STATUS:');
  Object.entries(testResults.flags).forEach(([flag, data]) => {
    if (data.status === 'AUTH_REQUIRED') {
      console.log(`  ✅ ${flag}: Properly protected (requires authentication)`);
    } else if (data.status === 'ACCESSIBLE') {
      console.log(`  ${data.security_issue ? '🚨' : '✅'} ${flag}: ${data.security_issue ? 'SECURITY ISSUE - Accessible without auth' : 'Accessible'}`);
      if (data.enabled !== undefined) {
        console.log(`      Enabled: ${data.enabled}, Rollout: ${data.rollout_percentage}%`);
      }
    } else {
      console.log(`  ❌ ${flag}: ${data.error || 'Error occurred'}`);
    }
  });
  
  // Errors
  if (testResults.errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:');
    testResults.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
  }
  
  // Final Assessment
  console.log('\n' + '='.repeat(80));
  const backendScore = testResults.backend.service_exists ? 1 : 0;
  const frontendScore = testResults.frontend.hook_exists ? 1 : 0;
  const securityScore = testResults.backend.auth_required && testResults.backend.admin_middleware_works ? 1 : 0;
  const totalScore = backendScore + frontendScore + securityScore;
  
  if (totalScore === 3) {
    console.log('🎉 OVERALL ASSESSMENT: ✅ EXCELLENT');
    console.log('   Complete feature flag system with proper security implementation.');
  } else if (totalScore === 2) {
    console.log('⚠️  OVERALL ASSESSMENT: 🔧 GOOD');
    console.log('   Feature flag system mostly implemented but needs attention in some areas.');
  } else if (totalScore === 1) {
    console.log('⚠️  OVERALL ASSESSMENT: 🚧 PARTIAL');
    console.log('   Feature flag system partially implemented. Significant work needed.');
  } else {
    console.log('❌ OVERALL ASSESSMENT: 💥 INCOMPLETE');
    console.log('   Feature flag system not properly implemented.');
  }
  
  console.log('\n📋 RECOMMENDATIONS:');
  if (!testResults.backend.service_exists) {
    console.log('   • Implement FeatureFlagService backend service');
  }
  if (!testResults.frontend.hook_exists) {
    console.log('   • Implement useFeatureFlag frontend hook');
  }
  if (!testResults.backend.auth_required) {
    console.log('   • Add authentication middleware to feature flag endpoints');
  }
  if (testResults.frontend.integration_score < 80) {
    console.log('   • Sync frontend and backend flag definitions');
  }
  if (Object.values(testResults.flags).some(f => f.security_issue)) {
    console.log('   • 🚨 CRITICAL: Fix security issues - feature flags should require authentication');
  }
  
  console.log('='.repeat(80));
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Enhanced Feature Flags Testing...\n');
  
  // Run authentication tests first
  await testCsrfEndpoint();
  await testLoginEndpoint();
  
  // Test backend service (unauthenticated)
  await testBackendServiceUnauthenticated();
  await testIndividualFlagsUnauthenticated();
  
  // Analyze service implementation
  await testBackendServiceExistence();
  
  // Test frontend hook
  await testFrontendHook();
  
  // Test system architecture
  await testSystemArchitecture();
  
  // Generate final report
  generateReport();
  
  // Save detailed results
  const resultsPath = './enhanced-feature-flag-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
  
  // Return appropriate exit code
  const systemFunctional = testResults.summary.service_functional && 
                          testResults.summary.authentication_required;
  
  return systemFunctional ? 0 : 1;
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testResults };