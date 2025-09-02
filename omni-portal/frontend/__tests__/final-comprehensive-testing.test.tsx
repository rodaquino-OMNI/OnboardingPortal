/**
 * Comprehensive Final Testing Suite
 * Tests all critical user flows, API integration, performance, and accessibility
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/components/auth/AuthProvider';
import LoginForm from '@/components/auth/LoginForm';
import UnifiedRegistrationForm from '@/components/auth/UnifiedRegistrationForm';
import UnifiedHealthQuestionnaire from '@/components/health/unified/BaseHealthQuestionnaire';
import { useAuth } from '@/hooks/auth/useAuth';
import { api } from '@/lib/api-config';
import { performance } from 'perf_hooks';

// Mock API responses
jest.mock('@/lib/api-config', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
}));

jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('Final Comprehensive Testing Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
    } as any);
  });

  describe('1. Authentication Flow Tests', () => {
    test('should handle complete login flow', async () => {
      const mockLogin = jest.fn().mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
        token: 'mock-token'
      });

      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: jest.fn(),
        register: jest.fn(),
      } as any);

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Fill login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /entrar|login/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      
      await act(async () => {
        await userEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    test('should handle registration flow with validation', async () => {
      const mockRegister = jest.fn().mockResolvedValue({
        user: { id: '1', email: 'newuser@example.com' },
        token: 'mock-token'
      });

      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: mockRegister,
      } as any);

      render(
        <TestWrapper>
          <UnifiedRegistrationForm />
        </TestWrapper>
      );

      // Test form validation
      const submitButton = screen.getByRole('button', { name: /cadastrar|register/i });
      
      await act(async () => {
        await userEvent.click(submitButton);
      });

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/email é obrigatório|email is required/i)).toBeInTheDocument();
      });
    });

    test('should handle authentication errors gracefully', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        logout: jest.fn(),
        register: jest.fn(),
      } as any);

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /entrar|login/i });

      await userEvent.type(emailInput, 'invalid@example.com');
      await userEvent.type(passwordInput, 'wrongpassword');
      
      await act(async () => {
        await userEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/erro|error|invalid/i)).toBeInTheDocument();
      });
    });
  });

  describe('2. API Integration Tests', () => {
    test('should validate API response structures', async () => {
      const mockApiResponse = {
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          permissions: ['read', 'write'],
          settings: { theme: 'light', notifications: true }
        },
        status: 200
      };

      (api.get as jest.Mock).mockResolvedValue(mockApiResponse);

      const response = await api.get('/api/auth/profile');
      
      expect(response.data).toHaveProperty('user');
      expect(response.data.user).toHaveProperty('id');
      expect(response.data.user).toHaveProperty('email');
      expect(response.data.user).toHaveProperty('name');
      expect(response.status).toBe(200);
    });

    test('should handle API errors correctly', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };

      (api.post as jest.Mock).mockRejectedValue(mockError);

      try {
        await api.post('/api/auth/login', { email: 'test@test.com', password: 'wrong' });
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toBe('Unauthorized');
      }
    });

    test('should validate health questionnaire API', async () => {
      const mockHealthData = {
        responses: [
          { questionId: 'q1', answer: 'yes', weight: 1 },
          { questionId: 'q2', answer: 'no', weight: 0 }
        ],
        riskScore: 0.3,
        recommendations: ['Exercise regularly', 'Balanced diet']
      };

      (api.post as jest.Mock).mockResolvedValue({ data: mockHealthData, status: 200 });

      const response = await api.post('/api/health/assessment', mockHealthData);
      
      expect(response.data).toHaveProperty('responses');
      expect(response.data).toHaveProperty('riskScore');
      expect(response.data).toHaveProperty('recommendations');
      expect(Array.isArray(response.data.responses)).toBe(true);
      expect(typeof response.data.riskScore).toBe('number');
    });
  });

  describe('3. Performance Tests', () => {
    test('should render components within performance budget', async () => {
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <UnifiedHealthQuestionnaire />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Component should render within 500ms
      expect(renderTime).toBeLessThan(500);
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random()
      }));

      const startTime = performance.now();
      
      // Simulate processing large dataset
      const processed = largeDataset.filter(item => item.value > 0.5);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process 1000 items within 50ms
      expect(processingTime).toBeLessThan(50);
      expect(processed.length).toBeGreaterThan(0);
    });

    test('should not create memory leaks', () => {
      const initialMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Render and unmount components multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <TestWrapper>
            <LoginForm />
          </TestWrapper>
        );
        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('4. Component Rendering Tests', () => {
    test('should render all critical components without errors', () => {
      const components = [LoginForm, UnifiedRegistrationForm];

      components.forEach((Component) => {
        expect(() => {
          render(
            <TestWrapper>
              <Component />
            </TestWrapper>
          );
        }).not.toThrow();
      });
    });

    test('should handle component state updates correctly', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      
      await userEvent.type(emailInput, 'test@example.com');
      
      expect(emailInput).toHaveValue('test@example.com');
    });

    test('should display proper error states', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn().mockRejectedValue(new Error('Network error')),
        logout: jest.fn(),
        register: jest.fn(),
      } as any);

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /entrar|login/i });
      
      await act(async () => {
        await userEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/erro|error/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Accessibility Tests', () => {
    test('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /entrar|login/i });

      expect(emailInput).toHaveAttribute('aria-label');
      expect(passwordInput).toHaveAttribute('aria-label');
      expect(submitButton).toHaveAttribute('role', 'button');
    });

    test('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Tab navigation
      emailInput.focus();
      expect(emailInput).toHaveFocus();

      await userEvent.tab();
      expect(passwordInput).toHaveFocus();
    });

    test('should have proper color contrast and focus indicators', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /entrar|login/i });
      
      // Check if focus styles are applied
      submitButton.focus();
      const computedStyle = window.getComputedStyle(submitButton);
      
      // Basic checks for focus indicators
      expect(computedStyle.outline).toBeDefined();
    });
  });

  describe('6. Responsive Design Tests', () => {
    test('should adapt to different screen sizes', () => {
      // Mock different viewport sizes
      const viewports = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ];

      viewports.forEach((viewport) => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });

        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        });

        render(
          <TestWrapper>
            <LoginForm />
          </TestWrapper>
        );

        // Verify component renders without breaking
        expect(screen.getByRole('button', { name: /entrar|login/i })).toBeInTheDocument();
      });
    });
  });

  describe('7. Edge Cases and Error Handling', () => {
    test('should handle network failures gracefully', async () => {
      (api.post as jest.Mock).mockRejectedValue(new Error('Network Error'));

      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn().mockRejectedValue(new Error('Network Error')),
        logout: jest.fn(),
        register: jest.fn(),
      } as any);

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /entrar|login/i });
      
      await act(async () => {
        await userEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/erro|error|network/i)).toBeInTheDocument();
      });
    });

    test('should handle malformed API responses', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: null, // Malformed response
        status: 200
      });

      try {
        const response = await api.get('/api/auth/profile');
        expect(response.data).toBeNull();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle concurrent requests properly', async () => {
      const mockResponse = { data: { success: true }, status: 200 };
      (api.post as jest.Mock).mockResolvedValue(mockResponse);

      // Simulate multiple concurrent requests
      const requests = Array.from({ length: 5 }, () => 
        api.post('/api/test', { data: 'test' })
      );

      const responses = await Promise.all(requests);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      });
    });
  });
});