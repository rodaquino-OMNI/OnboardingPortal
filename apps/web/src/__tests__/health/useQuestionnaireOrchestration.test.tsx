import { renderHook, waitFor, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useQuestionnaireOrchestration } from '@/hooks/useQuestionnaireOrchestration';
import { QuestionnaireSchema, QuestionnaireResponse } from '@/types/health';

// Mock fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock analytics
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

// Mock timers for auto-save debounce
jest.useFakeTimers();

const mockSchema: QuestionnaireSchema = {
  id: 1,
  version: 1,
  title: 'PHQ-9 Depression Screening',
  sections: [
    {
      id: 'phq9',
      title: 'Depression Assessment',
      questions: [
        {
          id: 'phq9_q1',
          text: 'Over the last 2 weeks, how often have you felt down, depressed, or hopeless?',
          type: 'scale',
          required: true,
          options: [
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ],
        },
      ],
    },
  ],
  scoring: {
    phq9: {
      min: 0,
      max: 27,
      thresholds: {
        minimal: 5,
        mild: 10,
        moderate: 15,
        moderately_severe: 20,
      },
    },
  },
};

const mockResponse: QuestionnaireResponse = {
  id: 123,
  questionnaire_id: 1,
  user_id: 456,
  answers: { phq9_q1: 2 },
  is_draft: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// SWR wrapper for testing
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('useQuestionnaireOrchestration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockTrackEvent.mockClear();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('Schema Fetching', () => {
    it('fetches schema with SWR and tracks analytics', async () => {
      const startTime = Date.now();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.schema).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.schema).toBeDefined();
      });

      expect(result.current.schema?.version).toBe(1);
      expect(result.current.schema?.title).toBe('PHQ-9 Depression Screening');

      // Verify analytics event
      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('health.schema_fetched', {
          questionnaire_id: 1,
          version: 1,
          fetch_latency_ms: expect.any(Number),
        });
      });

      const analyticsCall = mockTrackEvent.mock.calls.find(
        (call) => call[0] === 'health.schema_fetched'
      );
      expect(analyticsCall[1].fetch_latency_ms).toBeGreaterThan(0);
    });

    it('handles schema fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.schema).toBeNull();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.schema_fetch_failed', {
        questionnaire_id: 1,
        error: 'Network error',
      });
    });

    it('caches schema and reuses on subsequent renders', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result, rerender } = renderHook(
        () => useQuestionnaireOrchestration(1),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      // Rerender should use cached data
      rerender();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('Auto-Save Draft', () => {
    it('auto-saves draft every 3 seconds with debounce', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockResponse }),
        });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      // Save draft
      act(() => {
        result.current.saveDraft({ phq9_q1: 1 });
      });

      // Fast-forward 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/health/response', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionnaire_id: 1,
            answers: { phq9_q1: 1 },
            is_draft: true,
          }),
        });
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.draft_saved', {
        questionnaire_id: 1,
        answer_count: 1,
        auto_save: true,
      });
    });

    it('debounces rapid draft saves', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      // Rapid updates
      act(() => {
        result.current.saveDraft({ phq9_q1: 1 });
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.saveDraft({ phq9_q1: 2 });
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.saveDraft({ phq9_q1: 3 });
      });

      // Fast-forward past debounce
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter(
          (call) => call[0] === '/api/v1/health/response'
        );
        // Should only save once with the final value
        expect(saveCalls.length).toBe(1);
        expect(JSON.parse(saveCalls[0][1].body).answers.phq9_q1).toBe(3);
      });
    });

    it('handles auto-save errors without blocking user', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockRejectedValueOnce(new Error('Save failed'));

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      act(() => {
        result.current.saveDraft({ phq9_q1: 2 });
      });

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('health.draft_save_failed', {
          questionnaire_id: 1,
          error: 'Save failed',
        });
      });

      // User can still interact
      expect(result.current.schema).toBeDefined();
    });

    it('cancels pending auto-save on unmount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result, unmount } = renderHook(
        () => useQuestionnaireOrchestration(1),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      act(() => {
        result.current.saveDraft({ phq9_q1: 1 });
      });

      // Unmount before auto-save triggers
      unmount();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should not call save after unmount
      const saveCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === '/api/v1/health/response'
      );
      expect(saveCalls.length).toBe(0);
    });
  });

  describe('Submit Response', () => {
    it('submits final response and tracks completion', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockResponse }),
        });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      await act(async () => {
        await result.current.submitResponse({ phq9_q1: 3 });
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/health/response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionnaire_id: 1,
          answers: { phq9_q1: 3 },
          is_draft: false,
        }),
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.response_submitted', {
        questionnaire_id: 1,
        answer_count: 1,
        completion_time_ms: expect.any(Number),
      });
    });

    it('validates required fields before submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      await act(async () => {
        try {
          await result.current.submitResponse({});
        } catch (error: any) {
          expect(error.message).toContain('Required field');
        }
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.validation_failed', {
        questionnaire_id: 1,
        missing_fields: ['phq9_q1'],
      });
    });
  });

  describe('Resume from Draft', () => {
    it('loads existing draft on mount', async () => {
      const draftResponse = {
        ...mockResponse,
        is_draft: true,
        answers: { phq9_q1: 2 },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: draftResponse }),
        });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.draftData).toEqual({ phq9_q1: 2 });
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.draft_resumed', {
        questionnaire_id: 1,
        answer_count: 1,
      });
    });
  });

  describe('Analytics Tracking', () => {
    it('tracks question view time', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result } = renderHook(() => useQuestionnaireOrchestration(1), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      act(() => {
        result.current.trackQuestionView('phq9_q1');
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      act(() => {
        result.current.trackQuestionView('phq9_q2');
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.question_viewed', {
        questionnaire_id: 1,
        question_id: 'phq9_q1',
        view_time_ms: 5000,
      });
    });

    it('tracks abandonment on unmount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const { result, unmount } = renderHook(
        () => useQuestionnaireOrchestration(1),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.schema).toBeDefined();
      });

      act(() => {
        result.current.saveDraft({ phq9_q1: 1 });
      });

      unmount();

      expect(mockTrackEvent).toHaveBeenCalledWith('health.questionnaire_abandoned', {
        questionnaire_id: 1,
        completed_answers: 1,
        total_questions: 1,
        completion_percentage: 100,
      });
    });
  });
});
