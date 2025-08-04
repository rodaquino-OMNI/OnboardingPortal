/**
 * Gamification System Repair - Integration Test Suite
 * Tests the critical fixes for badge assignment, hook integration, and state management
 */

import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useGamification } from '@/hooks/useGamification';
import { ProgressCard } from '@/components/gamification/ProgressCard';
import { BadgeDisplay } from '@/components/gamification/BadgeDisplay';
import api from '@/services/api';

// Mock API
jest.mock('@/services/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('Gamification System Repair - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset API mocks
    mockApi.get.mockClear();
    mockApi.post.mockClear();
  });

  describe('Claude Flow Hook Integration Fix', () => {
    it('should properly integrate with claude-flow hooks for coordination', async () => {
      // Mock claude-flow coordination calls
      const mockHookResponse = {
        data: {
          points: 150,
          level: 2,
          badges: ['health_questionnaire_complete'],
          coordination_id: 'swarm-gamification-123'
        }
      };

      mockApi.get.mockResolvedValue(mockHookResponse);
      mockApi.post.mockResolvedValue({
        data: {
          new_total: 200,
          level_up: false,
          hook_coordination: true
        }
      });

      const { result } = renderHook(() => useGamification());

      // Verify initialization with coordination
      await waitFor(() => {
        expect(result.current.progress).not.toBeNull();
      });

      // Test coordinated point addition
      await act(async () => {
        await result.current.addPoints(50, 'health_questionnaire_section');
      });

      expect(mockApi.post).toHaveBeenCalledWith('/gamification/add-points', {
        points: 50,
        reason: 'health_questionnaire_section'
      });

      // Verify state consistency after coordination
      expect(result.current.progress?.points).toBe(200);
    });

    it('should handle coordination failures gracefully', async () => {
      // Mock coordination failure
      mockApi.get.mockRejectedValue(new Error('Coordination service unavailable'));
      
      const { result } = renderHook(() => useGamification());

      // Should fall back to local state
      await waitFor(() => {
        expect(result.current.progress).toBeDefined();
      });

      // Should still function with degraded coordination
      mockApi.post.mockResolvedValue({
        data: { new_total: 50, coordination_fallback: true }
      });

      await act(async () => {
        await result.current.addPoints(50, 'fallback_test');
      });

      expect(result.current.progress?.points).toBe(50);
    });
  });

  describe('Badge Assignment System Repair', () => {
    it('should correctly assign badges for health questionnaire completion', async () => {
      const mockBadgeResponse = {
        data: {
          success: true,
          badge: {
            id: 'health_questionnaire_master',
            name: 'Health Questionnaire Master',
            description: 'Completed comprehensive health assessment',
            icon: '🏥',
            points_awarded: 100
          },
          new_total_points: 300
        }
      };

      mockApi.post.mockResolvedValue(mockBadgeResponse);

      const { result } = renderHook(() => useGamification());

      await act(async () => {
        await result.current.unlockBadge('health_questionnaire_master');
      });

      expect(mockApi.post).toHaveBeenCalledWith('/gamification/unlock-badge', {
        badge_id: 'health_questionnaire_master'
      });

      expect(result.current.badges).toContain('health_questionnaire_master');
      expect(result.current.points).toBe(300);
    });

    it('should handle progressive badge unlocking', async () => {
      const { result } = renderHook(() => useGamification());

      // Simulate multiple badge unlocks in sequence
      const badges = [
        'health_starter',
        'health_questionnaire_complete',
        'health_expert',
        'health_master'
      ];

      for (const badge of badges) {
        mockApi.post.mockResolvedValueOnce({
          data: {
            success: true,
            badge: { id: badge, name: badge.replace(/_/g, ' ') },
            new_total_points: result.current.points + 50
          }
        });

        await act(async () => {
          await result.current.unlockBadge(badge);
        });

        expect(result.current.badges).toContain(badge);
      }

      // Verify all badges are unlocked
      expect(result.current.badges).toHaveLength(4);
    });

    it('should prevent duplicate badge unlocking', async () => {
      const { result } = renderHook(() => useGamification());

      // Set initial badges
      act(() => {
        result.current.badges = ['existing_badge'];
      });

      await act(async () => {
        await result.current.unlockBadge('existing_badge');
      });

      // API should not be called for duplicate badge
      expect(mockApi.post).not.toHaveBeenCalled();
      expect(result.current.badges).toEqual(['existing_badge']);
    });
  });

  describe('State Management Consistency', () => {
    it('should maintain consistent state across component re-renders', async () => {
      const TestComponent = () => {
        const gamification = useGamification();
        return (
          <div>
            <span data-testid="points">{gamification.points}</span>
            <span data-testid="level">{gamification.level}</span>
            <button onClick={() => gamification.addPoints(25, 'test')}>
              Add Points
            </button>
          </div>
        );
      };

      mockApi.get.mockResolvedValue({
        data: { points: 100, level: 1, badges: [] }
      });
      mockApi.post.mockResolvedValue({
        data: { new_total: 125, level_up: false }
      });

      const { rerender } = render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('points')).toHaveTextContent('100');
      });

      fireEvent.click(screen.getByText('Add Points'));

      await waitFor(() => {
        expect(screen.getByTestId('points')).toHaveTextContent('125');
      });

      // Re-render component
      rerender(<TestComponent />);

      // State should persist
      expect(screen.getByTestId('points')).toHaveTextContent('125');
    });

    it('should synchronize localStorage with API state', async () => {
      const { result } = renderHook(() => useGamification());

      mockApi.post.mockResolvedValue({
        data: { new_total: 200, level_up: true, new_level: 2 }
      });

      await act(async () => {
        await result.current.addPoints(100, 'sync_test');
      });

      // Check localStorage synchronization
      const stored = JSON.parse(localStorage.getItem('gamification_data') || '{}');
      expect(stored.points).toBe(200);
      expect(stored.level).toBe(2);
    });
  });

  describe('Cross-Component Integration', () => {
    it('should integrate ProgressCard with badge system', async () => {
      const mockUserData = {
        points: 250,
        level: 2,
        badges: ['health_starter', 'document_upload'],
        nextLevelPoints: 500,
        progress: 50
      };

      render(
        <ProgressCard
          points={mockUserData.points}
          level={mockUserData.level}
          nextLevelPoints={mockUserData.nextLevelPoints}
          progress={mockUserData.progress}
        />
      );

      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('Nível 2')).toBeInTheDocument();
    });

    it('should display badges correctly in BadgeDisplay component', async () => {
      const mockBadges = [
        {
          id: 'health_master',
          name: 'Health Master',
          description: 'Completed all health assessments',
          icon: '🏥',
          earned: true,
          earnedAt: new Date().toISOString()
        },
        {
          id: 'document_expert',
          name: 'Document Expert',
          description: 'Uploaded all required documents',
          icon: '📋',
          earned: false
        }
      ];

      render(<BadgeDisplay badges={mockBadges} />);

      expect(screen.getByText('Health Master')).toBeInTheDocument();
      expect(screen.getByText('Document Expert')).toBeInTheDocument();
      expect(screen.getByText('🏥')).toBeInTheDocument();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid successive point additions', async () => {
      const { result } = renderHook(() => useGamification());

      mockApi.post.mockImplementation(() => 
        Promise.resolve({
          data: { new_total: Math.floor(Math.random() * 1000) }
        })
      );

      // Rapid fire point additions
      const promises = Array(10).fill(null).map((_, i) =>
        result.current.addPoints(10, `rapid_test_${i}`)
      );

      await act(async () => {
        await Promise.all(promises);
      });

      // Should handle all requests without race conditions
      expect(mockApi.post).toHaveBeenCalledTimes(10);
    });

    it('should recover from temporary API failures', async () => {
      const { result } = renderHook(() => useGamification());

      // First call fails
      mockApi.post.mockRejectedValueOnce(new Error('Temporary failure'));
      
      // Second call succeeds
      mockApi.post.mockResolvedValueOnce({
        data: { new_total: 100, recovered: true }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        await result.current.addPoints(50, 'recovery_test');
      });

      expect(consoleSpy).toHaveBeenCalled();

      // Retry should work
      await act(async () => {
        await result.current.addPoints(50, 'recovery_test_retry');
      });

      expect(result.current.points).toBe(100);
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed API responses', async () => {
      const { result } = renderHook(() => useGamification());

      mockApi.post.mockResolvedValue({
        data: null // Malformed response
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        await result.current.addPoints(50, 'malformed_test');
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.points).toBe(0); // Should maintain default state

      consoleSpy.mockRestore();
    });

    it('should handle very large point values', async () => {
      const { result } = renderHook(() => useGamification());

      mockApi.post.mockResolvedValue({
        data: { new_total: 999999999 }
      });

      await act(async () => {
        await result.current.addPoints(999999999, 'large_value_test');
      });

      expect(result.current.points).toBe(999999999);
      expect(typeof result.current.points).toBe('number');
    });

    it('should handle concurrent badge unlocking attempts', async () => {
      const { result } = renderHook(() => useGamification());

      const badgePromises = [
        'badge_1',
        'badge_2',
        'badge_3'
      ].map(badge => {
        mockApi.post.mockResolvedValueOnce({
          data: {
            success: true,
            badge: { id: badge, name: badge }
          }
        });
        return result.current.unlockBadge(badge);
      });

      await act(async () => {
        await Promise.all(badgePromises);
      });

      expect(result.current.badges).toHaveLength(3);
      expect(mockApi.post).toHaveBeenCalledTimes(3);
    });
  });
});