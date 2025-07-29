'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error for monitoring
    console.error('Health Questionnaire Error:', error, errorInfo);
    
    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetErrorBoundary={this.resetErrorBoundary} />;
      }

      return <DefaultErrorFallback error={this.state.error!} resetErrorBoundary={this.resetErrorBoundary} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full p-8 text-center shadow-lg">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">
              Oops! Algo deu errado
            </h2>
            <p className="text-gray-600">
              Encontramos um problema técnico com o questionário de saúde. 
              Seus dados estão seguros e não foram perdidos.
            </p>
          </div>

          <Alert className="text-left">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Erro técnico:</strong> {error.message}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button onClick={resetErrorBoundary} className="w-full" size="lg">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                <Home className="w-4 h-4 mr-2" />
                Início
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/suporte'}>
                <Phone className="w-4 h-4 mr-2" />
                Suporte
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 border-t pt-4">
            <p>Se o problema persistir, entre em contato com nossa equipe de suporte.</p>
            <p className="mt-1">Código de erro: {Date.now().toString(36).toUpperCase()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Hook for manual error reporting
export function useErrorHandler() {
  return (error: Error, errorInfo?: Record<string, unknown>) => {
    console.error('Manual error report:', error, errorInfo);
    
    // In production, send to error tracking
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  };
}