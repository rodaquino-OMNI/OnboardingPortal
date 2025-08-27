/**
 * Chunk Error Recovery System
 * 
 * Handles ChunkLoadError in Next.js applications with:
 * - Automatic retry mechanism
 * - Cache busting
 * - Progressive fallback
 * - User notification
 */

interface ChunkErrorHandler {
  retry: () => Promise<void>;
  clearCache: () => void;
  reportError: (error: Error) => void;
}

class ChunkLoadErrorRecovery implements ChunkErrorHandler {
  private retryAttempts = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor() {
    this.setupGlobalErrorHandler();
  }

  private setupGlobalErrorHandler() {
    // Handle unhandled promise rejections (chunk load errors)
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isChunkLoadError(event.reason)) {
        event.preventDefault();
        this.handleChunkError(event.reason);
      }
    });

    // Handle script load errors
    window.addEventListener('error', (event) => {
      if (this.isChunkLoadError(event.error)) {
        event.preventDefault();
        this.handleChunkError(event.error);
      }
    }, true);
  }

  private isChunkLoadError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || error.toString();
    const chunkErrorPatterns = [
      'Loading chunk',
      'ChunkLoadError',
      'Loading CSS chunk',
      'Loading JS chunk',
      'Failed to import',
      'Network error',
      '_next/static/chunks',
      '404'
    ];

    return chunkErrorPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private async handleChunkError(error: Error) {
    console.warn('[ChunkRecovery] Chunk load error detected:', error);
    
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      console.log(`[ChunkRecovery] Retry attempt ${this.retryAttempts}/${this.maxRetries}`);
      
      try {
        await this.retry();
      } catch (retryError) {
        console.error('[ChunkRecovery] Retry failed:', retryError);
        
        if (this.retryAttempts >= this.maxRetries) {
          this.handleFinalFailure(error);
        }
      }
    } else {
      this.handleFinalFailure(error);
    }
  }

  private async handleFinalFailure(error: Error) {
    console.error('[ChunkRecovery] All retry attempts failed');
    
    // Clear all caches
    this.clearCache();
    
    // Show user-friendly error message
    this.showUserNotification();
    
    // Report error for monitoring
    this.reportError(error);
    
    // Force page reload as last resort
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  private showUserNotification() {
    // Create and show a non-intrusive notification
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 320px;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="font-weight: 600; margin-bottom: 8px;">
          🔄 Atualizando aplicação
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          Detectamos uma atualização. A página será recarregada automaticamente.
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after reload
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2500);
  }

  async retry(): Promise<void> {
    // Wait before retry with exponential backoff
    const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Clear caches
    this.clearCache();
    
    // Try to reload the current route
    if (typeof window !== 'undefined' && window.location) {
      // For Next.js, trigger a soft reload by changing the URL hash
      const currentUrl = new URL(window.location.href);
      const timestamp = Date.now();
      
      // Add cache-busting parameter
      currentUrl.searchParams.set('_reload', timestamp.toString());
      
      // Navigate to the same page with cache busting
      window.history.replaceState(null, '', currentUrl.toString());
      
      // Trigger a route refresh in Next.js
      if ('__NEXT_DATA__' in window) {
        window.location.reload();
      }
    }
  }

  clearCache(): void {
    try {
      // Clear browser caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            if (cacheName.includes('next') || cacheName.includes('chunk')) {
              caches.delete(cacheName);
            }
          });
        });
      }
      
      // Clear localStorage items related to Next.js
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('next') || key.includes('chunk'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('next') || key.includes('chunk'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
      console.log('[ChunkRecovery] Caches cleared');
    } catch (error) {
      console.warn('[ChunkRecovery] Error clearing caches:', error);
    }
  }

  reportError(error: Error): void {
    // Report to monitoring service (implement as needed)
    try {
      const errorData = {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        retryAttempts: this.retryAttempts
      };
      
      console.error('[ChunkRecovery] Error reported:', errorData);
      
      // Send to monitoring service if available
      if (typeof window !== 'undefined' && 'fetch' in window) {
        fetch('/api/error-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData)
        }).catch(() => {
          // Fail silently if error tracking endpoint is not available
        });
      }
    } catch (reportError) {
      console.warn('[ChunkRecovery] Failed to report error:', reportError);
    }
  }

  // Public method to manually trigger recovery
  public recover(): Promise<void> {
    this.retryAttempts = 0;
    return this.retry();
  }
}

// Global instance
let chunkRecovery: ChunkLoadErrorRecovery | null = null;

export function initializeChunkRecovery(): ChunkLoadErrorRecovery {
  if (typeof window === 'undefined') {
    // Return a no-op instance for SSR
    return {
      retry: async () => {},
      clearCache: () => {},
      reportError: () => {},
      recover: async () => {}
    } as any;
  }
  
  if (!chunkRecovery) {
    chunkRecovery = new ChunkLoadErrorRecovery();
  }
  
  return chunkRecovery;
}

export function getChunkRecovery(): ChunkLoadErrorRecovery | null {
  return chunkRecovery;
}

// React hook for using chunk recovery in components
export function useChunkRecovery() {
  const recovery = initializeChunkRecovery();
  
  return {
    recover: recovery.recover.bind(recovery),
    clearCache: recovery.clearCache.bind(recovery)
  };
}