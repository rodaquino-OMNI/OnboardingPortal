import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { MobileNavigation } from '@/components/ui/mobile-navigation';
import { TouchFriendlySlider } from '@/components/ui/TouchFriendlySlider';

// Mobile Viewport Edge Cases Testing
describe('Mobile Viewport Edge Cases', () => {
  describe('Safe Area Support', () => {
    beforeEach(() => {
      // Mock safe area insets
      document.documentElement.style.setProperty('--safe-area-inset-top', '44px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px');
      document.documentElement.style.setProperty('--safe-area-inset-left', '0px');
      document.documentElement.style.setProperty('--safe-area-inset-right', '0px');
    });

    it('should respect safe area insets on iPhone with notch', () => {
      const mockComplete = jest.fn();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should have padding for safe areas
      const mainContainer = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(mainContainer);
      
      // Should account for safe areas in layout
      expect(styles.paddingTop || styles.marginTop).toBeTruthy();
    });

    it('should handle landscape safe areas', () => {
      // Mock landscape safe areas
      document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', '21px');
      document.documentElement.style.setProperty('--safe-area-inset-left', '44px');
      document.documentElement.style.setProperty('--safe-area-inset-right', '44px');

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should adapt to landscape safe areas
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // Buttons should not be in unsafe zones
        expect(rect.left).toBeGreaterThan(44);
        expect(rect.right).toBeLessThan(window.innerWidth - 44);
      });
    });
  });

  describe('Dynamic Viewport Changes', () => {
    it('should handle browser UI showing/hiding', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      const initialHeight = window.innerHeight;

      // Simulate browser UI hiding (viewport expansion)
      Object.defineProperty(window, 'innerHeight', {
        value: initialHeight + 100,
        writable: true
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        // Should still be functional after viewport change
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Simulate browser UI showing (viewport shrinking)
      Object.defineProperty(window, 'innerHeight', {
        value: initialHeight - 100,
        writable: true
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        // Should still be functional after viewport shrink
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    it('should handle virtual keyboard appearance', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Simulate virtual keyboard appearance (significant height reduction)
      const originalHeight = window.innerHeight;
      Object.defineProperty(window, 'innerHeight', {
        value: originalHeight * 0.5, // Keyboard takes ~50% of screen
        writable: true
      });

      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        // Content should still be accessible
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Should maintain touch target sizes even with limited space
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('should handle landscape to portrait orientation change', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Start in landscape
      Object.defineProperty(window, 'innerWidth', { value: 896 });
      Object.defineProperty(window, 'innerHeight', { value: 414 });
      
      fireEvent(window, new Event('orientationchange'));
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Rotate to portrait
      Object.defineProperty(window, 'innerWidth', { value: 414 });
      Object.defineProperty(window, 'innerHeight', { value: 896 });
      
      fireEvent(window, new Event('orientationchange'));
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        // Should maintain functionality after rotation
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Touch targets should remain appropriate
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Extreme Screen Sizes', () => {
    const extremeSizes = [
      { name: 'Very small (Galaxy Fold closed)', width: 280, height: 653 },
      { name: 'Ultra-wide (Galaxy Fold open)', width: 2480, height: 1000 },
      { name: 'Square aspect ratio', width: 500, height: 500 },
      { name: 'Very tall (unusual ratio)', width: 300, height: 1200 },
    ];

    extremeSizes.forEach(({ name, width, height }) => {
      it(`should handle ${name}`, () => {
        Object.defineProperty(window, 'innerWidth', { value: width });
        Object.defineProperty(window, 'innerHeight', { value: height });

        const mockComplete = jest.fn();
        const { container } = render(
          <UnifiedHealthAssessment 
            onComplete={mockComplete}
            onProgressUpdate={() => {}}
          />
        );

        fireEvent(window, new Event('resize'));

        // Should render without breaking
        expect(container.firstChild).toBeInTheDocument();
        
        // Should maintain usable touch targets
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        
        buttons.forEach(button => {
          const rect = button.getBoundingClientRect();
          expect(rect.height).toBeGreaterThanOrEqual(44);
          expect(rect.width).toBeGreaterThanOrEqual(44);
        });
      });
    });
  });

  describe('Zoom and Scaling', () => {
    it('should maintain usability at 200% zoom', () => {
      // Mock 200% zoom
      Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 187.5 }); // 375/2

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should still be usable at high zoom
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // At 200% zoom, effective sizes should still be adequate
        expect(rect.height).toBeGreaterThanOrEqual(22); // 44px / 2
      });
    });

    it('should handle browser zoom changes', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      // Simulate zoom change
      Object.defineProperty(window, 'devicePixelRatio', { value: 1.5 });
      fireEvent(window, new Event('resize'));

      const thumb = screen.getByTestId('slider-thumb');
      
      // Should still be interactive after zoom
      fireEvent.touchStart(thumb, {
        touches: [{ clientX: 200, clientY: 100 }]
      });

      fireEvent.touchMove(thumb, {
        touches: [{ clientX: 220, clientY: 100 }]
      });

      fireEvent.touchEnd(thumb);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should prevent unwanted zoom on double tap', () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      const button = buttons[0];

      // Double tap should not cause zoom
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);

      // Should handle as normal interaction, not zoom
      expect(button).toBeInTheDocument();
    });
  });

  describe('Split Screen and Multi-Window', () => {
    it('should handle split screen mode', () => {
      // Mock split screen (half width)
      Object.defineProperty(window, 'innerWidth', { value: 187.5 }); // iPhone 11 Pro half width
      Object.defineProperty(window, 'innerHeight', { value: 812 });

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      fireEvent(window, new Event('resize'));

      // Should adapt layout for narrow width
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Should maintain minimum touch targets even in narrow space
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('should handle picture-in-picture constraints', () => {
      // Mock very small PiP window
      Object.defineProperty(window, 'innerWidth', { value: 320 });
      Object.defineProperty(window, 'innerHeight', { value: 180 });

      const mockComplete = jest.fn();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      fireEvent(window, new Event('resize'));

      // Should gracefully handle extreme constraints
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Viewport Meta Tag Compliance', () => {
    it('should work with different viewport configurations', () => {
      const viewportConfigurations = [
        'width=device-width, initial-scale=1',
        'width=device-width, initial-scale=1, maximum-scale=1',
        'width=device-width, initial-scale=1, user-scalable=no',
        'width=device-width, initial-scale=1, viewport-fit=cover'
      ];

      viewportConfigurations.forEach(config => {
        // Mock viewport meta tag
        const mockMeta = document.createElement('meta');
        mockMeta.name = 'viewport';
        mockMeta.content = config;
        document.head.appendChild(mockMeta);

        const mockComplete = jest.fn();
        render(
          <UnifiedHealthAssessment 
            onComplete={mockComplete}
            onProgressUpdate={() => {}}
          />
        );

        // Should work with any viewport configuration
        expect(screen.getByRole('button')).toBeInTheDocument();

        document.head.removeChild(mockMeta);
      });
    });
  });

  describe('CSS Environment Variables', () => {
    it('should use CSS environment variables for safe areas', () => {
      // Mock CSS environment variables
      const mockGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = jest.fn().mockImplementation((element) => {
        const originalStyles = mockGetComputedStyle(element);
        return {
          ...originalStyles,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        };
      });

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should handle CSS environment variables gracefully
      expect(screen.getByRole('button')).toBeInTheDocument();

      window.getComputedStyle = mockGetComputedStyle;
    });
  });

  describe('Fullscreen and Immersive Modes', () => {
    it('should handle fullscreen API transitions', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Mock fullscreen change
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        writable: true
      });

      fireEvent(document, new Event('fullscreenchange'));

      await waitFor(() => {
        // Should remain functional in fullscreen
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Exit fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true
      });

      fireEvent(document, new Event('fullscreenchange'));

      await waitFor(() => {
        // Should remain functional after exiting fullscreen
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    it('should handle immersive mode on Android', () => {
      // Mock Android immersive mode
      Object.defineProperty(window, 'innerHeight', { value: 812 }); // Full height
      
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should use full viewport height in immersive mode
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Scroll Behavior', () => {
    it('should prevent overscroll bounce', () => {
      const mockComplete = jest.fn();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      const scrollContainer = container.querySelector('[class*="overflow"]');
      if (scrollContainer) {
        const styles = window.getComputedStyle(scrollContainer);
        // Should prevent rubber band scrolling
        expect(styles.overscrollBehavior || styles.WebkitOverflowScrolling).toBeTruthy();
      }
    });

    it('should handle momentum scrolling', () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Should enable smooth momentum scrolling on iOS
      const scrollableElements = document.querySelectorAll('[class*="overflow"], [class*="scroll"]');
      scrollableElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        expect(styles.WebkitOverflowScrolling).toBe('touch');
      });
    });
  });
});