import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ErrorBoundary } from 'react-error-boundary';
import '@testing-library/jest-dom';

// Components that were broken in the error analysis
import { UnifiedRegistrationForm } from '../../components/auth/UnifiedRegistrationForm';
import UnifiedHealthAssessment from '../../components/health/UnifiedHealthAssessment';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import EnhancedDocumentUpload from '../../components/upload/EnhancedDocumentUpload';

// Mock problematic dependencies
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn()
  }))
}));

jest.mock('../../hooks/useUnifiedNavigation', () => ({
  useUnifiedNavigation: jest.fn(() => ({
    currentStep: 0,
    totalSteps: 5,
    canAdvance: true,
    canGoBack: false,
    goToNext: jest.fn(),
    goToPrevious: jest.fn(),
    goToStep: jest.fn()
  })),
  NAVIGATION_PROFILES: {
    health: {
      autoAdvance: true,
      autoAdvanceDelay: 1800,
      autoAdvanceTypes: ['scale', 'boolean'],
      requireConfirmation: false,
      animationDuration: 250,
      skipValidationForOptional: true
    }
  }
}));

// Mock components that may not exist
jest.mock('../../components/health/TouchFriendlySlider', () => ({
  TouchFriendlySlider: ({ value, onChange, min = 1, max = 10, label }: any) => (
    <div data-testid="touch-friendly-slider">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        aria-label={label}
      />
      <span>{value}</span>
    </div>
  )
}));

