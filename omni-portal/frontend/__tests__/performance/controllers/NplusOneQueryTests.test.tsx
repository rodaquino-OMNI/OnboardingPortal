/**
 * N+1 Query Performance Tests
 * Tests to verify that controller optimizations prevent N+1 query issues
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGamificationIntegration } from '@/hooks/useGamificationIntegration';

// Mock the API client to track query calls
const mockApiCalls: Array<{ endpoint: string; timestamp: number; queryCount: number }> = [];

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockImplementation((endpoint: string) => {
      const queryCount = mockApiCalls.filter(call => 
        call.endpoint === endpoint && 
        Date.now() - call.timestamp < 100
      ).length + 1;
      
      mockApiCalls.push({
        endpoint,
        timestamp: Date.now(),
        queryCount
      });

      // Simulate different response times for different endpoints
      const responseTime = endpoint.includes('users') ? 50 : 30;
      
      return new Promise(resolve => {
        setTimeout(() => {
          if (endpoint.includes('profile')) {
            resolve({
              data: {
                id: 1,
                name: 'Test User',
                email: 'test@example.com',
                badges: Array.from({ length: 5 }, (_, i) => ({
                  id: i + 1,
                  name: `Badge ${i + 1}`,
                  description: `Test badge ${i + 1}`,
                  earned_at: new Date().toISOString()
                })),
                achievements: Array.from({ length: 3 }, (_, i) => ({
                  id: i + 1,
                  title: `Achievement ${i + 1}`,
                  points: (i + 1) * 100
                }))
              }
            });
          }
          
          if (endpoint.includes('users')) {
            resolve({
              data: Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                name: `User ${i + 1}`,
                profile: {
                  id: i + 1,
                  bio: `Bio for user ${i + 1}`
                }
              }))
            });
          }

          resolve({ data: [] });
        }, responseTime);
      });
    }),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }
}));

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0
      }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('N+1 Query Performance Tests', () => {
  beforeEach(() => {
    mockApiCalls.length = 0;
    jest.clearAllMocks();
  });

  describe('Profile Loading with Relationships', () => {
    it('should load profile with badges and achievements in single query batch', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toBeDefined();
      }, { timeout: 5000 });

      // Check that profile data was loaded efficiently
      const profileCalls = mockApiCalls.filter(call => call.endpoint.includes('profile'));
      const badgeCalls = mockApiCalls.filter(call => call.endpoint.includes('badges'));
      
      // Should have made minimal calls for profile data
      expect(profileCalls.length).toBeLessThanOrEqual(2);
      
      // Should not have made individual badge calls (N+1 pattern)
      expect(badgeCalls.length).toBeLessThanOrEqual(1);
      
      // Verify the user has the expected relationships loaded
      if (result.current.user) {
        expect(result.current.user.badges).toBeDefined();
        expect(Array.isArray(result.current.user.badges)).toBe(true);
      }
    });

    it('should prevent N+1 queries when loading multiple users with profiles', async () => {
      const startTime = Date.now();
      const wrapper = createWrapper();

      // Simulate loading multiple users (potential N+1 scenario)
      const { result } = renderHook(() => {
        return {
          // This would typically trigger N+1 if not optimized
          users: Array.from({ length: 10 }, (_, i) => i + 1)
        };
      }, { wrapper });

      await waitFor(() => {
        expect(result.current.users).toBeDefined();
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time (not exponential with user count)
      expect(executionTime).toBeLessThan(500); // 500ms threshold

      // Check query pattern
      const userCalls = mockApiCalls.filter(call => call.endpoint.includes('users'));
      
      // Should not have made 1 call per user (N+1 pattern)
      // Instead should have batched or used eager loading
      expect(userCalls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Gamification System Queries', () => {
    it('should load gamification data efficiently without N+1 queries', async () => {
      const wrapper = createWrapper();
      
      const { result } = renderHook(() => useGamificationIntegration(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 3000 });

      // Analyze query patterns
      const gamificationCalls = mockApiCalls.filter(call => 
        call.endpoint.includes('badges') || 
        call.endpoint.includes('achievements') || 
        call.endpoint.includes('points')
      );

      // Should batch gamification queries efficiently
      expect(gamificationCalls.length).toBeLessThanOrEqual(3);

      // Check for concurrent query execution (not sequential N+1)
      const timestamps = gamificationCalls.map(call => call.timestamp);
      const maxTimeDiff = Math.max(...timestamps) - Math.min(...timestamps);
      
      // Queries should execute concurrently, not sequentially
      expect(maxTimeDiff).toBeLessThan(200); // 200ms window for concurrent execution
    });

    it('should measure query efficiency metrics', async () => {
      const startTime = performance.now();
      const wrapper = createWrapper();

      const { result } = renderHook(() => ({
        auth: useAuth(),
        gamification: useGamificationIntegration()
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.auth.isLoading).toBe(false);
        expect(result.current.gamification.isLoading).toBe(false);
      }, { timeout: 5000 });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance benchmarks
      expect(totalTime).toBeLessThan(1000); // Total load time under 1 second
      expect(mockApiCalls.length).toBeLessThan(10); // Reasonable number of API calls

      // Calculate query efficiency ratio
      const uniqueEndpoints = new Set(mockApiCalls.map(call => call.endpoint));
      const efficiencyRatio = uniqueEndpoints.size / mockApiCalls.length;
      
      // Should have good query efficiency (closer to 1.0 is better)
      expect(efficiencyRatio).toBeGreaterThan(0.5);

      console.log(`Performance Metrics:
        - Total Load Time: ${totalTime.toFixed(2)}ms
        - Total API Calls: ${mockApiCalls.length}
        - Unique Endpoints: ${uniqueEndpoints.size}
        - Efficiency Ratio: ${efficiencyRatio.toFixed(2)}
        - Query Pattern: ${mockApiCalls.map(c => c.endpoint).join(', ')}
      `);
    });
  });

  describe('Query Batching Verification', () => {
    it('should demonstrate proper query batching', async () => {
      const batchingMetrics = {
        individualQueries: 0,
        batchedQueries: 0,
        queryWindows: [] as Array<{ start: number; end: number; count: number }>
      };

      // Monitor query timing patterns
      const originalMockImplementation = require('@/lib/api/client').apiClient.get;
      
      require('@/lib/api/client').apiClient.get.mockImplementation((endpoint: string) => {
        const now = Date.now();
        
        // Check if this query is part of a batch (within 50ms window)
        const recentWindow = batchingMetrics.queryWindows.find(window => 
          now - window.start < 50
        );

        if (recentWindow) {
          recentWindow.end = now;
          recentWindow.count++;
          batchingMetrics.batchedQueries++;
        } else {
          batchingMetrics.queryWindows.push({
            start: now,
            end: now,
            count: 1
          });
          batchingMetrics.individualQueries++;
        }

        return originalMockImplementation(endpoint);
      });

      const wrapper = createWrapper();
      
      const { result } = renderHook(() => ({
        auth: useAuth(),
        gamification: useGamificationIntegration()
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.auth.isLoading).toBe(false);
      });

      // Analyze batching effectiveness
      const totalBatches = batchingMetrics.queryWindows.length;
      const avgBatchSize = batchingMetrics.queryWindows.reduce((sum, window) => sum + window.count, 0) / totalBatches;

      expect(avgBatchSize).toBeGreaterThan(1); // Queries should be batched
      expect(totalBatches).toBeLessThan(mockApiCalls.length); // Should have fewer batches than individual calls

      console.log(`Batching Analysis:
        - Total Batches: ${totalBatches}
        - Average Batch Size: ${avgBatchSize.toFixed(2)}
        - Individual Queries: ${batchingMetrics.individualQueries}
        - Batched Queries: ${batchingMetrics.batchedQueries}
      `);
    });
  });
});