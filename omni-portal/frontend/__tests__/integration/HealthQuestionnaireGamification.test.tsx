import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';
import { healthAPI } from '@/lib/api/health';
import { useGamification } from '@/hooks/useGamification';

// Mock the dependencies
jest.mock('@/lib/api/health');
jest.mock('@/hooks/useGamification');
jest.mock('@/services/api');

const mockHealthAPI = healthAPI as jest.Mocked<typeof healthAPI>;
const mockUseGamification = useGamification as jest.MockedFunction<typeof useGamification>;

describe('Health Questionnaire Gamification Integration', () => {
  const mockOnComplete = jest.fn();
  const mockFetchProgress = jest.fn();
  const mockFetchBadges = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock gamification hook
    mockUseGamification.mockReturnValue({
      user: {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      progress: {
        level: 1,
        currentXP: 100,
        nextLevelXP: 500,
        totalPoints: 100
      },
      badges: [],
      isLoading: false,
      error: null,
      fetchProgress: mockFetchProgress,
      fetchBadges: mockFetchBadges,
      awardPoints: jest.fn(),
      unlockBadge: jest.fn(),
      checkAchievements: jest.fn()
    });

    // Mock API responses
    mockHealthAPI.prepareSubmissionData.mockReturnValue({
      questionnaire_type: 'unified',
      responses: {},
      metadata: {
        version: '2.0.0',
        completed_at: new Date().toISOString(),
        time_taken_seconds: 300,
        domains_completed: ['mental_health'],
        risk_scores: {},
        fraud_score: 0
      }
    });
  });

  describe('Badge Awards for Mental Health Domain', () => {
    it('should award wellness-champion badge for low risk assessment', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-123',
        risk_assessment: {
          overall_risk: 'low',
          domain_risks: { mental_health: 'low' },
          recommendations: [],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 200,
          badges_earned: ['wellness-champion'],
          level_progress: {
            current_level: 1,
            current_xp: 300,
            next_level_xp: 500
          },
          achievements_unlocked: ['Campeão do Bem-Estar']
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      // Simulate completing questionnaire
      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockHealthAPI.submitQuestionnaire).toHaveBeenCalled();
        expect(mockFetchProgress).toHaveBeenCalled();
        expect(mockFetchBadges).toHaveBeenCalled();
      });

      // Verify gamification event was dispatched
      const gamificationEvent = new CustomEvent('gamification:update', {
        detail: {
          points_earned: 200,
          badges_earned: ['wellness-champion'],
          level_progress: {
            current_level: 1,
            current_xp: 300,
            next_level_xp: 500
          },
          achievements_unlocked: ['Campeão do Bem-Estar']
        }
      });

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'gamification:update'
        })
      );
    });

    it('should award mental-wellness-champion badge for completing mental health domain', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-124',
        risk_assessment: {
          overall_risk: 'moderate',
          domain_risks: { mental_health: 'moderate' },
          recommendations: ['Consider mental health counseling'],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 300,
          badges_earned: ['health-awareness', 'mental-wellness-champion'],
          level_progress: {
            current_level: 1,
            current_xp: 400,
            next_level_xp: 500
          },
          achievements_unlocked: [
            'Consciência em Saúde',
            'Campeão do Bem-Estar Mental'
          ]
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      // Simulate completing questionnaire
      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockHealthAPI.submitQuestionnaire).toHaveBeenCalled();
        
        const submissionData = mockHealthAPI.submitQuestionnaire.mock.calls[0][0];
        expect(submissionData.metadata.domains_completed).toContain('mental_health');
      });
    });

    it('should award health-advocate badge for high risk assessment', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-125',
        risk_assessment: {
          overall_risk: 'high',
          domain_risks: { mental_health: 'high' },
          recommendations: [
            'Immediate psychiatric evaluation recommended',
            'Contact mental health professional within 24-48 hours'
          ],
          requires_immediate_attention: true
        },
        gamification_rewards: {
          points_earned: 250,
          badges_earned: ['health-advocate'],
          level_progress: {
            current_level: 1,
            current_xp: 350,
            next_level_xp: 500
          },
          achievements_unlocked: ['Defensor da Saúde']
        },
        next_steps: [
          {
            action: 'schedule_psychiatric_evaluation',
            description: 'Schedule psychiatric evaluation',
            priority: 'high'
          }
        ]
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      // Simulate completing questionnaire
      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockHealthAPI.submitQuestionnaire).toHaveBeenCalled();
        expect(mockFetchProgress).toHaveBeenCalled();
        expect(mockFetchBadges).toHaveBeenCalled();
      });
    });
  });

  describe('Points Award System', () => {
    it('should award base points plus domain bonuses', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-126',
        risk_assessment: {
          overall_risk: 'low',
          domain_risks: {
            mental_health: 'low',
            lifestyle: 'low',
            risk_behaviors: 'low'
          },
          recommendations: [],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 225, // 150 base + 25*3 domains
          badges_earned: ['wellness-champion', 'lifestyle-conscious'],
          level_progress: {
            current_level: 2,
            current_xp: 25,
            next_level_xp: 1000
          },
          achievements_unlocked: []
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        const submissionCall = mockHealthAPI.submitQuestionnaire.mock.calls[0][0];
        expect(submissionCall.metadata.domains_completed).toHaveLength(3);
      });
    });

    it('should award honesty bonus for high-risk disclosure', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-127',
        risk_assessment: {
          overall_risk: 'high',
          domain_risks: { mental_health: 'high' },
          recommendations: ['Seek immediate help'],
          requires_immediate_attention: true
        },
        gamification_rewards: {
          points_earned: 225, // 150 base + 25 domain + 50 honesty bonus
          badges_earned: ['health-advocate'],
          level_progress: {
            current_level: 1,
            current_xp: 325,
            next_level_xp: 500
          },
          achievements_unlocked: []
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockHealthAPI.submitQuestionnaire).toHaveBeenCalled();
        const response = mockHealthAPI.submitQuestionnaire.mock.results[0].value;
        expect(response.gamification_rewards.points_earned).toBe(225);
      });
    });
  });

  describe('Gamification UI Updates', () => {
    it('should show success message with earned rewards', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-128',
        risk_assessment: {
          overall_risk: 'low',
          domain_risks: { mental_health: 'low' },
          recommendations: [],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 200,
          badges_earned: ['wellness-champion'],
          level_progress: {
            current_level: 1,
            current_xp: 300,
            next_level_xp: 500
          },
          achievements_unlocked: ['Campeão do Bem-Estar']
        },
        next_steps: []
      });

      const { container } = render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/questionário enviado com sucesso/i)).toBeInTheDocument();
      });

      // Check if gamification update was triggered
      await waitFor(() => {
        expect(mockFetchProgress).toHaveBeenCalled();
        expect(mockFetchBadges).toHaveBeenCalled();
      });
    });

    it('should handle submission errors gracefully', async () => {
      mockHealthAPI.submitQuestionnaire.mockRejectedValueOnce(
        new Error('Network error')
      );

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/erro ao enviar questionário/i)).toBeInTheDocument();
      });

      // Gamification updates should not be called on error
      expect(mockFetchProgress).not.toHaveBeenCalled();
      expect(mockFetchBadges).not.toHaveBeenCalled();
    });
  });

  describe('Badge Display After Completion', () => {
    it('should display earned badges in success message', async () => {
      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-129',
        risk_assessment: {
          overall_risk: 'low',
          domain_risks: {
            mental_health: 'low',
            lifestyle: 'low'
          },
          recommendations: [],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 350,
          badges_earned: ['wellness-champion', 'mental-wellness-champion', 'lifestyle-conscious'],
          level_progress: {
            current_level: 2,
            current_xp: 50,
            next_level_xp: 1000
          },
          achievements_unlocked: [
            'Campeão do Bem-Estar',
            'Campeão do Bem-Estar Mental',
            'Estilo de Vida Consciente'
          ]
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/questionário enviado com sucesso/i)).toBeInTheDocument();
        
        // Should show points earned
        expect(screen.getByText(/350 pontos/i)).toBeInTheDocument();
        
        // Should show badges earned
        expect(screen.getByText(/3 conquistas desbloqueadas/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Gamification Hooks', () => {
    it('should trigger gamification updates on successful submission', async () => {
      const mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');

      mockHealthAPI.submitQuestionnaire.mockResolvedValueOnce({
        success: true,
        questionnaire_id: 'test-130',
        risk_assessment: {
          overall_risk: 'moderate',
          domain_risks: { mental_health: 'moderate' },
          recommendations: [],
          requires_immediate_attention: false
        },
        gamification_rewards: {
          points_earned: 150,
          badges_earned: ['health-awareness'],
          level_progress: {
            current_level: 1,
            current_xp: 250,
            next_level_xp: 500
          },
          achievements_unlocked: ['Consciência em Saúde']
        },
        next_steps: []
      });

      render(
        <UnifiedHealthQuestionnaire
          onComplete={mockOnComplete}
          userId="test-user-1"
        />
      );

      const submitButton = screen.getByText(/enviar/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockDispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'gamification:update',
            detail: expect.objectContaining({
              points_earned: 150,
              badges_earned: ['health-awareness']
            })
          })
        );
      });

      mockDispatchEvent.mockRestore();
    });
  });
});