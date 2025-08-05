import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';

// Components under test
import { UnifiedRegistrationForm } from '../../components/auth/UnifiedRegistrationForm';
import ProfileSetup from '../../components/profile/ProfileSetup';
import UnifiedHealthAssessment from '../../components/health/UnifiedHealthAssessment';
import EnhancedDocumentUpload from '../../components/upload/EnhancedDocumentUpload';
import InterviewUnlockCard from '../../components/dashboard/InterviewUnlockCard';
import UserDashboard from '../../app/(dashboard)/home/page';

// Types
import type { User, RegisterResponse, LoginResponse } from '../../types/auth';
import type { HealthAssessmentResult } from '../../types/health';

expect.extend(toHaveNoViolations);

// MSW Server Setup
const server = setupServer(
  // Authentication endpoints
  http.post('/api/auth/register/step1', async ({ request }) => {
    const { email, cpf } = await request.json();
    return HttpResponse.json(
({
        success: true,
        user: {
          id: '123',
          name: '',
          email,
          cpf,
        },
        registration_step: 'step2',
      })
    );
  }),

  http.post('/api/auth/register/step2', async ({ request }) => {
    const { name, phone } = await request.json();
    return HttpResponse.json(
({
        success: true,
        user: {
          id: '123',
          name,
          email: 'test@example.com',
          cpf: '12345678901',
        },
        registration_step: 'step3',
      })
    );
  }),

  http.post('/api/auth/register/step3', async ({ request }) => {
    const { password } = await request.json();
    return HttpResponse.json(
({
        success: true,
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
        },
        token: 'mock-jwt-token',
        registration_step: 'completed',
      })
    );
  }),

  http.post('/api/auth/login', async ({ request }) => {
    return HttpResponse.json(
({
        success: true,
        user: {
          id: '123',
          name: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
          gamification_progress: { points: 0, level: 1 },
          lgpd_consent: true,
          lgpd_consent_at: new Date().toISOString()
        },
      })
    );
  }),

  // Profile endpoints
  http.put('/api/profile', async ({ request }) => {
    const profile = await request.json();
    return HttpResponse.json({
        success: true,
        user: {
          ...profile,
          profile_completed: true,
        },
      });
  }),

  // Health assessment endpoints
  http.post('/api/health/assessment/start', ({ request }) => {
    return HttpResponse.json({
        assessment_id: 'assessment-123',
        pathway: 'progressive',
        questions: [
          {
            id: 'q1',
            text: 'How would you rate your overall health?',
            type: 'scale',
            options: ['1', '2', '3', '4', '5'],
          },
        ],
      });
  }),

  http.post('/api/health/assessment/submit', async ({ request }) => {
    const { responses } = await request.json();
    return HttpResponse.json(
({
        id: 'result-123',
        userId: '123',
        assessmentType: 'progressive',
        completedAt: new Date(),
        score: 85,
        riskLevel: 'low',
        recommendations: [
          {
            id: 'rec1',
            category: 'lifestyle',
            priority: 'medium',
            title: 'Increase Physical Activity',
            description: 'Consider adding 30 minutes of exercise daily',
            actionItems: ['Join a gym', 'Take daily walks'],
          },
        ],
        insights: [
          {
            id: 'ins1',
            type: 'positive_habit',
            message: 'Your nutrition habits are excellent',
            confidence: 0.9,
            relatedQuestions: ['q1'],
          },
        ],
        pathwayTaken: 'progressive',
      })
    );
  }),

  // Document upload endpoints
  http.post('/api/documents/upload', async ({ request }) => {
    return HttpResponse.json(
      ({
        success: true,
        document: {
          id: 'doc-123',
          name: 'ID Document',
          type: 'identification',
          status: 'processing',
          uploaded_at: new Date().toISOString()
        },
      })
    );
  }),

  http.post('/api/documents/ocr/process', async ({ request }) => {
    return HttpResponse.json(
      await new Promise(resolve => setTimeout(resolve, 1000))
      ({
        success: true,
        extracted_data: {
          name: 'Test User',
          cpf: '12345678901',
          rg: '123456789',
          birth_date: '1990-01-01',
        },
        confidence: 0.95,
        processing_time: 1.2,
      })
    );
  }),

  // Interview scheduling endpoints
  http.get('/api/interviews/slots', ({ request }) => {
    return HttpResponse.json({
        slots: [
          {
            id: 'slot-1',
            date: '2024-12-20',
            time: '10:00',
            available: true,
            timezone: 'America/Sao_Paulo',
          },
          {
            id: 'slot-2',
            date: '2024-12-20',
            time: '14:00',
            available: true,
            timezone: 'America/Sao_Paulo',
          },
        ],
      });
  }),

  http.post('/api/interviews/schedule', async ({ request }) => {
    const { slot_id } = await request.json();
    return HttpResponse.json({
        success: true,
        interview: {
          id: 'interview-123',
          slot_id,
          scheduled_at: '2024-12-20T10:00:00Z',
          meeting_url: 'https://meet.example.com/interview-123',
          status: 'scheduled',
        },
      });
  }),

  // Gamification endpoints
  http.get('/api/gamification/progress', ({ request }) => {
    return HttpResponse.json({
        points: 150,
        level: 2,
        badges: ['first_login', 'profile_complete', 'health_assessed'],
        next_level_points: 200,
        activities: [
          { action: 'registration', points: 50 },
          { action: 'profile_completion', points: 50 },
          { action: 'health_assessment', points: 50 },
        ],
      });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

// Mock next/router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/'
  }),
  usePathname: () => '/'
}));

