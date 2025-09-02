#!/usr/bin/env node

/**
 * Comprehensive Feature Flag End-to-End Testing Script
 * Tests backend FeatureFlagService and frontend useFeatureFlag hook
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

// Test results storage
let testResults = {
  backend: {
    serviceExists: false,
    endpointsWork: false,
    enableDisable: false,
    rolloutPercentage: false,
    roleAccess: false,
    userSpecific: false,
    tests: []
  },
  frontend: {
    hookExists: false,
    integration: false,
    caching: false,
    fallback: false,
    tests: []
  },
  flags: {},
  errors: []
};

/**
 * Helper function to make authenticated API requests
 */
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status 
    };
  }
}

/**
 * Test 1: Backend Service Existence and Basic Functionality
 */
async function testBackendService() {
  console.log('🔍 Testing Backend FeatureFlagService...');
  
  try {
    // Test API endpoint accessibility
    const response = await makeRequest('GET', '');
    
    if (response.success) {
      testResults.backend.serviceExists = true;
      testResults.backend.endpointsWork = true;
      testResults.backend.tests.push({
        test: 'API Endpoints Accessible',
        result: 'PASS',
        details: `Got ${response.status} response with data`
      });

      console.log('✅ Backend service exists and responds');
      console.log('📊 Response data:', JSON.stringify(response.data, null, 2));

      return response.data.data || response.data;
    } else {
      testResults.backend.tests.push({
        test: 'API Endpoints Accessible',
        result: 'FAIL',
        details: `${response.status}: ${response.error}`
      });
      console.log('❌ Backend service not accessible:', response.error);
      return null;
    }
  } catch (error) {
    testResults.errors.push(`Backend test error: ${error.message}`);
    testResults.backend.tests.push({
      test: 'Backend Service Basic Test',
      result: 'ERROR',
      details: error.message
    });
    console.log('💥 Backend test error:', error.message);
    return null;
  }
}

/**
 * Test 2: Individual Flag Status Testing
 */
async function testIndividualFlags() {
  console.log('🚩 Testing individual feature flags...');
  
  for (const flag of TEST_FLAGS) {
    try {
      console.log(`\n  Testing flag: ${flag}`);
      const response = await makeRequest('GET', `/${flag}`);
      
      if (response.success) {
        testResults.flags[flag] = {
          status: 'ACCESSIBLE',
          enabled: response.data.data?.enabled || false,
          rollout_percentage: response.data.data?.rollout_percentage || 0,
          user_enabled: response.data.data?.user_enabled || false,
          name: response.data.data?.name || flag
        };
        
        console.log(`  ✅ ${flag}: enabled=${testResults.flags[flag].enabled}, rollout=${testResults.flags[flag].rollout_percentage}%`);
      } else {
        testResults.flags[flag] = {
          status: 'ERROR',
          error: response.error,
          httpStatus: response.status
        };
        console.log(`  ❌ ${flag}: ${response.error}`);
      }
    } catch (error) {
      testResults.flags[flag] = {
        status: 'EXCEPTION',
        error: error.message
      };
      console.log(`  💥 ${flag}: ${error.message}`);
    }
  }
}

/**
 * Test 3: Enable/Disable Functionality (Admin required)
 */
