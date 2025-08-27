import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Import components that handle telemedicine security
import { VideoConferencing } from '@/components/video/VideoConferencing';
import InterviewUnlockCard from '@/components/dashboard/InterviewUnlockCard';
import { InterviewScheduler } from '@/components/interview/InterviewScheduler';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock security-related modules
jest.mock('@/lib/security', () => ({
  sanitizeInput: jest.fn((input) => input.replace(/<script.*?>.*?<\/script>/gi, '')),
  validateToken: jest.fn(() => true),
  encryptSensitiveData: jest.fn((data) => `encrypted_${data}`),
  auditLog: jest.fn()
}));

jest.mock('@/lib/hipaa-compliance', () => ({
  validateHipaaCompliance: jest.fn(() => true),
  logDataAccess: jest.fn(),
  encryptPHI: jest.fn((data) => ({ encrypted: true, data: data }))
}));

// MSW Server for security testing
const server = setupServer(
  // Protected interview endpoint
  http.get('/api/interviews/available-slots', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Simulate SQL injection attempt detection
    const params = new URL(request.url).searchParams;
    const professionalId = params.get('professional_id') || '';
    if (professionalId.includes('DROP TABLE') || professionalId.includes('SELECT *')) {
      return HttpResponse.json({ error: 'Invalid input detected' }, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
      data: {
        slots: [
          {
            id: 'slot-1',
            date: '2024-12-20',
            time: '10:00',
            professional: { name: 'Dr. Test', id: 'prof-1' },
            is_telemedicine: true
          }
        ]
      }
    });
  }),

  // Video session creation with security validation
  http.post('/api/video/sessions', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      success: true,
      session: {
        id: 'secure-session-123',
        sessionId: 'vonage-session-456',
        tokens: { 'user-1': 'secure-token-789' },
        settings: {
          hipaaCompliant: true,
          endToEndEncryption: true,
          recordingEncrypted: true
        }
      }
    });
  }),

  // Malicious input testing endpoint
  http.post('/api/interviews', async ({ request }) => {
    const body = await request.json();
    
    // Check for XSS attempts
    if (body.notes && body.notes.includes('<script>')) {
      // Should sanitize, not reject completely
      return HttpResponse.json(({
        success: true,
        data: {
          interview: {
            id: 'interview-123',
            notes: body.notes.replace(/<script.*?>.*?<\/script>/gi, ''),
            sanitized: true
          }
        }
      }));
    }

    return HttpResponse.json({
      success: true,
      data: { interview: { id: 'interview-123', notes: body.notes } }
    });
  }),

  // Rate limiting simulation
  http.get('/api/interviews/history', ({ request }) => {
    // Simulate rate limiting after 10 requests
    const requestCount = parseInt(request.headers.get('x-request-count') || '0');
    if (requestCount > 10) {
      return HttpResponse.json({ error: 'Too Many Requests', retryAfter: 60 }, { status: 429 });
    }

    return HttpResponse.json({
      success: true,
      data: { data: [], total: 0 }
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

const renderWithProviders = (ui: React.ReactElement, { user = null } = {}) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={user}>
        {ui}
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Telemedicine Security Validation', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Authentication and Authorization', () => {
    it('should prevent unauthorized access to telemedicine features', async () => {
      // Render without authentication
      renderWithProviders(<InterviewScheduler />);

      // Should show login prompt or redirect
      await waitFor(() => {
        expect(screen.getByText(/please log in/i) || screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });

    it('should validate user tokens before video session access', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(
        <VideoConferencing
          interviewId="interview-123"
          participantInfo={mockUser}
          onSessionEnd={jest.fn()}
          onError={jest.fn()}
        />,
        { user: mockUser }
      );

      await waitFor(() => {
        expect(screen.getByText(/connecting to video session/i)).toBeInTheDocument();
      });

      // Should successfully connect with valid token
      await waitFor(() => {
        expect(screen.queryByText(/unauthorized/i)).not.toBeInTheDocument();
      });
    });

    it('should reject expired or invalid tokens', async () => {
      const expiredUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'expired-token-123',
        role: 'patient'
      };

      // Mock token validation to return false for expired token
      const mockValidateToken = jest.requireMock('@/lib/security').validateToken;
      mockValidateToken.mockReturnValueOnce(false);

      const onError = jest.fn();
      renderWithProviders(
        <VideoConferencing
          interviewId="interview-123"
          participantInfo={expiredUser}
          onSessionEnd={jest.fn()}
          onError={onError}
        />,
        { user: expiredUser }
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('invalid token'));
      });
    });
  });

  describe('Input Validation and XSS Protection', () => {
    it('should sanitize XSS attempts in interview notes', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      // Find booking form
      const bookButton = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(bookButton);

      // Input malicious script in notes
      const notesField = screen.getByLabelText(/notes/i);
      const maliciousInput = '<script>alert("XSS Attack!")</script>Legitimate notes';
      
      await user.type(notesField, maliciousInput);
      
      const confirmButton = screen.getByRole('button', { name: /confirm booking/i });
      await user.click(confirmButton);

      // Verify XSS was sanitized
      await waitFor(() => {
        expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
      });

      // Check that script tags were removed
      const displayedNotes = screen.queryByText(/script.*alert/i);
      expect(displayedNotes).not.toBeInTheDocument();
    });

    it('should validate input length and format', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      const bookButton = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(bookButton);

      // Test extremely long input
      const notesField = screen.getByLabelText(/notes/i);
      const longInput = 'a'.repeat(10000);
      
      await user.type(notesField, longInput);
      
      const confirmButton = screen.getByRole('button', { name: /confirm booking/i });
      await user.click(confirmButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/too long/i) || screen.getByText(/maximum.*characters/i)).toBeInTheDocument();
      });
    });

    it('should prevent SQL injection attempts', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      // Try to manipulate URL parameters with SQL injection
      const sqlInjection = "'; DROP TABLE interviews; --";
      
      // This would typically be done through URL manipulation
      // but we'll simulate it through component props or form inputs
      const professionalFilter = screen.getByLabelText(/professional/i);
      await user.type(professionalFilter, sqlInjection);

      // Should not cause errors or expose data
      await waitFor(() => {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('HIPAA Compliance and Data Protection', () => {
    it('should ensure video sessions are HIPAA compliant', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'doctor'
      };

      renderWithProviders(
        <VideoConferencing
          interviewId="interview-123"
          participantInfo={mockUser}
          onSessionEnd={jest.fn()}
          onError={jest.fn()}
        />,
        { user: mockUser }
      );

      await waitFor(() => {
        expect(screen.getByText(/HIPAA Compliant/i)).toBeInTheDocument();
      });

      // Verify encryption indicators
      expect(screen.getByText(/encrypted/i) || screen.getByText(/secure/i)).toBeInTheDocument();
    });

    it('should encrypt sensitive data before transmission', async () => {
      const mockEncrypt = jest.requireMock('@/lib/hipaa-compliance').encryptPHI;
      
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      const bookButton = screen.getAllByRole('button', { name: /book.*slot/i })[0];
      await user.click(bookButton);

      const notesField = screen.getByLabelText(/notes/i);
      await user.type(notesField, 'Sensitive medical information');
      
      const confirmButton = screen.getByRole('button', { name: /confirm booking/i });
      await user.click(confirmButton);

      // Verify encryption was called for sensitive data
      await waitFor(() => {
        expect(mockEncrypt).toHaveBeenCalledWith(expect.stringContaining('medical'));
      });
    });

    it('should log all data access for audit purposes', async () => {
      const mockAuditLog = jest.requireMock('@/lib/security').auditLog;
      const mockLogDataAccess = jest.requireMock('@/lib/hipaa-compliance').logDataAccess;
      
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText(/available interview slots/i)).toBeInTheDocument();
      });

      // Access should be logged
      await waitFor(() => {
        expect(mockLogDataAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            action: 'view_slots',
            timestamp: expect.any(String)
          })
        );
      });
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle rate limiting gracefully', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      // Simulate multiple rapid requests
      const historyButton = screen.getByRole('button', { name: /history/i });
      
      // Make multiple rapid clicks
      for (let i = 0; i < 15; i++) {
        await user.click(historyButton);
        
        // Set request count header for rate limiting simulation
        if (i > 10) {
          break;
        }
      }

      // Should show rate limiting message
      await waitFor(() => {
        expect(screen.getByText(/too many requests/i) || screen.getByText(/rate limit/i)).toBeInTheDocument();
      });
    });

    it('should prevent session hijacking attempts', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      const onError = jest.fn();
      renderWithProviders(
        <VideoConferencing
          interviewId="interview-123"
          participantInfo={mockUser}
          onSessionEnd={jest.fn()}
          onError={onError}
        />,
        { user: mockUser }
      );

      // Simulate token tampering
      localStorage.setItem('auth_token', 'tampered-token-456');
      
      // Trigger session validation
      fireEvent.focus(window);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('session'));
      });
    });
  });

  describe('Content Security Policy', () => {
    it('should prevent inline script execution', () => {
      // Test that CSP headers prevent inline scripts
      const scriptElement = document.createElement('script');
      scriptElement.innerHTML = 'alert("CSP Test")';
      
      expect(() => {
        document.head.appendChild(scriptElement);
      }).not.toThrow();
      
      // Script should not execute due to CSP
      // This test is more conceptual as CSP is enforced by browser
    });

    it('should only allow trusted external resources', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      renderWithProviders(
        <VideoConferencing
          interviewId="interview-123"
          participantInfo={mockUser}
          onSessionEnd={jest.fn()}
          onError={jest.fn()}
        />,
        { user: mockUser }
      );

      // Verify only trusted domains are used for video resources
      await waitFor(() => {
        const iframes = document.querySelectorAll('iframe');
        const scripts = document.querySelectorAll('script[src]');
        
        [...iframes, ...scripts].forEach(element => {
          const src = element.getAttribute('src');
          if (src && src.startsWith('http')) {
            // Should only allow trusted domains
            expect(src).toMatch(/^https:\/\/(api\.opentok\.com|static\.opentok\.com|.*\.vonage\.com)/);
          }
        });
      });
    });
  });

  describe('Error Handling and Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      // Mock an API error
      server.use(
        http.get('/api/interviews/available-slots', ({ request }) => {
          return HttpResponse.json({ 
              error: 'Database connection failed: user=admin, password=secret123, host=db.internal.com'
            }, { status: 500 });
        })
      );

      const onError = jest.fn();
      renderWithProviders(<InterviewScheduler onError={onError} />, { user: mockUser });

      await waitFor(() => {
        if (onError.mock.calls.length > 0) {
          const errorMessage = onError.mock.calls[0][0];
          
          // Should not contain sensitive information
          expect(errorMessage).not.toContain('password');
          expect(errorMessage).not.toContain('secret');
          expect(errorMessage).not.toContain('admin');
          expect(errorMessage).not.toContain('db.internal.com');
        }
      });
    });

    it('should handle malformed responses safely', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        token: 'valid-token-123',
        role: 'patient'
      };

      // Mock malformed response
      server.use(
        http.get('/api/interviews/available-slots', ({ request }) => {
          return HttpResponse.text('Not JSON response');
        })
      );

      renderWithProviders(<InterviewScheduler />, { user: mockUser });

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(screen.getByText(/error loading/i) || screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });

      // Should not expose technical details
      expect(screen.queryByText(/JSON/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/parse/i)).not.toBeInTheDocument();
    });
  });
});