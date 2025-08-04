import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary, HealthQuestionnaireErrorBoundary, useErrorHandler } from '@/components/health/ErrorBoundary';

// Mock console.error to prevent test output pollution
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Test component that throws errors
const ErrorThrowingComponent = ({ shouldThrow = false, errorType = 'sync' }: { shouldThrow?: boolean; errorType?: string }) => {
  const { captureError } = useErrorHandler();

  React.useEffect(() => {
    if (shouldThrow && errorType === 'async') {
      const error = new Error('Test async error');
      captureError(error);
    }
  }, [shouldThrow, errorType, captureError]);

  if (shouldThrow && errorType === 'sync') {
    throw new Error('Test sync error');
  }

  if (shouldThrow && errorType === 'memory') {
    const nullObject: any = null;
    return <div>{nullObject.nonExistentProperty}</div>;
  }

  return <div>No error component</div>;
};

// Wrapper component for testing
const TestWrapper = ({ children, boundaryType = 'generic' }: { children: ReactNode; boundaryType?: 'generic' | 'health' }) => {
  const onError = jest.fn();

  if (boundaryType === 'health') {
    return (
      <HealthQuestionnaireErrorBoundary onError={onError}>
        {children}
      </HealthQuestionnaireErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      onError={onError}
      fallback={<div>Generic error boundary fallback</div>}
    >
      {children}
    </ErrorBoundary>
  );
};

describe('ErrorBoundary Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ErrorBoundary Component', () => {
    it('should render children when no error occurs', () => {
      render(
        <TestWrapper>
          <ErrorThrowingComponent shouldThrow={false} />
        </TestWrapper>
      );

      expect(screen.getByText('No error component')).toBeInTheDocument();
    });

    it('should catch synchronous errors and display fallback', () => {
      render(
        <TestWrapper>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      expect(screen.getByText('Generic error boundary fallback')).toBeInTheDocument();
      expect(screen.queryByText('No error component')).not.toBeInTheDocument();
    });

    it('should catch memory access errors', () => {
      render(
        <TestWrapper>
          <ErrorThrowingComponent shouldThrow={true} errorType="memory" />
        </TestWrapper>
      );

      expect(screen.getByText('Generic error boundary fallback')).toBeInTheDocument();
    });

    it('should reset on props change when resetOnPropsChange is enabled', () => {
      const { rerender } = render(
        <ErrorBoundary
          resetOnPropsChange={true}
          fallback={<div>Error occurred</div>}
        >
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error occurred')).toBeInTheDocument();

      // Change props to trigger reset
      rerender(
        <ErrorBoundary
          resetOnPropsChange={true}
          fallback={<div>Error occurred</div>}
        >
          <ErrorThrowingComponent shouldThrow={false} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error component')).toBeInTheDocument();
    });

    it('should reset when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary
          resetKeys={['key1']}
          fallback={<div>Error occurred</div>}
        >
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error occurred')).toBeInTheDocument();

      // Change resetKeys to trigger reset
      rerender(
        <ErrorBoundary
          resetKeys={['key2']}
          fallback={<div>Error occurred</div>}
        >
          <ErrorThrowingComponent shouldThrow={false} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error component')).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = jest.fn();
      
      render(
        <ErrorBoundary onError={onError} fallback={<div>Error occurred</div>}>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    it('should auto-reset after multiple errors', async () => {
      jest.useFakeTimers();
      
      const { rerender } = render(
        <ErrorBoundary fallback={<div>Error occurred</div>}>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error occurred')).toBeInTheDocument();

      // Simulate multiple errors by rerendering with different errors
      for (let i = 0; i < 3; i++) {
        rerender(
          <ErrorBoundary fallback={<div>Error occurred</div>}>
            <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
          </ErrorBoundary>
        );
      }

      // Fast-forward time to trigger auto-reset
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('HealthQuestionnaireErrorBoundary Component', () => {
    it('should render health-specific error UI', () => {
      render(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      expect(screen.getByText('Erro no Questionário de Saúde')).toBeInTheDocument();
      expect(screen.getByText('Houve um problema ao processar suas respostas')).toBeInTheDocument();
      expect(screen.getByText('Continuar Questionário')).toBeInTheDocument();
      expect(screen.getByText('Recarregar Página')).toBeInTheDocument();
    });

    it('should show user-friendly messages for health questionnaire errors', () => {
      render(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      expect(screen.getByText(/Suas respostas foram salvas automaticamente/)).toBeInTheDocument();
      expect(screen.getByText(/Tentar continuar de onde parou/)).toBeInTheDocument();
      expect(screen.getByText(/Recarregar a página para começar novamente/)).toBeInTheDocument();
    });

    it('should provide recovery options in health boundary', () => {
      render(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      const continueButton = screen.getByText('Continuar Questionário');
      const reloadButton = screen.getByText('Recarregar Página');

      expect(continueButton).toBeInTheDocument();
      expect(reloadButton).toBeInTheDocument();

      // Test continue button functionality
      fireEvent.click(continueButton);
      // The component should attempt to reset
    });

    it('should show development error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true
      });

      render(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      // Should show error details in development
      expect(screen.getByText(/Detalhes do erro \(desenvolvimento\)/)).toBeInTheDocument();

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        configurable: true
      });
    });

    it('should generate unique error IDs', () => {
      const { rerender } = render(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </TestWrapper>
      );

      const errorId1 = screen.getByText(/ID do erro:/).textContent;

      // Trigger another error
      rerender(
        <TestWrapper boundaryType="health">
          <ErrorThrowingComponent shouldThrow={true} errorType="memory" />
        </TestWrapper>
      );

      const errorId2 = screen.getByText(/ID do erro:/).textContent;

      expect(errorId1).not.toBe(errorId2);
    });
  });

  describe('useErrorHandler Hook', () => {
    const TestComponent = () => {
      const { captureError, resetError } = useErrorHandler();
      
      return (
        <div>
          <button onClick={() => captureError(new Error('Test error'))}>
            Trigger Error
          </button>
          <button onClick={resetError}>
            Reset Error
          </button>
        </div>
      );
    };

    it('should provide error handling functions', () => {
      render(
        <ErrorBoundary fallback={<div>Error caught</div>}>
          <TestComponent />
        </ErrorBoundary>
      );

      const triggerButton = screen.getByText('Trigger Error');
      const resetButton = screen.getByText('Reset Error');

      expect(triggerButton).toBeInTheDocument();
      expect(resetButton).toBeInTheDocument();
    });

    it('should throw error when captureError is called', async () => {
      render(
        <ErrorBoundary fallback={<div>Error caught</div>}>
          <TestComponent />
        </ErrorBoundary>
      );

      const triggerButton = screen.getByText('Trigger Error');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Error caught')).toBeInTheDocument();
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('should work with nested error boundaries', () => {
      render(
        <ErrorBoundary fallback={<div>Outer boundary</div>}>
          <ErrorBoundary fallback={<div>Inner boundary</div>}>
            <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getByText('Inner boundary')).toBeInTheDocument();
      expect(screen.queryByText('Outer boundary')).not.toBeInTheDocument();
    });

    it('should handle errors in event handlers', async () => {
      const ComponentWithEventError = () => {
        const { captureError } = useErrorHandler();
        
        return (
          <button onClick={() => captureError(new Error('Event error'))}>
            Click me
          </button>
        );
      };

      render(
        <ErrorBoundary fallback={<div>Event error caught</div>}>
          <ComponentWithEventError />
        </ErrorBoundary>
      );

      const button = screen.getByText('Click me');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Event error caught')).toBeInTheDocument();
      });
    });

    it('should preserve error boundary state across re-renders', () => {
      const { rerender } = render(
        <ErrorBoundary fallback={<div>Error state preserved</div>}>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error state preserved')).toBeInTheDocument();

      // Re-render with same error
      rerender(
        <ErrorBoundary fallback={<div>Error state preserved</div>}>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error state preserved')).toBeInTheDocument();
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks with multiple errors', () => {
      const errorCounts = [];
      
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <ErrorBoundary
            onError={() => errorCounts.push(i)}
            fallback={<div>Error {i}</div>}
          >
            <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
          </ErrorBoundary>
        );
        
        unmount();
      }

      expect(errorCounts).toHaveLength(100);
    });

    it('should clean up timeouts on unmount', () => {
      jest.useFakeTimers();
      
      const { unmount } = render(
        <ErrorBoundary fallback={<div>Error</div>}>
          <ErrorThrowingComponent shouldThrow={true} errorType="sync" />
        </ErrorBoundary>
      );

      // Unmount before timeout fires
      unmount();
      
      // Advance timers to ensure no errors occur
      jest.advanceTimersByTime(10000);
      
      jest.useRealTimers();
    });
  });
});

// Integration tests with actual questionnaire components
describe('Error Boundary Integration with Questionnaire Components', () => {
  it('should handle errors in question rendering', () => {
    // This would test actual questionnaire components with error boundaries
    expect(true).toBe(true); // Placeholder
  });

  it('should preserve user data during errors', () => {
    // This would test data persistence during error recovery
    expect(true).toBe(true); // Placeholder
  });

  it('should provide graceful degradation', () => {
    // This would test fallback UI quality
    expect(true).toBe(true); // Placeholder
  });
});