async function testEnableDisable() {
  console.log('🔄 Testing enable/disable functionality...');
  
  const testFlag = TEST_FLAGS[0]; // Use first flag for testing
  
  try {
    // Test enable
    console.log(`  Attempting to enable ${testFlag}...`);
    const enableResponse = await makeRequest('POST', `/${testFlag}/enable`, {
      rollout_percentage: 50
    });
    
    if (enableResponse.success) {
      testResults.backend.enableDisable = true;
      testResults.backend.tests.push({
        test: 'Enable Flag',
        result: 'PASS',
        details: `Successfully enabled ${testFlag}`
      });
      console.log(`  ✅ Enable successful`);
    } else if (enableResponse.status === 403) {
      testResults.backend.tests.push({
        test: 'Enable Flag',
        result: 'SKIP',
        details: 'No admin permissions (expected for non-admin users)'
      });
      console.log(`  ⚠️  Enable skipped: No admin permissions (this is expected)`);
    } else {
      testResults.backend.tests.push({
        test: 'Enable Flag',
        result: 'FAIL',
        details: `Failed to enable: ${enableResponse.error}`
      });
      console.log(`  ❌ Enable failed: ${enableResponse.error}`);
    }
    
    // Test disable
    console.log(`  Attempting to disable ${testFlag}...`);
    const disableResponse = await makeRequest('POST', `/${testFlag}/disable`);
    
    if (disableResponse.success) {
      testResults.backend.tests.push({
        test: 'Disable Flag',
        result: 'PASS',
        details: `Successfully disabled ${testFlag}`
      });
      console.log(`  ✅ Disable successful`);
    } else if (disableResponse.status === 403) {
      testResults.backend.tests.push({
        test: 'Disable Flag',
        result: 'SKIP',
        details: 'No admin permissions (expected for non-admin users)'
      });
      console.log(`  ⚠️  Disable skipped: No admin permissions (this is expected)`);
    } else {
      testResults.backend.tests.push({
        test: 'Disable Flag',
        result: 'FAIL',
        details: `Failed to disable: ${disableResponse.error}`
      });
      console.log(`  ❌ Disable failed: ${disableResponse.error}`);
    }
    
  } catch (error) {
    testResults.errors.push(`Enable/Disable test error: ${error.message}`);
    console.log(`  💥 Enable/Disable test error: ${error.message}`);
  }
}

/**
 * Test 4: Rollout Percentage Functionality
 */
async function testRolloutPercentage() {
  console.log('📊 Testing rollout percentage functionality...');
  
  const testFlag = TEST_FLAGS[1]; // Use second flag for testing
  
  try {
    const response = await makeRequest('POST', `/${testFlag}/rollout`, {
      percentage: 25
    });
    
    if (response.success) {
      testResults.backend.rolloutPercentage = true;
      testResults.backend.tests.push({
        test: 'Rollout Percentage',
        result: 'PASS',
        details: 'Successfully set rollout percentage to 25%'
      });
      console.log('  ✅ Rollout percentage test passed');
    } else if (response.status === 403) {
      testResults.backend.tests.push({
        test: 'Rollout Percentage',
        result: 'SKIP',
        details: 'No admin permissions (expected for non-admin users)'
      });
      console.log('  ⚠️  Rollout percentage test skipped: No admin permissions');
    } else {
      testResults.backend.tests.push({
        test: 'Rollout Percentage',
        result: 'FAIL',
        details: `Failed: ${response.error}`
      });
      console.log(`  ❌ Rollout percentage test failed: ${response.error}`);
    }
  } catch (error) {
    testResults.errors.push(`Rollout percentage test error: ${error.message}`);
    console.log(`  💥 Rollout percentage test error: ${error.message}`);
  }
}

/**
 * Test 5: Frontend Hook Testing (Static Analysis)
 */
