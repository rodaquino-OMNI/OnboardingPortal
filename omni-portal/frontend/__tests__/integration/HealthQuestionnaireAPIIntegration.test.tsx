import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';
import { healthAPI } from '@/lib/api/health';
import '@testing-library/jest-dom';

// Mock the API
jest.mock('@/lib/api/health', () => ({
  healthAPI: {
    submitQuestionnaire: jest.fn(),
    prepareSubmissionData: jest.fn(),
    getTemplates: jest.fn(),
    startQuestionnaire: jest.fn()
  }
}));

// Mock gamification hook
jest.mock('@/hooks/useGamification', () => ({
  useGamification: () => ({
    fetchProgress: jest.fn().mockResolvedValue({}),
    fetchBadges: jest.fn().mockResolvedValue({}),
    fetchStats: jest.fn().mockResolvedValue({}),
    progress: null,
    stats: null,
    badgesData: { earned: [], available: [] }
  })
}));

describe('Health Questionnaire API Integration', () => {
  const mockOnComplete = jest.fn();
  const mockOnProgressUpdate = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API response
    (healthAPI.submitQuestionnaire as jest.Mock).mockResolvedValue({
      success: true,
      questionnaire_id: 'test-123',
      risk_assessment: {
        overall_risk: 'low',
        domain_risks: {},
        recommendations: [],
        requires_immediate_attention: false
      },
      gamification_rewards: {
        points_earned: 100,
        badges_earned: ['first_questionnaire'],
        level_progress: {
          current_level: 1,
          current_xp: 100,
          next_level_xp: 200
        },
        achievements_unlocked: ['health_starter']
      },
      next_steps: []
    });

    (healthAPI.prepareSubmissionData as jest.Mock).mockReturnValue({
      questionnaire_type: 'unified',
      responses: {},
      metadata: {
        version: '2.0.0',
        completed_at: new Date().toISOString(),
        time_taken_seconds: 120,
        domains_completed: [],
        risk_scores: {},
        validation_pairs: {},
        fraud_score: 0
      },
      session_id: 'session-123',
      user_id: 'test-user'
    });
  });

  it('submits questionnaire data to backend on completion', async () => {
    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
        mode="standard"
        features={{ gamification: true }}
      />
    );

    // Simulate questionnaire completion
    // This is a simplified test - in reality, user would answer questions
    // For now, we'll directly trigger completion through the component
    
    // Wait for API call
    await waitFor(() => {
      expect(healthAPI.prepareSubmissionData).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(healthAPI.submitQuestionnaire).toHaveBeenCalled();
    });

    // Verify onComplete was called with enriched data
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          submission_result: expect.objectContaining({
            success: true,
            questionnaire_id: 'test-123'
          })
        })
      );
    });
  });

  it('handles API submission errors gracefully', async () => {
    // Mock API error
    (healthAPI.submitQuestionnaire as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
      />
    );

    // Wait for error handling
    await waitFor(() => {
      expect(healthAPI.submitQuestionnaire).toHaveBeenCalled();
    });

    // Should still call onComplete even on error
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });

    // Error message should be displayed
    expect(screen.getByText(/Erro ao enviar questionário/)).toBeInTheDocument();
  });

  it('updates gamification state after successful submission', async () => {
    const mockFetchProgress = jest.fn().mockResolvedValue({});
    const mockFetchBadges = jest.fn().mockResolvedValue({});

    jest.mock('@/hooks/useGamification', () => ({
      useGamification: () => ({
        fetchProgress: mockFetchProgress,
        fetchBadges: mockFetchBadges,
        fetchStats: jest.fn(),
        progress: null,
        stats: null,
        badgesData: { earned: [], available: [] }
      })
    }));

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
        features={{ gamification: true }}
      />
    );

    await waitFor(() => {
      expect(healthAPI.submitQuestionnaire).toHaveBeenCalled();
    });

    // Gamification should be updated after successful submission
    await waitFor(() => {
      expect(mockFetchProgress).toHaveBeenCalled();
      expect(mockFetchBadges).toHaveBeenCalled();
    });
  });

  it('shows loading state during submission', async () => {
    // Mock slow API response
    (healthAPI.submitQuestionnaire as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
      />
    );

    // Trigger submission (simplified)
    await waitFor(() => {
      expect(healthAPI.prepareSubmissionData).toHaveBeenCalled();
    });

    // Should show loading message
    expect(screen.getByText(/Enviando suas respostas/)).toBeInTheDocument();
  });

  it('shows success message after submission', async () => {
    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
      />
    );

    await waitFor(() => {
      expect(healthAPI.submitQuestionnaire).toHaveBeenCalled();
    });

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/Questionário enviado com sucesso/)).toBeInTheDocument();
    });
  });

  it('clears persisted state after successful submission', async () => {
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        userId="test-user"
      />
    );

    await waitFor(() => {
      expect(healthAPI.submitQuestionnaire).toHaveBeenCalled();
    });

    // Should clear localStorage
    await waitFor(() => {
      expect(removeItemSpy).toHaveBeenCalledWith(
        expect.stringContaining('health-questionnaire-test-user')
      );
    });

    removeItemSpy.mockRestore();
  });
});