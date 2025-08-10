// Authentication Diagnostics Module
// This module tracks all auth-related events to identify redirect issues

interface AuthEvent {
  timestamp: number;
  type: string;
  location: string;
  data: any;
  stackTrace?: string;
}

class AuthDiagnostics {
  private events: AuthEvent[] = [];
  private isEnabled = true;

  log(type: string, location: string, data: any) {
    if (!this.isEnabled) return;
    
    const event: AuthEvent = {
      timestamp: Date.now(),
      type,
      location,
      data,
      stackTrace: new Error().stack
    };
    
    this.events.push(event);
    
    // Console output with color coding
    const color = this.getColorForType(type);
    console.log(
      `%c[AUTH-DIAG] ${new Date().toISOString()} | ${location} | ${type}`,
      `color: ${color}; font-weight: bold`,
      data
    );
    
    // Store in sessionStorage for persistence
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('auth-diagnostics', JSON.stringify(this.events.slice(-50)));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }
  
  private getColorForType(type: string): string {
    switch(type) {
      case 'REDIRECT': return '#ff0000';
      case 'AUTH_CHECK': return '#0066cc';
      case 'STATE_CHANGE': return '#009900';
      case 'COOKIE_CHECK': return '#ff9900';
      case 'API_CALL': return '#9900ff';
      case 'ERROR': return '#cc0000';
      default: return '#666666';
    }
  }
  
  getEvents(): AuthEvent[] {
    return this.events;
  }
  
  getReport(): string {
    const report = this.events.map(e => 
      `${new Date(e.timestamp).toISOString()} | ${e.location} | ${e.type} | ${JSON.stringify(e.data)}`
    ).join('\n');
    
    return report;
  }
  
  clear() {
    this.events = [];
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth-diagnostics');
    }
  }
  
  // Load previous events from storage
  loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('auth-diagnostics');
        if (stored) {
          this.events = JSON.parse(stored);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
}

export const authDiag = new AuthDiagnostics();

// Auto-load on import
if (typeof window !== 'undefined') {
  authDiag.loadFromStorage();
  
  // Add global access for debugging
  (window as any).authDiag = authDiag;
  
  console.log('%c[AUTH-DIAG] Diagnostics module loaded. Use window.authDiag.getReport() to see all events', 'color: #0066cc; font-weight: bold');
}