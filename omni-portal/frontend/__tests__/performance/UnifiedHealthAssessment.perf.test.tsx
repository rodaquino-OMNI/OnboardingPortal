import { render, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

// Performance benchmark tests
describe('UnifiedHealthAssessment Performance Benchmarks', () => {
  const mockOnComplete = jest.fn();
  const mockOnDomainChange = jest.fn();

  // Helper to measure render time
  const measureRenderTime = async (Component: React.FC<any>, props: any) => {
    const start = performance.now();
    const { container } = render(<Component {...props} />);
    await waitFor(() => container.querySelector('[data-testid]'));
    const end = performance.now();
    return end - start;
  };

  // Helper to measure memory usage
  const measureMemoryUsage = () => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  };

  describe('Initial Render Performance', () => {
    it('should render within 100ms', async () => {
      const renderTime = await measureRenderTime(UnifiedHealthAssessment, {
        onComplete: mockOnComplete,
        onDomainChange: mockOnDomainChange
      });

      expect(renderTime).toBeLessThan(100);
      console.log(`Initial render time: ${renderTime.toFixed(2)}ms`);
    });

    it('should have minimal memory footprint', () => {
      const initialMemory = measureMemoryUsage();
      
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      const afterRenderMemory = measureMemoryUsage();
      const memoryIncrease = afterRenderMemory - initialMemory;
      
      // Should use less than 5MB for initial render
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Question Transition Performance', () => {
    it('should transition between questions in under 50ms', async () => {
      const flow = new UnifiedHealthFlow();
      const transitions: number[] = [];

      // Mock flow responses
      jest.spyOn(flow, 'processResponse')
        .mockImplementation(async () => ({
          type: 'question',
          question: {
            id: `q${transitions.length}`,
            text: 'Test Question',
            type: 'boolean',
            domain: 'test',
            riskWeight: 1
          },
          progress: transitions.length * 10,
          currentDomain: 'Test',
          currentLayer: 'Test',
          estimatedTimeRemaining: 5
        }));

      const { getByText } = render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Measure 10 transitions
      for (let i = 0; i < 10; i++) {
        await waitFor(() => getByText('✅ Sim'));
        
        const start = performance.now();
        fireEvent.click(getByText('✅ Sim'));
        await waitFor(() => getByText('Test Question'));
        const end = performance.now();
        
        transitions.push(end - start);
      }

      const avgTransition = transitions.reduce((a, b) => a + b) / transitions.length;
      expect(avgTransition).toBeLessThan(50);
      console.log(`Average transition time: ${avgTransition.toFixed(2)}ms`);
    });
  });

  describe('Large Form Performance', () => {
    it('should handle 100 questions without performance degradation', async () => {
      const flow = new UnifiedHealthFlow();
      const responses: Record<string, any> = {};
      const renderTimes: number[] = [];

      // Create 100 questions
      const questions = Array.from({ length: 100 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i}`,
        type: 'boolean' as const,
        domain: 'test',
        riskWeight: 1
      }));

      let currentIndex = 0;
      jest.spyOn(flow, 'processResponse')
        .mockImplementation(async (id: string, value: any) => {
          if (id !== '_init') {
            responses[id] = value;
            currentIndex++;
          }
          
          const result: any = {
            type: currentIndex < questions.length ? 'question' : 'complete',
            progress: (currentIndex / questions.length) * 100,
            currentDomain: 'Test',
            currentLayer: 'Test',
            estimatedTimeRemaining: questions.length - currentIndex
          };
          
          if (currentIndex < questions.length) {
            result.question = questions[currentIndex];
          }
          
          if (currentIndex >= questions.length) {
            result.results = {
              responses,
              riskScores: {},
              completedDomains: ['test'],
              totalRiskScore: 50,
              riskLevel: 'moderate' as const,
              recommendations: [],
              nextSteps: [],
              fraudDetectionScore: 0,
              timestamp: new Date().toISOString()
            };
          }
          
          return result;
        });

      const { getByText } = render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Answer all questions and measure performance
      for (let i = 0; i < questions.length; i++) {
        await waitFor(() => getByText('✅ Sim'));
        
        const start = performance.now();
        fireEvent.click(getByText('✅ Sim'));
        
        if (i < questions.length - 1) {
          await waitFor(() => getByText(`Question ${i + 1}`));
        }
        
        const end = performance.now();
        renderTimes.push(end - start);
      }

      // Performance should not degrade over time
      const firstTenAvg = renderTimes.slice(0, 10).reduce((a, b) => a + b) / 10;
      const lastTenAvg = renderTimes.slice(-10).reduce((a, b) => a + b) / 10;
      
      // Last questions should not be more than 50% slower than first
      expect(lastTenAvg).toBeLessThan(firstTenAvg * 1.5);
      
      console.log(`First 10 avg: ${firstTenAvg.toFixed(2)}ms`);
      console.log(`Last 10 avg: ${lastTenAvg.toFixed(2)}ms`);
    });
  });

  describe('Bundle Size Impact', () => {
    it('should have reasonable component size', () => {
      // This is a proxy test - in real scenario, use webpack-bundle-analyzer
      const componentCode = UnifiedHealthAssessment.toString();
      const sizeInKB = new Blob([componentCode]).size / 1024;
      
      // Component code should be under 20KB
      expect(sizeInKB).toBeLessThan(20);
      console.log(`Component size: ${sizeInKB.toFixed(2)}KB`);
    });
  });

  describe('Re-render Performance', () => {
    it('should minimize unnecessary re-renders', async () => {
      let renderCount = 0;
      
      // Mock component to count renders
      const MockedUnifiedHealthAssessment = () => {
        renderCount++;
        return <UnifiedHealthAssessment 
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />;
      };

      const { rerender } = render(<MockedUnifiedHealthAssessment />);
      
      // Initial render
      expect(renderCount).toBe(1);
      
      // Re-render with same props should not cause re-render
      rerender(<MockedUnifiedHealthAssessment />);
      expect(renderCount).toBe(1);
      
      console.log(`Total renders: ${renderCount}`);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clean up properly on unmount', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Mount and unmount component multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <UnifiedHealthAssessment 
            onComplete={mockOnComplete}
            onDomainChange={mockOnDomainChange}
          />
        );
        
        await waitFor(() => {});
        unmount();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryLeak = finalMemory - initialMemory;
      
      // Should not leak more than 1MB after 10 mount/unmount cycles
      expect(memoryLeak).toBeLessThan(1024 * 1024);
      console.log(`Memory leak: ${(memoryLeak / 1024).toFixed(2)}KB`);
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle multiple instances efficiently', async () => {
      const instances = 5;
      const renderTimes: number[] = [];
      
      // Render multiple instances
      for (let i = 0; i < instances; i++) {
        const start = performance.now();
        render(
          <UnifiedHealthAssessment 
            key={i}
            onComplete={mockOnComplete}
            onDomainChange={mockOnDomainChange}
          />
        );
        const end = performance.now();
        renderTimes.push(end - start);
      }
      
      const avgRenderTime = renderTimes.reduce((a, b) => a + b) / instances;
      
      // Average render time should stay under 150ms even with multiple instances
      expect(avgRenderTime).toBeLessThan(150);
      console.log(`Avg render time for ${instances} instances: ${avgRenderTime.toFixed(2)}ms`);
    });
  });

  describe('Flow Processing Performance', () => {
    it('should process responses in under 10ms', async () => {
      const flow = new UnifiedHealthFlow();
      const processingTimes: number[] = [];
      
      // Process multiple responses
      const testResponses = [
        { id: 'age', value: 30 },
        { id: 'biological_sex', value: 'male' },
        { id: 'emergency_check', value: ['none'] },
        { id: 'pain_severity', value: 5 },
        { id: 'mood_interest', value: 2 },
        { id: 'chronic_conditions_flag', value: true }
      ];
      
      for (const response of testResponses) {
        const start = performance.now();
        await flow.processResponse(response.id, response.value);
        const end = performance.now();
        processingTimes.push(end - start);
      }
      
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b) / processingTimes.length;
      
      expect(avgProcessingTime).toBeLessThan(10);
      console.log(`Avg response processing time: ${avgProcessingTime.toFixed(2)}ms`);
    });
  });

  describe('Accessibility Performance', () => {
    it('should maintain performance with screen readers', async () => {
      // Simulate screen reader by adding ARIA live regions
      const { container } = render(
        <div>
          <div aria-live="polite" aria-atomic="true">
            <UnifiedHealthAssessment 
              onComplete={mockOnComplete}
              onDomainChange={mockOnDomainChange}
            />
          </div>
        </div>
      );
      
      // Measure time to find all accessible elements
      const start = performance.now();
      const accessibleElements = container.querySelectorAll('[role], [aria-label], [aria-describedby]');
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5);
      expect(accessibleElements.length).toBeGreaterThan(0);
      console.log(`Accessibility query time: ${(end - start).toFixed(2)}ms`);
    });
  });
});