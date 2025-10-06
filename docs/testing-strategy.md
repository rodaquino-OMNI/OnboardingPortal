# Testing Strategy & QA Methodology - OnboardingPortal

## 📋 Overview

This document outlines the comprehensive testing strategy and quality assurance methodology for the OnboardingPortal project, ensuring high code quality, reliability, and user satisfaction through systematic testing approaches.

## 🎯 Testing Philosophy

### Core Principles
1. **Test-Driven Development (TDD)**: Write tests before implementation
2. **Quality Gates**: Automated quality checks at every stage
3. **Risk-Based Testing**: Focus on high-impact, high-risk areas
4. **Continuous Testing**: Integrated testing throughout CI/CD pipeline
5. **User-Centric**: Tests that reflect real user scenarios
6. **Performance First**: Performance testing as a first-class citizen

### Testing Pyramid
```
              /\
             /  \
        E2E /    \ Integration
           /      \
          /________\
             Unit
```

- **Unit Tests (70%)**: Fast, isolated, comprehensive coverage
- **Integration Tests (20%)**: Component interactions, API testing
- **E2E Tests (10%)**: Critical user journeys, smoke tests

---

## 🧪 Testing Levels

### 1. Unit Testing

#### Frontend Unit Tests
```typescript
// __tests__/components/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with correct text content', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('applies correct variant classes', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-gray-200');
    });

    it('handles disabled state correctly', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Disabled</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('hides loading indicator when isLoading is false', () => {
      render(<Button isLoading={false}>Not Loading</Button>);
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });
});

// __tests__/hooks/use-onboarding-progress.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import * as apiClient from '@/lib/api-client';

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn()
  }
}));

describe('useOnboardingProgress Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with loading state', () => {
      vi.mocked(apiClient.apiClient.get).mockImplementation(() => new Promise(() => {}));
      
      const { result } = renderHook(() => useOnboardingProgress());
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.progress).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Data Loading', () => {
    it('loads progress data successfully', async () => {
      const mockProgress = {
        currentStep: 2,
        totalSteps: 5,
        completedSteps: ['welcome', 'company-info'],
        percentage: 40
      };

      vi.mocked(apiClient.apiClient.get).mockResolvedValue(mockProgress);

      const { result } = renderHook(() => useOnboardingProgress());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.progress).toEqual(mockProgress);
        expect(result.current.error).toBeNull();
      });
    });

    it('handles loading errors correctly', async () => {
      const errorMessage = 'Failed to load progress';
      vi.mocked(apiClient.apiClient.get).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useOnboardingProgress());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.progress).toBeNull();
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('Progress Updates', () => {
    it('advances to next step successfully', async () => {
      const initialProgress = { currentStep: 2, totalSteps: 5 };
      const updatedProgress = { currentStep: 3, totalSteps: 5 };

      vi.mocked(apiClient.apiClient.get).mockResolvedValue(initialProgress);
      vi.mocked(apiClient.apiClient.patch).mockResolvedValue(updatedProgress);

      const { result } = renderHook(() => useOnboardingProgress());

      await waitFor(() => {
        expect(result.current.progress).toEqual(initialProgress);
      });

      await act(async () => {
        await result.current.nextStep();
      });

      expect(result.current.progress).toEqual(updatedProgress);
      expect(vi.mocked(apiClient.apiClient.patch)).toHaveBeenCalledWith('/onboarding/progress', {
        currentStep: 3
      });
    });
  });
});
```

