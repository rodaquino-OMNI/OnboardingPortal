import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface HealthStatus {
  frontend: {
    status: 'healthy' | 'degraded' | 'offline';
    responseTime: number;
  };
  backend: {
    status: 'healthy' | 'degraded' | 'offline';
    responseTime: number;
    checks?: {
      database: boolean;
      cache: boolean;
      session: boolean;
      storage: boolean;
    };
  };
  lastChecked: Date;
}

export function useApiHealth(intervalMs: number = 30000) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    const startTime = Date.now();

    try {
      // Check backend health
      const response = await api.get('/api/health');
      const backendTime = Date.now() - startTime;

      setHealth({
        frontend: {
          status: 'healthy',
          responseTime: 0, // Frontend is running if this code executes
        },
        backend: {
          status: response.data.status === 'healthy' ? 'healthy' : 'degraded',
          responseTime: backendTime,
          checks: response.data.checks,
        },
        lastChecked: new Date(),
      });
    } catch (error) {
      const backendTime = Date.now() - startTime;
      
      setHealth({
        frontend: {
          status: 'healthy',
          responseTime: 0,
        },
        backend: {
          status: 'offline',
          responseTime: backendTime,
        },
        lastChecked: new Date(),
      });
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, intervalMs);

    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return { health, isChecking, refresh: checkHealth };
}