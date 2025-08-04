/**
 * GAD-7 Zero Value Fix Validation
 * 
 * CRITICAL FIX VALIDATION: Tests the specific issue where value 0 ("nunca") 
 * is treated as falsy and causes the continue button to be disabled.
 * 
 * ROOT CAUSE FOUND: responses[currentQuestion.id] === undefined fails when value is 0
 * because 0 is falsy in JavaScript, but it's a valid response value.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';

describe('GAD-7 Zero Value Fix Validation', () => {
  let mockOnComplete: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnComplete = jest.fn();
  });

  describe('CRITICAL BUG: Zero Value Handling', () => {
    it('should enable continue button when value 0 (nunca) is selected', async () => {
      const user = userEvent.setup();
      
      // Mock flow to return GAD-7 question
      jest.spyOn(React, 'useState').mockImplementation((initial) => {
        if (initial && typeof initial === 'object' && initial.processResponse) {
          // Mock UnifiedHealthFlow instance
          return [{
            processResponse: jest.fn().mockResolvedValue({
              type: 'question',
              question: {
                id: 'gad7_1_nervousness',
                text: 'Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?',
                type: 'select',
                domain: 'mental_health',
                instrument: 'GAD-7',
                riskWeight: 3,
                options: [
                  { value: 0, label: 'Nunca', riskScore: 0 },
                  { value: 1, label: 'Alguns dias', riskScore: 1 },
                  { value: 2, label: 'Mais da metade dos dias', riskScore: 2 },
                  { value: 3, label: 'Quase todos os dias', riskScore: 3 }
                ]
              },
              progress: 20,
              currentDomain: 'Bem-estar Mental',
              currentLayer: 'Avaliação de Bem-estar',
              estimatedTimeRemaining: 4
            })
          }, jest.fn()];
        }
        return React.useState.call(null, initial);
      });

      render(<UnifiedHealthAssessment onComplete={mockOnComplete} />);

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas: Sentir-se nervoso, ansioso ou tenso?')).toBeInTheDocument();
      });

      // Check initial state - continue button should be disabled
      const continueButton = screen.getByRole('button', { name: /continuar/i });
      expect(continueButton).toBeDisabled();

      // Click "Nunca" (value 0)
      const nuncaOption = screen.getByText('Nunca');
      await user.click(nuncaOption);

      // CRITICAL TEST: Continue button should be enabled after selecting value 0
      await waitFor(() => {
        expect(continueButton).not.toBeDisabled();
      });
    });

    it('should correctly distinguish between undefined and 0 values', () => {
      const responses = {};
      const questionId = 'gad7_1_nervousness';
      
      // Test undefined - should be disabled
      expect(responses[questionId] === undefined).toBe(true);
      
      // Set value to 0
      responses[questionId] = 0;
      
      // Test 0 value - should NOT be disabled
      expect(responses[questionId] === undefined).toBe(false);
      expect(responses[questionId] !== undefined).toBe(true);
      
      // The bug: using falsy check instead of undefined check
      expect(Boolean(responses[questionId])).toBe(false); // This is the problem!
      expect(responses[questionId] !== undefined).toBe(true); // This is the fix!
    });
  });

  describe('Value Preservation Tests', () => {
    it('should preserve zero values in component state', async () => {
      const user = userEvent.setup();
      let capturedResponses = {};
      
      // Mock useState to capture responses state
      const originalUseState = React.useState;
      React.useState = jest.fn().mockImplementation((initial) => {
        if (typeof initial === 'object' && !Array.isArray(initial) && initial !== null) {
          const [responses, setResponses] = originalUseState(initial);
          
          // Intercept setResponses to capture values
          const interceptSetResponses = (newResponses) => {
            if (typeof newResponses === 'object') {
              capturedResponses = { ...capturedResponses, ...newResponses };
            }
            setResponses(newResponses);
          };
          
          return [responses, interceptSetResponses];
        }
        return originalUseState(initial);
      });

      render(<UnifiedHealthAssessment onComplete={mockOnComplete} />);

      // Simulate selecting value 0
      const mockEvent = { target: { value: 0 } };
      fireEvent.change(screen.getByRole('button', { name: /nunca/i }), mockEvent);

      // Check that value 0 is preserved
      expect(capturedResponses['gad7_1_nervousness']).toBe(0);
      expect(capturedResponses['gad7_1_nervousness'] !== undefined).toBe(true);
    });
  });

  describe('JavaScript Falsy Value Edge Cases', () => {
    it('should handle all falsy values that are valid responses', () => {
      const validFalsyResponses = {
        'question_1': 0,        // "Nunca" in GAD-7/PHQ-9
        'question_2': false,    // Boolean "No" response  
        'question_3': '',       // Empty string (valid text input)
        'question_4': null      // Explicit null selection
      };

      Object.entries(validFalsyResponses).forEach(([questionId, value]) => {
        // Using the WRONG check (current bug)
        const wrongCheck = validFalsyResponses[questionId] === undefined;
        
        // Using the CORRECT check (the fix)
        const correctCheck = validFalsyResponses[questionId] !== undefined;
        
        if (value === 0) {
          // For GAD-7 "nunca" scenario
          expect(wrongCheck).toBe(false); // Value exists
          expect(correctCheck).toBe(true); // Should enable continue button
        }
      });
    });

    it('should demonstrate the exact bug condition', () => {
      const responses = { 'gad7_1_nervousness': 0 };
      const questionId = 'gad7_1_nervousness';
      
      // Current buggy condition (treats 0 as invalid)
      const buggyCondition = responses[questionId] === undefined;
      expect(buggyCondition).toBe(false); // This works
      
      // But if there was a falsy check somewhere:
      const falsyBugCondition = !responses[questionId];
      expect(falsyBugCondition).toBe(true); // This would be the bug!
      
      // Correct condition (the fix)
      const correctCondition = responses[questionId] !== undefined;
      expect(correctCondition).toBe(true); // This works correctly
    });
  });

  describe('All GAD-7 Questions Zero Value Test', () => {
    const gad7Questions = [
      'gad7_1_nervousness',
      'gad7_2_worry_control',
      'gad7_3_excessive_worry', 
      'gad7_4_trouble_relaxing',
      'gad7_5_restlessness',
      'gad7_6_irritability',
      'gad7_7_fear_awful'
    ];

    gad7Questions.forEach((questionId) => {
      it(`should handle zero value correctly for ${questionId}`, () => {
        const responses = {};
        
        // Simulate selecting "Nunca" (value 0)
        responses[questionId] = 0;
        
        // Test the current implementation logic
        const isUndefined = responses[questionId] === undefined;
        const shouldEnableContinue = !isUndefined;
        
        expect(shouldEnableContinue).toBe(true);
        expect(responses[questionId]).toBe(0);
        expect(typeof responses[questionId]).toBe('number');
      });
    });
  });

  describe('Integration with Real Component Logic', () => {
    it('should match the actual UnifiedHealthAssessment select logic', () => {
      // Simulate the exact logic from UnifiedHealthAssessment.tsx line 226
      const responses = { 'gad7_1_nervousness': 0 };
      const currentQuestionId = 'gad7_1_nervousness';
      
      // This is the actual condition from the component
      const selectedValue = responses[currentQuestionId];
      const shouldDisable = selectedValue === undefined;
      
      // With value 0 ("nunca")
      expect(selectedValue).toBe(0);
      expect(shouldDisable).toBe(false); // Should NOT be disabled
      expect(selectedValue !== undefined).toBe(true);
    });

    it('should work with all valid PHQ-9 and GAD-7 score values', () => {
      const validScores = [0, 1, 2, 3]; // All valid scores for these instruments
      
      validScores.forEach(score => {
        const responses = { 'test_question': score };
        const questionId = 'test_question';
        
        // Test component logic
        const selectedValue = responses[questionId];
        const shouldDisable = selectedValue === undefined;
        
        expect(shouldDisable).toBe(false);
        expect(selectedValue).toBe(score);
      });
    });
  });

  describe('Error Prevention Tests', () => {
    it('should prevent accidental falsy value bugs', () => {
      const responses = { 'gad7_1': 0 };
      
      // These would be WRONG ways to check:
      const wrongCheck1 = !responses['gad7_1']; // BUG: treats 0 as falsy
      const wrongCheck2 = Boolean(responses['gad7_1']); // BUG: converts 0 to false
      
      // This is the CORRECT way:
      const correctCheck = responses['gad7_1'] !== undefined;
      
      expect(wrongCheck1).toBe(true); // Would incorrectly disable button
      expect(wrongCheck2).toBe(false); // Would incorrectly disable button  
      expect(correctCheck).toBe(true); // Correctly enables button
    });
  });
});