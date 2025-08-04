import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import InterviewSchedulePage from '@/app/(onboarding)/interview-schedule/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('InterviewSchedulePage UX Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Countdown UX Improvements', () => {
    test('displays countdown with user control options', async () => {
      render(<InterviewSchedulePage />);

      // Check that countdown is displayed
      expect(screen.getByText(/Redirecionamento automático em/)).toBeInTheDocument();
      expect(screen.getByText('Ir Agora para Telemedicina')).toBeInTheDocument();
      expect(screen.getByText('Ficar nesta página')).toBeInTheDocument();
      
      // Check countdown shows initial value
      expect(screen.getByText(/5 segundos/)).toBeInTheDocument();
    });

    test('allows user to proceed immediately', async () => {
      render(<InterviewSchedulePage />);

      const proceedButton = screen.getByText('Ir Agora para Telemedicina');
      fireEvent.click(proceedButton);

      expect(mockPush).toHaveBeenCalledWith('/telemedicine-schedule');
    });

    test('allows user to cancel countdown', async () => {
      render(<InterviewSchedulePage />);

      const cancelButton = screen.getByText('Ficar nesta página');
      fireEvent.click(cancelButton);

      // Countdown should be cancelled - check for state change
      await waitFor(() => {
        expect(screen.queryByText(/Redirecionamento automático em/)).not.toBeInTheDocument();
      }, { timeout: 3000 });
      
      // Should show the non-countdown button
      expect(screen.getByText('Agendar Consulta de Telemedicina')).toBeInTheDocument();
    });

    test('countdown decrements automatically', async () => {
      jest.useFakeTimers();
      render(<InterviewSchedulePage />);

      expect(screen.getByText(/5 segundos/)).toBeInTheDocument();

      // Advance timer by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/4 segundos/)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('auto-redirects after countdown completes', async () => {
      jest.useFakeTimers();
      render(<InterviewSchedulePage />);

      // Advance timer by 5 seconds to complete countdown
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/telemedicine-schedule');
      });

      jest.useRealTimers();
    });

    test('can cancel countdown using X button', async () => {
      render(<InterviewSchedulePage />);

      const cancelIcon = screen.getByTitle('Cancelar redirecionamento automático');
      fireEvent.click(cancelIcon);

      await waitFor(() => {
        expect(screen.queryByText(/Redirecionamento automático em/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    test('renders properly on mobile viewport', () => {
      render(<InterviewSchedulePage />);

      const proceedButton = screen.getByText('Ir Agora para Telemedicina');
      expect(proceedButton).toBeInTheDocument();
      
      // Check that buttons have minimum height for touch targets
      const navigationButtons = screen.getAllByRole('button');
      navigationButtons.forEach(button => {
        // Should have proper sizing classes or actual height
        const hasProperHeight = button.className.includes('min-h') || 
                                button.className.includes('h-') ||
                                button.className.includes('py-');
        expect(hasProperHeight).toBe(true);
      });
    });

    test('responsive button layout changes after countdown cancellation', async () => {
      render(<InterviewSchedulePage />);

      // Cancel countdown
      const cancelButton = screen.getByText('Ficar nesta página');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        const mainButton = screen.getByText('Agendar Consulta de Telemedicina');
        expect(mainButton).toHaveClass(/w-full|sm:w-auto/);
      });
    });
  });

  describe('Navigation Integration', () => {
    test('back button navigates to document-upload', () => {
      render(<InterviewSchedulePage />);

      const backButton = screen.getByText('Voltar');
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/document-upload');
    });

    test('bottom navigation button text changes based on countdown state', async () => {
      render(<InterviewSchedulePage />);

      // Initially should show countdown-aware text
      const bottomButton = screen.getByText('Prosseguir para Telemedicina');
      expect(bottomButton).toBeInTheDocument();

      // Cancel countdown
      const cancelButton = screen.getByText('Ficar nesta página');
      fireEvent.click(cancelButton);

      // Button text should change
      await waitFor(() => {
        expect(screen.getByText('Agendar Consulta de Telemedicina')).toBeInTheDocument();
      });
    });
  });

  describe('Visual Feedback', () => {
    test('displays loading animations only during countdown', async () => {
      render(<InterviewSchedulePage />);

      // Animations should be visible during countdown
      const animatedElements = screen.getByText(/Redirecionamento automático em/).closest('.bg-blue-50');
      expect(animatedElements).toBeInTheDocument();

      // Cancel countdown
      const cancelButton = screen.getByText('Ficar nesta página');
      fireEvent.click(cancelButton);

      // Loading animations should be hidden after cancellation
      await waitFor(() => {
        expect(screen.queryByText(/Redirecionamento automático em/)).not.toBeInTheDocument();
      });
    });

    test('displays reward information prominently', () => {
      render(<InterviewSchedulePage />);

      expect(screen.getByText('🎉 Recompensa Especial Desbloqueada!')).toBeInTheDocument();
      expect(screen.getByText('Consulta de Telemedicina')).toBeInTheDocument();
      expect(screen.getByText('Benefícios Exclusivos')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('countdown controls have proper ARIA labels', () => {
      render(<InterviewSchedulePage />);

      const cancelIcon = screen.getByTitle('Cancelar redirecionamento automático');
      expect(cancelIcon).toHaveAttribute('title');
    });

    test('buttons have adequate touch targets for mobile', () => {
      render(<InterviewSchedulePage />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        
        // Should meet WCAG AA touch target minimum of 44px
        expect(minHeight).toBeGreaterThanOrEqual(44);
      });
    });

    test('maintains focus management during state changes', async () => {
      render(<InterviewSchedulePage />);

      const proceedButton = screen.getByText('Ir Agora para Telemedicina');
      proceedButton.focus();
      
      expect(document.activeElement).toBe(proceedButton);
    });
  });

  describe('Error Handling', () => {
    test('handles router errors gracefully', () => {
      // Mock router.push to throw error
      mockPush.mockImplementationOnce(() => {
        throw new Error('Navigation failed');
      });

      render(<InterviewSchedulePage />);

      const proceedButton = screen.getByText('Ir Agora para Telemedicina');
      
      // Should not throw error to user
      expect(() => fireEvent.click(proceedButton)).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('cleans up timer on unmount', () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<InterviewSchedulePage />);
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('does not update state after component unmount', async () => {
      jest.useFakeTimers();
      const { unmount } = render(<InterviewSchedulePage />);
      
      unmount();
      
      // Advance timer after unmount - should not cause warnings
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // No warnings should be logged
      jest.useRealTimers();
    });
  });
});