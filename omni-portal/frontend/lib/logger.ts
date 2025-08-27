/**
 * Production-safe logging utility
 * Replaces direct console.* calls with environment-aware logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: any;
  timestamp: Date;
  component?: string;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';
  
  private minLevel: LogLevel = this.isProduction 
    ? LogLevel.ERROR 
    : LogLevel.DEBUG;

  /**
   * Debug logging - only in development
   */
  debug(message: string, context?: any, component?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log({
        level: LogLevel.DEBUG,
        message,
        context,
        timestamp: new Date(),
        component,
      });
    }
  }

  /**
   * Info logging - development and staging
   */
  info(message: string, context?: any, component?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log({
        level: LogLevel.INFO,
        message,
        context,
        timestamp: new Date(),
        component,
      });
    }
  }

  /**
   * Warning logging - all environments
   */
  warn(message: string, context?: any, component?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log({
        level: LogLevel.WARN,
        message,
        context,
        timestamp: new Date(),
        component,
      });
    }
  }

  /**
   * Error logging - all environments, always shown
   */
  error(message: string, error?: Error | any, context?: any, component?: string): void {
    const logEntry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      context: {
        error: error?.message || error,
        stack: error?.stack,
        ...context,
      },
      timestamp: new Date(),
      component,
    };

    this.log(logEntry);
    
    // In production, also send to monitoring service
    if (this.isProduction) {
      this.sendToMonitoring(logEntry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private log(entry: LogEntry): void {
    const { level, message, context, timestamp, component } = entry;
    
    // Format message with component and timestamp
    const formattedMessage = [
      `[${timestamp.toISOString()}]`,
      component ? `[${component}]` : '',
      message,
    ].filter(Boolean).join(' ');

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.log(`🔍 DEBUG: ${formattedMessage}`, context || '');
        }
        break;
      
      case LogLevel.INFO:
        if (!this.isProduction) {
          console.info(`ℹ️ INFO: ${formattedMessage}`, context || '');
        }
        break;
      
      case LogLevel.WARN:
        console.warn(`⚠️ WARN: ${formattedMessage}`, context || '');
        break;
      
      case LogLevel.ERROR:
        console.error(`❌ ERROR: ${formattedMessage}`, context || '');
        break;
    }
  }

  private sendToMonitoring(entry: LogEntry): void {
    // TODO: Implement monitoring service integration
    // This could be Sentry, LogRocket, or another service
    try {
      // Example: Sentry.captureException(entry);
      // For now, we'll keep it as console.error in production for critical errors
    } catch (monitoringError) {
      // Fallback to console if monitoring fails
      console.error('Monitoring service failed:', monitoringError);
    }
  }

  /**
   * Create a component-specific logger
   */
  createComponentLogger(componentName: string) {
    return {
      debug: (message: string, context?: any) => this.debug(message, context, componentName),
      info: (message: string, context?: any) => this.info(message, context, componentName),
      warn: (message: string, context?: any) => this.warn(message, context, componentName),
      error: (message: string, error?: Error | any, context?: any) => 
        this.error(message, error, context, componentName),
    };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export component logger factory
export const createLogger = (componentName: string) => 
  logger.createComponentLogger(componentName);

// Development helper for migration
export const devConsole = {
  log: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(message, ...args);
  },
};