#### Backend Unit Tests (Laravel)
```php
<?php
// tests/Unit/Services/OnboardingProgressServiceTest.php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\OnboardingProgressService;
use App\Models\User;
use App\Models\OnboardingSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;

class OnboardingProgressServiceTest extends TestCase
{
    use RefreshDatabase;

    private OnboardingProgressService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new OnboardingProgressService();
    }

    /** @test */
    public function it_calculates_progress_percentage_correctly()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create([
            'user_id' => $user->id,
            'current_step' => 3,
            'total_steps' => 5,
            'completed_steps' => ['welcome', 'company-info', 'health-questionnaire']
        ]);

        $progress = $this->service->calculateProgress($session);

        $this->assertEquals(60, $progress['percentage']);
        $this->assertEquals(3, $progress['currentStep']);
        $this->assertEquals(5, $progress['totalSteps']);
        $this->assertEquals(['welcome', 'company-info', 'health-questionnaire'], $progress['completedSteps']);
    }

    /** @test */
    public function it_advances_to_next_step_when_valid()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create([
            'user_id' => $user->id,
            'current_step' => 2,
            'total_steps' => 5
        ]);

        $result = $this->service->advanceStep($session);

        $this->assertTrue($result['success']);
        $this->assertEquals(3, $session->fresh()->current_step);
    }

    /** @test */
    public function it_prevents_advancing_beyond_total_steps()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create([
            'user_id' => $user->id,
            'current_step' => 5,
            'total_steps' => 5
        ]);

        $result = $this->service->advanceStep($session);

        $this->assertFalse($result['success']);
        $this->assertEquals('Cannot advance beyond final step', $result['message']);
        $this->assertEquals(5, $session->fresh()->current_step);
    }

    /** @test */
    public function it_validates_step_completion_requirements()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create([
            'user_id' => $user->id,
            'current_step' => 1,
            'form_data' => []
        ]);

        $result = $this->service->validateStepCompletion($session, 'company-info');

        $this->assertFalse($result['valid']);
        $this->assertArrayHasKey('errors', $result);
        $this->assertContains('Company information is required', $result['errors']);
    }
}

// tests/Unit/Models/UserTest.php
namespace Tests\Unit\Models;

use Tests\TestCase;
use App\Models\User;
use App\Models\OnboardingSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

class UserTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_has_onboarding_session_relationship()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create(['user_id' => $user->id]);

        $this->assertInstanceOf(OnboardingSession::class, $user->onboardingSession);
        $this->assertEquals($session->id, $user->onboardingSession->id);
    }

    /** @test */
    public function it_formats_full_name_correctly()
    {
        $user = User::factory()->create([
            'first_name' => 'John',
            'last_name' => 'Doe'
        ]);

        $this->assertEquals('John Doe', $user->full_name);
    }

    /** @test */
    public function it_checks_onboarding_completion_status()
    {
        $user = User::factory()->create();
        $session = OnboardingSession::factory()->create([
            'user_id' => $user->id,
            'status' => 'completed'
        ]);

        $this->assertTrue($user->hasCompletedOnboarding());
    }
}
```

### 2. Integration Testing

