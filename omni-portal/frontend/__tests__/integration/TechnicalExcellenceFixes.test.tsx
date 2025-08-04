import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuestionRenderer } from '@/components/health/unified/QuestionRenderer';
import { useQuestionnaire } from '@/components/health/unified/BaseHealthQuestionnaire';
import { useUnifiedNavigation, NAVIGATION_PROFILES } from '@/hooks/useUnifiedNavigation';
import { HealthQuestion } from '@/types/health';

// Mock dependencies
jest.mock('@/components/health/unified/BaseHealthQuestionnaire');
jest.mock('@/hooks/useUnifiedNavigation');
jest.mock('@/components/health/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useErrorHandler: () => ({ captureError: jest.fn() })
}));

const mockUseQuestionnaire = useQuestionnaire as jest.MockedFunction<typeof useQuestionnaire>;
const mockUseUnifiedNavigation = useUnifiedNavigation as jest.MockedFunction<typeof useUnifiedNavigation>;

describe('Technical Excellence Fixes Integration Tests', () => {
  const mockCurrentQuestion: HealthQuestion = {
    id: 'test_question',
    text: 'Test question text',
    type: 'boolean',
    domain: 'test',
    riskWeight: 1,
    required: true
  };

  const mockState = {
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    responses: {},
    sectionProgress: {},
    validationErrors: {},
    metadata: {},
    flowState: 'screening' as const,
    isLoading: false,
    error: null
  };

  const mockNavigationState = {
    isNavigating: false,
    willAutoAdvance: false,
    autoAdvanceDelay: 1800,
    hasPendingAutoAdvance: false,
    navigationProfile: 'clinical' as const,
    remainingAutoAdvanceTime: 0,
    canNavigateNext: true,
    canNavigatePrevious: true,
    validationRequired: true,
    hasResponse: false,
    questionType: 'boolean' as const,
    isHighRisk: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseQuestionnaire.mockReturnValue({
      state: mockState,
      getCurrentSection: () => ({ id: 'test', title: 'Test Section', questions: [] }),
      getCurrentQuestion: () => mockCurrentQuestion,
      getVisibleQuestions: () => [mockCurrentQuestion],
      setResponse: jest.fn(),
      validateQuestion: jest.fn(() => null),
      nextQuestion: jest.fn(),
      previousQuestion: jest.fn(),
      calculateProgress: () => 25
    });

    mockUseUnifiedNavigation.mockReturnValue({
      handleResponse: jest.fn(),
      handleNext: jest.fn(),
      handlePrevious: jest.fn(),
      cancelNavigation: jest.fn(),
      getNavigationState: () => mockNavigationState,
      shouldAutoAdvance: false,
      config: { autoAdvance: true }
    });
  });

  describe('FIX 1: Unified Navigation Profile Resolver', () => {
    it('should handle undefined navigation profile gracefully', () => {
      const { container } = render(
        <QuestionRenderer config={{ navigationProfile: undefined }} />
      );
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
      expect(screen.getByText('Test question text')).toBeInTheDocument();
    });

    it('should handle invalid navigation profile with fallback', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      render(
        <QuestionRenderer config={{ navigationProfile: 'nonexistent_profile' as any }} />
      );
      
      // Should log warning and use fallback
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Navigation profile 'nonexistent_profile' not found")
      );
      
      consoleSpy.mockRestore();
    });

    it('should use correct fallback chain: requested -> clinical -> standard -> minimal', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock NAVIGATION_PROFILES to be empty to test final fallback
      const originalProfiles = { ...NAVIGATION_PROFILES };
      Object.keys(NAVIGATION_PROFILES).forEach(key => {
        delete (NAVIGATION_PROFILES as any)[key];
      });
      
      render(<QuestionRenderer config={{ navigationProfile: 'invalid' as any }} />);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'No navigation profiles found, using minimal safe configuration'
      );
      
      // Restore original profiles
      Object.assign(NAVIGATION_PROFILES, originalProfiles);
      consoleSpy.mockRestore();
    });
  });

  describe('FIX 2: Centralized Auto-Advance Coordinator', () => {
    it('should cancel pending auto-advance when manual advance is triggered', async () => {
      const mockCancelNavigation = jest.fn();
      const mockHandleNext = jest.fn();
      
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        cancelNavigation: mockCancelNavigation,
        handleNext: mockHandleNext,
        shouldAutoAdvance: true,
        getNavigationState: () => ({
          ...mockNavigationState,
          willAutoAdvance: true,
          hasPendingAutoAdvance: true
        })
      });

      render(<QuestionRenderer />);
      
      const advanceButton = screen.getByText('Avançar agora');
      fireEvent.click(advanceButton);
      
      await waitFor(() => {
        expect(mockCancelNavigation).toHaveBeenCalled();
        expect(mockHandleNext).toHaveBeenCalled();
      });
    });

    it('should disable manual advance button during navigation', () => {
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: () => ({
          ...mockNavigationState,
          isNavigating: true,
          willAutoAdvance: true
        })
      });

      render(<QuestionRenderer />);
      
      const advanceButton = screen.getByText('Processando...');
      expect(advanceButton).toBeDisabled();
    });
  });

  describe('FIX 3: Unified Validation Error Manager', () => {
    it('should prioritize global validation state over local state', async () => {
      const mockStateWithError = {
        ...mockState,
        validationErrors: { test_question: 'Global validation error' }
      };

      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: mockStateWithError
      });

      render(<QuestionRenderer />);
      
      await waitFor(() => {
        expect(screen.getByText('Global validation error')).toBeInTheDocument();
      });
    });

    it('should clear local error state when global state clears', async () => {
      // First render with error
      const { rerender } = render(<QuestionRenderer />);
      
      // Update to have error
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: {
          ...mockState,
          validationErrors: { test_question: 'Test error' }
        }
      });

      rerender(<QuestionRenderer />);
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Clear error
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: {
          ...mockState,
          validationErrors: {}
        }
      });

      rerender(<QuestionRenderer />);
      await waitFor(() => {
        expect(screen.queryByText('Test error')).not.toBeInTheDocument();
      });
    });

    it('should prevent infinite loops by checking error message changes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockStateWithError = {
        ...mockState,
        validationErrors: { test_question: 'Same error message' }
      };

      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: mockStateWithError
      });

      render(<QuestionRenderer />);
      
      // Should only log once for the same error message
      expect(consoleSpy).toHaveBeenCalledWith(
        'Validation error synchronized from global state:', 
        'Same error message'
      );
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      
      consoleSpy.mockRestore();
    });
  });

  describe('FIX 4: Reactive Button State System', () => {
    it('should cache navigation state to prevent repeated function calls', () => {
      const mockGetNavigationState = jest.fn(() => mockNavigationState);
      
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: mockGetNavigationState
      });

      render(<QuestionRenderer />);
      
      // Should call getNavigationState only once due to useMemo caching
      expect(mockGetNavigationState).toHaveBeenCalledTimes(1);
    });

    it('should synchronize button states with navigation state', () => {
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: () => ({
          ...mockNavigationState,
          canNavigateNext: false,
          canNavigatePrevious: false,
          isNavigating: true
        })
      });

      render(<QuestionRenderer />);
      
      const previousButton = screen.getByText('Voltar');
      const nextButton = screen.getByText('Processando...');
      
      expect(previousButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should update button text based on navigation state', () => {
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: () => ({
          ...mockNavigationState,
          isNavigating: false
        })
      });

      render(<QuestionRenderer />);
      
      expect(screen.getByText('Próximo')).toBeInTheDocument();
      
      // Test with navigating state
      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: () => ({
          ...mockNavigationState,
          isNavigating: true
        })
      });

      const { rerender } = render(<QuestionRenderer />);
      rerender(<QuestionRenderer />);
      
      expect(screen.getByText('Processando...')).toBeInTheDocument();
    });
  });

  describe('FIX 5: Bounds-Safe Question Indexing', () => {
    it('should handle null currentQuestion gracefully', () => {
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        getCurrentQuestion: () => null,
        getVisibleQuestions: () => []
      });

      const { container } = render(<QuestionRenderer />);
      
      // Should render without crashing
      expect(container).toBeInTheDocument();
    });

    it('should adjust question index when out of bounds', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const visibleQuestions = [mockCurrentQuestion];
      
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: {
          ...mockState,
          currentQuestionIndex: 5 // Out of bounds
        },
        getCurrentQuestion: () => null, // Simulates out of bounds
        getVisibleQuestions: () => visibleQuestions
      });

      render(<QuestionRenderer />);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Question index bounds adjusted from 5 to 0')
      );
      
      consoleSpy.mockRestore();
    });

    it('should return safe fallback when question is null but visible questions exist', () => {
      const visibleQuestions = [mockCurrentQuestion];
      
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        getCurrentQuestion: () => null,
        getVisibleQuestions: () => visibleQuestions,
        state: {
          ...mockState,
          currentQuestionIndex: 0
        }
      });

      render(<QuestionRenderer />);
      
      // Should render the fallback question
      expect(screen.getByText('Test question text')).toBeInTheDocument();
    });
  });

  describe('Integration: All Fixes Working Together', () => {
    it('should handle complex scenario with all fixes applied', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Complex scenario: invalid profile + validation errors + bounds issues + navigation conflicts
      mockUseQuestionnaire.mockReturnValue({
        ...mockUseQuestionnaire(),
        state: {
          ...mockState,
          currentQuestionIndex: 10, // Out of bounds
          validationErrors: { test_question: 'Complex validation error' }
        },
        getCurrentQuestion: () => null,
        getVisibleQuestions: () => [mockCurrentQuestion]
      });

      mockUseUnifiedNavigation.mockReturnValue({
        ...mockUseUnifiedNavigation(),
        getNavigationState: () => ({
          ...mockNavigationState,
          isNavigating: true,
          canNavigateNext: false
        }),
        shouldAutoAdvance: true
      });

      const { container } = render(
        <QuestionRenderer config={{ navigationProfile: 'invalid_profile' as any }} />
      );
      
      // Should handle all issues gracefully
      expect(container).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Complex validation error')).toBeInTheDocument();
        expect(screen.getByText('Test question text')).toBeInTheDocument();
      });
      
      // Should have logged warnings for profile and bounds issues
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Navigation profile 'invalid_profile' not found")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Question index bounds adjusted from 10 to 0')
      );
      
      consoleSpy.mockRestore();
    });

    it('should maintain performance with all fixes active', () => {
      const startTime = performance.now();
      
      render(<QuestionRenderer />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 100ms for this simple case)
      expect(renderTime).toBeLessThan(100);
    });
  });
});