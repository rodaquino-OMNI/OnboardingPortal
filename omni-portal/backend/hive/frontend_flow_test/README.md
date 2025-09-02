# Frontend Flow Tester

Comprehensive testing suite for frontend authentication flows using Playwright.

## Features

🎯 **Complete Authentication Flow Testing**
- Login button detection and interaction
- Form filling and submission
- Success state validation
- Redirect tracking

🌐 **Network Request Monitoring**
- CSRF cookie requests (`/sanctum/csrf-cookie`)
- Login API requests (`/api/login`)
- Response status and headers tracking
- Cookie management validation

🔍 **Browser Console Monitoring**
- JavaScript errors detection
- Console message logging
- Page error tracking
- Performance metrics

📸 **Visual Documentation**
- Full-page screenshots at each step
- Error state capture
- Success state documentation
- Test progression tracking

🌊 **cURL Simulation**
- Proper browser headers simulation
- CORS preflight request testing
- Authentication header management
- Network debugging commands

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npm run install-browsers
   ```

3. **Ensure your frontend is running on localhost:3000**

4. **Run tests:**
   ```bash
   npm test
   ```

## Test Commands

```bash
# Run all tests
npm test

# Run tests with browser UI (debug mode)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug specific test
npm run test:debug

# View HTML report
npm run report
```

## Test Structure

### 1. Authentication Flow Test (`auth-flow.spec.js`)
- Navigate to application
- Detect login elements (multiple strategies)
- Fill credentials and submit
- Monitor network requests
- Capture screenshots at each step
- Validate success indicators

### 2. CSRF Cookie Test
- Monitor `/sanctum/csrf-cookie` requests
- Capture response headers and cookies
- Validate proper cookie setting

### 3. cURL Simulation Test (`curl-simulation.spec.js`)
- Simulate browser requests with proper headers
- Test CORS preflight requests
- Generate equivalent shell commands
- Validate authentication flow via HTTP

## Output Structure

```
hive/frontend_flow_test/
├── screenshots/          # Test screenshots
│   ├── 01-landing-page.png
│   ├── 02-login-form.png
│   ├── 03-credentials-filled.png
│   └── ...
├── network/             # Network request logs
│   ├── csrf-response-details.json
│   ├── curl-simulation-results.json
│   └── network-logs.json
├── logs/                # Console and error logs
│   ├── console-logs.json
│   └── playwright-output.log
├── reports/             # Test summary reports
│   ├── test-summary.json
│   └── auth-flow-summary.json
└── playwright-report/   # HTML test report
```

## Key Features

### Network Monitoring
- Captures all HTTP requests/responses
- Monitors specific endpoints:
  - `/sanctum/csrf-cookie`
  - `/api/login`
  - Frontend assets
- Tracks headers, cookies, and response bodies

### Console Error Detection
- JavaScript runtime errors
- Page load errors
- Network failures
- Authentication state changes

### Screenshot Documentation
- Before/after each major action
- Error states
- Success confirmations
- Full page captures

### cURL Command Generation
- Generates equivalent shell commands
- Proper header simulation
- Cookie management
- CORS handling

## Test Configuration

The tests are configured to:
- Run against `http://localhost:3000` (frontend)
- API calls to `http://localhost:8000` (Laravel backend)
- Support multiple browsers (Chrome, Firefox, Safari)
- Capture detailed network activity
- Save comprehensive logs and screenshots

## Troubleshooting

1. **Frontend not accessible:** Ensure your frontend app is running on localhost:3000
2. **Backend API errors:** Verify Laravel backend is running on localhost:8000
3. **CORS issues:** Check CORS configuration in Laravel
4. **Authentication failures:** Verify test credentials and endpoints

## Generated Artifacts

After running tests, you'll find:
- **HTML Report:** `playwright-report/index.html`
- **Screenshots:** `screenshots/` directory
- **Network Logs:** `network/` directory
- **Console Logs:** `logs/` directory
- **cURL Commands:** `network/curl-commands-*.sh`

## Integration

This testing suite integrates with your existing authentication flow by:
1. Testing actual user interactions
2. Monitoring network requests
3. Validating CSRF token handling
4. Checking cookie management
5. Documenting the complete flow

Perfect for debugging authentication issues, validating CORS setup, and ensuring proper frontend/backend integration.