#### API Integration Tests
```typescript
// __tests__/integration/api/onboarding.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testApiClient } from '@/lib/test-utils';

describe('Onboarding API Integration', () => {
  let testUser: { id: string; token: string };

  beforeAll(async () => {
    testUser = await testApiClient.createTestUser();
  });

  afterAll(async () => {
    await testApiClient.cleanup();
  });

  describe('Progress Management', () => {
    it('creates initial onboarding session', async () => {
      const response = await testApiClient.post('/onboarding/start', {}, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.session).toMatchObject({
        currentStep: 0,
        totalSteps: expect.any(Number),
        status: 'in_progress'
      });
    });

    it('tracks progress through onboarding steps', async () => {
      // Start onboarding
      await testApiClient.post('/onboarding/start', {}, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      // Complete company info step
      const companyData = {
        name: 'Test Company',
        cnpj: '12.345.678/0001-90',
        email: 'test@company.com'
      };

      const companyResponse = await testApiClient.post('/onboarding/company', companyData, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(companyResponse.status).toBe(200);

      // Check progress update
      const progressResponse = await testApiClient.get('/onboarding/progress', {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(progressResponse.data.data.progress).toMatchObject({
        currentStep: 1,
        completedSteps: expect.arrayContaining(['company-info']),
        percentage: expect.any(Number)
      });
    });

    it('validates step completion requirements', async () => {
      // Try to advance without completing required fields
      const response = await testApiClient.post('/onboarding/company', {
        name: '', // Invalid - empty name
        cnpj: 'invalid-cnpj' // Invalid format
      }, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(response.status).toBe(422);
      expect(response.data.error.details).toMatchObject({
        name: expect.arrayContaining(['Name is required']),
        cnpj: expect.arrayContaining(['Invalid CNPJ format'])
      });
    });
  });

  describe('Document Upload Integration', () => {
    it('uploads and processes document successfully', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content']), 'test-document.pdf');
      formData.append('documentType', 'id');

      const response = await testApiClient.post('/documents/upload', formData, {
        headers: { 
          Authorization: `Bearer ${testUser.token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.data.document).toMatchObject({
        id: expect.any(String),
        type: 'id',
        uploadStatus: 'completed',
        validationStatus: expect.stringMatching(/pending|approved|rejected/)
      });
    });

    it('rejects invalid file types', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['malicious script']), 'malware.exe');

      const response = await testApiClient.post('/documents/upload', formData, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(response.status).toBe(400);
      expect(response.data.error.message).toContain('Unsupported file type');
    });
  });

  describe('Health Questionnaire Integration', () => {
    it('processes comprehensive questionnaire', async () => {
      const questionnaireData = {
        pathway: 'comprehensive',
        responses: {
          age: 35,
          gender: 'male',
          chronicConditions: ['diabetes'],
          medications: [{
            name: 'Metformina',
            dosage: '850mg',
            frequency: '2x/day'
          }],
          lifestyle: {
            smoking: false,
            exercise: 'regular'
          }
        }
      };

      const response = await testApiClient.post('/onboarding/health/questionnaire', questionnaireData, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.data.submission).toMatchObject({
        riskAssessment: {
          overallRisk: expect.stringMatching(/low|medium|high/),
          score: expect.any(Number)
        },
        telemedicineEligibility: {
          eligible: expect.any(Boolean)
        }
      });
    });
  });
});

// __tests__/integration/database/user-onboarding.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, cleanupTestDatabase } from '@/lib/test-database';

describe('User Onboarding Database Integration', () => {
  beforeEach(async () => {
    await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('maintains data consistency across related tables', async () => {
    // This test verifies database constraints and relationships
    const db = await getTestDatabaseConnection();

    // Create user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    }).returning();

    // Create onboarding session
    const [session] = await db.insert(onboardingSessions).values({
      userId: user.id,
      currentStep: 0,
      status: 'in_progress'
    }).returning();

    // Verify relationships
    const userWithSession = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: {
        onboardingSession: true
      }
    });

    expect(userWithSession?.onboardingSession?.id).toBe(session.id);
  });
});
```

### 3. End-to-End Testing

#### Playwright E2E Tests
```typescript
// tests/e2e/onboarding-flow.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OnboardingPage } from '../pages/OnboardingPage';

