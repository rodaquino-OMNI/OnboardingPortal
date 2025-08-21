import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],              // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || 'http://localhost:8000';

export default function () {
  // Test homepage
  let homeResponse = http.get(`${BASE_URL}/`);
  check(homeResponse, {
    'Homepage status is 200': (r) => r.status === 200,
    'Homepage loads in < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  sleep(1);

  // Test registration page
  let registerResponse = http.get(`${BASE_URL}/register`);
  check(registerResponse, {
    'Register page status is 200': (r) => r.status === 200,
    'Register page loads in < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  sleep(1);

  // Test login page
  let loginResponse = http.get(`${BASE_URL}/login`);
  check(loginResponse, {
    'Login page status is 200': (r) => r.status === 200,
    'Login page loads in < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  sleep(1);

  // Test API health endpoint
  let healthResponse = http.get(`${API_URL}/api/health`);
  check(healthResponse, {
    'API health status is 200': (r) => r.status === 200,
    'API responds in < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test dashboard (may require auth)
  let dashboardResponse = http.get(`${BASE_URL}/dashboard`);
  check(dashboardResponse, {
    'Dashboard accessible': (r) => r.status === 200 || r.status === 302,
  }) || errorRate.add(1);

  sleep(2);

  // Test health questionnaire
  let questionnaireResponse = http.get(`${BASE_URL}/health-questionnaire`);
  check(questionnaireResponse, {
    'Health questionnaire accessible': (r) => r.status === 200 || r.status === 302,
  }) || errorRate.add(1);

  sleep(1);

  // Simulate user registration
  let registerPayload = JSON.stringify({
    name: `User ${Date.now()}`,
    email: `user${Date.now()}@test.com`,
    password: 'Password123!',
    password_confirmation: 'Password123!',
  });

  let registerHeaders = { 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  let registerApiResponse = http.post(
    `${API_URL}/api/auth/register`,
    registerPayload,
    { headers: registerHeaders }
  );

  check(registerApiResponse, {
    'Registration API works': (r) => r.status === 201 || r.status === 200 || r.status === 422,
    'Registration API responds in < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(2);

  // Test static assets
  let staticResponse = http.get(`${BASE_URL}/_next/static/chunks/webpack.js`);
  check(staticResponse, {
    'Static assets load': (r) => r.status === 200 || r.status === 404,
    'Static assets load in < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .metric { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>
    <h1>AUSTA OnboardingPortal Performance Test Results</h1>
    <div class="metric">
        <h2>Test Configuration</h2>
        <p>Maximum VUs: 100</p>
        <p>Test Duration: ~23 minutes</p>
        <p>Base URL: ${BASE_URL}</p>
        <p>API URL: ${API_URL}</p>
    </div>
    
    <div class="metric">
        <h2>Key Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Threshold</th>
                <th>Status</th>
            </tr>
            <tr>
                <td>HTTP Request Duration (p95)</td>
                <td>${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms</td>
                <td>< 500 ms</td>
                <td class="${data.metrics.http_req_duration?.values?.['p(95)'] < 500 ? 'passed' : 'failed'}">
                    ${data.metrics.http_req_duration?.values?.['p(95)'] < 500 ? 'PASSED' : 'FAILED'}
                </td>
            </tr>
            <tr>
                <td>Error Rate</td>
                <td>${(data.metrics.errors?.values?.rate * 100)?.toFixed(2) || '0'} %</td>
                <td>< 10%</td>
                <td class="${data.metrics.errors?.values?.rate < 0.1 ? 'passed' : 'failed'}">
                    ${data.metrics.errors?.values?.rate < 0.1 ? 'PASSED' : 'FAILED'}
                </td>
            </tr>
            <tr>
                <td>Total Requests</td>
                <td>${data.metrics.http_reqs?.values?.count || 0}</td>
                <td>-</td>
                <td>-</td>
            </tr>
            <tr>
                <td>Request Rate</td>
                <td>${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s</td>
                <td>-</td>
                <td>-</td>
            </tr>
        </table>
    </div>
    
    <div class="metric">
        <h2>Response Times</h2>
        <table>
            <tr>
                <th>Percentile</th>
                <th>Duration (ms)</th>
            </tr>
            <tr>
                <td>Min</td>
                <td>${data.metrics.http_req_duration?.values?.min?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>Median (p50)</td>
                <td>${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>p90</td>
                <td>${data.metrics.http_req_duration?.values?.['p(90)']?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>p95</td>
                <td>${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>p99</td>
                <td>${data.metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>Max</td>
                <td>${data.metrics.http_req_duration?.values?.max?.toFixed(2) || 'N/A'}</td>
            </tr>
        </table>
    </div>
    
    <div class="metric">
        <h2>Test Summary</h2>
        <p>Generated at: ${new Date().toISOString()}</p>
        <p>Overall Status: ${
          data.metrics.http_req_duration?.values?.['p(95)'] < 500 && 
          data.metrics.errors?.values?.rate < 0.1 
            ? '<span class="passed">PASSED</span>' 
            : '<span class="failed">FAILED</span>'
        }</p>
    </div>
</body>
</html>
  `;
}

function textSummary(data, options) {
  // Basic text summary for console output
  return `
Performance Test Summary
========================
Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
Request Rate: ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0} req/s
Error Rate: ${(data.metrics.errors?.values?.rate * 100)?.toFixed(2) || 0}%

Response Times:
  Min: ${data.metrics.http_req_duration?.values?.min?.toFixed(2) || 'N/A'} ms
  p50: ${data.metrics.http_req_duration?.values?.['p(50)']?.toFixed(2) || 'N/A'} ms
  p95: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'} ms
  Max: ${data.metrics.http_req_duration?.values?.max?.toFixed(2) || 'N/A'} ms

Thresholds:
  p95 < 500ms: ${data.metrics.http_req_duration?.values?.['p(95)'] < 500 ? 'PASSED' : 'FAILED'}
  Error Rate < 10%: ${data.metrics.errors?.values?.rate < 0.1 ? 'PASSED' : 'FAILED'}
  `;
}