'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorBoundary: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorBoundary: true // Flag to identify this as an error boundary
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Handle both client and server-side errors
    return { 
      hasError: true, 
      error,
      errorBoundary: true
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Safely handle errors that might occur during SSR
    try {
      console.error('Error caught by boundary:', error, errorInfo);
      
      // Check if we're in a browser environment before logging
      if (typeof window !== 'undefined') {
        // Report to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
          // TODO: Add Sentry or other error reporting
          console.error('Production error:', {
            error: error.toString(),
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (loggingError) {
      // Prevent infinite error loops during logging
      console.error('Error in error boundary logging:', loggingError);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Algo deu errado
            </h1>
            <p className="text-gray-600 mb-4">
              Ocorreu um erro inesperado. Por favor, recarregue a página.
            </p>
            {/* Only render the reload button on client-side */}
            {typeof window !== 'undefined' && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Recarregar Página
              </button>
            )}
            {/* Fallback for server-side rendering */}
            {typeof window === 'undefined' && (
              <p className="text-sm text-gray-500 mt-2">
                Por favor, recarregue a página manualmente.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}