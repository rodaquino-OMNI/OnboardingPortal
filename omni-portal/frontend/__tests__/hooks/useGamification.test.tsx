import { renderHook, act } from '@testing-library/react';
import { useGamification } from '@/hooks/useGamification';
import api from '@/services/api';

// Mock dependencies
jest.mock('@/services/api');

describe('useGamification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useGamification());
      
      expect(result.current.points).toBe(0);
      expect(result.current.level).toBe(1);
      expect(result.current.badges).toEqual([]);
      expect(result.current.achievements).toEqual([]);
      expect(result.current.leaderboardPosition).toBeNull();
    });

    it('loads data from localStorage if available', () => {
      const mockData = {
        points: 150,
        level: 2,
        badges: ['early_bird', 'document_master'],
        achievements: [{ id: 'first_login', unlockedAt: '2024-01-01' }]
      };
      
      localStorage.setItem('gamification_data', JSON.stringify(mockData));
      
      const { result } = renderHook(() => useGamification());
      
      expect(result.current.points).toBe(150);
      expect(result.current.level).toBe(2);
      expect(result.current.badges).toEqual(['early_bird', 'document_master']);
      expect(result.current.achievements).toHaveLength(1);
    });

    it('fetches user data from API on mount', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          points: 250,
          level: 3,
          badges: ['health_champion'],
          achievements: [],
          leaderboard_position: 42
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(api.get).toHaveBeenCalledWith('/gamification/user-stats');
      expect(result.current.points).toBe(250);
      expect(result.current.leaderboardPosition).toBe(42);
    });
  });

  describe('Adding Points', () => {
    it('adds points and updates total', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          new_total: 150,
          level_up: false
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.addPoints(50, 'task_completed');
      });
      
      expect(api.post).toHaveBeenCalledWith('/gamification/add-points', {
        points: 50,
        reason: 'task_completed'
      });
      expect(result.current.points).toBe(150);
    });

    it('handles level up when adding points', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          new_total: 500,
          level_up: true,
          new_level: 3,
          rewards: {
            badge: 'level_3_achiever',
            bonus_points: 100
          }
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.addPoints(100, 'milestone_reached');
      });
      
      expect(result.current.level).toBe(3);
      expect(result.current.badges).toContain('level_3_achiever');
    });

    it('shows notification when points are added', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: { new_total: 50 }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.addPoints(50, 'document_uploaded');
      });
      
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'points',
        message: expect.stringContaining('+50 pontos')
      });
    });

    it('persists points to localStorage', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: { new_total: 100 }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.addPoints(100, 'test');
      });
      
      const stored = JSON.parse(localStorage.getItem('gamification_data') || '{}');
      expect(stored.points).toBe(100);
    });
  });

  describe('Unlocking Badges', () => {
    it('unlocks new badge successfully', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          badge: {
            id: 'early_adopter',
            name: 'Early Adopter',
            description: 'One of the first users',
            icon: '🌟'
          }
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.unlockBadge('early_adopter');
      });
      
      expect(api.post).toHaveBeenCalledWith('/gamification/unlock-badge', {
        badge_id: 'early_adopter'
      });
      expect(result.current.badges).toContain('early_adopter');
    });

    it('prevents duplicate badge unlocking', async () => {
      const { result } = renderHook(() => useGamification());
      
      // Set initial badges
      act(() => {
        result.current.badges = ['existing_badge'];
      });
      
      await act(async () => {
        await result.current.unlockBadge('existing_badge');
      });
      
      // API should not be called for duplicate badge
      expect(api.post).not.toHaveBeenCalled();
    });

    it('shows badge notification', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          badge: {
            id: 'health_master',
            name: 'Health Master',
            icon: '🏥'
          }
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.unlockBadge('health_master');
      });
      
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'badge',
        message: expect.stringContaining('Health Master')
      });
    });

    it('handles badge unlock errors gracefully', async () => {
      (api.post as jest.Mock).mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.unlockBadge('error_badge');
      });
      
      expect(result.current.badges).not.toContain('error_badge');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Achievements', () => {
    it('tracks achievements properly', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          achievement: {
            id: 'speed_demon',
            name: 'Speed Demon',
            description: 'Complete onboarding in under 10 minutes',
            points: 200
          }
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.unlockAchievement('speed_demon');
      });
      
      expect(result.current.achievements).toHaveLength(1);
      expect(result.current.achievements[0]).toMatchObject({
        id: 'speed_demon',
        unlockedAt: expect.any(String)
      });
    });

    it('awards points for achievements', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          achievement: {
            id: 'perfectionist',
            points: 500
          },
          new_total_points: 500
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.unlockAchievement('perfectionist');
      });
      
      expect(result.current.points).toBe(500);
    });
  });

  describe('Leaderboard', () => {
    it('fetches leaderboard data', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          user_position: 15,
          top_users: [
            { rank: 1, name: 'User 1', points: 5000 },
            { rank: 2, name: 'User 2', points: 4500 },
            { rank: 3, name: 'User 3', points: 4000 }
          ],
          nearby_users: [
            { rank: 14, name: 'User 14', points: 1500 },
            { rank: 15, name: 'You', points: 1450, isCurrentUser: true },
            { rank: 16, name: 'User 16', points: 1400 }
          ]
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        const leaderboard = await result.current.getLeaderboard();
        expect(leaderboard.user_position).toBe(15);
        expect(leaderboard.top_users).toHaveLength(3);
        expect(leaderboard.nearby_users).toHaveLength(3);
      });
      
      expect(api.get).toHaveBeenCalledWith('/gamification/leaderboard');
    });

    it('updates leaderboard position after points change', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          new_total: 2000,
          new_leaderboard_position: 10
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.addPoints(500, 'big_achievement');
      });
      
      expect(result.current.leaderboardPosition).toBe(10);
    });
  });

  describe('Progress Tracking', () => {
    it('calculates progress to next level', () => {
      const { result } = renderHook(() => useGamification());
      
      act(() => {
        result.current.points = 150;
        result.current.level = 2;
      });
      
      const progress = result.current.getProgressToNextLevel();
      
      expect(progress).toMatchObject({
        currentLevelPoints: 150,
        pointsNeeded: expect.any(Number),
        percentage: expect.any(Number)
      });
      expect(progress.percentage).toBeGreaterThan(0);
      expect(progress.percentage).toBeLessThanOrEqual(100);
    });

    it('tracks daily streaks', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          current_streak: 5,
          longest_streak: 10,
          last_activity: new Date().toISOString()
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        const streak = await result.current.getStreak();
        expect(streak.current_streak).toBe(5);
        expect(streak.longest_streak).toBe(10);
      });
    });
  });

  describe('Notifications', () => {
    it('clears notifications after timeout', async () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useGamification());
      
      act(() => {
        result.current.notifications = [
          { id: '1', type: 'points', message: 'Test' }
        ];
      });
      
      expect(result.current.notifications).toHaveLength(1);
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      
      expect(result.current.notifications).toHaveLength(0);
      
      jest.useRealTimers();
    });

    it('dismisses notification manually', () => {
      const { result } = renderHook(() => useGamification());
      
      act(() => {
        result.current.notifications = [
          { id: '1', type: 'points', message: 'Test 1' },
          { id: '2', type: 'badge', message: 'Test 2' }
        ];
      });
      
      act(() => {
        result.current.dismissNotification('1');
      });
      
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe('2');
    });
  });

  describe('Challenges', () => {
    it('fetches active challenges', async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: {
          challenges: [
            {
              id: 'weekly_login',
              name: 'Weekly Warrior',
              description: 'Login 7 days in a row',
              progress: 3,
              target: 7,
              reward_points: 100
            }
          ]
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        const challenges = await result.current.getActiveChallenges();
        expect(challenges).toHaveLength(1);
        expect(challenges[0].progress).toBe(3);
      });
    });

    it('completes challenge and awards rewards', async () => {
      (api.post as jest.Mock).mockResolvedValue({
        data: {
          completed: true,
          rewards: {
            points: 100,
            badge: 'challenge_master'
          },
          new_total_points: 600
        }
      });
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await result.current.completeChallenge('weekly_login');
      });
      
      expect(result.current.points).toBe(600);
      expect(result.current.badges).toContain('challenge_master');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { result } = renderHook(() => useGamification());
      
      // Should not throw
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.points).toBe(0); // Default value maintained
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('falls back to localStorage on API failure', async () => {
      (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const mockData = { points: 100, level: 2 };
      localStorage.setItem('gamification_data', JSON.stringify(mockData));
      
      const { result } = renderHook(() => useGamification());
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      expect(result.current.points).toBe(100);
      expect(result.current.level).toBe(2);
    });
  });
});