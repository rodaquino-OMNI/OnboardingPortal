import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useUnifiedNavigation, NAVIGATION_PROFILES } from '@/hooks/useUnifiedNavigation';
import { HealthQuestion } from '@/types';

describe('Health Questionnaire Navigation - Zero Value Bug Fix', () => {
  // Test question similar to AUDIT-C where "Nunca" = 0
  const mockQuestion: HealthQuestion = {
    id: 'alcohol_frequency',
    text: 'Com que frequência você toma bebidas alcoólicas?',
    type: 'select',
    required: true,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Mensalmente ou menos' },
      { value: 2, label: '2-4 vezes por mês' },
      { value: 3, label: '2-3 vezes por semana' },
      { value: 4, label: '4 ou mais vezes por semana' }
    ],
    metadata: {
      validatedTool: 'AUDIT-C'
    }
  };

  const mockCallbacks = {
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onValidationError: jest.fn(),
    onProgress: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation State with Zero Values', () => {
    it('should enable "Próximo" button when user selects "Nunca" (value=0)', () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          0, // User selected "Nunca" which has value 0
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      
      // CRITICAL ASSERTION: Button should be ENABLED when value is 0
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
      expect(navState.validationRequired).toBe(true);
    });

    it('should disable "Próximo" button when no value is selected', () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null, // No value selected
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      
      // Button should be DISABLED when no value
      expect(navState.canNavigateNext).toBe(false);
      expect(navState.hasResponse).toBe(false);
    });

    it('should handle all numeric option values correctly', () => {
      const testCases = [
        { value: 0, expected: true, label: 'Nunca' },
        { value: 1, expected: true, label: 'Mensalmente' },
        { value: 2, expected: true, label: '2-4 vezes' },
        { value: null, expected: false, label: 'No selection' },
        { value: undefined, expected: false, label: 'Undefined' }
      ];

      testCases.forEach(({ value, expected, label }) => {
        const { result } = renderHook(() =>
          useUnifiedNavigation(
            mockQuestion,
            value as any,
            NAVIGATION_PROFILES.clinical,
            mockCallbacks
          )
        );

        const navState = result.current.getNavigationState();
        expect(navState.canNavigateNext).toBe(expected);
        expect(navState.hasResponse).toBe(expected);
      });
    });
  });

  describe('Validation with Zero Values', () => {
    it('should not show validation error when value is 0', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          0,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      await act(async () => {
        await result.current.handleNext();
      });

      // Should proceed without validation error
      expect(mockCallbacks.onValidationError).not.toHaveBeenCalled();
      expect(mockCallbacks.onNext).toHaveBeenCalled();
    });

    it('should show validation error when required field has no value', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      await act(async () => {
        await result.current.handleNext();
      });

      // Should show validation error
      expect(mockCallbacks.onValidationError).toHaveBeenCalledWith('Este campo é obrigatório');
      expect(mockCallbacks.onNext).not.toHaveBeenCalled();
    });
  });

  describe('Different Question Types with Zero/False Values', () => {
    it('should handle boolean questions with false value', () => {
      const boolQuestion: HealthQuestion = {
        id: 'has_condition',
        text: 'Você tem esta condição?',
        type: 'boolean',
        required: true
      };

      const { result } = renderHook(() =>
        useUnifiedNavigation(
          boolQuestion,
          false, // User selected "Não"
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });

    it('should handle scale questions with 0 value', () => {
      const scaleQuestion: HealthQuestion = {
        id: 'pain_scale',
        text: 'Qual o nível de dor?',
        type: 'scale',
        required: true,
        validation: { min: 0, max: 10 }
      };

      const { result } = renderHook(() =>
        useUnifiedNavigation(
          scaleQuestion,
          0, // No pain
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });

    it('should handle number questions with 0 value', () => {
      const numberQuestion: HealthQuestion = {
        id: 'cigarettes_per_day',
        text: 'Quantos cigarros por dia?',
        type: 'number',
        required: true,
        validation: { min: 0, max: 100 }
      };

      const { result } = renderHook(() =>
        useUnifiedNavigation(
          numberQuestion,
          0, // Non-smoker
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });
  });

  describe('PHQ-9 and GAD-7 Specific Tests', () => {
    it('should handle PHQ-9 questions with "Nunca" (0) correctly', () => {
      const phq9Question: HealthQuestion = {
        id: 'phq9_little_interest',
        text: 'Pouco interesse ou pouco prazer em fazer as coisas',
        type: 'select',
        required: true,
        options: [
          { value: 0, label: 'Nunca' },
          { value: 1, label: 'Vários dias' },
          { value: 2, label: 'Mais da metade dos dias' },
          { value: 3, label: 'Quase todos os dias' }
        ],
        metadata: {
          validatedTool: 'PHQ-9'
        }
      };

      const { result } = renderHook(() =>
        useUnifiedNavigation(
          phq9Question,
          0,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });

    it('should handle GAD-7 questions with score 0 correctly', () => {
      const gad7Question: HealthQuestion = {
        id: 'gad7_feeling_nervous',
        text: 'Sentir-se nervoso, ansioso ou no limite',
        type: 'select',
        required: true,
        options: [
          { value: 0, label: 'Nunca' },
          { value: 1, label: 'Vários dias' },
          { value: 2, label: 'Mais da metade dos dias' },
          { value: 3, label: 'Quase todos os dias' }
        ],
        metadata: {
          validatedTool: 'GAD-7'
        }
      };

      const { result } = renderHook(() =>
        useUnifiedNavigation(
          gad7Question,
          0,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
    });
  });

  describe('Edge Cases and Regression Tests', () => {
    it('should distinguish between 0 and "0" string', () => {
      const { result: numericResult } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          0, // Numeric zero
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const { result: stringResult } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          "0", // String zero
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Both should be valid
      expect(numericResult.current.getNavigationState().canNavigateNext).toBe(true);
      expect(stringResult.current.getNavigationState().canNavigateNext).toBe(true);
    });

    it('should handle empty string as invalid for select questions', () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          '', // Empty string
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(false);
      expect(navState.hasResponse).toBe(false);
    });

    it('should handle first option selection in any position', () => {
      // Test that the first option works regardless of its value
      const questionsWithDifferentFirstValues = [
        { firstValue: 0, label: 'Zero as first' },
        { firstValue: 1, label: 'One as first' },
        { firstValue: -1, label: 'Negative as first' },
        { firstValue: 'a', label: 'String as first' }
      ];

      questionsWithDifferentFirstValues.forEach(({ firstValue }) => {
        const question: HealthQuestion = {
          id: 'test_question',
          text: 'Test question',
          type: 'select',
          required: true,
          options: [
            { value: firstValue, label: 'First option' },
            { value: 'other', label: 'Other option' }
          ]
        };

        const { result } = renderHook(() =>
          useUnifiedNavigation(
            question,
            firstValue as any,
            NAVIGATION_PROFILES.clinical,
            mockCallbacks
          )
        );

        const navState = result.current.getNavigationState();
        expect(navState.canNavigateNext).toBe(true);
      });
    });
  });

  describe('Auto-advance with Zero Values', () => {
    it('should not prevent auto-advance when value is 0', () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          { ...mockQuestion, type: 'scale' }, // Scale type auto-advances
          0,
          NAVIGATION_PROFILES.standard,
          mockCallbacks
        )
      );

      // Should be eligible for auto-advance with value 0
      expect(result.current.shouldAutoAdvance).toBe(true);
    });

    it('should prevent auto-advance when value is null', () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          { ...mockQuestion, type: 'scale' },
          null,
          NAVIGATION_PROFILES.standard,
          mockCallbacks
        )
      );

      // Should NOT auto-advance without a value
      expect(result.current.shouldAutoAdvance).toBe(false);
    });
  });
});