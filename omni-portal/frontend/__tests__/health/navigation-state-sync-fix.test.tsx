import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useUnifiedNavigation, NAVIGATION_PROFILES } from '@/hooks/useUnifiedNavigation';
import { HealthQuestion } from '@/types';

describe('Navigation State Synchronization Fix', () => {
  const mockQuestion: HealthQuestion = {
    id: 'audit_c_2',
    text: 'Quantas doses de álcool você toma em um dia típico quando está bebendo?',
    type: 'select',
    required: true,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('State Update Synchronization', () => {
    it('should immediately update navigation state when handleResponse is called', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useUnifiedNavigation(
          mockQuestion,
          value,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        ),
        { initialProps: { value: null } }
      );

      // Initially, button should be disabled
      let navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(false);
      expect(navState.hasResponse).toBe(false);

      // Call handleResponse with value 0 (first option "1 ou 2")
      await act(async () => {
        await result.current.handleResponse(0);
      });

      // Immediately after handleResponse, state should be updated
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);

      // No need to wait for re-render, the ref should be updated immediately
    });

    it('should handle rapid selection changes without race conditions', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Rapidly change selections
      await act(async () => {
        await result.current.handleResponse(0); // Select "1 ou 2"
      });
      
      let navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);

      await act(async () => {
        await result.current.handleResponse(1); // Change to "3 ou 4"
      });
      
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);

      await act(async () => {
        await result.current.handleResponse(2); // Change to "5 ou 6"
      });
      
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);

      // All rapid changes should maintain valid navigation state
    });

    it('should not have stale closure issues with questionValueRef', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Set a value
      await act(async () => {
        await result.current.handleResponse(0);
      });

      // Try to navigate immediately
      await act(async () => {
        await result.current.handleNext();
      });

      // Should successfully navigate without validation error
      expect(mockCallbacks.onValidationError).not.toHaveBeenCalled();
      expect(mockCallbacks.onNext).toHaveBeenCalled();
    });
  });

  describe('First Option Selection Bug', () => {
    it('should enable navigation when first option with value 0 is selected', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Select first option "1 ou 2" which has value 0
      await act(async () => {
        await result.current.handleResponse(0);
      });

      const navState = result.current.getNavigationState();
      
      // CRITICAL: Navigation should be enabled
      expect(navState.canNavigateNext).toBe(true);
      expect(navState.hasResponse).toBe(true);
      
      // Should be able to navigate
      await act(async () => {
        await result.current.handleNext();
      });
      
      expect(mockCallbacks.onNext).toHaveBeenCalled();
      expect(mockCallbacks.onValidationError).not.toHaveBeenCalled();
    });

    it('should handle all AUDIT-C question 2 options correctly', async () => {
      const testCases = [
        { value: 0, label: '1 ou 2', shouldEnable: true },
        { value: 1, label: '3 ou 4', shouldEnable: true },
        { value: 2, label: '5 ou 6', shouldEnable: true },
        { value: 3, label: '7-9', shouldEnable: true },
        { value: 4, label: '10 ou mais', shouldEnable: true },
        { value: null, label: 'No selection', shouldEnable: false }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        
        const { result } = renderHook(() =>
          useUnifiedNavigation(
            mockQuestion,
            null,
            NAVIGATION_PROFILES.clinical,
            mockCallbacks
          )
        );

        if (testCase.value !== null) {
          await act(async () => {
            await result.current.handleResponse(testCase.value);
          });
        }

        const navState = result.current.getNavigationState();
        
        expect(navState.canNavigateNext).toBe(testCase.shouldEnable);
        expect(navState.hasResponse).toBe(testCase.shouldEnable);
        
        console.log(`Testing ${testCase.label}: canNavigateNext=${navState.canNavigateNext}`);
      }
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state between local and navigation hook', async () => {
      let localValue: any = null;
      const setLocalValue = (value: any) => {
        localValue = value;
      };

      const { result, rerender } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          localValue,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Simulate what happens in QuestionRenderer
      const handleResponse = async (value: any) => {
        setLocalValue(value);
        await result.current.handleResponse(value);
      };

      // Select first option
      await act(async () => {
        await handleResponse(0);
      });

      // State should be immediately consistent
      const navState = result.current.getNavigationState();
      expect(navState.hasResponse).toBe(true);
      expect(navState.canNavigateNext).toBe(true);
      
      // Local value should match
      expect(localValue).toBe(0);
    });

    it('should handle navigation state updates without memoization issues', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useUnifiedNavigation(
          mockQuestion,
          value,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        ),
        { initialProps: { value: null } }
      );

      // Get initial state
      let navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(false);

      // Update value prop
      rerender({ value: 0 });

      // State should update without needing handleResponse call
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined vs null correctly', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useUnifiedNavigation(
          mockQuestion,
          value,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        ),
        { initialProps: { value: undefined as any } }
      );

      // Both undefined and null should disable navigation
      let navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(false);

      rerender({ value: null });
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(false);

      // But 0 should enable it
      rerender({ value: 0 });
      navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
    });

    it('should not have double-firing issues', async () => {
      const { result } = renderHook(() =>
        useUnifiedNavigation(
          mockQuestion,
          null,
          NAVIGATION_PROFILES.clinical,
          mockCallbacks
        )
      );

      // Simulate rapid double-click
      await act(async () => {
        await result.current.handleResponse(0);
        await result.current.handleResponse(0); // Same value again
      });

      // Should only process once, state should be valid
      const navState = result.current.getNavigationState();
      expect(navState.canNavigateNext).toBe(true);
      
      // Try to navigate
      await act(async () => {
        await result.current.handleNext();
      });
      
      // Should navigate successfully
      expect(mockCallbacks.onNext).toHaveBeenCalledTimes(1);
    });
  });
});