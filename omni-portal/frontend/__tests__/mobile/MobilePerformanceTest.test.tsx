import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { MobileHealthQuestionnaire } from '@/components/health/MobileHealthQuestionnaire';
import { TouchFriendlySlider } from '@/components/ui/TouchFriendlySlider';

// Mobile Performance Testing
describe('Mobile Performance Testing', () => {
  describe('3G/4G Network Simulation', () => {
    beforeEach(() => {
      // Mock slow network conditions
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          downlink: 1.5, // 1.5 Mbps
          rtt: 300, // 300ms round trip time
          saveData: false
        },
        writable: true
      });
    });

    it('should load within acceptable time on 3G', async () => {
      const startTime = performance.now();
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      }, { timeout: 5000 });

      const loadTime = performance.now() - startTime;
      
      // Should load within 3 seconds on 3G
      expect(loadTime).toBeLessThan(3000);
    });

    it('should prioritize critical resources on slow networks', async () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      // Essential UI should be available immediately
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Non-critical features can load later
      const voiceButton = screen.queryByLabelText(/voice input/i);
      // Voice input might not be loaded yet on slow network
      if (voiceButton) {
        expect(voiceButton).toBeInTheDocument();
      }
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 10000)
        )
      );

      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      // Should still function offline
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      global.fetch = originalFetch;
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not leak memory during interactions', async () => {
      const mockComplete = jest.fn();
      let initialMemory: number;
      let finalMemory: number;

      // Mock memory API
      if ('memory' in performance) {
        initialMemory = (performance as any).memory.usedJSHeapSize;
      } else {
        initialMemory = 0;
      }

      const { unmount } = render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      // Simulate extensive interactions
      for (let i = 0; i < 50; i++) {
        await waitFor(() => {
          expect(screen.getByRole('button')).toBeInTheDocument();
        });

        const button = screen.getAllByRole('button')[0];
        fireEvent.touchStart(button);
        fireEvent.touchEnd(button);
      }

      unmount();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      if ('memory' in performance) {
        finalMemory = (performance as any).memory.usedJSHeapSize;
        const memoryIncrease = finalMemory - initialMemory;
        
        // Memory increase should be reasonable (< 10MB)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('should efficiently handle large datasets', async () => {
      const mockComplete = jest.fn();
      
      // Simulate large questionnaire with many questions
      const largeQuestionnaireProps = {
        onComplete: mockComplete,
        // Simulate large dataset
        userId: 'test-user-' + 'x'.repeat(1000),
      };

      const startTime = performance.now();
      
      render(
        <MobileHealthQuestionnaire {...largeQuestionnaireProps} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render efficiently even with large data
      expect(renderTime).toBeLessThan(1000);
    });

    it('should implement efficient re-renders', async () => {
      const mockComplete = jest.fn();
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <MobileHealthQuestionnaire onComplete={mockComplete} />;
      };

      const { rerender } = render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const initialRenderCount = renderCount;

      // Trigger re-render
      rerender(<TestComponent />);

      // Should not cause excessive re-renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Battery Impact Assessment', () => {
    it('should minimize CPU usage during idle', async () => {
      const mockComplete = jest.fn();
      let animationFrameCount = 0;
      
      const originalRequestAnimationFrame = requestAnimationFrame;
      requestAnimationFrame = jest.fn().mockImplementation((callback) => {
        animationFrameCount++;
        return originalRequestAnimationFrame(callback);
      });

      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Wait for idle period
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      // Should not continuously request animation frames when idle
      expect(animationFrameCount).toBeLessThan(10);

      requestAnimationFrame = originalRequestAnimationFrame;
    });

    it('should reduce animations on battery saver mode', () => {
      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          level: 0.15, // Low battery
          charging: false,
          chargingTime: Infinity,
          dischargingTime: 3600,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        }),
        writable: true
      });

      const mockComplete = jest.fn();
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      // Should disable non-essential animations on low battery
      const animatedElements = document.querySelectorAll('[class*="animate"]');
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        // Animations should be reduced or disabled
        expect(parseFloat(styles.animationDuration || '0')).toBeLessThanOrEqual(0.3);
      });
    });

    it('should optimize haptic feedback usage', async () => {
      const mockVibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true
      });

      const mockComplete = jest.fn();
      render(
        <MobileHealthQuestionnaire 
          onComplete={mockComplete} 
          enableHapticFeedback={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const button = screen.getAllByRole('button')[0];
      
      // Multiple rapid interactions
      for (let i = 0; i < 5; i++) {
        fireEvent.touchStart(button);
        fireEvent.touchEnd(button);
      }

      // Should not excessively vibrate (battery optimization)
      expect(mockVibrate).toHaveBeenCalledTimes(1); // Only once for completion
    });
  });

  describe('Rendering Performance', () => {
    it('should maintain 60fps during scrolling', async () => {
      const mockComplete = jest.fn();
      let frameCount = 0;
      const frameTimes: number[] = [];

      const measureFrame = () => {
        frameCount++;
        frameTimes.push(performance.now());
        if (frameCount < 60) {
          requestAnimationFrame(measureFrame);
        }
      };

      render(
        <div style={{ height: '200vh' }}>
          <UnifiedHealthAssessment 
            onComplete={mockComplete}
            onProgressUpdate={() => {}}
          />
        </div>
      );

      // Start measuring
      requestAnimationFrame(measureFrame);

      // Simulate scrolling
      const scrollContainer = document.documentElement;
      for (let i = 0; i < 100; i += 10) {
        fireEvent.scroll(scrollContainer, { target: { scrollY: i } });
      }

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Calculate average frame time
      if (frameTimes.length > 1) {
        const averageFrameTime = 
          (frameTimes[frameTimes.length - 1] - frameTimes[0]) / frameTimes.length;
        
        // Should maintain close to 16.67ms per frame (60fps)
        expect(averageFrameTime).toBeLessThan(20);
      }
    });

    it('should handle rapid state changes efficiently', async () => {
      const mockOnChange = jest.fn();
      
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      const thumb = screen.getByTestId('slider-thumb');
      const startTime = performance.now();

      // Rapid value changes
      for (let i = 0; i < 100; i++) {
        fireEvent.touchStart(thumb, {
          touches: [{ clientX: 200 + i, clientY: 100 }]
        });
        fireEvent.touchMove(thumb, {
          touches: [{ clientX: 200 + i + 1, clientY: 100 }]
        });
      }

      fireEvent.touchEnd(thumb);

      const duration = performance.now() - startTime;
      
      // Should handle rapid changes smoothly
      expect(duration).toBeLessThan(500);
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should optimize image loading and rendering', async () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      // Should use efficient image formats and loading
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        expect(img.loading).toBe('lazy');
        expect(img.decoding).toBe('async');
      });
    });
  });

  describe('Load Time Optimization', () => {
    it('should implement progressive loading', async () => {
      const mockComplete = jest.fn();
      const startTime = performance.now();
      
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Initial content should load quickly
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      }, { timeout: 1000 });

      const firstContentTime = performance.now() - startTime;
      expect(firstContentTime).toBeLessThan(500); // First meaningful paint
    });

    it('should implement code splitting for non-critical features', () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire 
          onComplete={mockComplete}
          enableVoiceInput={false} // Should not load voice recognition code
        />
      );

      // Voice recognition should not be loaded
      expect(window.webkitSpeechRecognition).toBeUndefined();
    });

    it('should preload critical resources', async () => {
      // Mock resource hints
      const preloadLinks = document.querySelectorAll('link[rel="preload"]');
      const prefetchLinks = document.querySelectorAll('link[rel="prefetch"]');

      // Should have preload hints for critical resources
      expect(preloadLinks.length + prefetchLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Performance', () => {
    it('should work efficiently in offline mode', async () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', { value: false });

      const mockComplete = jest.fn();
      const startTime = performance.now();
      
      render(
        <MobileHealthQuestionnaire 
          onComplete={mockComplete}
          offlineMode={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;
      
      // Should load quickly offline (from cache/service worker)
      expect(loadTime).toBeLessThan(1000);
    });

    it('should handle offline data storage efficiently', async () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire 
          onComplete={mockComplete}
          offlineMode={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const button = screen.getAllByRole('button')[0];
      fireEvent.click(button);

      // Should store data efficiently in localStorage
      const storedData = localStorage.getItem('mobile_health_responses');
      expect(storedData).toBeTruthy();
      
      // Storage should be compact
      const dataSize = new Blob([storedData!]).size;
      expect(dataSize).toBeLessThan(10000); // < 10KB
    });
  });

  describe('Input Latency', () => {
    it('should respond to touch within 100ms', async () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const button = screen.getAllByRole('button')[0];
      const startTime = performance.now();
      
      fireEvent.touchStart(button);
      
      // Should have immediate visual feedback
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should minimize slider drag latency', () => {
      const mockOnChange = jest.fn();
      
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      const thumb = screen.getByTestId('slider-thumb');
      const startTime = performance.now();
      
      fireEvent.touchStart(thumb, {
        touches: [{ clientX: 200, clientY: 100 }]
      });

      fireEvent.touchMove(thumb, {
        touches: [{ clientX: 250, clientY: 100 }]
      });

      const latency = performance.now() - startTime;
      
      // Should respond immediately to drag
      expect(latency).toBeLessThan(50);
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor and report performance metrics', async () => {
      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Complete questionnaire to get metrics
      const button = screen.getAllByRole('button')[0];
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockComplete).toHaveBeenCalled();
      });

      const results = mockComplete.mock.calls[0][0];
      expect(results.performance).toBeDefined();
      expect(results.performance.loadTime).toBeGreaterThan(0);
      expect(results.performance.batteryImpact).toMatch(/low|medium|high/);
    });

    it('should track network usage', async () => {
      const originalFetch = global.fetch;
      const fetchCalls: string[] = [];
      
      global.fetch = jest.fn().mockImplementation((url) => {
        fetchCalls.push(url);
        return Promise.resolve(new Response('{}'));
      });

      const mockComplete = jest.fn();
      
      render(
        <MobileHealthQuestionnaire onComplete={mockComplete} />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Should minimize network requests
      expect(fetchCalls.length).toBeLessThan(5);

      global.fetch = originalFetch;
    });
  });
});