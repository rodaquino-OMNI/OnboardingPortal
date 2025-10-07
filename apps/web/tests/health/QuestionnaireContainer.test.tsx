/**
 * QuestionnaireContainer Tests - Integration tests for container component
 *
 * Tests container orchestration logic and feature flag integration
 */

import { render, screen, waitFor } from '@testing-library/react';
import { QuestionnaireContainer } from '@/containers/health/QuestionnaireContainer';
import { FeatureFlagProvider } from '@/providers/FeatureFlagProvider';

// Mock the orchestration hook
jest.mock('@/hooks/useQuestionnaireOrchestration', () => ({
  useQuestionnaireOrchestration: jest.fn(() => ({
    schema: {},
    isLoadingSchema: false,
    schemaError: null,
    saveDraft: jest.fn(),
    submit: jest.fn(),
    isSubmitting: false,
    submitError: null,
    currentStep: 0,
    totalSteps: 3,
    nextStep: jest.fn(),
    previousStep: jest.fn(),
    visibleQuestions: [
      {
        title: 'Personal Information',
        description: 'Please provide your basic information',
        questions: [],
      },
    ],
    trackPageTurn: jest.fn(),
    questionnaireSchema: {},
  })),
}));

// Mock UI components
jest.mock('@austa/ui/forms', () => ({
  DynamicFormRenderer: () => <div>Dynamic Form</div>,
  QuestionnaireProgress: () => <div>Progress</div>,
  ErrorSummary: () => <div>Errors</div>,
  SectionHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('QuestionnaireContainer', () => {
  it('renders questionnaire when feature flag enabled', async () => {
    const mockFlags = { sliceC_health: true };

    render(
      <FeatureFlagProvider>
        <QuestionnaireContainer questionnaireId={1} />
      </FeatureFlagProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Personal Information/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while schema loads', () => {
    const useQuestionnaireOrchestration = require('@/hooks/useQuestionnaireOrchestration').useQuestionnaireOrchestration;
    useQuestionnaireOrchestration.mockReturnValue({
      isLoadingSchema: true,
      schemaError: null,
    });

    render(<QuestionnaireContainer questionnaireId={1} />);

    expect(screen.getByText(/Loading questionnaire/i)).toBeInTheDocument();
  });

  it('shows error state when schema fails to load', () => {
    const useQuestionnaireOrchestration = require('@/hooks/useQuestionnaireOrchestration').useQuestionnaireOrchestration;
    useQuestionnaireOrchestration.mockReturnValue({
      isLoadingSchema: false,
      schemaError: new Error('Failed to load schema'),
    });

    render(<QuestionnaireContainer questionnaireId={1} />);

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });
});