test.describe('Complete Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('user completes full onboarding process', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const onboardingPage = new OnboardingPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login('testuser@example.com', 'password123');
    await expect(page).toHaveURL('/welcome');

    // Welcome step
    await expect(page.locator('h1')).toContainText('Bem-vindo ao Processo de Onboarding');
    await page.click('button:has-text("Começar Onboarding")');
    await expect(page).toHaveURL('/company-info');

    // Company info step
    await onboardingPage.fillCompanyInfo({
      name: 'ACME Healthcare Corp',
      cnpj: '12.345.678/0001-90',
      email: 'contact@acme.com',
      phone: '(11) 1234-5678'
    });
    await page.click('button:has-text("Próximo")');
    await expect(page).toHaveURL('/health-questionnaire');

    // Health questionnaire
    await onboardingPage.fillHealthQuestionnaire({
      age: '35',
      gender: 'male',
      hasChronicConditions: true,
      conditions: ['diabetes']
    });
    await page.click('button:has-text("Próximo")');
    await expect(page).toHaveURL('/document-upload');

    // Document upload
    await onboardingPage.uploadDocument({
      filePath: './test-files/sample-id.pdf',
      documentType: 'id'
    });
    await page.waitForSelector('[data-testid="upload-success"]');
    await page.click('button:has-text("Próximo")');

    // Interview scheduling
    await expect(page).toHaveURL('/interview-schedule');
    await onboardingPage.scheduleInterview({
      date: '2024-02-15',
      time: '09:00',
      type: 'video'
    });
    await page.click('button:has-text("Agendar")');

    // Completion
    await expect(page).toHaveURL('/completion');
    await expect(page.locator('h1')).toContainText('Onboarding Concluído');
    await expect(page.locator('[data-testid="completion-badge"]')).toBeVisible();
  });

  test('handles validation errors gracefully', async ({ page }) => {
    const onboardingPage = new OnboardingPage(page);

    await page.goto('/company-info');

    // Try to submit with invalid data
    await onboardingPage.fillCompanyInfo({
      name: '', // Invalid - empty
      cnpj: '123', // Invalid format
      email: 'invalid-email' // Invalid format
    });
    await page.click('button:has-text("Próximo")');

    // Check validation errors
    await expect(page.locator('[data-testid="error-name"]')).toContainText('Nome é obrigatório');
    await expect(page.locator('[data-testid="error-cnpj"]')).toContainText('CNPJ inválido');
    await expect(page.locator('[data-testid="error-email"]')).toContainText('Email inválido');

    // Verify user stays on the same page
    await expect(page).toHaveURL('/company-info');
  });

  test('progress is persisted across sessions', async ({ page, context }) => {
    const onboardingPage = new OnboardingPage(page);

    // Complete first step
    await page.goto('/company-info');
    await onboardingPage.fillCompanyInfo({
      name: 'Test Company',
      cnpj: '12.345.678/0001-90',
      email: 'test@company.com'
    });
    await page.click('button:has-text("Próximo")');

    // Close browser and reopen (simulate session interruption)
    await context.close();
    const newContext = await page.context().browser()?.newContext();
    const newPage = await newContext!.newPage();

    // Login again and check progress is maintained
    const loginPage = new LoginPage(newPage);
    await loginPage.goto();
    await loginPage.login('testuser@example.com', 'password123');

    // Should redirect to next incomplete step
    await expect(newPage).toHaveURL('/health-questionnaire');
    
    // Verify progress indicator shows correct completion
    await expect(newPage.locator('[data-testid="progress-bar"]')).toHaveAttribute('data-progress', '25');
  });
});

// tests/pages/OnboardingPage.ts
import { Page, Locator } from '@playwright/test';

export class OnboardingPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async fillCompanyInfo(data: {
    name: string;
    cnpj: string;
    email: string;
    phone?: string;
  }) {
    await this.page.fill('[data-testid="company-name"]', data.name);
    await this.page.fill('[data-testid="company-cnpj"]', data.cnpj);
    await this.page.fill('[data-testid="company-email"]', data.email);
    
    if (data.phone) {
      await this.page.fill('[data-testid="company-phone"]', data.phone);
    }
  }

  async fillHealthQuestionnaire(data: {
    age: string;
    gender: string;
    hasChronicConditions: boolean;
    conditions?: string[];
  }) {
    await this.page.fill('[data-testid="age-input"]', data.age);
    await this.page.selectOption('[data-testid="gender-select"]', data.gender);
    
    if (data.hasChronicConditions) {
      await this.page.check('[data-testid="has-conditions"]');
      
      for (const condition of data.conditions || []) {
        await this.page.check(`[data-testid="condition-${condition}"]`);
      }
    }
  }

  async uploadDocument(data: {
    filePath: string;
    documentType: string;
  }) {
    await this.page.selectOption('[data-testid="document-type"]', data.documentType);
    await this.page.setInputFiles('[data-testid="file-input"]', data.filePath);
    await this.page.click('[data-testid="upload-button"]');
  }

  async scheduleInterview(data: {
    date: string;
    time: string;
    type: string;
  }) {
    await this.page.fill('[data-testid="interview-date"]', data.date);
    await this.page.selectOption('[data-testid="interview-time"]', data.time);
    await this.page.selectOption('[data-testid="interview-type"]', data.type);
  }
}
```

---

## 🚀 Performance Testing

### Load Testing with k6
```javascript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('error_rate');

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    error_rate: ['rate<0.01'],        // Error rate under 1%
  },
};

