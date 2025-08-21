'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorCount } = this.state;

    // Call the onError callback if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      errorCount: errorCount + 1
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Auto-reset after 3 errors to prevent infinite loops
    if (errorCount >= 2) {
      this.scheduleReset(5000);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      // Reset on props change if enabled
      if (resetOnPropsChange && prevProps.children !== this.props.children) {
        this.resetErrorBoundary();
      }

      // Reset if resetKeys have changed
      if (resetKeys && this.previousResetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (key, index) => key !== this.previousResetKeys[index]
        );
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }
    }

    this.previousResetKeys = resetKeys || [];
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    });
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <CardTitle>Algo deu errado</CardTitle>
              </div>
              <CardDescription>
                Encontramos um erro inesperado. Por favor, tente novamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && error && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm font-mono text-red-800">
                    {error.toString()}
                  </p>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button
                  onClick={this.resetErrorBoundary}
                  className="w-full"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
                
                {errorCount > 1 && (
                  <p className="text-sm text-gray-600 text-center">
                    Erro ocorreu {errorCount} vezes. 
                    {errorCount >= 3 && ' Recarregando automaticamente...'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Specialized error boundary for health questionnaire
export class HealthQuestionnaireErrorBoundary extends ErrorBoundary {
  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="max-w-lg w-full shadow-xl">
            <CardHeader className="bg-blue-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <AlertCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    Erro no Questionário de Saúde
                  </CardTitle>
                  <CardDescription>
                    Houve um problema ao processar suas respostas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-3">
                <p className="text-gray-700">
                  Suas respostas foram salvas automaticamente. Você pode:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Tentar continuar de onde parou</li>
                  <li>Recarregar a página para começar novamente</li>
                  <li>Entrar em contato com o suporte se o erro persistir</li>
                </ul>
              </div>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="p-4 bg-gray-100 rounded-lg">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Detalhes do erro (desenvolvimento)
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                    {error.stack || error.toString()}
                  </pre>
                </details>
              )}
              
              <div className="flex flex-col gap-2">
                <Button
                  onClick={this.resetErrorBoundary}
                  className="w-full"
                  size="lg"
                  variant="primary"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Continuar Questionário
                </Button>
                
                <Button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  }}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Recarregar Página
                </Button>
              </div>

              <p className="text-xs text-center text-gray-500" suppressHydrationWarning>
                ID do erro: {Date.now().toString(36)}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Hook for functional components to catch errors
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  return { captureError, resetError };
}