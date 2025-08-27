'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class HealthQuestionnaireErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[HealthQuestionnaireErrorBoundary] Error caught:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleNavigateHome = () => {
    window.location.href = '/home';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Ops! Algo deu errado
              </h2>
              <p className="text-gray-600">
                Encontramos um erro ao processar sua avaliação de saúde.
              </p>
              {this.state.error && (
                <p className="text-sm text-red-600 mt-4 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={this.handleNavigateHome}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ir para Início
              </Button>
              <Button
                onClick={this.handleReset}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left mt-6 p-4 bg-gray-100 rounded-lg">
                <summary className="cursor-pointer font-semibold text-sm text-gray-700">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="mt-2 text-xs overflow-auto text-gray-600">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}