import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedHealthAssessment } from '@/components/health/UnifiedHealthAssessment';
import { UnifiedHealthFlow } from '@/lib/unified-health-flow';

// Mock the UnifiedHealthFlow
jest.mock('@/lib/unified-health-flow', () => ({
  UnifiedHealthFlow: jest.fn(),
  UNIVERSAL_TRIAGE: {
    id: 'universal_triage',
    name: 'Avaliação Inicial',
    description: 'Test description',
    estimatedSeconds: 60,
    questions: []
  }
}));

describe('UnifiedHealthAssessment', () => {
  let mockFlow: any;
  let mockOnComplete: jest.Mock;
  let mockOnDomainChange: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock flow instance
    mockFlow = {
      processResponse: jest.fn(),
      getCurrentDomain: jest.fn().mockReturnValue('Avaliação Inicial'),
      getCurrentLayer: jest.fn().mockReturnValue('Triage'),
      getResponses: jest.fn().mockReturnValue({})
    };

    // Setup UnifiedHealthFlow mock
    (UnifiedHealthFlow as jest.Mock).mockImplementation(() => mockFlow);

    // Create mock callbacks
    mockOnComplete = jest.fn();
    mockOnDomainChange = jest.fn();
  });

  describe('Component Initialization', () => {
    it('should render loading state initially', () => {
      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      expect(screen.getByText('Iniciando avaliação...')).toBeInTheDocument();
    });

    it('should initialize assessment on mount', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'test-question',
          text: 'Test Question?',
          type: 'boolean',
          domain: 'test',
          riskWeight: 1
        },
        progress: 10,
        currentDomain: 'Test Domain',
        currentLayer: 'Test Layer',
        estimatedTimeRemaining: 5
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('_init', true);
      });
    });
  });

  describe('Question Rendering', () => {
    it('should render scale questions correctly', async () => {
      const scaleQuestion = {
        id: 'pain-scale',
        text: 'Rate your pain',
        type: 'scale',
        domain: 'pain',
        riskWeight: 2,
        options: Array.from({ length: 11 }, (_, i) => ({
          value: i,
          label: i.toString(),
          emoji: '😊'
        }))
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: scaleQuestion,
        progress: 20,
        currentDomain: 'Pain',
        currentLayer: 'Assessment',
        estimatedTimeRemaining: 4
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rate your pain')).toBeInTheDocument();
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });
    });

    it('should render select questions correctly', async () => {
      const selectQuestion = {
        id: 'mood',
        text: 'How is your mood?',
        type: 'select',
        domain: 'mental_health',
        riskWeight: 3,
        options: [
          { value: 'good', label: 'Good', emoji: '😊' },
          { value: 'bad', label: 'Bad', emoji: '😢' }
        ]
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: selectQuestion,
        progress: 30,
        currentDomain: 'Mental Health',
        currentLayer: 'Mood',
        estimatedTimeRemaining: 3
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('How is your mood?')).toBeInTheDocument();
        expect(screen.getByText('Good')).toBeInTheDocument();
        expect(screen.getByText('Bad')).toBeInTheDocument();
      });
    });

    it('should render boolean questions correctly', async () => {
      const booleanQuestion = {
        id: 'chronic',
        text: 'Do you have chronic conditions?',
        type: 'boolean',
        domain: 'chronic_disease',
        riskWeight: 4
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: booleanQuestion,
        progress: 40,
        currentDomain: 'Chronic Disease',
        currentLayer: 'Screening',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Do you have chronic conditions?')).toBeInTheDocument();
        expect(screen.getByText('✅ Sim')).toBeInTheDocument();
        expect(screen.getByText('❌ Não')).toBeInTheDocument();
      });
    });

    it('should render multiselect questions correctly', async () => {
      const multiselectQuestion = {
        id: 'conditions',
        text: 'Select all that apply',
        type: 'multiselect',
        domain: 'chronic_disease',
        riskWeight: 5,
        options: [
          { value: 'diabetes', label: 'Diabetes' },
          { value: 'hypertension', label: 'Hypertension' },
          { value: 'none', label: 'None' }
        ]
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: multiselectQuestion,
        progress: 50,
        currentDomain: 'Chronic Disease',
        currentLayer: 'Conditions',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select all that apply')).toBeInTheDocument();
        expect(screen.getByText('Selecione todas as opções que se aplicam:')).toBeInTheDocument();
        expect(screen.getByText('Diabetes')).toBeInTheDocument();
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('should render text/number input questions correctly', async () => {
      const textQuestion = {
        id: 'medications',
        text: 'List your medications',
        type: 'text',
        domain: 'chronic_disease',
        riskWeight: 1
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: textQuestion,
        progress: 60,
        currentDomain: 'Chronic Disease',
        currentLayer: 'Medications',
        estimatedTimeRemaining: 1
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('List your medications')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Digite sua resposta')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should process scale responses correctly', async () => {
      const scaleQuestion = {
        id: 'pain-scale',
        text: 'Rate your pain',
        type: 'scale',
        domain: 'pain',
        riskWeight: 2,
        options: Array.from({ length: 11 }, (_, i) => ({
          value: i,
          label: i.toString(),
          emoji: '😊'
        }))
      };

      mockFlow.processResponse
        .mockResolvedValueOnce({
          type: 'question',
          question: scaleQuestion,
          progress: 20,
          currentDomain: 'Pain',
          currentLayer: 'Assessment',
          estimatedTimeRemaining: 4
        })
        .mockResolvedValueOnce({
          type: 'complete',
          results: { riskLevel: 'low' },
          progress: 100,
          currentDomain: 'Complete',
          currentLayer: 'Done',
          estimatedTimeRemaining: 0
        });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('slider')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('pain-scale', 7);
      });
    });

    it('should process select responses correctly', async () => {
      const selectQuestion = {
        id: 'mood',
        text: 'How is your mood?',
        type: 'select',
        domain: 'mental_health',
        riskWeight: 3,
        options: [
          { value: 'good', label: 'Good', emoji: '😊' },
          { value: 'bad', label: 'Bad', emoji: '😢' }
        ]
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: selectQuestion,
        progress: 30,
        currentDomain: 'Mental Health',
        currentLayer: 'Mood',
        estimatedTimeRemaining: 3
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Good')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Good'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('mood', 'good');
      });
    });

    it('should process boolean responses correctly', async () => {
      const booleanQuestion = {
        id: 'chronic',
        text: 'Do you have chronic conditions?',
        type: 'boolean',
        domain: 'chronic_disease',
        riskWeight: 4
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: booleanQuestion,
        progress: 40,
        currentDomain: 'Chronic Disease',
        currentLayer: 'Screening',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('✅ Sim')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('✅ Sim'));

      await waitFor(() => {
        expect(mockFlow.processResponse).toHaveBeenCalledWith('chronic', true);
      });
    });
  });

  describe('Domain Transitions', () => {
    it('should handle domain transitions correctly', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'domain_transition',
        domain: { id: 'pain_management', name: 'Pain Management' },
        message: 'Moving to pain assessment',
        progress: 25,
        currentDomain: 'Pain Management',
        currentLayer: 'Initial',
        estimatedTimeRemaining: 3
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(mockOnDomainChange).toHaveBeenCalledWith('pain_management');
      });
    });
  });

  describe('Completion Flow', () => {
    it('should handle completion correctly', async () => {
      const mockResults = {
        riskLevel: 'moderate',
        riskScores: { pain: 5, mental_health: 3 },
        recommendations: ['See a doctor'],
        nextSteps: ['Schedule appointment']
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'complete',
        results: mockResults,
        progress: 100,
        currentDomain: 'Complete',
        currentLayer: 'Done',
        estimatedTimeRemaining: 0
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Continuar para Próxima Etapa'));

      expect(mockOnComplete).toHaveBeenCalledWith(mockResults);
    });
  });

  describe('Progress Tracking', () => {
    it('should display progress correctly', async () => {
      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: {
          id: 'test',
          text: 'Test',
          type: 'boolean',
          domain: 'test',
          riskWeight: 1
        },
        progress: 75,
        currentDomain: 'Test Domain',
        currentLayer: 'Test Layer',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('~2min')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFlow.processResponse.mockRejectedValue(new Error('Test error'));

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error processing response:', expect.any(Error));
      });

      consoleError.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      const question = {
        id: 'test',
        text: 'Test Question',
        type: 'scale',
        domain: 'test',
        riskWeight: 1,
        options: []
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question,
        progress: 50,
        currentDomain: 'Test',
        currentLayer: 'Test',
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
        expect(slider).toHaveAttribute('type', 'range');
        expect(slider).toHaveAttribute('min', '0');
        expect(slider).toHaveAttribute('max', '10');
      });
    });
  });

  describe('Metadata Handling', () => {
    it('should show sensitive info alert when metadata indicates', async () => {
      const sensitiveQuestion = {
        id: 'sensitive',
        text: 'Sensitive Question',
        type: 'text',
        domain: 'test',
        riskWeight: 1,
        metadata: { sensitiveInfo: true }
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: sensitiveQuestion,
        progress: 50,
        currentDomain: 'Test',
        currentLayer: 'Test',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Esta informação é protegida e usada apenas para cálculos médicos')).toBeInTheDocument();
      });
    });

    it('should display instrument badge when specified', async () => {
      const instrumentQuestion = {
        id: 'phq9',
        text: 'PHQ-9 Question',
        type: 'select',
        domain: 'mental_health',
        instrument: 'PHQ-9',
        riskWeight: 1,
        options: []
      };

      mockFlow.processResponse.mockResolvedValue({
        type: 'question',
        question: instrumentQuestion,
        progress: 50,
        currentDomain: 'Mental Health',
        currentLayer: 'Assessment',
        estimatedTimeRemaining: 2
      });

      render(
        <UnifiedHealthAssessment 
          onComplete={mockOnComplete} 
          onDomainChange={mockOnDomainChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('PHQ-9')).toBeInTheDocument();
      });
    });
  });
});