import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requests = new Counter('requests');

// Test configuration
export const options = {
  stages: [
    // Ramp-up: gradually increase load
    { duration: '2m', target: 20 }, // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 20 }, // Stay at 20 users for 5 minutes
    { duration: '2m', target: 50 }, // Ramp up to 50 users over 2 minutes
    { duration: '5m', target: 50 }, // Stay at 50 users for 5 minutes
    { duration: '2m', target: 100 }, // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 }, // Stay at 100 users for 5 minutes
    { duration: '5m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Error rate should be less than 1%
    errors: ['rate<0.01'],
    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500'],
    // 99% of requests should be below 1000ms
    'http_req_duration{name:login}': ['p(99)<1000'],
    'http_req_duration{name:register}': ['p(99)<1000'],
    'http_req_duration{name:health_questionnaire}': ['p(99)<1500'],
    'http_req_duration{name:document_upload}': ['p(99)<2000'],
  },
};

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

// Test data generators
function generateTestUser() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `test${timestamp}@example.com`,
    cpf: `${timestamp}`.slice(-11).padStart(11, '1'),
    password: 'TestPassword123!',
    password_confirmation: 'TestPassword123!'
  };
}

function generateHealthData() {
  return {
    age: Math.floor(Math.random() * 50) + 20,
    height: Math.floor(Math.random() * 40) + 150,
    weight: Math.floor(Math.random() * 50) + 50,
    has_diabetes: Math.random() < 0.1,
    has_hypertension: Math.random() < 0.15,
    exercises_regularly: Math.random() < 0.6,
    smoker: Math.random() < 0.2,
    alcohol_consumption: ['none', 'light', 'moderate', 'heavy'][Math.floor(Math.random() * 4)]
  };
}

// Authentication helper
function authenticate(userEmail = 'admin@example.com', password = 'password') {
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: userEmail,
    password: password
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(response, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('data.token') !== undefined
  });

  return response.json('data.token');
}

// Test scenarios
export default function () {
  const scenarios = [
    'testHomePage',
    'testApiHealth',
    'testUserRegistration',
    'testUserAuthentication',
    'testHealthQuestionnaire',
    'testUserProfile',
    'testDocumentUpload',
    'testTelemedicineFlow'
  ];

  // Randomly select a scenario for each virtual user
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  switch (scenario) {
    case 'testHomePage':
      testHomePage();
      break;
    case 'testApiHealth':
      testApiHealth();
      break;
    case 'testUserRegistration':
      testUserRegistration();
      break;
    case 'testUserAuthentication':
      testUserAuthentication();
      break;
    case 'testHealthQuestionnaire':
      testHealthQuestionnaire();
      break;
    case 'testUserProfile':
      testUserProfile();
      break;
    case 'testDocumentUpload':
      testDocumentUpload();
      break;
    case 'testTelemedicineFlow':
      testTelemedicineFlow();
      break;
  }

  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

function testHomePage() {
  group('Frontend Home Page Load', () => {
    const response = http.get(FRONTEND_URL);
    
    check(response, {
      'home page status is 200': (r) => r.status === 200,
      'home page loads in reasonable time': (r) => r.timings.duration < 2000,
      'home page has content': (r) => r.body.length > 1000
    });

    requests.add(1);
    errorRate.add(response.status >= 400);
  });
}

function testApiHealth() {
  group('API Health Check', () => {
    const response = http.get(`${BASE_URL}/api/health`);
    
    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
      'health check has status': (r) => r.json('status') === 'ok'
    });

    requests.add(1);
    errorRate.add(response.status >= 400);
  });
}

function testUserRegistration() {
  group('User Registration Flow', () => {
    const userData = generateTestUser();
    
    const response = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(userData), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'register' }
    });

    const success = check(response, {
      'registration status is 201 or 422': (r) => r.status === 201 || r.status === 422,
      'registration response time < 1000ms': (r) => r.timings.duration < 1000,
      'registration has proper response format': (r) => {
        const body = r.json();
        return body.hasOwnProperty('message');
      }
    });

    requests.add(1);
    errorRate.add(!success || response.status >= 500);
    responseTime.add(response.timings.duration);
  });
}

