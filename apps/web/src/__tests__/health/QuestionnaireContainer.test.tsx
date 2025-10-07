import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireContainer } from '@/components/health/QuestionnaireContainer';
import { SWRConfig } from 'swr';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock analytics
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

// Mock router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockSchema = {
  id: 1,
  version: 1,
  title: 'PHQ-9 Depression Screening',
  sections: [
    {
      id: 'screening',
      title: 'Initial Screening',
      questions: [
        {
          id: 'has_symptoms',
          text: 'Have you experienced any symptoms?',
          type: 'select',
          required: true,
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
      ],
    },
    {
      id: 'phq9',
      title: 'Depression Assessment',
      questions: [
        {
          id: 'phq9_q1',
          text: 'Feeling down, depressed, or hopeless?',
          type: 'scale',
          required: true,
          options: [
            { value: 0, label: 'Not at all' },
            { value: 1, label: 'Several days' },
            { value: 2, label: 'More than half the days' },
            { value: 3, label: 'Nearly every day' },
          ],
          condition: {
            question_id: 'has_symptoms',
            operator: 'equals',
            value: 'yes',
          },
        },
      ],
    },
  ],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

describe('QuestionnaireContainer', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockTrackEvent.mockClear();
    mockPush.mockClear();
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner while fetching schema', () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve to keep loading state
          })
      );

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays error message on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to load questionnaire/i)).toBeInTheDocument();
      });
    });

    it('provides retry button on error', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });
    });
  });

  describe('Branching Logic', () => {
    it('shows conditional questions when condition is met', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      // Initially, PHQ-9 question should not be visible
      expect(screen.queryByText(/feeling down, depressed/i)).not.toBeInTheDocument();

      // Select "Yes" for screening question
      const select = screen.getByRole('combobox', {
        name: /have you experienced any symptoms/i,
      });
      await user.selectOptions(select, 'yes');

      // PHQ-9 question should now appear
      await waitFor(() => {
        expect(screen.getByText(/feeling down, depressed/i)).toBeInTheDocument();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.conditional_question_shown', {
        questionnaire_id: 1,
        question_id: 'phq9_q1',
        trigger_question: 'has_symptoms',
        trigger_value: 'yes',
      });
    });

    it('hides conditional questions when condition is not met', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'yes');

      await waitFor(() => {
        expect(screen.getByText(/feeling down, depressed/i)).toBeInTheDocument();
      });

      // Change answer back to "No"
      await user.selectOptions(select, 'no');

      await waitFor(() => {
        expect(screen.queryByText(/feeling down, depressed/i)).not.toBeInTheDocument();
      });
    });

    it('clears answers from hidden conditional questions', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 123 } }),
        });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      // Answer screening question
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'yes');

      // Answer PHQ-9 question
      await waitFor(() => {
        expect(screen.getByText(/feeling down, depressed/i)).toBeInTheDocument();
      });

      const radio = screen.getByRole('radio', { name: /several days/i });
      await user.click(radio);

      // Change screening answer to hide PHQ-9
      await user.selectOptions(select, 'no');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const submitCall = mockFetch.mock.calls.find(
          (call) => call[0] === '/api/v1/health/response'
        );
        const body = JSON.parse(submitCall[1].body);
        // PHQ-9 answer should not be included
        expect(body.answers).not.toHaveProperty('phq9_q1');
      });
    });
  });

  describe('Resume from Draft', () => {
    it('loads and displays draft answers on mount', async () => {
      const draftData = {
        id: 123,
        questionnaire_id: 1,
        answers: {
          has_symptoms: 'yes',
          phq9_q1: 2,
        },
        is_draft: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: draftData }),
        });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      // Should show draft resume banner
      expect(screen.getByText(/resume from where you left off/i)).toBeInTheDocument();

      // Screening answer should be pre-selected
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('yes');

      // PHQ-9 should be visible and answered
      await waitFor(() => {
        const radio = screen.getByRole('radio', { name: /more than half the days/i });
        expect(radio).toBeChecked();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.draft_resumed', {
        questionnaire_id: 1,
        answer_count: 2,
      });
    });

    it('allows user to start fresh instead of resuming draft', async () => {
      const user = userEvent.setup();

      const draftData = {
        id: 123,
        questionnaire_id: 1,
        answers: { has_symptoms: 'yes' },
        is_draft: true,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: draftData }),
        });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/resume from where you left off/i)).toBeInTheDocument();
      });

      const startFreshButton = screen.getByRole('button', { name: /start fresh/i });
      await user.click(startFreshButton);

      // Draft banner should disappear
      expect(screen.queryByText(/resume from where you left off/i)).not.toBeInTheDocument();

      // Answers should be cleared
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');

      expect(mockTrackEvent).toHaveBeenCalledWith('health.draft_discarded', {
        questionnaire_id: 1,
      });
    });
  });

  describe('Form Submission', () => {
    it('validates all required fields before submission', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/please answer all required questions/i)).toBeInTheDocument();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.validation_failed', {
        questionnaire_id: 1,
        missing_fields: ['has_symptoms'],
      });
    });

    it('submits successfully with valid answers', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 123, score: 5 } }),
        });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      // Answer screening question
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'no');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockTrackEvent).toHaveBeenCalledWith('health.response_submitted', {
          questionnaire_id: 1,
          answer_count: 1,
          completion_time_ms: expect.any(Number),
        });
      });

      // Should redirect to results page
      expect(mockPush).toHaveBeenCalledWith('/health/results/123');
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({ data: { id: 123 } }),
                  }),
                1000
              );
            })
        );

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'no');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Button should show loading state
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(within(submitButton).getByRole('status')).toBeInTheDocument();
      });
    });

    it('handles submission errors gracefully', async () => {
      const user = userEvent.setup();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockSchema }),
        })
        .mockRejectedValueOnce(new Error('Submission failed'));

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'no');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/failed to submit/i)).toBeInTheDocument();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('health.submission_failed', {
        questionnaire_id: 1,
        error: 'Submission failed',
      });
    });
  });

  describe('Progress Tracking', () => {
    it('updates progress bar as questions are answered', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSchema }),
      });

      render(<QuestionnaireContainer questionnaireId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(mockSchema.title)).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      // Answer screening question
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'yes');

      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '50'); // 1 of 2 questions
      });

      // Answer PHQ-9 question
      const radio = screen.getByRole('radio', { name: /not at all/i });
      await user.click(radio);

      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      });
    });
  });
});
