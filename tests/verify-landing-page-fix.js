#!/usr/bin/env node

/**
 * Landing Page Fix Verification
 * Tests if the React app properly renders the landing page instead of infinite spinner
 */

const http = require('http');
const { execSync } = require('child_process');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';
const TIMEOUT = 10000; // 10 seconds

console.log('🔍 Landing Page Fix Verification');
console.log('================================');

async function testHttpRequest(url, expectedContent, description) {
    return new Promise((resolve) => {
        console.log(`\n🔗 Testing: ${description}`);
        console.log(`   URL: ${url}`);
        
        const req = http.get(url, { timeout: TIMEOUT }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const success = expectedContent ? data.includes(expectedContent) : res.statusCode === 200;
                console.log(`   Status: ${res.statusCode}`);
                console.log(`   Content Length: ${data.length} bytes`);
                
                if (expectedContent) {
                    console.log(`   Looking for: "${expectedContent}"`);
                    console.log(`   Found: ${success ? '✅ YES' : '❌ NO'}`);
                }
                
                // Check for specific issues
                if (data.includes('animate-spin')) {
                    console.log('   ⚠️  WARNING: Loading spinner detected in HTML');
                }
                
                if (data.includes('Portal de Onboarding AUSTA')) {
                    console.log('   ✅ SUCCESS: Landing page content found');
                }
                
                if (data.includes('min-h-screen flex items-center justify-center')) {
                    console.log('   ❌ PROBLEM: Centered loading layout detected');
                }
                
                resolve({
                    success,
                    statusCode: res.statusCode,
                    contentLength: data.length,
                    hasSpinner: data.includes('animate-spin'),
                    hasLandingContent: data.includes('Portal de Onboarding AUSTA'),
                    hasLoadingLayout: data.includes('min-h-screen flex items-center justify-center'),
                    responseTime: Date.now()
                });
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ ERROR: ${error.message}`);
            resolve({
                success: false,
                error: error.message,
                responseTime: Date.now()
            });
        });
        
        req.on('timeout', () => {
            console.log(`   ⏱️  TIMEOUT: Request timed out after ${TIMEOUT}ms`);
            req.destroy();
            resolve({
                success: false,
                error: 'Timeout',
                responseTime: Date.now()
            });
        });
    });
}

async function checkProcesses() {
    console.log('\n📋 Process Check');
    console.log('================');
    
    try {
        // Check if frontend is running
        const frontendProcess = execSync('lsof -ti:3000', { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ Frontend (port 3000): PID ${frontendProcess.trim()}`);
    } catch (error) {
        console.log('❌ Frontend (port 3000): Not running');
        return false;
    }
    
    try {
        // Check if backend is running
        const backendProcess = execSync('lsof -ti:8000', { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ Backend (port 8000): PID ${backendProcess.trim()}`);
    } catch (error) {
        console.log('⚠️  Backend (port 8000): Not running (this is OK for frontend-only test)');
    }
    
    return true;
}

async function main() {
    const startTime = Date.now();
    
    // Check if processes are running
    const processesRunning = await checkProcesses();
    if (!processesRunning) {
        console.log('\n❌ Frontend is not running. Please start it with: npm run dev');
        process.exit(1);
    }
    
    // Test frontend root page
    const frontendTest = await testHttpRequest(
        FRONTEND_URL,
        'Portal de Onboarding AUSTA',
        'Frontend landing page'
    );
    
    // Test backend health (optional)
    const backendTest = await testHttpRequest(
        `${BACKEND_URL}/api/health`,
        null,
        'Backend health check'
    );
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    const totalTime = Date.now() - startTime;
    console.log(`Total test time: ${totalTime}ms`);
    
    console.log('\n🎯 Frontend Landing Page:');
    if (frontendTest.success && frontendTest.hasLandingContent && !frontendTest.hasSpinner) {
        console.log('   ✅ SUCCESS: Landing page renders correctly');
        console.log('   ✅ No loading spinner detected');
        console.log('   ✅ Landing content is present');
    } else if (frontendTest.hasSpinner) {
        console.log('   ❌ FAILED: Still showing loading spinner');
        console.log('   ❌ The infinite loading issue is NOT fixed');
    } else if (!frontendTest.hasLandingContent) {
        console.log('   ⚠️  PARTIAL: Page loads but missing expected content');
    } else {
        console.log('   ❌ FAILED: Page did not load properly');
        console.log(`   Error: ${frontendTest.error || 'Unknown error'}`);
    }
    
    console.log('\n🔧 Backend API:');
    if (backendTest.success) {
        console.log('   ✅ Backend is accessible');
    } else {
        console.log('   ⚠️  Backend not accessible (may affect auth, but landing page should still work)');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations');
    console.log('==================');
    
    if (frontendTest.hasSpinner) {
        console.log('❌ The loading spinner issue is NOT resolved.');
        console.log('   Check:');
        console.log('   1. DashboardLayout loading conditions');
        console.log('   2. AuthProvider initialization');
        console.log('   3. useAuth hook dependencies');
        console.log('   4. Browser console for JavaScript errors');
    } else if (frontendTest.hasLandingContent) {
        console.log('✅ The loading spinner issue appears to be RESOLVED!');
        console.log('   The landing page is now rendering properly.');
    }
    
    // Exit code
    const overallSuccess = frontendTest.success && frontendTest.hasLandingContent && !frontendTest.hasSpinner;
    process.exit(overallSuccess ? 0 : 1);
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
    process.exit(1);
});

// Run the tests
main().catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});