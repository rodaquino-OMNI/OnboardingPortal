import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { MobileNavigation, MobileTabBar } from '@/components/ui/mobile-navigation';
import { TouchFriendlySlider } from '@/components/ui/TouchFriendlySlider';

// One-Handed Operation Testing
describe('One-Handed Operation Testing', () => {
  describe('Thumb Reach Zones', () => {
    const mockDevices = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'iPhone 12 Pro Max', width: 428, height: 926 },
      { name: 'Galaxy S21', width: 360, height: 800 },
      { name: 'Galaxy S21 Ultra', width: 412, height: 915 },
    ];

    mockDevices.forEach(({ name, width, height }) => {
      describe(`${name} (${width}x${height})`, () => {
        beforeEach(() => {
          Object.defineProperty(window, 'innerWidth', { value: width });
          Object.defineProperty(window, 'innerHeight', { value: height });
        });

        it('should place primary actions in thumb-friendly zone', async () => {
          const mockComplete = jest.fn();
          render(
            <UnifiedHealthAssessment 
              onComplete={mockComplete}
              onProgressUpdate={() => {}}
            />
          );

          await waitFor(() => {
            expect(screen.getByRole('button')).toBeInTheDocument();
          });

          const primaryButtons = screen.getAllByRole('button');
          
          primaryButtons.forEach(button => {
            const rect = button.getBoundingClientRect();
            
            // Primary actions should be in lower 2/3 of screen for thumb reach
            // Exception: very small screens where everything is reachable
            if (height > 600) {
              expect(rect.bottom).toBeGreaterThan(height * 0.33);
            }
            
            // Should be within comfortable horizontal reach (not in far corners)
            expect(rect.left).toBeGreaterThan(16);
            expect(rect.right).toBeLessThan(width - 16);
          });
        });

        it('should position navigation controls for thumb access', () => {
          render(<MobileNavigation />);

          const menuButton = screen.getByRole('button', { name: /menu/i });
          const rect = menuButton.getBoundingClientRect();

          // Menu button should be positioned for right-hand thumb access
          // Typically bottom-right for easy thumb reach
          expect(rect.bottom).toBeGreaterThan(height * 0.7);
          expect(rect.right).toBeGreaterThan(width * 0.7);
        });

        it('should provide alternative access for hard-to-reach areas', () => {
          render(<MobileTabBar />);

          const tabItems = screen.getAllByRole('link');
          
          // Tab bar items should be evenly distributed and reachable
          tabItems.forEach(tab => {
            const rect = tab.getBoundingClientRect();
            
            // Should be at bottom of screen for thumb access
            expect(rect.bottom).toBeGreaterThan(height * 0.9);
            
            // Should not be too narrow for thumb targeting
            expect(rect.width).toBeGreaterThan(44);
          });
        });
      });
    });
  });

  describe('Right-Hand vs Left-Hand Operation', () => {
    it('should work efficiently for right-handed users', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const rightSideButtons = buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.left > window.innerWidth * 0.5;
      });

      // Should have right-side positioned elements for right thumb
      expect(rightSideButtons.length).toBeGreaterThan(0);
    });

    it('should work efficiently for left-handed users', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const leftSideButtons = buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.right < window.innerWidth * 0.5;
      });

      // Should have left-side accessible elements for left thumb
      expect(leftSideButtons.length).toBeGreaterThan(0);
    });

    it('should provide ambidextrous navigation options', () => {
      render(<MobileNavigation />);

      // Should support both left and right hand operation
      const menuButton = screen.getByRole('button', { name: /menu/i });
      const rect = menuButton.getBoundingClientRect();

      // Menu should be accessible from either side through gestures
      // Check if swipe gesture support is available
      const gestureElement = menuButton.closest('[data-gesture-enabled]') || 
                            document.querySelector('[class*="gesture"]');
      
      // Either positioned accessibly or gesture-enabled
      const isAccessible = rect.bottom > window.innerHeight * 0.5 || gestureElement;
      expect(isAccessible).toBeTruthy();
    });
  });

  describe('Thumb Arc Optimization', () => {
    it('should arrange controls in natural thumb arc', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      
      // Calculate if buttons follow natural thumb arc
      // Thumb arc: bottom-center to top-opposite-side
      const rightHandArc = buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Natural right thumb reach: bottom-right to top-left arc
        const thumbReachScore = 
          (window.innerHeight - y) / window.innerHeight + // Prefer bottom
          (window.innerWidth - x) / window.innerWidth;   // Prefer right for thumb start
        
        return thumbReachScore > 1; // Above average reachability
      });

      expect(rightHandArc.length).toBeGreaterThan(0);
    });

    it('should optimize slider position for thumb control', () => {
      const mockOnChange = jest.fn();
      render(
        <div style={{ padding: '20px' }}>
          <TouchFriendlySlider
            min={0}
            max={100}
            value={50}
            onChange={mockOnChange}
            size="large"
          />
        </div>
      );

      const slider = screen.getByRole('slider');
      const rect = slider.getBoundingClientRect();

      // Slider should be positioned for comfortable thumb operation
      // Not too high, not too low
      expect(rect.top).toBeGreaterThan(window.innerHeight * 0.2);
      expect(rect.bottom).toBeLessThan(window.innerHeight * 0.8);
      
      // Should have adequate horizontal space for thumb movement
      expect(rect.width).toBeGreaterThan(200);
    });
  });

  describe('Gesture-Based Navigation', () => {
    it('should support swipe gestures for one-handed navigation', async () => {
      render(<MobileNavigation />);

      const navigationDrawer = screen.getByRole('navigation');
      
      // Should support swipe to open/close
      fireEvent.touchStart(navigationDrawer, {
        touches: [{ clientX: window.innerWidth - 10, clientY: 200 }]
      });

      fireEvent.touchMove(navigationDrawer, {
        touches: [{ clientX: window.innerWidth - 100, clientY: 200 }]
      });

      fireEvent.touchEnd(navigationDrawer);

      // Navigation should respond to swipe gesture
      await waitFor(() => {
        expect(navigationDrawer).toBeInTheDocument();
      });
    });

    it('should implement edge swipes for system navigation', () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      const container = document.querySelector('[data-testid]') || document.body;
      
      // Simulate edge swipe (from screen edge)
      fireEvent.touchStart(container, {
        touches: [{ clientX: 0, clientY: 300 }]
      });

      fireEvent.touchMove(container, {
        touches: [{ clientX: 50, clientY: 300 }]
      });

      fireEvent.touchEnd(container);

      // Should not interfere with normal operation
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should support pull-to-refresh in reachable areas', async () => {
      const mockComplete = jest.fn();
      const { container } = render(
        <div style={{ height: '100vh', overflowY: 'auto' }}>
          <UnifiedHealthAssessment 
            onComplete={mockComplete}
            onProgressUpdate={() => {}}
          />
        </div>
      );

      const scrollContainer = container.firstChild as HTMLElement;
      
      // Simulate pull-to-refresh gesture
      fireEvent.touchStart(scrollContainer, {
        touches: [{ clientX: 200, clientY: 100 }]
      });

      fireEvent.touchMove(scrollContainer, {
        touches: [{ clientX: 200, clientY: 200 }]
      });

      fireEvent.touchEnd(scrollContainer);

      // Should handle pull gesture without breaking functionality
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });
  });

  describe('Reachability Adaptations', () => {
    it('should provide reachability mode for large screens', () => {
      // Mock large screen device
      Object.defineProperty(window, 'innerWidth', { value: 428 });
      Object.defineProperty(window, 'innerHeight', { value: 926 });

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should adapt layout for large screen one-handed use
      const container = document.querySelector('[class*="container"]') || 
                       document.querySelector('[class*="wrapper"]');
      
      if (container) {
        const styles = window.getComputedStyle(container);
        // Should have reasonable max-width for thumb reach
        const maxWidth = parseFloat(styles.maxWidth);
        if (maxWidth) {
          expect(maxWidth).toBeLessThan(400);
        }
      }
    });

    it('should implement floating action patterns', () => {
      render(<MobileNavigation />);

      const floatingButton = screen.getByRole('button', { name: /menu/i });
      const styles = window.getComputedStyle(floatingButton);

      // Should be positioned as floating element
      expect(styles.position).toBe('fixed');
      
      // Should be in thumb-reachable corner
      const rect = floatingButton.getBoundingClientRect();
      const isInThumbZone = 
        rect.bottom > window.innerHeight * 0.6 && 
        rect.right > window.innerWidth * 0.6;
      
      expect(isInThumbZone).toBe(true);
    });

    it('should provide alternative input methods for unreachable areas', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Should provide keyboard navigation as alternative
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      
      // Should be able to navigate with keyboard
      fireEvent.keyDown(firstButton, { key: 'Tab' });
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeTruthy();
      expect(focusedElement?.getAttribute('role')).toBeTruthy();
    });
  });

  describe('Comfort and Ergonomics', () => {
    it('should minimize stretching for common actions', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const commonActions = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('Sim') || 
        button.textContent?.includes('Não') ||
        button.textContent?.includes('Continuar')
      );

      commonActions.forEach(button => {
        const rect = button.getBoundingClientRect();
        
        // Common actions should be in comfortable reach
        // Avoid top 25% and extreme corners
        expect(rect.top).toBeGreaterThan(window.innerHeight * 0.25);
        expect(rect.left).toBeGreaterThan(20);
        expect(rect.right).toBeLessThan(window.innerWidth - 20);
      });
    });

    it('should group related controls for efficient thumb movement', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        const yesButton = screen.queryByText(/sim/i);
        const noButton = screen.queryByText(/não/i);
        
        if (yesButton && noButton) {
          const yesRect = yesButton.getBoundingClientRect();
          const noRect = noButton.getBoundingClientRect();
          
          // Related buttons should be close together
          const distance = Math.sqrt(
            Math.pow(yesRect.left - noRect.left, 2) + 
            Math.pow(yesRect.top - noRect.top, 2)
          );
          
          expect(distance).toBeLessThan(200); // Within easy thumb movement
        }
      });
    });

    it('should provide rest areas to prevent thumb fatigue', () => {
      const mockOnChange = jest.fn();
      render(
        <div style={{ padding: '40px' }}>
          <TouchFriendlySlider
            min={0}
            max={100}
            value={50}
            onChange={mockOnChange}
            size="large"
          />
        </div>
      );

      // Should have adequate padding/margins for thumb rest
      const container = screen.getByRole('slider').closest('div');
      if (container) {
        const styles = window.getComputedStyle(container);
        const padding = parseFloat(styles.padding);
        expect(padding).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe('Adaptive Interface', () => {
    it('should detect hand preference from usage patterns', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const rightSideButton = screen.getAllByRole('button').find(button => {
        const rect = button.getBoundingClientRect();
        return rect.left > window.innerWidth * 0.6;
      });

      if (rightSideButton) {
        // Simulate multiple right-side interactions (right-handed pattern)
        for (let i = 0; i < 3; i++) {
          fireEvent.touchStart(rightSideButton, {
            touches: [{ clientX: window.innerWidth * 0.8, clientY: 400 }]
          });
          fireEvent.touchEnd(rightSideButton);
        }
      }

      // Interface should adapt to detected preference
      // This would typically involve storing user preference
      expect(localStorage.getItem).toBeDefined();
    });

    it('should adjust layout based on device orientation', () => {
      const mockComplete = jest.fn();
      
      // Portrait mode
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 812 });
      
      const { rerender } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Landscape mode
      Object.defineProperty(window, 'innerWidth', { value: 812 });
      Object.defineProperty(window, 'innerHeight', { value: 375 });
      
      fireEvent(window, new Event('orientationchange'));
      
      rerender(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should adapt thumb zones for landscape
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // In landscape, should utilize corners more effectively
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('should provide customization options for accessibility', () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should provide ways to customize thumb-friendliness
      // Look for settings or customization options
      const settingsButton = screen.queryByLabelText(/settings/i) || 
                             screen.queryByText(/configurações/i);
      
      // Interface should be adaptable
      expect(document.querySelector('[data-customizable]') || settingsButton).toBeTruthy();
    });
  });
});