function testUserAuthentication() {
  group('User Authentication Flow', () => {
    // Test with existing user credentials
    const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: 'admin@example.com',
      password: 'password'
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' }
    });

    const success = check(response, {
      'login status is 200': (r) => r.status === 200,
      'login response time < 800ms': (r) => r.timings.duration < 800,
      'login returns token': (r) => {
        const body = r.json();
        return body.data && body.data.token;
      },
      'login returns user data': (r) => {
        const body = r.json();
        return body.data && body.data.user && body.data.user.email;
      }
    });

    requests.add(1);
    errorRate.add(!success);
    responseTime.add(response.timings.duration);

    // Test logout if login was successful
    if (success && response.status === 200) {
      const token = response.json('data.token');
      
      const logoutResponse = http.post(`${BASE_URL}/api/auth/logout`, null, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      check(logoutResponse, {
        'logout status is 200': (r) => r.status === 200,
        'logout response time < 300ms': (r) => r.timings.duration < 300
      });

      requests.add(1);
      errorRate.add(logoutResponse.status >= 400);
    }
  });
}

function testHealthQuestionnaire() {
  group('Health Questionnaire Submission', () => {
    const token = authenticate();
    if (!token) return;

    const healthData = generateHealthData();
    
    const response = http.post(`${BASE_URL}/api/health-questionnaire`, JSON.stringify(healthData), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      tags: { name: 'health_questionnaire' }
    });

    const success = check(response, {
      'health questionnaire status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'health questionnaire response time < 1200ms': (r) => r.timings.duration < 1200,
      'health questionnaire processes correctly': (r) => {
        const body = r.json();
        return body.message || body.data;
      }
    });

    requests.add(1);
    errorRate.add(!success || response.status >= 500);
    responseTime.add(response.timings.duration);
  });
}

function testUserProfile() {
  group('User Profile Access', () => {
    const token = authenticate();
    if (!token) return;

    const response = http.get(`${BASE_URL}/api/user`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const success = check(response, {
      'profile status is 200': (r) => r.status === 200,
      'profile response time < 300ms': (r) => r.timings.duration < 300,
      'profile has user data': (r) => {
        const body = r.json();
        return body.email && body.name;
      }
    });

    requests.add(1);
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  });
}

function testDocumentUpload() {
  group('Document Upload Simulation', () => {
    const token = authenticate();
    if (!token) return;

    // Simulate file upload with mock data
    const mockFileData = 'Mock file content for testing';
    const formData = {
      document_type: 'id_card',
      file: http.file(mockFileData, 'test-document.txt', 'text/plain')
    };

    const response = http.post(`${BASE_URL}/api/documents/upload`, formData, {
      headers: { 
        'Authorization': `Bearer ${token}`
      },
      tags: { name: 'document_upload' }
    });

    const success = check(response, {
      'document upload status is acceptable': (r) => r.status === 200 || r.status === 201 || r.status === 422,
      'document upload response time < 2000ms': (r) => r.timings.duration < 2000,
      'document upload has response': (r) => r.body.length > 0
    });

    requests.add(1);
    errorRate.add(!success || response.status >= 500);
    responseTime.add(response.timings.duration);
  });
}

function testTelemedicineFlow() {
  group('Telemedicine Appointment Flow', () => {
    const token = authenticate();
    if (!token) return;

    // Get available slots
    const slotsResponse = http.get(`${BASE_URL}/api/telemedicine/slots`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    check(slotsResponse, {
      'slots fetch status is 200': (r) => r.status === 200,
      'slots response time < 500ms': (r) => r.timings.duration < 500
    });

    // Book appointment (simulate)
    const bookingData = {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      time: '14:00',
      type: 'consultation'
    };

    const bookingResponse = http.post(`${BASE_URL}/api/telemedicine/book`, JSON.stringify(bookingData), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const success = check(bookingResponse, {
      'booking status is acceptable': (r) => r.status === 200 || r.status === 201 || r.status === 422,
      'booking response time < 1000ms': (r) => r.timings.duration < 1000
    });

    requests.add(2); // Two requests in this test
    errorRate.add(slotsResponse.status >= 400);
    errorRate.add(!success || bookingResponse.status >= 500);
  });
}

// Handle test setup and teardown
export function setup() {
  console.log('Starting load test setup...');
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  console.log('Load test setup complete');
  return { timestamp: Date.now() };
}

export function teardown(data) {
  console.log(`Load test completed at ${new Date()}`);
  console.log(`Test ran for ${(Date.now() - data.timestamp) / 1000} seconds`);
}