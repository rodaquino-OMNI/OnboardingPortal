/**
 * Secure Configuration Service
 * This service fetches configuration from the backend to avoid exposing
 * sensitive environment variables in the client-side code
 */

interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'production' | 'development';
    locale: string;
    timezone: string;
  };
  features: {
    registration: {
      enabled: boolean;
      multi_step: boolean;
      social_login: boolean;
    };
    documents: {
      enabled: boolean;
      ocr_enabled: boolean;
      max_file_size: number;
      allowed_types: string[];
    };
    video_conferencing: {
      enabled: boolean;
      max_duration: number;
    };
    gamification: {
      enabled: boolean;
      points_enabled: boolean;
      badges_enabled: boolean;
    };
    analytics: {
      enabled: boolean;
    };
    monitoring: {
      enabled: boolean;
    };
  };
  security: {
    session_timeout: number;
    session_warning_time: number;
    password_requirements: {
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_numbers: boolean;
      require_symbols: boolean;
    };
    two_factor_enabled: boolean;
  };
  api: {
    version: string;
    timeout: number;
    rate_limits: {
      per_minute: number;
    };
  };
  social_providers: string[];
  locales: {
    available: string[];
    default: string;
  };
  urls: {
    terms: string;
    privacy: string;
    support: string;
  };
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;
  private loading: Promise<AppConfig> | null = null;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get configuration from backend
   * This method caches the configuration to avoid multiple requests
   */
  async getConfig(): Promise<AppConfig> {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    // Return existing loading promise if in progress
    if (this.loading) {
      return this.loading;
    }

    // Start loading configuration
    this.loading = this.loadConfig();
    
    try {
      this.config = await this.loading;
      return this.config;
    } finally {
      this.loading = null;
    }
  }

  /**
   * Load configuration from backend
   */
  private async loadConfig(): Promise<AppConfig> {
    try {
      // In development, use local API URL
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8000' 
        : '';
      
      const response = await fetch(`${baseUrl}/api/config/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.config) {
        throw new Error('Invalid configuration response');
      }

      return data.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      
      // Return default configuration as fallback
      return this.getDefaultConfig();
    }
  }

  /**
   * Get default configuration
   * Used as fallback when backend is unavailable
   */
  private getDefaultConfig(): AppConfig {
    return {
      app: {
        name: 'AUSTA Health Portal',
        version: '1.0.0',
        environment: process.env.NODE_ENV as 'production' | 'development',
        locale: 'pt-BR',
        timezone: 'America/Sao_Paulo',
      },
      features: {
        registration: {
          enabled: true,
          multi_step: true,
          social_login: false, // Disabled by default for security
        },
        documents: {
          enabled: true,
          ocr_enabled: true,
          max_file_size: 10485760, // 10MB
          allowed_types: ['jpg', 'jpeg', 'png', 'pdf'],
        },
        video_conferencing: {
          enabled: true,
          max_duration: 3600, // 1 hour
        },
        gamification: {
          enabled: true,
          points_enabled: true,
          badges_enabled: true,
        },
        analytics: {
          enabled: false, // Disabled by default for privacy
        },
        monitoring: {
          enabled: false, // Disabled by default for privacy
        },
      },
      security: {
        session_timeout: 3600000, // 1 hour
        session_warning_time: 300000, // 5 minutes
        password_requirements: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_symbols: true,
        },
        two_factor_enabled: true,
      },
      api: {
        version: 'v1',
        timeout: 30000,
        rate_limits: {
          per_minute: 60,
        },
      },
      social_providers: [],
      locales: {
        available: ['pt-BR', 'en', 'es'],
        default: 'pt-BR',
      },
      urls: {
        terms: '/terms',
        privacy: '/privacy',
        support: '/support',
      },
    };
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.config = null;
  }

  /**
   * Get specific configuration value
   */
  async get<T = any>(path: string): Promise<T> {
    const config = await this.getConfig();
    return this.getValueByPath(config, path);
  }

  /**
   * Get value by dot notation path
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();

// Export config type
export type { AppConfig };

// Helper functions for common config access
export async function getApiUrl(): Promise<string> {
  // For API URL, we still use a minimal environment variable
  // but it only contains the base URL, not sensitive data
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
}

export async function getAppName(): Promise<string> {
  const config = await configService.getConfig();
  return config.app.name;
}

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  return configService.get<boolean>(`features.${feature}.enabled`);
}

export async function getSecurityConfig(): Promise<AppConfig['security']> {
  const config = await configService.getConfig();
  return config.security;
}

// React hook for using config
import { useEffect, useState } from 'react';

export function useConfig(): {
  config: AppConfig | null;
  loading: boolean;
  error: Error | null;
} {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    configService.getConfig()
      .then(setConfig)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { config, loading, error };
}