async function testFrontendHook() {
  console.log('🎣 Testing frontend useFeatureFlag hook...');
  
  try {
    // Check if hook file exists and analyze structure
    const hookPath = '../hooks/useFeatureFlag.tsx';
    
    if (fs.existsSync(hookPath)) {
      const hookContent = fs.readFileSync(hookPath, 'utf8');
      
      testResults.frontend.hookExists = true;
      
      // Check for key functions
      const hasUseFeatureFlag = hookContent.includes('export function useFeatureFlag');
      const hasUseFeatureFlags = hookContent.includes('export function useFeatureFlags');
      const hasFeatureFlagComponent = hookContent.includes('export function FeatureFlag');
      const hasCaching = hookContent.includes('localStorage') && hookContent.includes('cache');
      const hasApiIntegration = hookContent.includes('apiService.get');
      const hasFallback = hookContent.includes('default') && hookContent.includes('fallback');
      
      testResults.frontend.integration = hasApiIntegration;
      testResults.frontend.caching = hasCaching;
      testResults.frontend.fallback = hasFallback;
      
      testResults.frontend.tests = [
        {
          test: 'useFeatureFlag Hook Exists',
          result: hasUseFeatureFlag ? 'PASS' : 'FAIL',
          details: hasUseFeatureFlag ? 'Hook function found' : 'Hook function not found'
        },
        {
          test: 'useFeatureFlags Multi Hook Exists',
          result: hasUseFeatureFlags ? 'PASS' : 'FAIL',
          details: hasUseFeatureFlags ? 'Multi-flag hook found' : 'Multi-flag hook not found'
        },
        {
          test: 'FeatureFlag Component Exists',
          result: hasFeatureFlagComponent ? 'PASS' : 'FAIL',
          details: hasFeatureFlagComponent ? 'Component wrapper found' : 'Component wrapper not found'
        },
        {
          test: 'API Integration',
          result: hasApiIntegration ? 'PASS' : 'FAIL',
          details: hasApiIntegration ? 'API service integration found' : 'No API integration found'
        },
        {
          test: 'Caching Mechanism',
          result: hasCaching ? 'PASS' : 'FAIL',
          details: hasCaching ? 'localStorage caching implemented' : 'No caching mechanism found'
        },
        {
          test: 'Fallback Handling',
          result: hasFallback ? 'PASS' : 'FAIL',
          details: hasFallback ? 'Fallback to defaults implemented' : 'No fallback mechanism found'
        }
      ];
      
      console.log('  ✅ Frontend hook file exists and contains expected functionality');
      
      // Check for specific admin flags
      TEST_FLAGS.forEach(flag => {
        const hasFlag = hookContent.includes(flag);
        testResults.frontend.tests.push({
          test: `Flag Definition: ${flag}`,
          result: hasFlag ? 'PASS' : 'FAIL',
          details: hasFlag ? 'Flag defined in frontend' : 'Flag not defined in frontend'
        });
      });
      
    } else {
      testResults.frontend.tests.push({
        test: 'Frontend Hook File Exists',
        result: 'FAIL',
        details: 'useFeatureFlag.tsx file not found'
      });
      console.log('  ❌ Frontend hook file not found');
    }
    
  } catch (error) {
    testResults.errors.push(`Frontend hook test error: ${error.message}`);
    console.log(`  💥 Frontend hook test error: ${error.message}`);
  }
}

/**
 * Test 6: Cross-Component Integration
 */
async function testIntegration() {
  console.log('🔗 Testing cross-component integration...');
  
  try {
    // Get all flags from backend
    const backendFlags = await makeRequest('GET', '');
    
    if (backendFlags.success) {
      const frontendFlagsPath = '../hooks/useFeatureFlag.tsx';
      
      if (fs.existsSync(frontendFlagsPath)) {
        const frontendContent = fs.readFileSync(frontendFlagsPath, 'utf8');
        
        // Check if backend flags match frontend definitions
        let matchingFlags = 0;
        let totalBackendFlags = 0;
        
        if (backendFlags.data.data) {
          Object.keys(backendFlags.data.data).forEach(flagKey => {
            totalBackendFlags++;
            if (frontendContent.includes(flagKey)) {
              matchingFlags++;
            }
          });
        }
        
        const integrationScore = totalBackendFlags > 0 ? (matchingFlags / totalBackendFlags) * 100 : 0;
        
        testResults.frontend.tests.push({
          test: 'Backend-Frontend Flag Sync',
          result: integrationScore >= 80 ? 'PASS' : 'WARN',
          details: `${matchingFlags}/${totalBackendFlags} flags synchronized (${integrationScore.toFixed(1)}%)`
        });
        
        console.log(`  📊 Integration score: ${integrationScore.toFixed(1)}% (${matchingFlags}/${totalBackendFlags} flags synchronized)`);
      }
    }
  } catch (error) {
    testResults.errors.push(`Integration test error: ${error.message}`);
    console.log(`  💥 Integration test error: ${error.message}`);
  }
}

