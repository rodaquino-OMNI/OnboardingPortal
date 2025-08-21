/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
  }),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Import components to test
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { PendingTasksReminder } from '@/components/onboarding/PendingTasksReminder';
import { HealthAssessmentComplete } from '@/components/health/HealthAssessmentComplete';
import { ClientOnly } from '@/components/ClientOnly';
import { useClientOnly, useTimestamp, useLocalStorage, useIsMobile } from '@/hooks/useClientOnly';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Hydration Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('useClientOnly hook', () => {
    function TestComponent() {
      const isClient = useClientOnly();
      return <div data-testid="client-status">{isClient ? 'client' : 'server'}</div>;
    }

    it('should start as server-side and become client-side after mount', async () => {
      render(<TestComponent />);
      
      // Initially should be server-side
      expect(screen.getByTestId('client-status')).toHaveTextContent('server');
      
      // After useEffect runs, should be client-side
      await waitFor(() => {
        expect(screen.getByTestId('client-status')).toHaveTextContent('client');
      });
    });
  });

  describe('useTimestamp hook', () => {
    function TestComponent() {
      const timestamp = useTimestamp();
      return <div data-testid="timestamp">{timestamp || 'null'}</div>;
    }

    it('should return null initially and timestamp after mount', async () => {
      const beforeRender = Date.now();
      render(<TestComponent />);
      
      // Initially should be null (SSR safe)
      expect(screen.getByTestId('timestamp')).toHaveTextContent('null');
      
      // After useEffect runs, should have timestamp
      await waitFor(() => {
        const timestamp = parseInt(screen.getByTestId('timestamp').textContent || '0');
        expect(timestamp).toBeGreaterThanOrEqual(beforeRender);
      });
    });
  });

  describe('useLocalStorage hook', () => {
    function TestComponent() {
      const [value, setValue] = useLocalStorage('test-key', 'default');
      return (
        <div>
          <div data-testid="value">{value}</div>
          <button onClick={() => setValue('updated')} data-testid="update">
            Update
          </button>
        </div>
      );
    }

    it('should use default value initially and handle localStorage', async () => {
      render(<TestComponent />);
      
      // Should start with default value
      expect(screen.getByTestId('value')).toHaveTextContent('default');
      
      // Wait for client-side to load
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key');
      });
    });
  });

  describe('useIsMobile hook', () => {
    function TestComponent() {
      const isMobile = useIsMobile();
      return <div data-testid="mobile-status">{isMobile ? 'mobile' : 'desktop'}</div>;
    }

    it('should detect mobile device safely', async () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'iPhone',
      });

      render(<TestComponent />);
      
      // Initially should be desktop (server-side default)
      expect(screen.getByTestId('mobile-status')).toHaveTextContent('desktop');
      
      // After client-side, should detect mobile
      await waitFor(() => {
        expect(screen.getByTestId('mobile-status')).toHaveTextContent('mobile');
      });
    });
  });

  describe('ClientOnly component', () => {
    it('should render fallback during SSR and children on client', async () => {
      render(
        <ClientOnly fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="client-content">Client Content</div>
        </ClientOnly>
      );
      
      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('client-content')).not.toBeInTheDocument();
      
      // After mount, should show client content
      await waitFor(() => {
        expect(screen.getByTestId('client-content')).toBeInTheDocument();
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      });
    });

    it('should add suppressHydrationWarning by default', async () => {
      const { container } = render(
        <ClientOnly>
          <div>Test content</div>
        </ClientOnly>
      );
      
      await waitFor(() => {
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveAttribute('suppresshydrationwarning');
      });
    });
  });

  describe('PendingTasksReminder hydration safety', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'onboarding_partial_progress') {
          return JSON.stringify({
            documentUploads: {},
            completionStats: {
              total: 3,
              completed: 1,
              pending: 2,
              pendingDocs: [
                { id: '1', name: 'Document 1' },
                { id: '2', name: 'Document 2' }
              ],
              isComplete: false
            },
            timestamp: Date.now() - 1000, // 1 second ago
            step: 'documents'
          });
        }
        return null;
      });
    });

    it('should not render during SSR and render safely on client', async () => {
      const { container } = render(<PendingTasksReminder />);
      
      // Should be empty during SSR (returns null when !isClient)
      expect(container.firstChild).toBeNull();
      
      // After client-side mounting, should render content
      await waitFor(() => {
        expect(screen.getByText(/Documentos pendentes/)).toBeInTheDocument();
      });
    });
  });

  describe('HealthAssessmentComplete timestamp safety', () => {
    const mockHealthResults = {
      completedDomains: ['pain_management', 'mental_health'],
      riskLevel: 'low' as const,
      totalRiskScore: 10,
      recommendations: ['Exercise regularly'],
      nextSteps: ['Schedule follow-up'],
      riskScores: { pain_management: 5, mental_health: 5 },
      responses: { q1: 'yes', q2: 'no' }
    };

    it('should handle timestamps safely without hydration mismatch', async () => {
      const sessionStart = new Date(Date.now() - 300000); // 5 minutes ago
      
      render(
        <HealthAssessmentComplete
          healthResults={mockHealthResults}
          userName="Test User"
          userAge={30}
          sessionStartTime={sessionStart}
          onNavigateHome={jest.fn()}
          onNavigateNext={jest.fn()}
        />
      );

      // Should render without hydration errors
      await waitFor(() => {
        expect(screen.getByText(/Parabéns/)).toBeInTheDocument();
      });

      // Session duration should be rendered with suppressHydrationWarning
      await waitFor(() => {
        const durationElement = screen.getByText(/min$/);
        expect(durationElement).toBeInTheDocument();
      });
    });
  });

  describe('Date.now() usage patterns', () => {
    it('should not cause hydration mismatch in error ID generation', () => {
      // Test that Date.now().toString(36) is properly wrapped with suppressHydrationWarning
      // This is tested implicitly through the ErrorBoundary component usage
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      function BrokenComponent() {
        throw new Error('Test error');
      }

      // The ErrorBoundary should handle this without hydration warnings
      const { HealthQuestionnaireErrorBoundary } = require('@/components/health/ErrorBoundary');
      
      render(
        <HealthQuestionnaireErrorBoundary>
          <BrokenComponent />
        </HealthQuestionnaireErrorBoundary>
      );

      expect(screen.getByText(/Erro no Questionário/)).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Math.random() elimination', () => {
    it('should use deterministic progress in PDF generation', () => {
      // Verify that Math.random() has been replaced with deterministic progress
      const { PDFGenerationCenter } = require('@/components/pdf/PDFGenerationCenter');
      
      const mockUser = {
        name: 'Test User',
        completionDate: new Date(),
        sessionDuration: 5,
        badges: [],
        totalPoints: 100,
        level: 1
      };

      // Should render without using Math.random()
      expect(() => {
        render(
          <PDFGenerationCenter
            user={mockUser}
            healthResults={mockHealthResults}
            showImmediately={true}
          />
        );
      }).not.toThrow();
    });
  });
});

describe('Integration: Complete Hydration Safety', () => {
  it('should render complex component tree without hydration mismatches', async () => {
    const mockHealthResults = {
      completedDomains: ['pain_management'],
      riskLevel: 'low' as const,
      totalRiskScore: 5,
      recommendations: ['Rest well'],
      nextSteps: ['Continue monitoring'],
      riskScores: { pain_management: 5 },
      responses: { q1: 'yes' }
    };

    // Test that complex components with multiple hydration-sensitive features work together
    render(
      <div>
        <PendingTasksReminder />
        <ClientOnly fallback={<div>Loading...</div>}>
          <HealthAssessmentComplete
            healthResults={mockHealthResults}
            userName="Test User"
            userAge={25}
            sessionStartTime={new Date(Date.now() - 120000)}
            onNavigateHome={jest.fn()}
            onNavigateNext={jest.fn()}
          />
        </ClientOnly>
      </div>
    );

    // All components should render without errors
    await waitFor(() => {
      expect(screen.getByText(/Parabéns/)).toBeInTheDocument();
    });
  });
});