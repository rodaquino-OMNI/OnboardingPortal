import { test, expect } from '@playwright/test';
import fs from 'fs-extra';
import path from 'path';

const SCREENSHOTS_DIR = './screenshots';
const LOGS_DIR = './logs';
const NETWORK_DIR = './network';

// Ensure directories exist
await fs.ensureDir(SCREENSHOTS_DIR);
await fs.ensureDir(LOGS_DIR);
await fs.ensureDir(NETWORK_DIR);

test.describe('Frontend Authentication Flow', () => {
  let networkLogs = [];
  let consoleLogs = [];
  let testStartTime;

  test.beforeEach(async ({ page }) => {
    testStartTime = new Date().toISOString();
    networkLogs = [];
    consoleLogs = [];

    // Monitor network requests
    page.on('request', request => {
      networkLogs.push({
        timestamp: new Date().toISOString(),
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      networkLogs.push({
        timestamp: new Date().toISOString(),
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers()
      });
    });

    // Monitor console messages
    page.on('console', msg => {
      consoleLogs.push({
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Monitor page errors
    page.on('pageerror', error => {
      consoleLogs.push({
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      });
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    const testName = testInfo.title.replace(/\s+/g, '-').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save network logs
    await fs.writeJson(
      path.join(NETWORK_DIR, `${testName}-${timestamp}-network.json`),
      networkLogs,
      { spaces: 2 }
    );

    // Save console logs
    await fs.writeJson(
      path.join(LOGS_DIR, `${testName}-${timestamp}-console.json`),
      consoleLogs,
      { spaces: 2 }
    );

    // Take final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${testName}-${timestamp}-final.png`),
      fullPage: true
    });
  });

  test('should complete login flow successfully', async ({ page }) => {
    // Step 1: Navigate to application
    console.log('🚀 Starting authentication flow test');
    await page.goto('/');
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-landing-page.png'),
      fullPage: true
    });

    // Step 2: Look for login button/link
    console.log('🔍 Looking for login elements');
    
    // Try multiple selectors for login
    const loginSelectors = [
      'button[contains(text(), "Login")]',
      'a[contains(text(), "Login")]',
      '[data-testid="login-button"]',
      '.login-btn',
      '#login',
      'button[type="submit"]'
    ];

    let loginElement = null;
    for (const selector of loginSelectors) {
      try {
        loginElement = await page.locator(selector).first();
        if (await loginElement.isVisible()) break;
      } catch (e) {
        // Continue to next selector
      }
    }

    // If no login button found, look for login form directly
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      console.log('📝 Found login form directly');
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-login-form-found.png'),
        fullPage: true
      });

      // Fill credentials
      await emailInput.fill('test@example.com');
      await passwordInput.fill('password123');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03-credentials-filled.png'),
        fullPage: true
      });

      // Look for submit button
      const submitButton = page.locator('button[type="submit"], .submit-btn, [data-testid="submit"]').first();
      
      // Monitor network activity before submission
      const networkPromise = page.waitForResponse(response => 
        response.url().includes('/sanctum/csrf-cookie') || 
        response.url().includes('/api/login') ||
        response.url().includes('/login')
      );

      await submitButton.click();
      
      try {
        const response = await networkPromise;
        console.log('📡 Network response received:', response.url(), response.status());
      } catch (e) {
        console.log('⚠️ No expected network response captured');
      }

    } else if (loginElement && await loginElement.isVisible()) {
      console.log('🎯 Found login button, clicking');
      await loginElement.click();
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-after-login-click.png'),
        fullPage: true
      });

      // Wait for login form to appear
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03-login-form-appeared.png'),
        fullPage: true
      });

      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04-credentials-entered.png'),
        fullPage: true
      });

      // Submit form
      const submitButton = page.locator('button[type="submit"], .submit-btn').first();
      await submitButton.click();
    } else {
      console.log('❌ No login elements found, capturing page state');
      
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-no-login-found.png'),
        fullPage: true
      });

      // Get page content for analysis
      const pageContent = await page.content();
      await fs.writeFile(
        path.join(LOGS_DIR, 'page-content-analysis.html'),
        pageContent
      );
    }

    // Step 3: Wait and check for redirect or success state
    console.log('⏳ Waiting for authentication result');
    
    await page.waitForTimeout(3000); // Wait for potential redirect
    
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-after-submit.png'),
      fullPage: true
    });

    // Check current URL
    const currentUrl = page.url();
    console.log('🌐 Current URL:', currentUrl);

    // Look for success indicators
    const successIndicators = [
      '.dashboard',
      '[data-testid="dashboard"]',
      '.user-menu',
      '.logout-btn',
      'text=Welcome',
      'text=Dashboard'
    ];

    let isLoggedIn = false;
    for (const indicator of successIndicators) {
      try {
        const element = page.locator(indicator).first();
        if (await element.isVisible()) {
          isLoggedIn = true;
          console.log('✅ Success indicator found:', indicator);
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-final-state.png'),
      fullPage: true
    });

    // Analyze network requests
    const csrfRequests = networkLogs.filter(log => 
      log.url && log.url.includes('/sanctum/csrf-cookie')
    );
    const loginRequests = networkLogs.filter(log => 
      log.url && (log.url.includes('/api/login') || log.url.includes('/login'))
    );

    console.log('🔍 CSRF requests found:', csrfRequests.length);
    console.log('🔍 Login requests found:', loginRequests.length);

    // Check for JavaScript errors
    const jsErrors = consoleLogs.filter(log => 
      log.type === 'error' || log.type === 'pageerror'
    );

    if (jsErrors.length > 0) {
      console.log('❌ JavaScript errors detected:', jsErrors.length);
      jsErrors.forEach(error => {
        console.log('  -', error.text);
      });
    }

    // Generate summary
    const summary = {
      testCompleted: true,
      authenticationAttempted: true,
      loginElementFound: !!loginElement || (await emailInput.isVisible()),
      currentUrl,
      isLoggedIn,
      networkRequests: {
        total: networkLogs.length,
        csrf: csrfRequests.length,
        login: loginRequests.length
      },
      consoleErrors: jsErrors.length,
      timestamp: testStartTime
    };

    await fs.writeJson(
      path.join('reports', `auth-flow-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      summary,
      { spaces: 2 }
    );

    console.log('📊 Test Summary:', JSON.stringify(summary, null, 2));
  });

  test('should monitor CSRF cookie requests', async ({ page }) => {
    console.log('🍪 Testing CSRF cookie flow');

    let csrfResponse = null;
    
    page.on('response', async (response) => {
      if (response.url().includes('/sanctum/csrf-cookie')) {
        csrfResponse = {
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          cookies: await page.context().cookies()
        };
      }
    });

    await page.goto('/');
    
    // Trigger CSRF cookie request if possible
    await page.evaluate(() => {
      // Try to make CSRF request via JavaScript
      if (window.axios) {
        return window.axios.get('/sanctum/csrf-cookie');
      } else if (window.fetch) {
        return window.fetch('/sanctum/csrf-cookie', {
          credentials: 'include'
        });
      }
    });

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'csrf-test.png'),
      fullPage: true
    });

    if (csrfResponse) {
      console.log('✅ CSRF cookie response captured');
      await fs.writeJson(
        path.join(NETWORK_DIR, 'csrf-response-details.json'),
        csrfResponse,
        { spaces: 2 }
      );
    } else {
      console.log('❌ No CSRF cookie response detected');
    }
  });
});