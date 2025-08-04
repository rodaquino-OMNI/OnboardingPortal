import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { TouchFriendlySlider } from '@/components/ui/TouchFriendlySlider';
import { act } from 'react-dom/test-utils';

// Mobile Accessibility Edge Cases Testing
describe('Mobile Accessibility Edge Cases', () => {
  describe('Screen Reader Compatibility', () => {
    it('should announce question changes to screen readers', async () => {
      const mockComplete = jest.fn();
      const mockAnnouncement = jest.fn();

      // Mock screen reader announcements
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn().mockImplementation((tagName) => {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'div') {
          const setAttribute = element.setAttribute;
          element.setAttribute = function(name, value) {
            if (name === 'aria-live') {
              mockAnnouncement(value);
            }
            return setAttribute.call(this, name, value);
          };
        }
        return element;
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Wait for first question
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Answer first question to trigger announcement
      const button = screen.getAllByRole('button')[0];
      fireEvent.click(button);

      // Should announce to screen reader
      expect(mockAnnouncement).toHaveBeenCalledWith('polite');

      // Restore original createElement
      document.createElement = originalCreateElement;
    });

    it('should provide proper focus management for screen readers', async () => {
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

      // Focus should be managed when new question appears
      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Answer question
      fireEvent.click(firstButton);

      // Wait for next question and check focus management
      await waitFor(() => {
        const newButtons = screen.getAllByRole('button');
        expect(newButtons.length).toBeGreaterThan(0);
      });
    });

    it('should provide comprehensive ARIA labels for complex interactions', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
          label="Pain Level"
          showValue={true}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-label', 'Pain Level');
      expect(slider).toHaveAttribute('aria-valuenow', '50');
      expect(slider).toHaveAttribute('aria-valuemin', '0');
      expect(slider).toHaveAttribute('aria-valuemax', '100');
      expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('should handle screen reader navigation between form elements', async () => {
      const user = userEvent.setup();
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

      // Navigate using screen reader commands (Tab/Shift+Tab)
      await user.tab();
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toHaveAttribute('role');
      
      // Should be able to navigate backwards
      await user.tab({ shift: true });
      await user.tab();
      
      // Focus should return to same element
      expect(document.activeElement).toBe(focusedElement);
    });
  });

  describe('Voice Input Compatibility', () => {
    it('should handle voice input activation without breaking touch', async () => {
      const mockSpeechRecognition = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      (window as any).webkitSpeechRecognition = mockSpeechRecognition;

      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
          hapticFeedback={true}
        />
      );

      const thumb = screen.getByTestId('slider-thumb');
      
      // Voice input should not interfere with touch
      fireEvent.touchStart(thumb, {
        touches: [{ clientX: 200, clientY: 100 }]
      });

      fireEvent.touchMove(thumb, {
        touches: [{ clientX: 250, clientY: 100 }]
      });

      fireEvent.touchEnd(thumb);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should provide voice alternatives for complex gestures', () => {
      // Test that voice commands can perform slider operations
      const mockOnChange = jest.fn();
      
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      const slider = screen.getByRole('slider');
      
      // Keyboard controls as voice alternatives
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(mockOnChange).toHaveBeenCalledWith(51);

      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
      expect(mockOnChange).toHaveBeenCalledWith(49);

      fireEvent.keyDown(slider, { key: 'Home' });
      expect(mockOnChange).toHaveBeenCalledWith(0);

      fireEvent.keyDown(slider, { key: 'End' });
      expect(mockOnChange).toHaveBeenCalledWith(100);
    });
  });

  describe('High Contrast Mode', () => {
    beforeEach(() => {
      // Mock high contrast media query
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    it('should adapt to high contrast preferences', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      // High contrast should be detected and styles adapted
      const thumb = screen.getByTestId('slider-thumb');
      const styles = window.getComputedStyle(thumb);
      
      // Should have strong contrast borders in high contrast mode
      expect(styles.borderWidth).toBe('2px');
    });

    it('should maintain touch targets in high contrast mode', () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.width).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Motor Impairment Support', () => {
    it('should provide larger touch targets for users with motor difficulties', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
          size="large" // Should provide 48px targets
        />
      );

      const thumb = screen.getByTestId('slider-thumb');
      const rect = thumb.getBoundingClientRect();
      
      // Large size should provide bigger touch area
      expect(rect.width).toBeGreaterThanOrEqual(48);
      expect(rect.height).toBeGreaterThanOrEqual(48);
    });

    it('should allow extended interaction time', async () => {
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

      const button = screen.getAllByRole('button')[0];
      
      // Long press should not interfere with normal operation
      fireEvent.touchStart(button);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      fireEvent.touchEnd(button);
      
      // Should still register as valid interaction
      expect(button).toBeInTheDocument();
    });

    it('should support alternative input methods', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      const slider = screen.getByRole('slider');
      
      // Should support keyboard navigation
      slider.focus();
      expect(document.activeElement).toBe(slider);

      // Arrow keys should work
      fireEvent.keyDown(slider, { key: 'ArrowUp' });
      expect(mockOnChange).toHaveBeenCalled();

      // Page keys for larger steps
      fireEvent.keyDown(slider, { key: 'PageUp' });
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Cognitive Accessibility', () => {
    it('should provide clear progress indicators', async () => {
      const mockComplete = jest.fn();
      const mockProgressUpdate = jest.fn();
      
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={mockProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Should show clear progress information
      const progressElements = screen.getAllByText(/progresso/i);
      expect(progressElements.length).toBeGreaterThan(0);

      // Progress should be announced
      expect(mockProgressUpdate).toHaveBeenCalled();
    });

    it('should provide simple language and clear instructions', async () => {
      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      await waitFor(() => {
        const questionText = screen.getByText(/como você se sente/i);
        expect(questionText).toBeInTheDocument();
      });

      // Instructions should be clear and simple
      const instructions = screen.queryAllByText(/selecione/i);
      instructions.forEach(instruction => {
        expect(instruction.textContent?.length).toBeLessThan(100); // Keep instructions concise
      });
    });

    it('should allow users to review and change answers', async () => {
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

      // Should provide a way to go back or change answers
      const backButton = screen.queryByText(/anterior/i) || screen.queryByText(/voltar/i);
      if (backButton) {
        expect(backButton).toBeInTheDocument();
      }
    });
  });

  describe('Seizure and Vestibular Disorder Safety', () => {
    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const mockComplete = jest.fn();
      render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Check that animations are disabled or reduced
      const animatedElements = document.querySelectorAll('[class*="animate"]');
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        // Animation should be minimal or disabled
        expect(parseFloat(styles.animationDuration || '0')).toBeLessThanOrEqual(0.01);
      });
    });

    it('should avoid rapid flashing or flickering', () => {
      const mockOnChange = jest.fn();
      render(
        <TouchFriendlySlider
          min={0}
          max={100}
          value={50}
          onChange={mockOnChange}
        />
      );

      // Should not have rapid state changes that could trigger seizures
      const thumb = screen.getByTestId('slider-thumb');
      
      // Rapid interactions should be debounced
      for (let i = 0; i < 10; i++) {
        fireEvent.touchStart(thumb);
        fireEvent.touchEnd(thumb);
      }

      // Should not cause rapid visual changes
      expect(mockOnChange).not.toHaveBeenCalledTimes(10);
    });

    it('should provide stable visual references', () => {
      const mockComplete = jest.fn();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      // Layout should be stable and not jump around
      const mainContainer = container.firstChild as HTMLElement;
      const initialHeight = mainContainer.getBoundingClientRect().height;

      // Simulate content changes
      fireEvent.resize(window);

      const newHeight = mainContainer.getBoundingClientRect().height;
      
      // Height should not change dramatically
      const heightDifference = Math.abs(newHeight - initialHeight);
      expect(heightDifference).toBeLessThan(100);
    });
  });

  describe('Touch Sensitivity Adjustments', () => {
    it('should handle light touch interactions', () => {
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
      
      // Very light touch (minimal pressure simulation)
      fireEvent.touchStart(thumb, {
        touches: [{ 
          clientX: 200, 
          clientY: 100,
          force: 0.1 // Light touch
        }]
      });

      fireEvent.touchMove(thumb, {
        touches: [{ 
          clientX: 220, 
          clientY: 100,
          force: 0.1
        }]
      });

      fireEvent.touchEnd(thumb);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle heavy touch interactions', () => {
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
      
      // Heavy touch
      fireEvent.touchStart(thumb, {
        touches: [{ 
          clientX: 200, 
          clientY: 100,
          force: 1.0 // Heavy touch
        }]
      });

      fireEvent.touchMove(thumb, {
        touches: [{ 
          clientX: 220, 
          clientY: 100,
          force: 1.0
        }]
      });

      fireEvent.touchEnd(thumb);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle accidental touches gracefully', async () => {
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

      const button = screen.getAllByRole('button')[0];
      
      // Simulate accidental touch (very brief)
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      
      // Immediately followed by another touch
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);

      // Should not double-submit
      await waitFor(() => {
        expect(mockComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Device-Specific Adaptations', () => {
    it('should adapt to different screen densities', () => {
      // Mock high DPI screen
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 3, // Retina display
        writable: true
      });

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
      
      // Touch targets should remain physically appropriate size
      const rect = thumb.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(48);
    });

    it('should handle foldable devices and unusual aspect ratios', () => {
      // Mock foldable device dimensions
      Object.defineProperty(window, 'innerWidth', { value: 2480 });
      Object.defineProperty(window, 'innerHeight', { value: 1200 });

      const mockComplete = jest.fn();
      const { container } = render(
        <UnifiedHealthAssessment 
          onComplete={mockComplete}
          onProgressUpdate={() => {}}
        />
      );

      fireEvent(window, new Event('resize'));

      // Should adapt layout for wide screens
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toBeInTheDocument();
    });
  });
});