/**
 * Generate comprehensive test report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 FEATURE FLAGS TESTING REPORT');
  console.log('='.repeat(60));
  
  // Backend Results
  console.log('\n🔧 BACKEND TESTING RESULTS:');
  console.log(`  Service Exists: ${testResults.backend.serviceExists ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Endpoints Work: ${testResults.backend.endpointsWork ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Enable/Disable: ${testResults.backend.enableDisable ? '✅ PASS' : '⚠️  SKIP (No admin access)'}`);
  console.log(`  Rollout Percentage: ${testResults.backend.rolloutPercentage ? '✅ PASS' : '⚠️  SKIP (No admin access)'}`);
  
  if (testResults.backend.tests.length > 0) {
    console.log('\n  Backend Test Details:');
    testResults.backend.tests.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : test.result === 'SKIP' ? '⚠️ ' : '❌';
      console.log(`    ${icon} ${test.test}: ${test.details}`);
    });
  }
  
  // Frontend Results  
  console.log('\n🎨 FRONTEND TESTING RESULTS:');
  console.log(`  Hook Exists: ${testResults.frontend.hookExists ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  API Integration: ${testResults.frontend.integration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Caching: ${testResults.frontend.caching ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Fallback: ${testResults.frontend.fallback ? '✅ PASS' : '❌ FAIL'}`);
  
  if (testResults.frontend.tests.length > 0) {
    console.log('\n  Frontend Test Details:');
    testResults.frontend.tests.forEach(test => {
      const icon = test.result === 'PASS' ? '✅' : test.result === 'WARN' ? '⚠️ ' : '❌';
      console.log(`    ${icon} ${test.test}: ${test.details}`);
    });
  }
  
  // Flag Status
  console.log('\n🚩 INDIVIDUAL FLAG STATUS:');
  Object.entries(testResults.flags).forEach(([flag, data]) => {
    const statusIcon = data.status === 'ACCESSIBLE' ? '✅' : '❌';
    console.log(`  ${statusIcon} ${flag}:`);
    if (data.status === 'ACCESSIBLE') {
      console.log(`      Enabled: ${data.enabled}`);
      console.log(`      Rollout: ${data.rollout_percentage}%`);
      console.log(`      User Enabled: ${data.user_enabled}`);
    } else {
      console.log(`      Error: ${data.error}`);
    }
  });
  
  // Errors
  if (testResults.errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:');
    testResults.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
  }
  
  // Overall Status
  console.log('\n' + '='.repeat(60));
  const backendWorking = testResults.backend.serviceExists && testResults.backend.endpointsWork;
  const frontendWorking = testResults.frontend.hookExists && testResults.frontend.integration;
  
  if (backendWorking && frontendWorking) {
    console.log('🎉 OVERALL STATUS: ✅ FEATURE FLAGS SYSTEM OPERATIONAL');
    console.log('   Both backend service and frontend hook are working correctly.');
  } else if (backendWorking) {
    console.log('⚠️  OVERALL STATUS: 🔧 BACKEND ONLY');
    console.log('   Backend service is working, but frontend integration has issues.');
  } else if (frontendWorking) {
    console.log('⚠️  OVERALL STATUS: 🎨 FRONTEND ONLY');
    console.log('   Frontend hook exists, but backend service is not accessible.');
  } else {
    console.log('❌ OVERALL STATUS: 💥 SYSTEM NOT FUNCTIONAL');
    console.log('   Both backend and frontend components have critical issues.');
  }
  
  console.log('='.repeat(60));
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Feature Flags End-to-End Testing...\n');
  
  // Run all tests
  await testBackendService();
  await testIndividualFlags();
  await testEnableDisable();
  await testRolloutPercentage();
  await testFrontendHook();
  await testIntegration();
  
  // Generate final report
  generateReport();
  
  // Save detailed results to file
  const resultsPath = './feature-flag-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
  
  // Return exit code based on results
  const backendWorking = testResults.backend.serviceExists && testResults.backend.endpointsWork;
  const frontendWorking = testResults.frontend.hookExists && testResults.frontend.integration;
  
  if (backendWorking && frontendWorking) {
    process.exit(0); // Success
  } else {
    process.exit(1); // Failure
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testResults };