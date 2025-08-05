import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Import components for testing
import LoginForm from '@/components/auth/LoginForm';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';

// Performance measurement utilities
interface PerformanceMetrics {
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  networkRequests?: number;
}

class PerformanceProfiler {
  private startTime: number = 0;
  private startMemory: number = 0;
  private networkRequestCount: number = 0;
  
  start() {
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsage();
    this.networkRequestCount = 0;
    
    // Mock fetch to count network requests
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((...args) => {
      this.networkRequestCount++;
      return originalFetch.apply(global, args);
    });
  }
  
  stop(): PerformanceMetrics {
    const renderTime = performance.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage() - this.startMemory;
    
    return {
      renderTime,
      interactionTime: 0,
      memoryUsage,
      networkRequests: this.networkRequestCount
    };
  }
  
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }
    return 0;
  }
  
  async measureInteraction(interactionFn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await interactionFn();
    return performance.now() - start;
  }
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('Critical Path Performance Tests', () => {
  let profiler: PerformanceProfiler;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
    user = userEvent.setup();
    
    // Clear performance marks
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  });

  describe('Login Form Critical Path', () => {
    it('should render login form within 100ms budget', async () => {
      profiler.start();
      
      render(<LoginForm />);
      
      const metrics = profiler.stop();
      
      // Critical performance assertions
      expect(metrics.renderTime).toBeLessThan(100); // 100ms budget
      expect(metrics.memoryUsage).toBeLessThan(5 * 1024 * 1024); // 5MB budget
      expect(metrics.networkRequests).toBeLessThanOrEqual(1); // Minimal network usage
      
      // Log metrics for analysis
      console.log(`Login Form Render Metrics:`, {
        renderTime: `${metrics.renderTime.toFixed(2)}ms`,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        networkRequests: metrics.networkRequests
      });
    });

    it('should respond to form input within 16ms (60fps target)', async () => {
      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email|login/i);
      
      const interactionTime = await profiler.measureInteraction(async () => {
        await user.type(emailInput, 'test@example.com');
      });
      
      // Calculate per-keystroke timing
      const avgKeystrokeTime = interactionTime / 'test@example.com'.length;
      
      expect(avgKeystrokeTime).toBeLessThan(16); // 60fps target
      
      console.log(`Form Input Performance:`, {
        totalTime: `${interactionTime.toFixed(2)}ms`,
        avgPerKeystroke: `${avgKeystrokeTime.toFixed(2)}ms`,
        targetFPS: avgKeystrokeTime < 16 ? '60fps ✓' : `${Math.round(1000/avgKeystrokeTime)}fps ✗`
      });
    });

    it('should handle form submission within performance budget', async () => {
      // Mock successful login
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: { id: 1, name: 'Test' } })
      });

      render(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email|login/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login|entrar/i });
      
      // Fill form
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      // Measure submission performance
      const submitTime = await profiler.measureInteraction(async () => {
        await user.click(submitButton);
        await waitFor(() => {
          // Wait for form to complete submission process
          expect(submitButton).not.toBeDisabled();
        }, { timeout: 5000 });
      });
      
      expect(submitTime).toBeLessThan(2000); // 2s max for form submission
      
      console.log(`Form Submission Performance: ${submitTime.toFixed(2)}ms`);
    });
  });

  describe('Health Questionnaire Critical Path', () => {
    it('should load initial questionnaire within 200ms', async () => {
      const mockComplete = jest.fn();
      
      profiler.start();
      
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <UnifiedHealthQuestionnaire
            onComplete={mockComplete}
            userId="test-user"
            mode="standard"
            features={{
              ai: false, // Disable for performance testing
              gamification: true,
              clinical: true,
              progressive: true
            }}
          />
        </QueryClientProvider>
      );
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
      
      const metrics = profiler.stop();
      
      expect(metrics.renderTime).toBeLessThan(200); // 200ms budget for complex component
      expect(metrics.memoryUsage).toBeLessThan(15 * 1024 * 1024); // 15MB budget
      
      console.log(`Health Questionnaire Initial Load:`, {
        renderTime: `${metrics.renderTime.toFixed(2)}ms`,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
      });
    });

    it('should handle question navigation within 50ms', async () => {
      const mockComplete = jest.fn();
      const mockProgress = jest.fn();
      
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <UnifiedHealthQuestionnaire
            onComplete={mockComplete}
            onProgressUpdate={mockProgress}
            userId="test-user"
            mode="standard"
          />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
      
      // Test rapid navigation
      const navigationTime = await profiler.measureInteraction(async () => {
        const nextButton = screen.getAllByRole('button').find(btn => 
          btn.textContent?.includes('Continuar') || btn.textContent?.includes('Next')
        );
        
        if (nextButton) {
          await user.click(nextButton);
          await waitFor(() => {
            // Wait for navigation to complete
            expect(nextButton).toBeInTheDocument();
          });
        }
      });
      
      expect(navigationTime).toBeLessThan(50); // 50ms for smooth navigation
      
      console.log(`Question Navigation Performance: ${navigationTime.toFixed(2)}ms`);
    });

    it('should optimize re-renders during interaction', async () => {
      let renderCount = 0;
      
      const TrackingWrapper = React.memo(({ children }: { children: React.ReactNode }) => {
        renderCount++;
        return <>{children}</>;
      });
      
      const mockComplete = jest.fn();
      
      const { rerender } = render(
        <QueryClientProvider client={createTestQueryClient()}>
          <TrackingWrapper>
            <UnifiedHealthQuestionnaire
              onComplete={mockComplete}
              userId="test-user"
              mode="standard"
            />
          </TrackingWrapper>
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
      
      const initialRenderCount = renderCount;
      
      // Force re-render with same props
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <TrackingWrapper>
            <UnifiedHealthQuestionnaire
              onComplete={mockComplete}
              userId="test-user"
              mode="standard"
            />
          </TrackingWrapper>
        </QueryClientProvider>
      );
      
      // Should not cause unnecessary re-renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(1);
      
      console.log(`Re-render Optimization: ${renderCount} total renders`);
    });
  });

  describe('Mobile Performance Simulation', () => {
    beforeEach(() => {
      // Mock slow mobile device conditions
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          downlink: 1.5,
          rtt: 300,
          saveData: false
        },
        writable: true
      });
      
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });
    });

    it('should maintain performance on slow network', async () => {
      // Simulate slow network with delayed responses
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true })
          }), 1000) // 1s delay
        )
      );

      const mockComplete = jest.fn();
      
      profiler.start();
      
      render(<LoginForm />);
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      const metrics = profiler.stop();
      
      // Should still render quickly even with slow network
      expect(metrics.renderTime).toBeLessThan(500);
      
      console.log(`Slow Network Performance: ${metrics.renderTime.toFixed(2)}ms`);
    });

    it('should handle touch interactions smoothly', async () => {
      render(<LoginForm />);
      
      const button = screen.getByRole('button');
      
      const touchTime = await profiler.measureInteraction(async () => {
        fireEvent.touchStart(button);
        fireEvent.touchEnd(button);
      });
      
      expect(touchTime).toBeLessThan(100); // 100ms for touch response
      
      console.log(`Touch Interaction Performance: ${touchTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance Tests', () => {
    it('should not leak memory during repeated interactions', async () => {
      const { unmount } = render(<LoginForm />);
      
      let memoryGrowth = 0;
      
      // Measure memory before
      const initialMemory = profiler['getMemoryUsage']();
      
      // Simulate heavy usage
      for (let i = 0; i < 10; i++) {
        const emailInput = screen.getByLabelText(/email|login/i);
        await user.type(emailInput, `test${i}@example.com`);
        await user.clear(emailInput);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = profiler['getMemoryUsage']();
      memoryGrowth = finalMemory - initialMemory;
      
      // Cleanup
      unmount();
      
      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // < 10MB growth
      
      console.log(`Memory Growth Test: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should cleanup event listeners on unmount', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(<LoginForm />);
      
      unmount();
      
      // Should clean up any event listeners
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Bundle Size Impact Tests', () => {
    it('should lazy load heavy components', async () => {
      // Test that heavy components are loaded on demand
      const LazyHealthQuestionnaire = React.lazy(() =>
        import('@/components/health/UnifiedHealthQuestionnaire').then(mod => ({
          default: mod.UnifiedHealthQuestionnaire
        }))
      );

      const LazyTestComponent = () => {
        const [showHeavy, setShowHeavy] = React.useState(false);
        
        return (
          <div>
            <button onClick={() => setShowHeavy(true)}>
              Load Heavy Component
            </button>
            {showHeavy && (
              <React.Suspense fallback={<div>Loading...</div>}>
                <LazyHealthQuestionnaire 
                  onComplete={() => {}}
                  userId="test"
                />
              </React.Suspense>
            )}
          </div>
        );
      };

      render(<LazyTestComponent />);
      
      // Initially should not load the heavy component
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      
      // Click to load
      await user.click(screen.getByText('Load Heavy Component'));
      
      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });
});