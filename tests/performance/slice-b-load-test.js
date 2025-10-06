import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import encoding from 'k6/encoding';

// Custom metrics
const errorRate = new Rate('errors');
const uploadDuration = new Trend('upload_duration');
const ocrDuration = new Trend('ocr_duration');
const approvalDuration = new Trend('approval_duration');
const successfulUploads = new Counter('successful_uploads');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://dev.onboarding.local';

// Test image data (1x1 PNG base64 for testing)
const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Load test options - simulates Slice B document upload under load
export const options = {
  stages: [
    { duration: '1m', target: 30 },   // Warm up to 30 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users (steady state)
    { duration: '2m', target: 100 },  // Spike to 100 users
    { duration: '3m', target: 100 },  // Maintain spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'],       // 95% of requests < 1s
    'http_req_duration{name:upload}': ['p(95)<2000'], // Upload < 2s
    'http_req_duration{name:ocr}': ['p(95)<5000'],    // OCR < 5s
    'errors': ['rate<0.02'],                    // Error rate < 2%
    'http_req_failed': ['rate<0.03'],           // HTTP failure rate < 3%
    'upload_duration': ['p(95)<3000'],          // End-to-end upload < 3s
  },
};

// Main test scenario - Slice B document upload
export default function () {
  // First, authenticate (reusing existing user or creating new one)
  const authToken = authenticate();
  if (!authToken) {
    errorRate.add(1);
    return;
  }

  group('Slice B - Document Upload Flow', () => {
    const startTime = Date.now();

    // Step 1: Upload document
    const documentType = ['rg', 'cpf', 'proof_of_address'][Math.floor(Math.random() * 3)];

    const uploadPayload = JSON.stringify({
      type: documentType,
      file: `data:image/png;base64,${TEST_IMAGE}`,
    });

    const uploadRes = http.post(
      `${BASE_URL}/api/documents/upload`,
      uploadPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        tags: { name: 'upload' },
      }
    );

    const uploadSuccess = check(uploadRes, {
      'upload status is 201': (r) => r.status === 201,
      'response contains document ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.document && body.document.id;
        } catch (e) {
          return false;
        }
      },
      'upload time < 2s': (r) => r.timings.duration < 2000,
    });

    if (!uploadSuccess) {
      errorRate.add(1);
      return;
    }

    const documentId = JSON.parse(uploadRes.body).document.id;
    const uploadTime = Date.now() - startTime;
    uploadDuration.add(uploadTime);

    sleep(1);

    // Step 2: Poll for OCR completion
    let ocrComplete = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!ocrComplete && attempts < maxAttempts) {
      const statusRes = http.get(
        `${BASE_URL}/api/documents/${documentId}/status`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          tags: { name: 'ocr' },
        }
      );

      check(statusRes, {
        'status check successful': (r) => r.status === 200,
      }) || errorRate.add(1);

      try {
        const status = JSON.parse(statusRes.body).status;
        if (status === 'processed' || status === 'approved') {
          ocrComplete = true;
        }
      } catch (e) {
        // Continue polling
      }

      attempts++;
      sleep(0.5);
    }

    const ocrTime = Date.now() - startTime;
    ocrDuration.add(ocrTime);

    if (!ocrComplete) {
      errorRate.add(1);
      return;
    }

    sleep(0.5);

    // Step 3: Check document status (simulating approval)
    const finalStatusRes = http.get(
      `${BASE_URL}/api/documents/status`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        tags: { name: 'status' },
      }
    );

    check(finalStatusRes, {
      'final status retrieved': (r) => r.status === 200,
      'documents list contains uploaded doc': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.documents && body.documents.some(d => d.id === documentId);
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);

    sleep(0.5);

    // Step 4: Check points balance (should increase after approval)
    const pointsRes = http.get(
      `${BASE_URL}/api/gamification/points/history`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        tags: { name: 'points' },
      }
    );

    check(pointsRes, {
      'points history retrieved': (r) => r.status === 200,
    }) || errorRate.add(1);

    const totalDuration = Date.now() - startTime;
    approvalDuration.add(totalDuration);

    successfulUploads.add(1);
  });

  // Think time between iterations
  sleep(Math.random() * 5 + 3); // 3-8 seconds
}

// Authentication helper
function authenticate() {
  const email = `loadtest-${__VU}@example.com`;
  const password = 'LoadTest123!@#';

  // Try to login first
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: email,
      password: password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { name: 'auth' },
    }
  );

  if (loginRes.status === 200) {
    try {
      return JSON.parse(loginRes.body).token;
    } catch (e) {
      return null;
    }
  }

  // If login fails, register new user
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: email,
      password: password,
      password_confirmation: password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      tags: { name: 'auth' },
    }
  );

  if (registerRes.status === 201) {
    try {
      return JSON.parse(registerRes.body).token;
    } catch (e) {
      return null;
    }
  }

  return null;
}

// Setup function
export function setup() {
  console.log('🚀 Starting Slice B Load Test');
  console.log(`Target: ${BASE_URL}`);
  console.log('Scenario: Document Upload → OCR Processing → Approval');

  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error('Health check failed - API is not ready');
  }

  return { timestamp: new Date().toISOString() };
}

// Teardown function
export function teardown(data) {
  console.log('✅ Slice B Load Test Completed');
  console.log(`Started at: ${data.timestamp}`);
}

// Handle summary
export function handleSummary(data) {
  return {
    'tests/Performance/reports/slice-b-load-test-summary.json': JSON.stringify(data, null, 2),
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  return `
Slice B Load Test Results
========================
Duration: ${data.state.testRunDurationMs}ms
Iterations: ${data.metrics.iterations.values.count}
VUs: ${data.metrics.vus.values.value}

HTTP Performance:
  Requests: ${data.metrics.http_reqs.values.count}
  Duration (p95): ${data.metrics.http_req_duration.values['p(95)']}ms
  Failed Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%

Custom Metrics:
  Successful Uploads: ${data.metrics.successful_uploads.values.count}
  Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%
  Upload Duration (p95): ${data.metrics.upload_duration.values['p(95)']}ms
  OCR Duration (p95): ${data.metrics.ocr_duration.values['p(95)']}ms
  `;
}
