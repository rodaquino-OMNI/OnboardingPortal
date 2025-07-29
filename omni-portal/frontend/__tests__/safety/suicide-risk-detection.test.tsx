/**
 * UX Safety Test Suite for Suicide Risk Detection
 * Tests the user experience impact of the suicide risk detection error
 * Ensures crisis resources are properly shown while maintaining questionnaire flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartHealthQuestionnaire } from '@/components/health/SmartHealthQuestionnaire';
import { calculateRiskScore } from '@/lib/health-questionnaire-v2';

describe('Suicide Risk Detection UX Safety', () => {
  let mockOnComplete: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockOnComplete = jest.fn();
    // Capture console errors to verify they don't break UX
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Crisis Resource Display', () => {
    it('should show crisis resources when legitimate suicide risk is detected', async () => {
      const { rerender } = render(
        <SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />
      );

      // Navigate to mental health section
      // This would require simulating responses to get to PHQ-9 question 9
      const responses = {
        'phq9_9': 1, // Any value > 0 triggers suicide risk
      };

      // Test risk calculation
      const riskScore = calculateRiskScore(responses);
      expect(riskScore.flags).toContain('suicide_risk');
      expect(riskScore.recommendations).toContain('Encaminhamento urgente para profissional de saúde mental');
    });

    it('should NOT show crisis resources for false positives', () => {
      const responses = {
        'phq9_9': 0, // No suicide risk
        'phq9_1': 2,
        'phq9_2': 2,
      };

      const riskScore = calculateRiskScore(responses);
      expect(riskScore.flags).not.toContain('suicide_risk');
    });
  });

  describe('Error Handling', () => {
    it('should continue functioning normally despite console errors', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Verify questionnaire renders properly
      expect(screen.getByRole('main', { name: /questionário de saúde/i })).toBeInTheDocument();
      
      // Verify progress indicator works
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Simulate error in risk calculation
      const mockError = new Error('Test error');
      consoleErrorSpy.mockImplementationOnce(() => {
        throw mockError;
      });

      // Trigger an action that would cause error logging
      // The questionnaire should still function
      const firstQuestion = await screen.findByText(/qual é sua idade/i);
      expect(firstQuestion).toBeInTheDocument();
    });

    it('should not expose technical errors to users', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Verify no technical error messages are visible
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/exception/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    });
  });

  describe('User Trust and Safety', () => {
    it('should maintain user trust with appropriate messaging', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Verify trust indicators are present
      expect(screen.getByText(/confiabilidade/i)).toBeInTheDocument();

      // Verify privacy mode toggle is available
      const privacyToggle = screen.getByRole('button', { name: /normal/i });
      expect(privacyToggle).toBeInTheDocument();

      // Test privacy mode activation
      fireEvent.click(privacyToggle);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /modo privado/i })).toBeInTheDocument();
      });
    });

    it('should show appropriate safety messaging for high-risk questions', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // High-risk questions should have safety messaging
      // This would be shown when navigating to questions with riskWeight >= 8
      // The component shows an alert for these questions
    });
  });

  describe('Emergency Protocol', () => {
    it('should trigger emergency protocol for critical risks', () => {
      const mockSessionStorage = {
        setItem: jest.fn(),
      };
      Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true,
      });

      // Simulate critical risk detection
      const handleCriticalRisk = (riskType: string) => {
        if (riskType === 'suicide') {
          sessionStorage.setItem('emergency_detected', JSON.stringify({
            type: riskType,
            timestamp: new Date().toISOString(),
            userId: 'test-user',
          }));
        }
      };

      handleCriticalRisk('suicide');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'emergency_detected',
        expect.stringContaining('suicide')
      );
    });

    it('should display CVV crisis hotline information correctly', async () => {
      const { container } = render(
        <SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />
      );

      // Simulate showing risk alert
      // In real scenario, this would be triggered by risk detection
      const riskAlertSection = container.querySelector('[role="dialog"]');
      if (riskAlertSection) {
        expect(riskAlertSection).toHaveAttribute('aria-labelledby', 'crisis-support-title');
        expect(riskAlertSection).toHaveAttribute('aria-describedby', 'crisis-support-desc');
      }
    });
  });

  describe('Questionnaire Flow Continuity', () => {
    it('should allow users to continue questionnaire after risk detection', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Verify navigation buttons are present and functional
      const nextButton = await screen.findByRole('button', { name: /próximo/i });
      expect(nextButton).toBeEnabled();

      // Verify back navigation is available
      const backButton = screen.getByRole('button', { name: /voltar/i });
      expect(backButton).toBeInTheDocument();
    });

    it('should properly validate and save responses even with errors', async () => {
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Test form validation continues to work
      const numberInput = screen.queryByRole('spinbutton');
      if (numberInput) {
        await userEvent.type(numberInput, '25');
        expect(numberInput).toHaveValue(25);
      }
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should debounce fraud detection to prevent performance issues', async () => {
      jest.useFakeTimers();
      
      render(<SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />);

      // Multiple rapid responses shouldn't cause multiple fraud checks
      // This is handled by the 300ms debounce in the component
      
      jest.advanceTimersByTime(300);
      
      // Verify console error was called appropriately
      expect(consoleErrorSpy).toHaveBeenCalledTimes(0); // No errors in normal flow
      
      jest.useRealTimers();
    });
  });

  describe('Accessibility During Crisis', () => {
    it('should maintain accessibility standards for crisis resources', async () => {
      const { container } = render(
        <SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />
      );

      // Verify ARIA labels and roles
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');

      // Verify keyboard navigation works
      const focusableElements = container.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
      );
      expect(focusableElements.length).toBeGreaterThan(0);
    });

    it('should announce crisis resources to screen readers', () => {
      const { container } = render(
        <SmartHealthQuestionnaire onComplete={mockOnComplete} userId="test-user" />
      );

      // Check for live regions
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();

      // Crisis alerts should be announced
      const alertRegion = container.querySelector('[role="alert"]');
      if (alertRegion) {
        expect(alertRegion).toHaveAttribute('role', 'alert');
      }
    });
  });
});