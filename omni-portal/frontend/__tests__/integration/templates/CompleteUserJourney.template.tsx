import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * INTEGRATION TEST TEMPLATE: Complete User Journey
 * 
 * Tests the full onboarding flow from registration to first interview
 * Demonstrates:
 * - Multi-step user journey testing
 * - State persistence across components
 * - Real-time updates (WebSocket simulation)
 * - File upload testing
 * - Video conferencing integration
 * - Gamification point tracking
 * - LGPD compliance verification
 */

describe('Complete User Journey Integration', () => {
  // Mock server setup
  const server = setupServer(
    // Authentication endpoints
    http.post('/api/auth/register', ({ request }) => {
      return HttpResponse.json({
        user: { id: '123', email: 'user@example.com' },
        token: 'fake-jwt-token'
      });
    }),
    
    // Profile endpoints
    http.put('/api/users/:userId/profile', ({ request }) => {
      return HttpResponse.json({ success: true });
    }),
    
    // Health assessment endpoints
    http.post('/api/health/assessment', async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        assessmentId: 'ha-123',
        riskLevel: body.responses.pain_severity > 7 ? 'high' : 'low',
        recommendations: ['Consult a physician', 'Regular exercise']
      });
    }),
    
    // Document upload endpoints
    http.post('/api/documents/upload', ({ request }) => {
      return HttpResponse.json({
        documentId: 'doc-456',
        ocrResult: {
          extractedText: 'John Doe\nCPF: 123.456.789-00',
          confidence: 0.95
        }
      });
    }),
    
    // Interview scheduling endpoints
    http.get('/api/interviews/slots', ({ request }) => {
      return HttpResponse.json({
        slots: [
          { id: 'slot-1', date: '2024-02-01', time: '10:00', available: true },
          { id: 'slot-2', date: '2024-02-01', time: '14:00', available: true }
        ]
      });
    }),
    
    http.post('/api/interviews/schedule', ({ request }) => {
      return HttpResponse.json({
        interviewId: 'int-789',
        videoUrl: 'https://video.example.com/room/int-789'
      });
    }),
    
    // Gamification endpoints
    http.get('/api/gamification/points', ({ request }) => {
      return HttpResponse.json({
        totalPoints: 150,
        level: 2,
        badges: ['early_bird', 'document_master']
      });
    }),
    
    http.post('/api/gamification/award', ({ request }) => {
      return HttpResponse.json({
        pointsAwarded: 50,
        newTotal: 200,
        newBadges: ['health_champion']
      });
    }),
  );

  // Test setup
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let mockWebSocket: any;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    
    // Mock WebSocket for real-time features
    global.WebSocket = jest.fn().mockImplementation(() => {
      mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        readyState: 1
      };
      return mockWebSocket;
    });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterAll(() => {
    server.close();
    delete global.WebSocket;
  });

  beforeEach(() => {
    user = userEvent.setup();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderApp = (initialRoute = '/') => {
    window.history.pushState({}, '', initialRoute);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Full Onboarding Journey', () => {
    it('should complete entire onboarding process from registration to interview', async () => {
      // Performance tracking
      const performanceMarks: Record<string, number> = {};
      performanceMarks.start = performance.now();

      // Step 1: Registration
      renderApp('/register');
      
      // Fill registration form
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
      await user.click(screen.getByRole('button', { name: /create account/i }));
      
      performanceMarks.registrationComplete = performance.now();
      
      // Verify redirect to profile setup
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/profile');
      });
      
      // Step 2: Profile Setup
      expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument();
      
      // Fill profile information
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/phone/i), '(11) 98765-4321');
      await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');
      await user.selectOptions(screen.getByLabelText(/gender/i), 'male');
      await user.type(screen.getByLabelText(/address/i), 'Rua Example, 123');
      
      // Upload profile picture
      const file = new File(['profile'], 'profile.jpg', { type: 'image/jpeg' });
      const input = screen.getByLabelText(/profile picture/i);
      await user.upload(input, file);
      
      await user.click(screen.getByRole('button', { name: /save profile/i }));
      
      performanceMarks.profileComplete = performance.now();
      
      // Verify gamification points awarded
      await waitFor(() => {
        expect(screen.getByText(/\+50 points/i)).toBeInTheDocument();
      });
      
      // Step 3: Health Assessment
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/health');
      });
      
      // Answer health questions
      expect(screen.getByRole('heading', { name: /health assessment/i })).toBeInTheDocument();
      
      // Emergency check
      await user.click(screen.getByLabelText(/no emergency conditions/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Pain assessment
      const painSlider = screen.getByRole('slider', { name: /pain level/i });
      await user.click(painSlider); // Set to moderate pain
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Mental health
      await user.click(screen.getByLabelText(/feeling good/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Chronic conditions
      await user.click(screen.getByLabelText(/no chronic conditions/i));
      await user.click(screen.getByRole('button', { name: /complete assessment/i }));
      
      performanceMarks.healthComplete = performance.now();
      
      // Verify health recommendations
      await waitFor(() => {
        expect(screen.getByText(/assessment complete/i)).toBeInTheDocument();
        expect(screen.getByText(/regular exercise/i)).toBeInTheDocument();
      });
      
      // More points awarded
      expect(screen.getByText(/\+100 points/i)).toBeInTheDocument();
      
      // Step 4: Document Upload
      await user.click(screen.getByRole('button', { name: /continue/i }));
      
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/documents');
      });
      
      // Upload required documents
      const idDocument = new File(['id'], 'rg.pdf', { type: 'application/pdf' });
      const proofOfAddress = new File(['address'], 'address.pdf', { type: 'application/pdf' });
      
      // Upload ID
      const idInput = within(screen.getByTestId('id-upload')).getByLabelText(/upload/i);
      await user.upload(idInput, idDocument);
      
      // Wait for OCR processing
      await waitFor(() => {
        expect(screen.getByText(/john doe/i)).toBeInTheDocument();
        expect(screen.getByText(/123\.456\.789-00/i)).toBeInTheDocument();
      });
      
      // Upload proof of address
      const addressInput = within(screen.getByTestId('address-upload')).getByLabelText(/upload/i);
      await user.upload(addressInput, proofOfAddress);
      
      await user.click(screen.getByRole('button', { name: /submit documents/i }));
      
      performanceMarks.documentsComplete = performance.now();
      
      // Step 5: Interview Scheduling
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/schedule');
      });
      
      expect(screen.getByRole('heading', { name: /schedule your interview/i })).toBeInTheDocument();
      
      // Select date
      await user.click(screen.getByLabelText(/select date/i));
      await user.click(screen.getByText('February 1, 2024'));
      
      // Select time slot
      await user.click(screen.getByRole('radio', { name: /10:00 AM/i }));
      
      // Confirm scheduling
      await user.click(screen.getByRole('button', { name: /schedule interview/i }));
      
      performanceMarks.scheduleComplete = performance.now();
      
      // Verify completion
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /onboarding complete/i })).toBeInTheDocument();
      });
      
      // Check final gamification status
      expect(screen.getByText(/level 2/i)).toBeInTheDocument();
      expect(screen.getByText(/3 badges earned/i)).toBeInTheDocument();
      
      // Performance assertions
      const totalTime = performanceMarks.scheduleComplete - performanceMarks.start;
      expect(totalTime).toBeLessThan(60000); // Complete flow under 60 seconds
      
      // Verify data consistency
      const userData = JSON.parse(localStorage.getItem('user-data') || '{}');
      expect(userData).toMatchObject({
        profile: expect.objectContaining({
          name: 'John Doe',
          email: 'newuser@example.com'
        }),
        health: expect.objectContaining({
          assessmentId: 'ha-123',
          riskLevel: 'low'
        }),
        documents: expect.arrayContaining([
          expect.objectContaining({ type: 'id' }),
          expect.objectContaining({ type: 'address' })
        ]),
        interview: expect.objectContaining({
          scheduled: true,
          date: '2024-02-01',
          time: '10:00'
        })
      });
    });

    it('should handle high-risk health assessment with appropriate urgency', async () => {
      // Setup authenticated user
      localStorage.setItem('auth-token', 'fake-jwt-token');
      renderApp('/onboarding/health');
      
      // Emergency condition selection
      await user.click(screen.getByLabelText(/chest pain/i));
      await user.click(screen.getByLabelText(/difficulty breathing/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // High pain level
      const painSlider = screen.getByRole('slider', { name: /pain level/i });
      fireEvent.change(painSlider, { target: { value: 9 } });
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Verify emergency alert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/immediate medical attention/i);
        expect(screen.getByRole('button', { name: /call emergency/i })).toBeInTheDocument();
      });
      
      // Should skip non-critical steps
      await user.click(screen.getByRole('button', { name: /continue with urgent care/i }));
      
      // Direct to urgent interview scheduling
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/urgent-schedule');
        expect(screen.getByText(/priority scheduling/i)).toBeInTheDocument();
      });
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should recover from interrupted onboarding', async () => {
      // Simulate partial completion
      localStorage.setItem('onboarding-progress', JSON.stringify({
        currentStep: 'documents',
        completedSteps: ['registration', 'profile', 'health'],
        data: {
          profile: { name: 'John Doe' },
          health: { assessmentId: 'ha-123' }
        }
      }));
      
      localStorage.setItem('auth-token', 'fake-jwt-token');
      
      // Render app
      renderApp('/');
      
      // Should redirect to documents step
      await waitFor(() => {
        expect(window.location.pathname).toBe('/onboarding/documents');
      });
      
      // Should show progress indicator
      expect(screen.getByText(/step 4 of 5/i)).toBeInTheDocument();
      expect(screen.getByText(/75% complete/i)).toBeInTheDocument();
    });

    it('should handle session timeout gracefully', async () => {
      // Start onboarding
      renderApp('/onboarding/profile');
      
      // Simulate session timeout
      server.use(
        http.put('/api/users/:userId/profile', ({ request }) => {
          return HttpResponse.json({ error: 'Session expired' }, { status: 401 });
        })
      );
      
      // Try to save profile
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.click(screen.getByRole('button', { name: /save profile/i }));
      
      // Should show session expired message
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/session expired/i);
      });
      
      // Should offer to save progress
      expect(screen.getByRole('button', { name: /save progress/i })).toBeInTheDocument();
      
      // Click save progress
      await user.click(screen.getByRole('button', { name: /save progress/i }));
      
      // Verify data saved locally
      const savedProgress = JSON.parse(localStorage.getItem('onboarding-draft') || '{}');
      expect(savedProgress.profile.name).toBe('John Doe');
    });
  });

  describe('Real-time Features', () => {
    it('should update progress in real-time across tabs', async () => {
      // Simulate broadcast channel for cross-tab communication
      const broadcastChannel = new BroadcastChannel('onboarding-progress');
      const messageHandler = jest.fn();
      broadcastChannel.addEventListener('message', messageHandler);
      
      // Render app
      renderApp('/onboarding/profile');
      
      // Complete profile
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.click(screen.getByRole('button', { name: /save profile/i }));
      
      // Verify broadcast message sent
      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'progress-update',
              step: 'profile',
              status: 'completed'
            })
          })
        );
      });
      
      broadcastChannel.close();
    });

    it('should show real-time notifications', async () => {
      renderApp('/dashboard');
      
      // Simulate WebSocket message
      const wsMessage = {
        type: 'notification',
        data: {
          title: 'Document Approved',
          message: 'Your ID document has been verified',
          points: 25
        }
      };
      
      // Trigger WebSocket event
      act(() => {
        mockWebSocket.addEventListener.mock.calls
          .find(call => call[0] === 'message')[1]({
            data: JSON.stringify(wsMessage)
          });
      });
      
      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/document approved/i);
        expect(screen.getByText(/\+25 points/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no accessibility violations throughout journey', async () => {
      const { container } = renderApp('/register');
      
      // Test registration page
      let results = await axe(container);
      expect(results).toHaveNoViolations();
      
      // Navigate through each step and test
      const steps = [
        '/onboarding/profile',
        '/onboarding/health',
        '/onboarding/documents',
        '/onboarding/schedule'
      ];
      
      for (const step of steps) {
        window.history.pushState({}, '', step);
        results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });

    it('should maintain focus management through multi-step form', async () => {
      renderApp('/onboarding/health');
      
      // Initial focus should be on first interactive element
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /health assessment/i })).toBeInTheDocument();
      });
      
      // Focus should be on first question
      expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
      
      // Complete step
      await user.click(screen.getByLabelText(/no emergency conditions/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      
      // Focus should move to next question
      await waitFor(() => {
        expect(document.activeElement?.getAttribute('role')).toBe('slider');
      });
    });
  });

  describe('LGPD Compliance', () => {
    it('should respect data privacy choices', async () => {
      renderApp('/privacy-settings');
      
      // Opt out of analytics
      await user.click(screen.getByLabelText(/analytics data/i));
      
      // Save preferences
      await user.click(screen.getByRole('button', { name: /save preferences/i }));
      
      // Verify no analytics calls
      const analyticsCalls = server.events.filter(
        event => event.url.pathname.includes('/analytics')
      );
      expect(analyticsCalls).toHaveLength(0);
    });

    it('should allow data export', async () => {
      localStorage.setItem('auth-token', 'fake-jwt-token');
      renderApp('/account/privacy');
      
      // Request data export
      await user.click(screen.getByRole('button', { name: /export my data/i }));
      
      // Verify export initiated
      await waitFor(() => {
        expect(screen.getByText(/preparing your data/i)).toBeInTheDocument();
      });
      
      // Simulate export ready
      server.use(
        http.get('/api/users/data-export', ({ request }) => {
          return HttpResponse.json(
            headers.set('Content-Disposition', 'attachment; filename="user-data.json"')
            ({
              profile: { name: 'John Doe' },
              health: { assessments: [] },
              documents: { uploaded: [] }
            })
          );
        })
      );
      
      // Download should start
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /download data/i })).toBeInTheDocument();
      });
    });
  });
});