describe('Complete User Journey Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should complete full onboarding journey from registration to interview scheduling', async () => {
    const startTime = performance.now();

    // Step 1: Registration Flow
    const { container } = renderWithProviders(<UnifiedRegistrationForm />);

    // Step 1.1: Initial registration
    const emailInput = screen.getByLabelText(/email/i);
    const cpfInput = screen.getByLabelText(/cpf/i);
    const lgpdCheckbox = screen.getByRole('checkbox', { name: /accept.*terms/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(cpfInput, '12345678901');
    await user.click(lgpdCheckbox);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Verify progression to step 2
    await waitFor(() => {
      expect(screen.getByText(/personal information/i)).toBeInTheDocument();
    });

    // Step 1.2: Personal information
    const nameInput = screen.getByLabelText(/full name/i);
    const phoneInput = screen.getByLabelText(/phone/i);
    
    await user.type(nameInput, 'Test User');
    await user.type(phoneInput, '11999999999');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 1.3: Password creation
    await waitFor(() => {
      expect(screen.getByText(/create.*password/i)).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    await user.type(passwordInput, 'SecurePass123!');
    await user.type(confirmPasswordInput, 'SecurePass123!');
    await user.click(screen.getByRole('button', { name: /complete registration/i }));

    // Verify registration completion
    await waitFor(() => {
      expect(localStorage.getItem('auth-token')).toBe('mock-jwt-token');
    });

    // Step 2: Profile Setup
    renderWithProviders(<ProfileSetup />);

    // Fill profile information
    const birthDateInput = screen.getByLabelText(/birth date/i);
    const addressInput = screen.getByLabelText(/address/i);
    const cityInput = screen.getByLabelText(/city/i);
    const stateSelect = screen.getByLabelText(/state/i);
    
    await user.type(birthDateInput, '01/01/1990');
    await user.type(addressInput, 'Rua Teste, 123');
    await user.type(cityInput, 'São Paulo');
    await user.selectOptions(stateSelect, 'SP');
    
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    // Verify profile saved
    await waitFor(() => {
      expect(screen.getByText(/profile.*completed/i)).toBeInTheDocument();
    });

    // Step 3: Health Assessment
    renderWithProviders(<UnifiedHealthAssessment />);

    // Start assessment
    await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

    // Answer questions
    await waitFor(() => {
      expect(screen.getByText(/rate.*overall health/i)).toBeInTheDocument();
    });

    const healthRating = screen.getByRole('radio', { name: /4/i });
    await user.click(healthRating);
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Complete assessment
    await waitFor(() => {
      expect(screen.getByText(/assessment.*complete/i)).toBeInTheDocument();
    });

    // Verify recommendations
    expect(screen.getByText(/increase physical activity/i)).toBeInTheDocument();
    expect(screen.getByText(/nutrition habits.*excellent/i)).toBeInTheDocument();

    // Step 4: Document Upload
    renderWithProviders(<EnhancedDocumentUpload type="identification" />);

    // Upload document
    const file = new File(['test'], 'id-document.jpg', { type: 'image/jpeg' });
    const uploadInput = screen.getByLabelText(/upload.*document/i);
    
    await user.upload(uploadInput, file);

    // Wait for OCR processing
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(screen.getByText(/extracted successfully/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify extracted data
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByText(/123\.456\.789-01/i)).toBeInTheDocument();

    // Step 5: Interview Scheduling
    renderWithProviders(<InterviewScheduler />);

    // Load available slots
    await waitFor(() => {
      expect(screen.getByText(/available slots/i)).toBeInTheDocument();
    });

    // Select a time slot
    const timeSlot = screen.getByRole('button', { name: /10:00/i });
    await user.click(timeSlot);
    
    // Confirm scheduling
    await user.click(screen.getByRole('button', { name: /confirm.*interview/i }));

    // Verify scheduling success
    await waitFor(() => {
      expect(screen.getByText(/interview.*scheduled/i)).toBeInTheDocument();
      expect(screen.getByText(/december 20.*10:00/i)).toBeInTheDocument();
    });

    // Step 6: Verify Dashboard State
    renderWithProviders(<UserDashboard />);

    await waitFor(() => {
      // Verify all steps completed
      expect(screen.getByText(/registration.*complete/i)).toBeInTheDocument();
      expect(screen.getByText(/profile.*complete/i)).toBeInTheDocument();
      expect(screen.getByText(/health.*assessed/i)).toBeInTheDocument();
      expect(screen.getByText(/documents.*uploaded/i)).toBeInTheDocument();
      expect(screen.getByText(/interview.*scheduled/i)).toBeInTheDocument();

      // Verify gamification progress
      expect(screen.getByText(/150.*points/i)).toBeInTheDocument();
      expect(screen.getByText(/level 2/i)).toBeInTheDocument();
    });

    // Performance assertion
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(10000); // Complete journey under 10 seconds

    // Accessibility check
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle errors gracefully during the journey', async () => {
    // Override server handlers to simulate errors
    server.use(
      http.post('/api/auth/register/step1', ({ request }) => {
        return HttpResponse.json({ message: 'Email already exists' }, { status: 400 });
      })
    );

    renderWithProviders(<UnifiedRegistrationForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const cpfInput = screen.getByLabelText(/cpf/i);
    const lgpdCheckbox = screen.getByRole('checkbox', { name: /accept.*terms/i });
    
    await user.type(emailInput, 'existing@example.com');
    await user.type(cpfInput, '12345678901');
    await user.click(lgpdCheckbox);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });

    // Verify user can correct and continue
    await user.clear(emailInput);
    await user.type(emailInput, 'new@example.com');
    
    // Reset handler
    server.resetHandlers();
    
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/personal information/i)).toBeInTheDocument();
    });
  });

  it('should maintain data consistency across the journey', async () => {
    const userData = {
      email: 'consistent@example.com',
      cpf: '98765432101',
      name: 'Consistent User',
    };

    // Track data through journey
    let capturedData: any = {};

    server.use(
      http.post('/api/auth/register/step3', async ({ request }) => {
        capturedData.registration = await request.json();
        return HttpResponse.json(
    ({
            success: true,
            user: {
              id: '456',
              name: userData.name,
              email: userData.email,
              cpf: userData.cpf,
            },
            token: 'consistent-token',
            registration_step: 'completed',
          })
        );
      }),

      http.put('/api/profile', async ({ request }) => {
        capturedData.profile = await request.json();
        return HttpResponse.json({ success: true });
      }),

      http.post('/api/health/assessment/submit', async ({ request }) => {
        capturedData.health = await request.json();
        return HttpResponse.json(
    ({
            id: 'result-456',
            userId: '456',
            assessmentType: 'progressive',
            completedAt: new Date(),
            score: 90,
            riskLevel: 'low',
            recommendations: [],
            insights: [],
            pathwayTaken: 'progressive',
          })
        );
      })
    );

    // Complete registration with specific data
    renderWithProviders(<UnifiedRegistrationForm />);
    
    // ... (complete registration flow with userData)

    // Verify data consistency
    expect(capturedData.registration).toMatchObject({
      email: userData.email,
      cpf: userData.cpf,
    });

    expect(capturedData.profile).toMatchObject({
      user_id: '456',
    });

    expect(capturedData.health).toMatchObject({
      user_id: '456',
    });
  });

  it('should handle session recovery during journey interruption', async () => {
    // Simulate partial completion
    sessionStorage.setItem('registration_step', 'step2');
    sessionStorage.setItem('registration_data', JSON.stringify({
      email: 'resume@example.com',
      cpf: '11122233344',
    }));

    renderWithProviders(<UnifiedRegistrationForm />);

    // Should resume at step 2
    await waitFor(() => {
      expect(screen.getByText(/personal information/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    });

    // Complete from step 2
    const nameInput = screen.getByLabelText(/full name/i);
    await user.type(nameInput, 'Resume User');
    
    // Continue journey normally
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/create.*password/i)).toBeInTheDocument();
    });
  });
});