export default function() {
  // Test API endpoints
  const baseUrl = 'https://api.example.com';
  
  // Health check
  const healthResponse = http.get(`${baseUrl}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(1);

  // Login
  const loginPayload = JSON.stringify({
    email: 'testuser@example.com',
    password: 'password123'
  });

  const loginResponse = http.post(`${baseUrl}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' }
  });

  const authToken = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 2s': (r) => r.timings.duration < 2000,
    'receives auth token': (r) => r.json('data.tokens.accessToken') !== undefined,
  }) ? loginResponse.json('data.tokens.accessToken') : null;

  if (!authToken) {
    errorRate.add(1);
    return;
  }

  sleep(2);

  // Test onboarding progress endpoint
  const progressResponse = http.get(`${baseUrl}/onboarding/progress`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  check(progressResponse, {
    'progress status is 200': (r) => r.status === 200,
    'progress response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);
}

// Stress test scenario
export function stressTest() {
  const response = http.get('https://api.example.com/onboarding/heavy-operation');
  check(response, {
    'stress test status is 200': (r) => r.status === 200,
    'stress test completes within 5s': (r) => r.timings.duration < 5000,
  });
}
```

### Frontend Performance Tests
```typescript
// tests/performance/lighthouse-config.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/welcome',
        'http://localhost:3000/company-info',
        'http://localhost:3000/health-questionnaire'
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

// tests/performance/bundle-analysis.test.ts
import { describe, it, expect } from 'vitest';
import { analyze } from 'next-bundle-analyzer';

describe('Bundle Performance', () => {
  it('keeps bundle sizes within limits', async () => {
    const analysis = await analyze();
    
    // Main bundle should be under 250KB
    expect(analysis.pages['/'].size).toBeLessThan(250 * 1024);
    
    // Vendor bundle should be under 500KB
    expect(analysis.vendor.size).toBeLessThan(500 * 1024);
    
    // No single chunk should be over 1MB
    analysis.chunks.forEach(chunk => {
      expect(chunk.size).toBeLessThan(1024 * 1024);
    });
  });

  it('uses code splitting effectively', async () => {
    const analysis = await analyze();
    
    // Should have separate chunks for different routes
    expect(analysis.pages).toHaveProperty('/company-info');
    expect(analysis.pages).toHaveProperty('/health-questionnaire');
    expect(analysis.pages).toHaveProperty('/document-upload');
  });
});
```

---

## 🔒 Security Testing

### Security Test Suite
```typescript
// tests/security/xss-protection.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompanyInfoForm } from '@/components/forms/CompanyInfoForm';

describe('XSS Protection', () => {
  it('sanitizes potentially dangerous input', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    
    render(
      <CompanyInfoForm 
        initialData={{ name: maliciousInput }}
        onSubmit={() => Promise.resolve()}
      />
    );
    
    const input = screen.getByDisplayValue('');
    expect(input).not.toHaveValue(maliciousInput);
    expect(document.querySelector('script')).toBeNull();
  });

  it('escapes HTML in user content', () => {
    const htmlContent = '<img src=x onerror=alert(1)>';
    
    render(<div data-testid="user-content">{htmlContent}</div>);
    
    const element = screen.getByTestId('user-content');
    expect(element.innerHTML).not.toContain('<img');
    expect(element.textContent).toBe(htmlContent);
  });
});

// tests/security/csrf-protection.test.ts
import { describe, it, expect } from 'vitest';
import { testApiClient } from '@/lib/test-utils';

describe('CSRF Protection', () => {
  it('rejects requests without CSRF token', async () => {
    const response = await testApiClient.post('/onboarding/company', {
      name: 'Test Company'
    });
    
    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('rejects requests with invalid CSRF token', async () => {
    const response = await testApiClient.post('/onboarding/company', {
      name: 'Test Company'
    }, {
      headers: {
        'X-CSRF-Token': 'invalid-token'
      }
    });
    
    expect(response.status).toBe(403);
    expect(response.data.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('accepts requests with valid CSRF token', async () => {
    // Get CSRF token first
    const tokenResponse = await testApiClient.get('/csrf-token');
    const csrfToken = tokenResponse.data.token;
    
    const response = await testApiClient.post('/onboarding/company', {
      name: 'Test Company',
      cnpj: '12.345.678/0001-90'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    expect(response.status).toBe(200);
  });
});

// tests/security/input-validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateCompanyInfo } from '@/lib/validations';

describe('Input Validation Security', () => {
  it('prevents SQL injection attempts', () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    const result = validateCompanyInfo({
      name: maliciousInput,
      cnpj: '12.345.678/0001-90',
      email: 'test@example.com'
    });
    
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('Invalid characters');
  });

  it('prevents NoSQL injection attempts', () => {
    const maliciousInput = { $ne: null };
    
    const result = validateCompanyInfo({
      name: maliciousInput,
      cnpj: '12.345.678/0001-90',
      email: 'test@example.com'
    });
    
    expect(result.success).toBe(false);
  });

  it('validates file upload security', () => {
    const maliciousFile = {
      name: 'malware.exe',
      type: 'application/x-msdownload',
      size: 1024
    };
    
    const result = validateFileUpload(maliciousFile);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('File type not allowed');
  });
});
```

---

## 📊 Test Coverage & Quality Gates

### Coverage Configuration
```json
// vitest.config.ts coverage settings
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: [
        'src/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.{ts,js}',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/test-utils.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'src/components/': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/hooks/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  }
});
```

### Quality Gates Pipeline
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Type checking
      run: npm run type-check
    
    - name: Linting
      run: npm run lint
    
    - name: Unit tests with coverage
      run: npm run test:coverage
    
    - name: Integration tests
      run: npm run test:integration
    
    - name: E2E tests
      run: npm run test:e2e
    
    - name: Performance tests
      run: npm run test:performance
    
    - name: Security audit
      run: npm audit --audit-level moderate
    
    - name: Bundle analysis
      run: npm run analyze
    
    - name: Generate test report
      if: always()
      run: npm run test:report
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

---

## 🔍 Test Data Management

### Test Database Setup
```typescript
// lib/test-database.ts
import { sql } from 'drizzle-orm';
import { db } from './database';
import { users, onboardingSessions, documents } from './schema';

export async function createTestDatabase() {
  // Create test schema
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS test`);
  
  // Run migrations on test schema
  await db.execute(sql`SET search_path TO test`);
  await runMigrations();
}

export async function cleanupTestDatabase() {
  await db.execute(sql`DROP SCHEMA IF EXISTS test CASCADE`);
}

export async function seedTestData() {
  // Create test users
  const testUsers = await db.insert(users).values([
    {
      email: 'test1@example.com',
      firstName: 'Test',
      lastName: 'User1',
      status: 'active'
    },
    {
      email: 'test2@example.com',
      firstName: 'Test',
      lastName: 'User2',
      status: 'active'
    }
  ]).returning();

  // Create test onboarding sessions
  const testSessions = await db.insert(onboardingSessions).values([
    {
      userId: testUsers[0].id,
      currentStep: 2,
      status: 'in_progress',
      formData: {
        company: {
          name: 'Test Company 1',
          cnpj: '12.345.678/0001-90'
        }
      }
    }
  ]).returning();

  return { testUsers, testSessions };
}

// Test fixtures
export const testFixtures = {
  validCompanyData: {
    name: 'ACME Healthcare Corp',
    cnpj: '12.345.678/0001-90',
    email: 'contact@acme.com',
    phone: '(11) 1234-5678'
  },
  
  validHealthData: {
    age: 35,
    gender: 'male',
    chronicConditions: ['diabetes'],
    medications: [{
      name: 'Metformina',
      dosage: '850mg',
      frequency: '2x/day'
    }]
  },

  invalidData: {
    invalidEmail: 'not-an-email',
    invalidCnpj: '123.456.789-00',
    emptyString: '',
    maliciousScript: '<script>alert("xss")</script>'
  }
};
```

### Mock Services
```typescript
// lib/mocks/api-client.ts
import { vi } from 'vitest';

export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

// Setup default successful responses
mockApiClient.get.mockImplementation((url: string) => {
  if (url.includes('/onboarding/progress')) {
    return Promise.resolve({
      data: {
        success: true,
        data: {
          progress: {
            currentStep: 2,
            totalSteps: 5,
            completedSteps: ['welcome', 'company-info'],
            percentage: 40
          }
        }
      }
    });
  }
  return Promise.resolve({ data: { success: true, data: {} } });
});

mockApiClient.post.mockResolvedValue({
  data: { success: true, data: {} }
});

// lib/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/onboarding/progress', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          progress: {
            currentStep: 2,
            totalSteps: 5,
            completedSteps: ['welcome', 'company-info'],
            percentage: 40
          }
        }
      })
    );
  }),

  rest.post('/api/onboarding/company', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          company: {
            id: 'test-company-id',
            name: 'Test Company',
            status: 'active'
          }
        }
      })
    );
  }),

  rest.post('/api/documents/upload', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: {
          document: {
            id: 'test-document-id',
            uploadStatus: 'completed',
            validationStatus: 'pending'
          }
        }
      })
    );
  })
];

// lib/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## 📋 QA Checklist

### Pre-Release Testing Checklist

#### Functional Testing
- [ ] All user stories tested and pass acceptance criteria
- [ ] All API endpoints tested with valid/invalid data
- [ ] Form validation working correctly
- [ ] File upload functionality tested
- [ ] Authentication and authorization working
- [ ] Error handling and user feedback functional
- [ ] Data persistence verified across sessions

#### UI/UX Testing
- [ ] Responsive design tested on multiple devices
- [ ] Cross-browser compatibility verified
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Loading states and error states display correctly
- [ ] Navigation and user flow intuitive
- [ ] Visual consistency maintained

#### Performance Testing
- [ ] Page load times under 2 seconds
- [ ] Bundle sizes within acceptable limits
- [ ] API response times under 500ms (95th percentile)
- [ ] No memory leaks detected
- [ ] Lighthouse scores meet thresholds

#### Security Testing
- [ ] Input validation prevents injection attacks
- [ ] Authentication tokens secured
- [ ] HTTPS enforced in production
- [ ] Sensitive data properly encrypted
- [ ] Rate limiting implemented
- [ ] CSRF protection active

#### Integration Testing
- [ ] Database operations working correctly
- [ ] External API integrations functional
- [ ] Email/SMS notifications working
- [ ] File storage operations successful
- [ ] Payment processing (if applicable) tested

#### Browser/Device Testing
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest version)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 📈 Test Metrics & Reporting

### Key Metrics to Track
1. **Test Coverage**: Line, branch, function coverage
2. **Test Execution Time**: Unit, integration, E2E test duration
3. **Test Reliability**: Flaky test rate, test stability
4. **Bug Detection**: Bugs found in testing vs production
5. **Performance Metrics**: Load test results, response times
6. **Security Metrics**: Vulnerabilities detected and fixed

### Automated Reporting
```typescript
// scripts/generate-test-report.ts
import { generateCoverageReport } from './coverage-reporter';
import { generatePerformanceReport } from './performance-reporter';
import { generateSecurityReport } from './security-reporter';

async function generateComprehensiveReport() {
  const reports = await Promise.all([
    generateCoverageReport(),
    generatePerformanceReport(),
    generateSecurityReport()
  ]);

  const consolidatedReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: reports[0].totalTests,
      passingTests: reports[0].passingTests,
      coverage: reports[0].coverage,
      performance: reports[1].summary,
      security: reports[2].summary
    },
    details: reports
  };

  await saveReport(consolidatedReport);
  await sendSlackNotification(consolidatedReport.summary);
}
```

This comprehensive testing strategy ensures the OnboardingPortal system maintains high quality, reliability, and user satisfaction through systematic testing at all levels.