'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getChunkRecovery } from '@/lib/chunk-error-recovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasChunkError: boolean;
  isRecovering: boolean;
  error?: Error;
}

/**
 * Specialized Error Boundary for handling ChunkLoadError specifically
 * 
 * Features:
 * - Detects chunk loading failures
 * - Triggers automatic recovery
 * - Shows user-friendly fallback UI
 * - Integrates with chunk recovery system
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 2;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasChunkError: false,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): State | null {
    // Check if this is a chunk loading error
    if (ChunkErrorBoundary.isChunkError(error)) {
      return {
        hasChunkError: true,
        isRecovering: false,
        error
      };
    }
    
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (ChunkErrorBoundary.isChunkError(error)) {
      console.error('[ChunkErrorBoundary] Chunk loading error caught:', error);
      console.error('Error info:', errorInfo);
      
      // Trigger recovery
      this.handleChunkError(error);
    }
  }

  private static isChunkError(error: Error): boolean {
    const message = error.message || error.toString();
    const chunkErrorPatterns = [
      'Loading chunk',
      'ChunkLoadError',
      'Loading CSS chunk',
      'Loading JS chunk',
      'Failed to import',
      'Cannot access before initialization',
      'Loading failed for module',
      '_next/static/chunks'
    ];

    return chunkErrorPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private async handleChunkError(error: Error) {
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('[ChunkErrorBoundary] Max recovery attempts reached');
      return;
    }

    this.recoveryAttempts++;
    
    this.setState({ isRecovering: true });

    try {
      // Get the chunk recovery service
      const chunkRecovery = getChunkRecovery();
      
      if (chunkRecovery) {
        console.log(`[ChunkErrorBoundary] Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})`);
        
        // Clear caches and retry
        chunkRecovery.clearCache();
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reset error state to retry rendering
        this.setState({
          hasChunkError: false,
          isRecovering: false
        });
        
      } else {
        // Fallback: force page reload
        console.warn('[ChunkErrorBoundary] Chunk recovery service not available, reloading page');
        setTimeout(() => window.location.reload(), 2000);
      }
      
    } catch (recoveryError) {
      console.error('[ChunkErrorBoundary] Recovery failed:', recoveryError);
      
      // Ultimate fallback: reload page
      setTimeout(() => window.location.reload(), 3000);
    }
  }

  private handleRetry = () => {
    this.handleChunkError(this.state.error!);
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasChunkError) {
      if (this.state.isRecovering) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-md w-full mx-4 text-center">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  🔄 Atualizando aplicação
                </h2>
                <p className="text-gray-600 mb-4">
                  Detectamos uma atualização necessária. Por favor, aguarde um momento...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse w-3/4"></div>
                </div>
                <p className="text-sm text-gray-500">
                  Tentativa {this.recoveryAttempts} de {this.maxRecoveryAttempts}
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                ⚠️ Erro de carregamento
              </h2>
              
              <p className="text-gray-600 mb-6">
                Ocorreu um problema ao carregar a aplicação. Isso pode ser devido a uma atualização recente.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  disabled={this.recoveryAttempts >= this.maxRecoveryAttempts}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {this.recoveryAttempts >= this.maxRecoveryAttempts ? 'Máximo de tentativas atingido' : '🔄 Tentar novamente'}
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  🔃 Recarregar página
                </button>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Detalhes técnicos
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                    {this.state.error?.message}
                    {'\n\n'}
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}