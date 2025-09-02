import { test } from '@playwright/test';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const API_BASE_URL = 'http://localhost:8000'; // Laravel backend
const NETWORK_DIR = './network';

test.describe('cURL Simulation Tests', () => {
  
  test('should simulate browser requests with proper headers', async () => {
    console.log('🌐 Starting cURL simulation tests');
    
    const testResults = [];
    
    // Test 1: CSRF Cookie Request
    try {
      console.log('🍪 Testing CSRF cookie request');
      
      const csrfResponse = await axios.get(`${API_BASE_URL}/sanctum/csrf-cookie`, {
        headers: {
          'Origin': BASE_URL,
          'Referer': `${BASE_URL}/login`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
        },
        withCredentials: true,
        validateStatus: () => true
      });

      testResults.push({
        test: 'CSRF Cookie Request',
        success: csrfResponse.status < 400,
        status: csrfResponse.status,
        headers: csrfResponse.headers,
        cookies: csrfResponse.headers['set-cookie'] || [],
        data: csrfResponse.data
      });

      console.log(`✅ CSRF request completed: ${csrfResponse.status}`);

    } catch (error) {
      testResults.push({
        test: 'CSRF Cookie Request',
        success: false,
        error: error.message,
        code: error.code
      });
      console.log(`❌ CSRF request failed: ${error.message}`);
    }

    // Test 2: Login Request with CSRF Token
    try {
      console.log('🔐 Testing login request');
      
      // First get CSRF cookie
      const csrfResponse = await axios.get(`${API_BASE_URL}/sanctum/csrf-cookie`, {
        withCredentials: true,
        validateStatus: () => true
      });

      const cookies = csrfResponse.headers['set-cookie'] || [];
      let csrfToken = null;
      let sessionCookie = null;

      // Extract CSRF token and session from cookies
      cookies.forEach(cookie => {
        if (cookie.includes('XSRF-TOKEN')) {
          csrfToken = decodeURIComponent(cookie.split('XSRF-TOKEN=')[1].split(';')[0]);
        }
        if (cookie.includes('laravel_session')) {
          sessionCookie = cookie.split(';')[0];
        }
      });

      const loginHeaders = {
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/login`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      };

      if (csrfToken) {
        loginHeaders['X-XSRF-TOKEN'] = csrfToken;
      }

      if (sessionCookie) {
        loginHeaders['Cookie'] = sessionCookie;
      }

      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const loginResponse = await axios.post(`${API_BASE_URL}/api/login`, loginData, {
        headers: loginHeaders,
        withCredentials: true,
        validateStatus: () => true
      });

      testResults.push({
        test: 'Login Request',
        success: loginResponse.status < 400,
        status: loginResponse.status,
        headers: loginResponse.headers,
        data: loginResponse.data,
        csrfTokenUsed: !!csrfToken,
        sessionCookieUsed: !!sessionCookie
      });

      console.log(`✅ Login request completed: ${loginResponse.status}`);

    } catch (error) {
      testResults.push({
        test: 'Login Request',
        success: false,
        error: error.message,
        code: error.code
      });
      console.log(`❌ Login request failed: ${error.message}`);
    }

    // Test 3: Frontend Asset Request
    try {
      console.log('📄 Testing frontend asset request');
      
      const assetResponse = await axios.get(BASE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1'
        },
        validateStatus: () => true
      });

      testResults.push({
        test: 'Frontend Asset Request',
        success: assetResponse.status < 400,
        status: assetResponse.status,
        headers: assetResponse.headers,
        contentType: assetResponse.headers['content-type'],
        contentLength: assetResponse.headers['content-length']
      });

      console.log(`✅ Frontend asset request completed: ${assetResponse.status}`);

    } catch (error) {
      testResults.push({
        test: 'Frontend Asset Request',
        success: false,
        error: error.message,
        code: error.code
      });
      console.log(`❌ Frontend asset request failed: ${error.message}`);
    }

    // Test 4: Preflight CORS Request
    try {
      console.log('🔄 Testing CORS preflight request');
      
      const preflightResponse = await axios.request({
        method: 'OPTIONS',
        url: `${API_BASE_URL}/api/login`,
        headers: {
          'Origin': BASE_URL,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-requested-with,x-xsrf-token',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Dest': 'empty'
        },
        validateStatus: () => true
      });

      testResults.push({
        test: 'CORS Preflight Request',
        success: preflightResponse.status < 400,
        status: preflightResponse.status,
        headers: preflightResponse.headers,
        corsHeaders: {
          'access-control-allow-origin': preflightResponse.headers['access-control-allow-origin'],
          'access-control-allow-methods': preflightResponse.headers['access-control-allow-methods'],
          'access-control-allow-headers': preflightResponse.headers['access-control-allow-headers'],
          'access-control-allow-credentials': preflightResponse.headers['access-control-allow-credentials']
        }
      });

      console.log(`✅ CORS preflight request completed: ${preflightResponse.status}`);

    } catch (error) {
      testResults.push({
        test: 'CORS Preflight Request',
        success: false,
        error: error.message,
        code: error.code
      });
      console.log(`❌ CORS preflight request failed: ${error.message}`);
    }

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeJson(
      path.join(NETWORK_DIR, `curl-simulation-results-${timestamp}.json`),
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: testResults.length,
          successful: testResults.filter(r => r.success).length,
          failed: testResults.filter(r => !r.success).length
        },
        results: testResults
      },
      { spaces: 2 }
    );

    // Generate shell script equivalents
    const shellCommands = [
      '#!/bin/bash',
      '# cURL commands equivalent to the axios requests',
      '',
      '# CSRF Cookie Request',
      `curl -X GET "${API_BASE_URL}/sanctum/csrf-cookie" \\`,
      `  -H "Origin: ${BASE_URL}" \\`,
      `  -H "Referer: ${BASE_URL}/login" \\`,
      '  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \\',
      '  -H "Accept: application/json" \\',
      '  -H "Accept-Language: en-US,en;q=0.9" \\',
      '  -c cookies.txt \\',
      '  -v',
      '',
      '# Login Request',
      `curl -X POST "${API_BASE_URL}/api/login" \\`,
      `  -H "Origin: ${BASE_URL}" \\`,
      `  -H "Referer: ${BASE_URL}/login" \\`,
      '  -H "Content-Type: application/json" \\',
      '  -H "Accept: application/json" \\',
      '  -H "X-Requested-With: XMLHttpRequest" \\',
      '  -b cookies.txt \\',
      '  -c cookies.txt \\',
      '  -d \'{"email":"test@example.com","password":"password123"}\' \\',
      '  -v',
      '',
      '# CORS Preflight',
      `curl -X OPTIONS "${API_BASE_URL}/api/login" \\`,
      `  -H "Origin: ${BASE_URL}" \\`,
      '  -H "Access-Control-Request-Method: POST" \\',
      '  -H "Access-Control-Request-Headers: content-type,x-requested-with,x-xsrf-token" \\',
      '  -v'
    ];

    await fs.writeFile(
      path.join(NETWORK_DIR, `curl-commands-${timestamp}.sh`),
      shellCommands.join('\n')
    );

    console.log('📊 cURL simulation completed');
    console.log(`📁 Results saved to: curl-simulation-results-${timestamp}.json`);
    console.log(`📄 Shell commands saved to: curl-commands-${timestamp}.sh`);
  });
});