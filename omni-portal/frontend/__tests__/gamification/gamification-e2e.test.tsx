import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { useGamification } from '@/hooks/useGamification';
import { BadgeDisplay } from '@/components/gamification/BadgeDisplay';
import { ProgressCard } from '@/components/gamification/ProgressCard';
import { Leaderboard } from '@/components/gamification/Leaderboard';
import DashboardPage from '@/app/(dashboard)/home/page';
import { gamificationApi } from '@/lib/api/gamification';
import '@testing-library/jest-dom';

// Mock the API
jest.mock('@/lib/api/gamification', () => ({
  gamificationApi: {
    getProgress: jest.fn(),
    getStats: jest.fn(),
    getBadges: jest.fn(),
    getLeaderboard: jest.fn(),
    getActivityFeed: jest.fn(),
    getDashboard: jest.fn(),
    getAchievements: jest.fn(),
    getLevels: jest.fn(),
  },
}));

// Mock auth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      fullName: 'Test User',
      email: 'test@example.com'
    },
    isAuthenticated: true
  })
}));

// Mock Next.js components
jest.mock('next/link', () => {
  return ({ children, href }: any) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('next/image', () => {
  return ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  );
});

// Mock other components
jest.mock('@/components/gamification/AchievementNotification', () => ({
  AchievementNotification: () => <div data-testid="achievement-notification" />
}));

jest.mock('@/components/onboarding/PendingTasksReminder', () => ({
  PendingTasksReminder: () => <div data-testid="pending-tasks-reminder" />
}));

jest.mock('@/components/dashboard/InterviewUnlockCard', () => ({
  __esModule: true,
  default: () => <div data-testid="interview-unlock-card" />
}));

jest.mock('@/lib/onboarding-demo', () => ({
  demoPresets: {
    locked: jest.fn(),
    partial: jest.fn(),
    almostComplete: jest.fn(),
    unlocked: jest.fn(),
    reset: jest.fn(),
  }
}));

const mockApiData = {
  progress: {
    current_level: { number: 5 },
    total_points: 2500,
    next_level: { points_remaining: 500 },
    streak_days: 7
  },
  stats: {
    current_level: 5,
    totalPoints: 2500,
    experienceToNext: 500,
    currentStreak: 7,
    achievementsUnlocked: 12
  },
  badges: {
    earned: [
      {
        id: '1',
        name: 'First Steps',
        description: 'Complete your first task',
        icon: '🎯',
        rarity: 'common' as const,
        pointsRequired: 100,
        earned_at: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        name: 'Profile Master',
        description: 'Complete your profile',
        icon: '👤',
        rarity: 'rare' as const,
        pointsRequired: 250,
        earned_at: '2024-01-16T14:20:00Z'
      }
    ],
    available: [
      {
        id: '3',
        name: 'Document Expert',
        description: 'Upload all required documents',
        icon: '📄',
        rarity: 'epic' as const,
        pointsRequired: 500
      }
    ]
  },
  leaderboard: [
    {
      userId: '1',
      username: 'Test User',
      points: 2500,
      rank: 1,
      avatar: null,
      achievements: []
    },
    {
      userId: '2',
      username: 'John Doe',
      points: 2300,
      rank: 2,
      avatar: '/avatar2.png',
      achievements: []
    }
  ],
  dashboardSummary: {
    quick_stats: {
      points_today: 150,
      completion_rate: 75,
      rank_in_company: 5
    },
    recent_badges: [
      {
        name: 'Recent Achievement',
        icon: '⭐',
        color: '#4F46E5',
        earned_at: '2024-01-20T08:00:00Z'
      }
    ]
  }
};

describe('Gamification System E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup API mocks with mock data
    (gamificationApi.getProgress as jest.Mock).mockResolvedValue(mockApiData.progress);
    (gamificationApi.getStats as jest.Mock).mockResolvedValue(mockApiData.stats);
    (gamificationApi.getBadges as jest.Mock).mockResolvedValue(mockApiData.badges);
    (gamificationApi.getLeaderboard as jest.Mock).mockResolvedValue(mockApiData.leaderboard);
    (gamificationApi.getDashboard as jest.Mock).mockResolvedValue(mockApiData.dashboardSummary);
    (gamificationApi.getActivityFeed as jest.Mock).mockResolvedValue([]);
    (gamificationApi.getAchievements as jest.Mock).mockResolvedValue({});
    (gamificationApi.getLevels as jest.Mock).mockResolvedValue([]);
  });

  describe('useGamification Hook Tests', () => {
    const TestComponent = () => {
      const {
        progress,
        stats,
        badges,
        leaderboard,
        dashboardSummary,
        fetchAll,
        isLoading,
        error
      } = useGamification();

      return (
        <div data-testid="test-component">
          <div data-testid="loading-state">{isLoading ? 'loading' : 'loaded'}</div>
          <div data-testid="error-state">{error || 'no-error'}</div>
          <div data-testid="progress-data">{JSON.stringify(progress)}</div>
          <div data-testid="stats-data">{JSON.stringify(stats)}</div>
          <div data-testid="badges-data">{JSON.stringify(badges)}</div>
          <div data-testid="leaderboard-data">{JSON.stringify(leaderboard)}</div>
          <div data-testid="dashboard-data">{JSON.stringify(dashboardSummary)}</div>
          <button onClick={fetchAll} data-testid="fetch-all-btn">Fetch All</button>
        </div>
      );
    };

    it('should successfully fetch all gamification data', async () => {
      render(<TestComponent />);
      
      // Click fetch all button
      fireEvent.click(screen.getByTestId('fetch-all-btn'));
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded');
      }, { timeout: 5000 });

      // Verify no errors
      expect(screen.getByTestId('error-state')).toHaveTextContent('no-error');

      // Verify API calls were made
      expect(gamificationApi.getProgress).toHaveBeenCalled();
      expect(gamificationApi.getStats).toHaveBeenCalled();
      expect(gamificationApi.getBadges).toHaveBeenCalled();
      expect(gamificationApi.getLeaderboard).toHaveBeenCalled();
      expect(gamificationApi.getDashboard).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Mock API to throw error
      (gamificationApi.getProgress as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('fetch-all-btn'));
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded');
      }, { timeout: 5000 });

      // Should not crash and should handle errors
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });

  describe('BadgeDisplay Component Tests', () => {
    it('should render badges without undefined variables', async () => {
      render(<BadgeDisplay />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Conquistas')).toBeInTheDocument();
      });

      // Check that earned badges are displayed
      expect(screen.getByText('2 conquistadas')).toBeInTheDocument();
      
      // Check individual badges are rendered properly
      expect(screen.getByText('First Steps')).toBeInTheDocument();
      expect(screen.getByText('Profile Master')).toBeInTheDocument();
      
      // Verify no undefined values in display
      const badgeElements = screen.getAllByText(/\d+ pontos/);
      expect(badgeElements).toHaveLength(2); // Two earned badges with point requirements
    });

    it('should handle empty badges gracefully', async () => {
      (gamificationApi.getBadges as jest.Mock).mockResolvedValue({
        earned: [],
        available: []
      });

      render(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('Nenhuma conquista ainda')).toBeInTheDocument();
      });
    });

    it('should switch between earned and available badges', async () => {
      render(<BadgeDisplay />);

      await waitFor(() => {
        expect(screen.getByText('Conquistas')).toBeInTheDocument();
      });

      // Switch to available tab
      fireEvent.click(screen.getByText(/Disponíveis/));

      await waitFor(() => {
        expect(screen.getByText('Document Expert')).toBeInTheDocument();
      });
    });
  });

  describe('ProgressCard Component Tests', () => {
    it('should render progress card without errors', async () => {
      render(<ProgressCard />);

      await waitFor(() => {
        expect(screen.getByText('Level 5')).toBeInTheDocument();
      });

      // Check points display
      expect(screen.getByText('2,500 points')).toBeInTheDocument();
      
      // Check progress to next level
      expect(screen.getByText('Progress to Level 6')).toBeInTheDocument();
      expect(screen.getByText('500 points to go')).toBeInTheDocument();

      // Check streak display
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('Day Streak')).toBeInTheDocument();
    });

    it('should handle missing data gracefully', async () => {
      (gamificationApi.getProgress as jest.Mock).mockResolvedValue(null);
      (gamificationApi.getStats as jest.Mock).mockResolvedValue(null);

      render(<ProgressCard />);

      await waitFor(() => {
        expect(screen.getByText('No progress data available')).toBeInTheDocument();
      });
    });

    it('should display correct progress percentage', async () => {
      render(<ProgressCard />);

      await waitFor(() => {
        // Progress should be calculated from total points (2500)
        // Level 5 = 5000 points needed, current has 2500, so 50% to next level
        const progressText = screen.getByText(/% complete/);
        expect(progressText).toBeInTheDocument();
      });
    });
  });

  describe('Leaderboard Component Tests', () => {
    it('should render leaderboard entries properly', async () => {
      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Ranking')).toBeInTheDocument();
      });

      // Check leaderboard entries
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Check points display
      const pointsDisplays = screen.getAllByTestId('points-counter');
      expect(pointsDisplays[0]).toHaveTextContent('2,500');
      expect(pointsDisplays[1]).toHaveTextContent('2,300');

      // Check rank display
      expect(screen.getByText('Rank #1')).toBeInTheDocument();
      expect(screen.getByText('Rank #2')).toBeInTheDocument();
    });

    it('should handle empty leaderboard', async () => {
      (gamificationApi.getLeaderboard as jest.Mock).mockResolvedValue([]);

      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Nenhum dado de ranking disponível')).toBeInTheDocument();
      });
    });

    it('should refresh leaderboard on button click', async () => {
      render(<Leaderboard />);

      await waitFor(() => {
        expect(screen.getByText('Ranking')).toBeInTheDocument();
      });

      // Click refresh button
      const refreshButton = screen.getByText('Atualizar');
      fireEvent.click(refreshButton);

      // Should show refreshing state
      await waitFor(() => {
        expect(screen.getByText('Atualizando...')).toBeInTheDocument();
      });

      // API should be called again
      await waitFor(() => {
        expect(gamificationApi.getLeaderboard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Dashboard Integration Tests', () => {
    it('should render dashboard with all gamification components', async () => {
      render(<DashboardPage />);

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByText(/Bom dia, Test User!/)).toBeInTheDocument();
      });

      // Check gamification components are present
      expect(screen.getByText('Level 5')).toBeInTheDocument(); // ProgressCard
      expect(screen.getByText('Conquistas')).toBeInTheDocument(); // BadgeDisplay
      expect(screen.getByText('Ranking')).toBeInTheDocument(); // Leaderboard

      // Check quick stats
      expect(screen.getByText('Pontos Hoje')).toBeInTheDocument();
      expect(screen.getByText('+150')).toBeInTheDocument(); // points_today
      expect(screen.getByText('75%')).toBeInTheDocument(); // completion_rate
      expect(screen.getByText('#5')).toBeInTheDocument(); // rank_in_company

      // Check recent achievements
      expect(screen.getByText('Conquistas Recentes')).toBeInTheDocument();
      expect(screen.getByText('Recent Achievement')).toBeInTheDocument();
    });

    it('should handle loading states correctly', async () => {
      // Mock slower API responses
      (gamificationApi.getDashboard as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockApiData.dashboardSummary), 100))
      );

      render(<DashboardPage />);

      // Should show loading states initially
      await waitFor(() => {
        expect(screen.getByText(/Bom dia, Test User!/)).toBeInTheDocument();
      });

      // Components should eventually load
      await waitFor(() => {
        expect(screen.getByText('Level 5')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle network errors gracefully', async () => {
      (gamificationApi.getProgress as jest.Mock).mockRejectedValue(new Error('Network error'));
      (gamificationApi.getStats as jest.Mock).mockRejectedValue(new Error('Network error'));
      (gamificationApi.getBadges as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Bom dia, Test User!/)).toBeInTheDocument();
      });

      // Components should still render with error states or fallbacks
      // Should not crash the entire page
      expect(screen.getByTestId('achievement-notification')).toBeInTheDocument();
    });

    it('should display appropriate empty states', async () => {
      (gamificationApi.getProgress as jest.Mock).mockResolvedValue(null);
      (gamificationApi.getStats as jest.Mock).mockResolvedValue(null);
      (gamificationApi.getBadges as jest.Mock).mockResolvedValue({ earned: [], available: [] });
      (gamificationApi.getLeaderboard as jest.Mock).mockResolvedValue([]);

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Bom dia, Test User!/)).toBeInTheDocument();
      });

      // Should show appropriate empty states
      await waitFor(() => {
        expect(screen.getByText('No progress data available')).toBeInTheDocument();
        expect(screen.getByText('Nenhuma conquista ainda')).toBeInTheDocument();
        expect(screen.getByText('Nenhum dado de ranking disponível')).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across components', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Bom dia, Test User!/)).toBeInTheDocument();
      });

      // Wait for all components to load
      await waitFor(() => {
        expect(screen.getByText('Level 5')).toBeInTheDocument();
      });

      // Check that the same data appears consistently
      const levelElements = screen.getAllByText('5');
      expect(levelElements.length).toBeGreaterThan(0);

      // Points should be consistent (2,500 from mockApiData)
      const pointsElements = screen.getAllByText('2,500');
      expect(pointsElements.length).toBeGreaterThan(0);
    });
  });
});