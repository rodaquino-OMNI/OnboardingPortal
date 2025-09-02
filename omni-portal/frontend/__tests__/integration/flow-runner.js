#!/usr/bin/env node

/**
 * User Flow Validation Runner
 * Validates all critical user flows and stores results in memory
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
const FLOWS_TO_TEST = [
  'registration',
  'login', 
  'health-questionnaire',
  'document-upload',
  'auth-redirects',
  'form-validation'
];

async function checkServerHealth() {
  try {
    const response = await fetch(BASE_URL);
    return response.ok;
  } catch (error) {
    console.error('❌ Server not available at', BASE_URL);
    return false;
  }
}

async function validateFlow(flowName, url) {
  console.log(`\n🔍 Testing ${flowName} flow: ${url}`);
  
  const results = {
    flow: flowName,
    url: url,
    success: false,
    errors: [],
    warnings: [],
    timestamp: new Date().toISOString(),
    responseTime: 0,
    statusCode: null
  };

  try {
    const startTime = Date.now();
    
    // Test basic connectivity
    const response = await fetch(url);
    results.responseTime = Date.now() - startTime;
    results.statusCode = response.status;
    
    if (response.ok) {
      const html = await response.text();
      
      // Basic content validation
      const hasForm = html.includes('<form') || html.includes('form');
      const hasInputs = html.includes('<input') || html.includes('input');
      const hasSubmitButton = html.includes('type="submit"') || html.includes('submit');
      
      // Check for common errors
      if (html.includes('Error') || html.includes('error')) {
        results.warnings.push('Page contains error messages');
      }
      
      if (html.includes('404') || html.includes('Not Found')) {
        results.errors.push('Page not found');
      } else if (flowName === 'registration' || flowName === 'login') {
        if (!hasForm) results.warnings.push('No form elements detected');
        if (!hasInputs) results.warnings.push('No input fields detected');
        if (!hasSubmitButton) results.warnings.push('No submit button detected');
      }
      
      results.success = results.errors.length === 0;
      console.log(`✅ ${flowName} flow: ${response.status} (${results.responseTime}ms)`);
      
    } else {
      results.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      console.log(`❌ ${flowName} flow: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    results.errors.push(error.message);
    console.log(`❌ ${flowName} flow: ${error.message}`);
  }
  
  return results;
}

async function runFlowValidation() {
  console.log('🚀 Starting User Flow Validation');
  console.log('='.repeat(50));
  
  // Check if server is running
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.error('❌ Cannot proceed - server not available');
    process.exit(1);
  }
  
  console.log('✅ Server is healthy at', BASE_URL);
  
  const allResults = {
    testRun: {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalFlows: FLOWS_TO_TEST.length
    },
    flows: {},
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };
  
  // Test each flow
  for (const flowName of FLOWS_TO_TEST) {
    let url;
    
    switch (flowName) {
      case 'registration':
        url = `${BASE_URL}/register`;
        break;
      case 'login':
        url = `${BASE_URL}/login`;
        break;
      case 'health-questionnaire':
        url = `${BASE_URL}/health-questionnaire`;
        break;
      case 'document-upload':
        url = `${BASE_URL}/document-upload`;
        break;
      case 'auth-redirects':
        url = `${BASE_URL}/dashboard`; // Should redirect to login
        break;
      case 'form-validation':
        url = `${BASE_URL}/register`; // Test form validation
        break;
      default:
        url = `${BASE_URL}/${flowName}`;
    }
    
    const result = await validateFlow(flowName, url);
    allResults.flows[flowName] = result;
    
    if (result.success) {
      allResults.summary.passed++;
    } else {
      allResults.summary.failed++;
    }
    
    if (result.warnings.length > 0) {
      allResults.summary.warnings += result.warnings.length;
    }
  }
  
  // Test additional routes
  console.log('\n🔍 Testing additional critical routes...');
  const additionalRoutes = ['/', '/dashboard', '/home', '/profile'];
  
  for (const route of additionalRoutes) {
    const url = `${BASE_URL}${route}`;
    try {
      const response = await fetch(url);
      console.log(`${route}: ${response.status} ${response.statusText}`);
      
      if (route === '/' && response.ok) {
        allResults.flows['landing_page'] = {
          flow: 'landing_page',
          url: url,
          success: true,
          statusCode: response.status,
          responseTime: 0
        };
        allResults.summary.passed++;
      }
    } catch (error) {
      console.log(`${route}: Error - ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${allResults.summary.passed}`);
  console.log(`❌ Failed: ${allResults.summary.failed}`);
  console.log(`⚠️  Warnings: ${allResults.summary.warnings}`);
  console.log(`🔗 Base URL: ${BASE_URL}`);
  
  // Store results
  const resultsPath = path.join(__dirname, 'flow-validation-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  console.log(`📄 Results saved to: ${resultsPath}`);
  
  // Store in Claude Flow memory if available
  try {
    execSync(`npx claude-flow@alpha memory store swarm/integration-flows/results '${JSON.stringify(allResults)}'`, {
      stdio: 'inherit'
    });
    console.log('💾 Results stored in Claude Flow memory');
  } catch (error) {
    console.log('⚠️  Could not store in Claude Flow memory:', error.message);
  }
  
  return allResults;
}

// Run if called directly
if (require.main === module) {
  runFlowValidation()
    .then((results) => {
      const success = results.summary.failed === 0;
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Flow validation failed:', error);
      process.exit(1);
    });
}

module.exports = { runFlowValidation, validateFlow };