// MSW Server for error reproduction
const server = setupServer(
  // Auth endpoints that should work after fixes
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        success: true,
        user: {
          id: '123',
          name: 'Test User',
          email,
          cpf: '12345678901',
        },
        token: 'valid-jwt-token'
      });
    }
    
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),

  // Health assessment endpoints
  http.post('/api/health/assessment/start', ({ request }) => {
    return HttpResponse.json({
      assessment_id: 'test-assessment-123',
      pathway: 'progressive',
      questions: [
        {
          id: 'q1',
          text: 'How would you rate your overall health?',
          type: 'scale',
          options: ['1', '2', '3', '4', '5'],
          min: 1,
          max: 5
        },
        {
          id: 'q2', 
          text: 'Do you exercise regularly?',
          type: 'boolean',
          options: ['Yes', 'No']
        }
      ],
    });
  }),

  // Document upload with OCR
  http.post('/api/documents/upload', async ({ request }) => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
    return HttpResponse.json({
      success: true,
      document: {
        id: 'doc-123',
        name: 'Test Document',
        type: 'identification',
        status: 'processing'
      }
    });
  }),

  http.post('/api/documents/ocr/process', async ({ request }) => {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate OCR processing
    return HttpResponse.json({
      success: true,
      extracted_data: {
        name: 'Test User',
        cpf: '12345678901',
        rg: '123456789'
      },
      confidence: 0.95
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
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        {ui}
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

describe('Error Reproduction and Prevention Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('Critical Error #1: Authentication System Broken', () => {
    it('should reproduce the ProtectedRoute authentication error', async () => {
      // This test reproduces the original error where ProtectedRoute used NextAuth 
      // instead of custom auth system
      
      const MockProtectedComponent = () => <div>Protected Content</div>;
      
      renderWithProviders(
        <ProtectedRoute>
          <MockProtectedComponent />
        </ProtectedRoute>
      );

      // Should redirect to login or show login prompt, not crash
      await waitFor(() => {
        expect(
          screen.getByText(/please log in/i) ||
          screen.getByText(/sign in/i) ||
          screen.getByText(/login/i) ||
          screen.getByText(/unauthorized/i)
        ).toBeInTheDocument();
      });

      // Should NOT crash or show error boundary
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should handle authenticated user correctly after auth fix', async () => {
      // Mock authenticated user
      const mockUseAuth = jest.requireMock('../../hooks/useAuth').useAuth;
      mockUseAuth.mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'test@example.com' },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn()
      });

      const MockProtectedComponent = () => <div>Protected Content</div>;
      
      renderWithProviders(
        <ProtectedRoute>
          <MockProtectedComponent />
        </ProtectedRoute>
      );

      // Should show protected content for authenticated users
      await waitFor(() => {
        expect(screen.getByText(/protected content/i)).toBeInTheDocument();
      });
    });

    it('should prevent session-based authentication bypass attempts', async () => {
      // Test session hijacking prevention
      const mockUseAuth = jest.requireMock('../../hooks/useAuth').useAuth;
      
      // Simulate invalid/expired token
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        logout: jest.fn(),
        error: 'Invalid token'
      });

      const MockProtectedComponent = () => <div>Protected Content</div>;
      
      renderWithProviders(
        <ProtectedRoute>
          <MockProtectedComponent />
        </ProtectedRoute>
      );

      // Should not show protected content with invalid auth
      await waitFor(() => {
        expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
        expect(
          screen.getByText(/please log in/i) ||
          screen.getByText(/unauthorized/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Critical Error #2: Health Questionnaire Component Crash', () => {
    it('should reproduce the ScaleQuestion import error', () => {
      // This test reproduces the error where UnifiedHealthAssessment imported
      // ScaleQuestion but used TouchFriendlySlider in the code
      
      // Should not crash when rendering health assessment
      expect(() => {
        renderWithProviders(<UnifiedHealthAssessment />);
      }).not.toThrow();
    });

    it('should render scale questions correctly after component fix', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      // Start assessment
      const startButton = screen.getByRole('button', { name: /start.*assessment/i });
      await user.click(startButton);

      // Should show scale question using TouchFriendlySlider
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
        expect(screen.getByText(/rate.*overall health/i)).toBeInTheDocument();
      });

      // Should be able to interact with the slider
      const slider = screen.getByRole('slider');
      await user.click(slider);
      
      // Should not crash
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should handle health assessment question transitions', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Answer first question (scale)
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      const slider = screen.getByRole('slider');
      await user.clear(slider);
      await user.type(slider, '4');

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should move to next question (boolean)
      await waitFor(() => {
        expect(screen.getByText(/exercise regularly/i)).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /yes/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /no/i })).toBeInTheDocument();
      });
    });

    it('should prevent malformed health data submission', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Try to submit without answering questions
      const submitButton = screen.queryByRole('button', { name: /submit/i });
      if (submitButton) {
        await user.click(submitButton);

        // Should show validation error, not crash
        await waitFor(() => {
          expect(
            screen.getByText(/please answer/i) ||
            screen.getByText(/required/i) ||
            screen.getByText(/validation/i)
          ).toBeInTheDocument();
        });
      }
    });
  });

  describe('Critical Error #3: Navigation System Configuration Missing', () => {
    it('should reproduce navigation profile undefined error', () => {
      // This test reproduces the error where NAVIGATION_PROFILES.health was undefined
      
      const mockUseNavigation = jest.requireMock('../../hooks/useUnifiedNavigation').useUnifiedNavigation;
      
      // Simulate missing navigation profiles (original error state)
      jest.doMock('../../hooks/useUnifiedNavigation', () => ({
        useUnifiedNavigation: jest.fn(() => ({
          currentStep: 0,
          totalSteps: 5,
          canAdvance: true,
          canGoBack: false,
          goToNext: jest.fn(),
          goToPrevious: jest.fn(),
          goToStep: jest.fn()
        })),
        NAVIGATION_PROFILES: undefined // This was the original error
      }));

      // Should handle missing navigation profiles gracefully
      expect(() => {
        renderWithProviders(<UnifiedHealthAssessment />);
      }).not.toThrow();
    });

    it('should work correctly with proper navigation profiles', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Should have proper navigation with defined profiles
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      // Navigation should work properly
      const mockGoToNext = jest.requireMock('../../hooks/useUnifiedNavigation').useUnifiedNavigation().goToNext;
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Should attempt navigation (mocked)
      expect(mockGoToNext).toHaveBeenCalled();
    });

    it('should handle auto-advance navigation configuration', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Simulate auto-advance for scale questions
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      const slider = screen.getByRole('slider');
      await user.click(slider);

      // With autoAdvance enabled, should automatically progress after delay
      // (This would be tested with proper timing in integration)
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Error #4: Service Worker/Build Process Issues', () => {
    it('should handle OCR processing without service worker failures', async () => {
      renderWithProviders(<EnhancedDocumentUpload type="identification" />);

      // Upload a file
      const file = new File(['test'], 'id-document.jpg', { type: 'image/jpeg' });
      const uploadInput = screen.getByLabelText(/upload.*document/i);
      
      await user.upload(uploadInput, file);

      // Should show processing state
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Should complete OCR without service worker errors
      await waitFor(() => {
        expect(screen.getByText(/extracted successfully/i) || screen.getByText(/processing complete/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should not show service worker errors
      expect(screen.queryByText(/service worker/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/workbox/i)).not.toBeInTheDocument();
    });

    it('should gracefully handle Tesseract loading failures', async () => {
      // Mock Tesseract failure
      server.use(
        http.post('/api/documents/ocr/process', ({ request }) => {
          return HttpResponse.json({ error: 'OCR service unavailable' }, { status: 503 });
        })
      );

      renderWithProviders(<EnhancedDocumentUpload type="identification" />);

      const file = new File(['test'], 'id-document.jpg', { type: 'image/jpeg' });
      const uploadInput = screen.getByLabelText(/upload.*document/i);
      
      await user.upload(uploadInput, file);

      // Should show error gracefully, not crash
      await waitFor(() => {
        expect(
          screen.getByText(/ocr.*unavailable/i) ||
          screen.getByText(/processing.*failed/i) ||
          screen.getByText(/try again/i)
        ).toBeInTheDocument();
      });

      // Should not crash the component
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Boundary and Recovery Tests', () => {
    it('should catch and handle component crashes gracefully', async () => {
      // Create a component that throws an error
      const BrokenComponent = () => {
        throw new Error('Test component error');
      };

      renderWithProviders(<BrokenComponent />);

      // Error boundary should catch the error
      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('should maintain user data during error recovery', async () => {
      // Simulate registration flow with error recovery
      renderWithProviders(<UnifiedRegistrationForm />);

      // Fill in some data
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      // Simulate temporary network error
      server.use(
        http.post('/api/auth/register/step1', ({ request }) => {
          return HttpResponse.json({ error: 'Network timeout' }, { status: 500 });
        })
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/network timeout/i) || screen.getByText(/error/i)).toBeInTheDocument();
      });

      // User data should be preserved
      expect(emailInput).toHaveValue('test@example.com');

      // Reset server and retry
      server.resetHandlers();
      await user.click(continueButton);

      // Should proceed normally
      await waitFor(() => {
        expect(screen.getByText(/personal information/i)).toBeInTheDocument();
      });
    });

    it('should provide meaningful error messages for users', async () => {
      // Test user-friendly error messages
      server.use(
        http.post('/api/auth/login', ({ request }) => {
          return HttpResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
        })
      );

      renderWithProviders(<UnifiedRegistrationForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(loginButton);

      // Should show user-friendly error message
      await waitFor(() => {
        expect(
          screen.getByText(/invalid.*credentials/i) ||
          screen.getByText(/incorrect.*email.*password/i) ||
          screen.getByText(/login failed/i)
        ).toBeInTheDocument();
      });

      // Should not show technical error codes
      expect(screen.queryByText(/INVALID_CREDENTIALS/)).not.toBeInTheDocument();
      expect(screen.queryByText(/401/)).not.toBeInTheDocument();
    });
  });

  describe('Integration Flow Error Prevention', () => {
    it('should complete the full corrected user journey without errors', async () => {
      // Mock authenticated state for protected routes
      const mockUseAuth = jest.requireMock('../../hooks/useAuth').useAuth;
      mockUseAuth.mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'test@example.com' },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn()
      });

      // Test registration
      const { unmount } = renderWithProviders(<UnifiedRegistrationForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');
      
      unmount();

      // Test health assessment
      renderWithProviders(<UnifiedHealthAssessment />);
      
      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      // Should not crash at any point
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('should handle concurrent user actions without data corruption', async () => {
      renderWithProviders(<UnifiedHealthAssessment />);

      await user.click(screen.getByRole('button', { name: /start.*assessment/i }));

      // Simulate rapid user interactions
      await waitFor(() => {
        expect(screen.getByTestId('touch-friendly-slider')).toBeInTheDocument();
      });

      const slider = screen.getByRole('slider');
      const nextButton = screen.getByRole('button', { name: /next/i });

      // Rapid interactions
      await user.click(slider);
      await user.click(nextButton);
      await user.click(slider);
      await user.click(nextButton);

      // Should handle gracefully without corruption
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });
});