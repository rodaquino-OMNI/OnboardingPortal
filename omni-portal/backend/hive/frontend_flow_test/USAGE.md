# Frontend Flow Tester - Usage Guide

## 🚀 Quick Start

### 1. Pre-requisites Check
```bash
# Run health check to verify environment
npm run health
```

This will check:
- ✅ Frontend running on http://localhost:3000
- ✅ Backend API accessible on http://localhost:8000  
- ✅ CSRF cookie endpoint working

### 2. Start Your Services

**Frontend (React/Vue/Next.js):**
```bash
# In your frontend directory
npm run dev
# or
yarn dev
```

**Backend (Laravel):**
```bash
# In your backend directory
php artisan serve --port=8000
```

### 3. Run Tests
```bash
# Full test suite with reports
npm test

# Interactive mode (great for debugging)
npm run test:ui

# Watch tests run in browser
npm run test:headed
```

## 📊 Test Results

After running tests, you'll find comprehensive documentation in:

```
hive/frontend_flow_test/
├── screenshots/              # 📸 Visual flow documentation
│   ├── 01-landing-page.png
│   ├── 02-login-form.png
│   ├── 03-credentials-filled.png
│   ├── 04-after-submit.png
│   └── 05-final-state.png
├── network/                  # 🌐 HTTP request/response logs
│   ├── csrf-response-details.json
│   ├── curl-simulation-results.json
│   └── auth-flow-network-logs.json
├── logs/                     # 📝 Console errors & messages
│   ├── console-logs.json
│   └── health-check.json
├── reports/                  # 📋 Test summaries
│   └── auth-flow-summary.json
└── playwright-report/        # 🎭 Interactive HTML report
    └── index.html
```

## 🔍 What Gets Tested

### Authentication Flow
1. **Page Load** - Navigate to localhost:3000
2. **Login Detection** - Find login button/form using multiple strategies:
   - `button[contains(text(), "Login")]`
   - `a[contains(text(), "Login")]`
   - `[data-testid="login-button"]`
   - `.login-btn`, `#login`
   - Direct email/password form detection
3. **Form Interaction** - Fill credentials and submit
4. **Success Validation** - Check for dashboard, user menu, or welcome messages

### Network Monitoring
- **CSRF Requests** - Monitor `/sanctum/csrf-cookie`
- **Login API** - Track `/api/login` with proper headers
- **Response Analysis** - Status codes, headers, cookies
- **CORS Validation** - Preflight requests and headers

### Console Monitoring  
- **JavaScript Errors** - Runtime errors and exceptions
- **Network Failures** - Failed API calls
- **Auth State Changes** - Login/logout events
- **Performance Issues** - Slow responses

## 🌊 cURL Command Generation

The tests automatically generate equivalent shell commands:

```bash
# View generated commands
cat network/curl-commands-*.sh

# Example output:
curl -X GET "http://localhost:8000/sanctum/csrf-cookie" \
  -H "Origin: http://localhost:3000" \
  -H "Referer: http://localhost:3000/login" \
  -H "User-Agent: Mozilla/5.0..." \
  -c cookies.txt -v

curl -X POST "http://localhost:8000/api/login" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -b cookies.txt \
  -d '{"email":"test@example.com","password":"password123"}' \
  -v
```

## 🐛 Troubleshooting

### Common Issues

**1. Frontend not accessible**
```bash
# Check if service is running
curl http://localhost:3000
# Start your frontend dev server
npm run dev  # or yarn dev
```

**2. Backend API errors**
```bash
# Check Laravel server
curl http://localhost:8000/api/health
# Start Laravel server
php artisan serve --port=8000
```

**3. CORS issues**
- Check `config/cors.php` in Laravel
- Ensure `localhost:3000` is in allowed origins
- Verify credentials support is enabled

**4. Authentication failures**
- Check test credentials in `tests/auth-flow.spec.js`
- Verify login endpoint URL
- Review network logs for error details

### Debug Mode

Run tests in debug mode to step through interactions:

```bash
npm run test:debug
```

This opens browser developer tools and pauses at each step.

## 📈 Test Customization

### Modify Test Credentials
Edit `tests/auth-flow.spec.js`:
```javascript
await emailInput.fill('your-test@email.com');
await passwordInput.fill('your-test-password');
```

### Add Custom Selectors
Add your app's specific selectors:
```javascript
const loginSelectors = [
  'button[contains(text(), "Login")]',
  '.your-custom-login-class',     // Add your selector
  '#your-login-id',               // Add your ID
  '[data-cy="login-button"]'      // Add Cypress data attributes
];
```

### Customize Success Detection
Modify success indicators:
```javascript
const successIndicators = [
  '.dashboard',
  '.your-success-element',        // Add your indicators
  'text=Welcome Back',
  '[data-testid="user-profile"]'
];
```

## 🎯 Integration Tips

1. **CI/CD Integration** - Add to your pipeline:
   ```yaml
   - name: Frontend Flow Tests
     run: |
       cd hive/frontend_flow_test
       npm test
   ```

2. **Environment Variables** - Customize URLs:
   ```javascript
   const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
   const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
   ```

3. **Test Data Management** - Use factories for dynamic test data
4. **Parallel Testing** - Run multiple browser tests simultaneously
5. **Mobile Testing** - Add mobile viewport configurations

## 📞 Support

If you encounter issues:
1. Run `npm run health` to check environment
2. Review generated logs in `logs/` directory  
3. Check screenshots in `screenshots/` directory
4. Examine network requests in `network/` directory
5. Use `npm run test:ui` for interactive debugging

The test suite provides comprehensive documentation of your authentication flow, making it easy to identify and resolve integration issues.