import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const registrationDuration = new Trend('registration_duration');
const verificationDuration = new Trend('verification_duration');
const pointsAwardDuration = new Trend('points_award_duration');
const successfulRegistrations = new Counter('successful_registrations');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://dev.onboarding.local';

// Load test options - simulates Slice A user flow under load
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Warm up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users (steady state)
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '3m', target: 200 },  // Maintain spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],        // 95% of requests < 500ms
    'http_req_duration{name:registration}': ['p(95)<800'], // Registration < 800ms
    'http_req_duration{name:verification}': ['p(95)<300'], // Verification < 300ms
    'errors': ['rate<0.01'],                   // Error rate < 1%
    'http_req_failed': ['rate<0.02'],          // HTTP failure rate < 2%
    'registration_duration': ['p(95)<1000'],   // End-to-end registration < 1s
  },
};

// Main test scenario - Slice A user journey
export default function () {
  const email = `loadtest-${__VU}-${__ITER}-${randomString(8)}@example.com`;
  const password = 'LoadTest123!@#';

  group('Slice A - Registration Flow', () => {
    const startTime = Date.now();

    // Step 1: Get CSRF token
    const csrfRes = http.get(`${BASE_URL}/sanctum/csrf-cookie`, {
      tags: { name: 'csrf_token' },
    });

    check(csrfRes, {
      'CSRF token retrieved': (r) => r.status === 204,
    }) || errorRate.add(1);

    sleep(0.5);

    // Step 2: Register new user
    const registerPayload = JSON.stringify({
      email: email,
      password: password,
      password_confirmation: password,
    });

    const registerRes = http.post(
      `${BASE_URL}/api/auth/register`,
      registerPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': csrfRes.cookies['XSRF-TOKEN'][0]?.value || '',
        },
        tags: { name: 'registration' },
      }
    );

    const registerSuccess = check(registerRes, {
      'registration status is 201': (r) => r.status === 201,
      'response contains user data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.user && body.user.email === email;
        } catch (e) {
          return false;
        }
      },
      'response time < 800ms': (r) => r.timings.duration < 800,
    });

    if (!registerSuccess) {
      errorRate.add(1);
      return; // Skip verification if registration failed
    }

    const regDuration = Date.now() - startTime;
    registrationDuration.add(regDuration);

    sleep(1);

    // Step 3: Simulate email verification
    // In real scenario, token would come from email
    // For load testing, we'll simulate token retrieval
    const verificationToken = JSON.parse(registerRes.body).verification_token || 'simulated-token';

    const verifyRes = http.post(
      `${BASE_URL}/api/auth/verify`,
      JSON.stringify({ token: verificationToken }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        tags: { name: 'verification' },
      }
    );

    const verifySuccess = check(verifyRes, {
      'verification status is 200': (r) => r.status === 200,
      'user received 100 points': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.points === 100;
        } catch (e) {
          return false;
        }
      },
      'verification time < 300ms': (r) => r.timings.duration < 300,
    });

    if (!verifySuccess) {
      errorRate.add(1);
      return;
    }

    const verifyDuration = Date.now() - startTime;
    verificationDuration.add(verifyDuration);

    sleep(0.5);

    // Step 4: Check points history
    const pointsRes = http.get(
      `${BASE_URL}/api/gamification/points/history`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${JSON.parse(verifyRes.body).token}`,
        },
        tags: { name: 'points_history' },
      }
    );

    check(pointsRes, {
      'points history retrieved': (r) => r.status === 200,
      'contains registration transaction': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.transactions && body.transactions.some(t => t.action === 'registration');
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);

    const totalDuration = Date.now() - startTime;
    pointsAwardDuration.add(totalDuration);

    // Increment success counter
    successfulRegistrations.add(1);
  });

  // Think time between iterations
  sleep(Math.random() * 3 + 2); // 2-5 seconds
}

// Setup function - runs once before test
export function setup() {
  console.log('🚀 Starting Slice A Load Test');
  console.log(`Target: ${BASE_URL}`);
  console.log('Scenario: Registration → Verification → Points Award');

  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error('Health check failed - API is not ready');
  }

  return { timestamp: new Date().toISOString() };
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log('✅ Slice A Load Test Completed');
  console.log(`Started at: ${data.timestamp}`);
}

// Handle summary - custom report formatting
export function handleSummary(data) {
  return {
    'tests/Performance/reports/slice-a-load-test-summary.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  return `
${indent}Slice A Load Test Results
${indent}========================
${indent}Duration: ${data.state.testRunDurationMs}ms
${indent}Iterations: ${data.metrics.iterations.values.count}
${indent}VUs: ${data.metrics.vus.values.value}
${indent}
${indent}HTTP Performance:
${indent}  Requests: ${data.metrics.http_reqs.values.count}
${indent}  Duration (p95): ${data.metrics.http_req_duration.values['p(95)']}ms
${indent}  Failed Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
${indent}
${indent}Custom Metrics:
${indent}  Successful Registrations: ${data.metrics.successful_registrations.values.count}
${indent}  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%
${indent}  Registration Duration (p95): ${data.metrics.registration_duration.values['p(95)']}ms
${indent}  Verification Duration (p95): ${data.metrics.verification_duration.values['p(95)']}ms
${indent}
${indent}Thresholds: ${Object.keys(data.metrics).filter(k => data.metrics[k].thresholds).map(k => {
    const metric = data.metrics[k];
    const passed = Object.values(metric.thresholds).every(t => t.ok);
    return `${k}: ${passed ? '✅ PASS' : '❌ FAIL'}`;
  }).join(', ')}
  `;
}
