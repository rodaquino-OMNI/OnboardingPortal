/**
 * Health Questionnaire Consolidation - Integration Test Suite
 * Tests the unified health flow, component integration, and performance optimizations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';
import { SmartHealthQuestionnaire } from '@/components/health/SmartHealthQuestionnaire';

// Mock the dependencies
jest.mock('@/lib/unified-health-flow');
jest.mock('@/components/health/SmartHealthQuestionnaire');

describe('Health Questionnaire Consolidation - Integration Tests', () => {
  let mockFlow: any;
  let mockOnComplete: jest.Mock;
  let mockOnDomainChange: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFlow = {
      processResponse: jest.fn(),
      getCurrentDomain: jest.fn().mockReturnValue('Avaliação Inicial'),
      getCurrentLayer: jest.fn().mockReturnValue('Triage'),
      getResponses: jest.fn().mockReturnValue({}),
      getProgress: jest.fn().mockReturnValue(0),
      getEstimatedTime: jest.fn().mockReturnValue(5)
    };

    (UnifiedHealthFlow as jest.Mock).mockImplementation(() => mockFlow);
    mockOnComplete = jest.fn();
    mockOnDomainChange = jest.fn();
  });

  describe('Unified Component Integration', () => {
    it('should seamlessly integrate all health questionnaire components', async () => {
      // Mock initial flow response
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'unified_age',
          text: 'Qual é sua idade?',
          type: 'number',
          domain: 'demographic',
          riskWeight: 1,
          min: 0,
          max: 120
        },
        progress: 5,
        currentDomain: 'Dados Demográficos',
        currentLayer: 'Básico',
        estimatedTimeRemaining: 8
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Verify unified initialization
      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('_init', true);
      });

      // Verify question rendering
      await waitFor(() => {
        expect(screen.getByText('Qual é sua idade?')).toBeInTheDocument();
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });

      // Test unified response handling
      fireEvent.change(screen.getByDisplayValue(''), { target: { value: '35' } });
      fireEvent.blur(screen.getByDisplayValue('35'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('unified_age', 35);
      });
    });

    it('should handle complex domain transitions in unified flow', async () => {
      // Start with triage
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'question',
        question: {
          id: 'emergency_check',
          text: 'Você tem alguma condição de emergência?',
          type: 'multiselect',
          domain: 'emergency',
          options: [
            { value: 'chest_pain', label: 'Dor no peito' },
            { value: 'breathing_difficulty', label: 'Dificuldade respiratória' },
            { value: 'none', label: 'Nenhuma' }
          ]
        },
        progress: 10,
        currentDomain: 'Triagem',
        currentLayer: 'Emergência',
        estimatedTimeRemaining: 7
      });

      // Then transition to pain domain
      mockFlow.processResponse.mockResolvedValueOnce({
        type: 'domain_transition',
        domain: { id: 'pain_management', name: 'Gestão da Dor' },
        message: 'Avaliando necessidade de gestão da dor',
        progress: 25,
        currentDomain: 'Gestão da Dor',
        currentLayer: 'Inicial',
        estimatedTimeRemaining: 6
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Você tem alguma condição de emergência?')).toBeInTheDocument();
      });

      // Select emergency condition
      fireEvent.click(screen.getByText('Dor no peito'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('emergency_check', ['chest_pain']);
      });

      // Verify domain transition
      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('pain_management');
      });
    });

    it('should maintain state consistency across component changes', async () => {
      const responses = {
        age: 45,
        gender: 'female',
        emergency_check: ['none'],
        pain_level: 6
      };

      mockFlow.getResponses.mockReturnValue(responses);
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'chronic_conditions',
          text: 'Você tem condições crônicas?',
          type: 'boolean',
          domain: 'chronic_disease'
        },
        progress: 60,
        currentDomain: 'Doenças Crônicas',
        currentLayer: 'Triagem',
        estimatedTimeRemaining: 3
      });

      const { rerender } = render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Você tem condições crônicas?')).toBeInTheDocument();
      });

      // Re-render should maintain state
      rerender(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      expect(mockFlow.getResponses).toHaveBeenCalled();
      expect(screen.getByText('Você tem condições crônicas?')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization Validation', () => {
    it('should render questions efficiently without re-renders', async () => {
      const renderSpy = jest.fn();
      
      const TestWrapper = ({ children }: { children: React.ReactNode }) => {
        renderSpy();
        return <div>{children}</div>;
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'optimized_question',
          text: 'Test question for optimization',
          type: 'scale',
          domain: 'test',
          options: Array.from({ length: 11 }, (_, i) => ({
            value: i,
            label: i.toString()
          }))
        },
        progress: 30,
        currentDomain: 'Test',
        currentLayer: 'Optimization',
        estimatedTimeRemaining: 4
      });

      render(
        <TestWrapper>
          <UnifiedHealthAssessment
            onComplete={mockOnComplete}
            onDomainChange={mockOnDomainChange}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test question for optimization')).toBeInTheDocument();
      });

      // Should render only once initially
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // User interaction shouldn't trigger unnecessary re-renders
      fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });

      // Wait a bit and verify no extra renders
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle large datasets efficiently', async () => {
      const largeOptionsList = Array.from({ length: 100 }, (_, i) => ({
        value: `option_${i}`,
        label: `Option ${i}`,
        description: `Description for option ${i}`
      }));

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'large_dataset_test',
          text: 'Select from many options',
          type: 'select',
          domain: 'performance',
          options: largeOptionsList
        },
        progress: 40,
        currentDomain: 'Performance Test',
        currentLayer: 'Large Dataset',
        estimatedTimeRemaining: 3
      });

      const startTime = performance.now();

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select from many options')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render efficiently even with large datasets
      expect(renderTime).toBeLessThan(1000); // Less than 1 second
      expect(screen.getByText('Option 0')).toBeInTheDocument();
      expect(screen.getByText('Option 99')).toBeInTheDocument();
    });

    it('should optimize memory usage for long questionnaires', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate long questionnaire with many questions
      for (let i = 0; i < 50; i++) {
        mockFlow.processResponse.mockResolvedValueOnce({
          type: 'question',
          question: {
            id: `memory_test_${i}`,
            text: `Question ${i}`,
            type: 'boolean',
            domain: 'memory_test'
          },
          progress: (i / 50) * 100,
          currentDomain: 'Memory Test',
          currentLayer: `Question ${i}`,
          estimatedTimeRemaining: 50 - i
        });
      }

      const { unmount } = render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Process through questions
      for (let i = 0; i < 10; i++) {
        await waitFor(() => {
          expect(screen.getByText(`Question ${i}`)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('✅ Sim'));

        await waitFor(() => {
          expect(mockFlow.processResponse).toHaveBeenCalledWith(`memory_test_${i}`, true);
        });
      }

      unmount();

      // Memory usage should not grow excessively
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      if (initialMemory > 0) {
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle flow processing errors gracefully', async () => {
      mockFlow.processResponse.mockRejectedValue(new Error('Flow processing failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error processing response:', expect.any(Error));
      });

      // Should show error state
      expect(screen.getByText('Erro ao processar questionário')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should recover from temporary failures', async () => {
      // First call fails
      mockFlow.processResponse
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          type: 'question',
          question: {
            id: 'recovery_test',
            text: 'Recovery question',
            type: 'boolean',
            domain: 'recovery'
          },
          progress: 50,
          currentDomain: 'Recovery Test',
          currentLayer: 'Resilience',
          estimatedTimeRemaining: 2
        });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      // Should show error initially
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Click retry button
      fireEvent.click(screen.getByText('Tentar novamente'));

      // Should recover and show question
      await waitFor(() => {
        expect(screen.getByText('Recovery question')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should validate responses before processing', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'validation_test',
          text: 'Enter your age',
          type: 'number',
          domain: 'validation',
          min: 0,
          max: 120,
          required: true
        },
        progress: 25,
        currentDomain: 'Validation Test',
        currentLayer: 'Input Validation',
        estimatedTimeRemaining: 5
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Enter your age')).toBeInTheDocument();
      });

      // Test invalid input
      fireEvent.change(screen.getByDisplayValue(''), { target: { value: '150' } });
      fireEvent.blur(screen.getByDisplayValue('150'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Valor deve estar entre 0 e 120')).toBeInTheDocument();
      });

      // Should not process invalid response
      expect(mockFlow.processResponse).not.toHaveBeenCalledWith('validation_test', 150);
    });
  });

  describe('Accessibility and Usability', () => {
    it('should provide proper ARIA labels and keyboard navigation', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'accessibility_test',
          text: 'Rate your pain level',
          type: 'scale',
          domain: 'accessibility',
          options: Array.from({ length: 11 }, (_, i) => ({
            value: i,
            label: i.toString(),
            description: `Pain level ${i}`
          }))
        },
        progress: 60,
        currentDomain: 'Accessibility Test',
        currentLayer: 'ARIA Compliance',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-label', 'Rate your pain level');
        expect(slider).toHaveAttribute('aria-valuemin', '0');
        expect(slider).toHaveAttribute('aria-valuemax', '10');
        expect(slider).toHaveAttribute('aria-valuenow', '0');
      });

      // Test keyboard navigation
      const slider = screen.getByRole('slider');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(slider).toHaveAttribute('aria-valuenow', '1');
    });

    it('should support screen readers with descriptive text', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'screen_reader_test',
          text: 'Do you have diabetes?',
          type: 'boolean',
          domain: 'chronic_disease',
          metadata: {
            screenReaderHelp: 'This question helps assess your risk for complications'
          }
        },
        progress: 70,
        currentDomain: 'Chronic Disease Assessment',
        currentLayer: 'Diabetes Screening',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Do you have diabetes?')).toBeInTheDocument();
        expect(screen.getByText('This question helps assess your risk for complications')).toBeInTheDocument();
      });

      // Verify screen reader support
      const yesButton = screen.getByText('✅ Sim');
      expect(yesButton).toHaveAttribute('role', 'button');
      expect(yesButton).toHaveAttribute('aria-label', 'Sim, tenho diabetes');
    });
  });

  describe('Integration with Gamification', () => {
    it('should trigger gamification events on questionnaire milestones', async () => {
      const mockGamificationTrigger = jest.fn();
      
      // Mock gamification integration
      (global as any).gamificationHooks = {
        triggerEvent: mockGamificationTrigger
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'domain_complete',
        domain: { id: 'chronic_disease', name: 'Chronic Disease Assessment' },
        completedQuestions: 15,
        totalQuestions: 50,
        progress: 30,
        currentDomain: 'Mental Health Assessment',
        currentLayer: 'Initial',
        estimatedTimeRemaining: 4,
        gamificationEvent: {
          type: 'domain_completed',
          points: 50,
          badge: 'chronic_disease_expert'
        }
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(mockGamificationTrigger).toHaveBeenCalledWith({
          type: 'domain_completed',
          points: 50,
          badge: 'chronic_disease_expert'
        });
      });

      delete (global as any).gamificationHooks;
    });

    it('should award points for completing difficult questions', async () => {
      const mockPointsAwarded = jest.fn();

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'complex_medical_history',
          text: 'Describe your complete medical history',
          type: 'text',
          domain: 'medical_history',
          difficulty: 'high',
          points: 25
        },
        progress: 85,
        currentDomain: 'Medical History',
        currentLayer: 'Comprehensive',
        estimatedTimeRemaining: 1,
        onPointsAwarded: mockPointsAwarded
      });

      render(
        <UnifiedHealthAssessment
          onComplete={mockOnComplete}
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Describe your complete medical history')).toBeInTheDocument();
      });

      // Complete the difficult question
      fireEvent.change(
        screen.getByPlaceholderText('Digite sua resposta'),
        { target: { value: 'Detailed medical history response' } }
      );

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith(
          'complex_medical_history',
          'Detailed medical history response'
        );
      });
    });
  });
});