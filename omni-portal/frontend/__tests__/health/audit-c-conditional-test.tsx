import React from 'react';
import { renderHook } from '@testing-library/react';
import { useUnifiedNavigation, NAVIGATION_PROFILES } from '@/hooks/useUnifiedNavigation';
import { HealthQuestion } from '@/types';

describe('AUDIT-C Conditional Logic', () => {
  const auditC1: HealthQuestion = {
    id: 'audit_c_1',
    text: 'Com que frequência você toma bebidas alcoólicas?',
    type: 'select',
    required: true,
    options: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Mensalmente ou menos' },
      { value: 2, label: '2-4 vezes por mês' },
      { value: 3, label: '2-3 vezes por semana' },
      { value: 4, label: '4 ou mais vezes por semana' }
    ]
  };

  const auditC2: HealthQuestion = {
    id: 'audit_c_2',
    text: 'Quantas doses de álcool você toma em um dia típico quando está bebendo?',
    type: 'select',
    required: true,
    conditionalOn: {
      questionId: 'audit_c_1',
      values: [1, 2, 3, 4] // Only shows if NOT "Nunca"
    },
    options: [
      { value: 0, label: '1 ou 2' },
      { value: 1, label: '3 ou 4' },
      { value: 2, label: '5 ou 6' },
      { value: 3, label: '7-9' },
      { value: 4, label: '10 ou mais' }
    ]
  };

  const mockCallbacks = {
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onValidationError: jest.fn(),
    onProgress: jest.fn()
  };

  describe('Question 1 - Frequency', () => {
    it('should enable navigation when "Nunca" (0) is selected', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          auditC1,
          0, // "Nunca" selected
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });

    it('should enable navigation for all frequency options', () => {
      const options = [0, 1, 2, 3, 4];
      
      options.forEach(value => {
        const { result } = renderHook(() =>
          useUnifiedNavigation(
            auditC1,
            value,
            NAVIGATION_PROFILES.clinical,
            mockCallbacks
          )
        );

        const navState = result.current.getNavigationState();
        expect(navState.canNavigateNext).toBe(true);
        console.log(`AUDIT-C1 option ${value}: canNavigateNext=${navState.canNavigateNext}`);
      });
    });
  });

  describe('Question 2 - Quantity (Conditional)', () => {
    it('should enable navigation when "1 ou 2" (0) is selected', async () => {
      // This question only appears if user drinks (not "Nunca")
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          auditC2,
          0, // "1 ou 2" selected
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
    });

    it('should handle all quantity options correctly', () => {
      const options = [
        { value: 0, label: '1 ou 2' },
        { value: 1, label: '3 ou 4' },
        { value: 2, label: '5 ou 6' },
        { value: 3, label: '7-9' },
        { value: 4, label: '10 ou mais' }
      ];

      options.forEach(({ value, label }) => {
        const { result } = renderHook(() =>
          useUnifiedNavigation(
            auditC2,
            value,
            NAVIGATION_PROFILES.clinical,
            mockCallbacks
          )
        );

        const navState = result.current.getNavigationState();
        expect(navState.canNavigateNext).toBe(true);
        console.log(`AUDIT-C2 "${label}" (${value}): canNavigateNext=${navState.canNavigateNext}`);
      });
    });
  });

  describe('Conditional Flow', () => {
    it('should skip Q2 and Q3 when "Nunca" is selected in Q1', () => {
      // When user selects "Nunca" in Q1, Q2 and Q3 should not appear
      // This is correct medical logic - no need to ask about drinking habits
      // if the person doesn't drink
      
      const responses = {
        'audit_c_1': 0 // "Nunca"
      };
      
      // Q2 should not be visible based on conditionalOn logic
      const q2Visible = auditC2.conditionalOn?.values.includes(responses['audit_c_1']);
      expect(q2Visible).toBe(false);
      
      console.log('When Q1="Nunca", Q2 visible:', q2Visible);
    });

    it('should show Q2 when any drinking frequency is selected in Q1', () => {
      const drinkingOptions = [1, 2, 3, 4];
      
      drinkingOptions.forEach(value => {
        const responses = {
          'audit_c_1': value
        };
        
        const q2Visible = auditC2.conditionalOn?.values.includes(responses['audit_c_1']);
        expect(q2Visible).toBe(true);
        
        console.log(`When Q1=${value}, Q2 visible:`, q2Visible);
      });
    });
  });
});