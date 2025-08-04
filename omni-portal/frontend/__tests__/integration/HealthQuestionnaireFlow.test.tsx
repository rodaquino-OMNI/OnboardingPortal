import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UnifiedHealthQuestionnaire } from '@/components/health/UnifiedHealthQuestionnaire';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';

// Mock the unified health flow
jest.mock('@/lib/unified-health-flow', () => {
  const mockFlow = {
    processResponse: jest.fn(),
    getCurrentDomain: () => 'Avaliação Inicial',
    getCurrentLayer: () => 'Triage',
    getResponses: () => ({})
  };

  return {
    UnifiedHealthFlow: jest.fn(() => mockFlow),
    UNIVERSAL_TRIAGE: {
      id: 'universal_triage',
      name: 'Avaliação Inicial',
      questions: [
        {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number',
          domain: 'demographics',
          riskWeight: 1
        }
      ]
    }
  };
});

// Mock error boundary
jest.mock('@/components/health/ErrorBoundary', () => ({
  HealthQuestionnaireErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useErrorHandler: () => ({ captureError: jest.fn() })
}));

describe('Health Questionnaire Complete Flow Integration Test', () => {
  const mockOnComplete = jest.fn();
  const mockOnProgressUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full questionnaire flow with all fixes applied', async () => {
    const { UnifiedHealthFlow } = require('@/lib/unified-health-flow');
    const mockFlowInstance = new UnifiedHealthFlow();
    
    // Mock the flow progression
    mockFlowInstance.processResponse
      .mockResolvedValueOnce({
        type: 'question',
        question: {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number',
          domain: 'demographics',
          riskWeight: 1
        },
        progress: 10,
        currentDomain: 'Avaliação Inicial',
        currentLayer: 'Triage',
        estimatedTimeRemaining: 5
      })
      .mockResolvedValueOnce({
        type: 'domain_transition',
        domain: {
          id: 'mental_health',
          name: 'Bem-estar Mental',
          description: 'Avaliação do seu bem-estar emocional',
          priority: 9,
          estimatedMinutes: 4,
          triggerConditions: [],
          layers: []
        },
        message: 'Agora vamos falar sobre bem-estar mental.',
        progress: 50,
        currentDomain: 'Bem-estar Mental',
        currentLayer: 'Avaliação de Bem-estar',
        estimatedTimeRemaining: 3
      })
      .mockResolvedValueOnce({
        type: 'complete',
        results: {
          responses: { age: 30 },
          riskScores: { demographics: 1 },
          completedDomains: ['demographics', 'mental_health'],
          totalRiskScore: 5,
          riskLevel: 'low',
          recommendations: ['Manter bons hábitos de saúde'],
          nextSteps: ['Próxima avaliação em 6 meses'],
          fraudDetectionScore: 0,
          timestamp: new Date().toISOString()
        } as HealthAssessmentResults,
        progress: 100,
        currentDomain: 'Completo',
        currentLayer: 'Finalizado',
        estimatedTimeRemaining: 0
      });

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/Iniciando avaliação/)).toBeInTheDocument();
    });

    // Simulate age input
    await waitFor(() => {
      const ageInput = screen.getByPlaceholderText('Digite um número');
      fireEvent.change(ageInput, { target: { value: '30' } });
    });

    // Continue through flow
    const continueButton = screen.getByText('Continuar');
    fireEvent.click(continueButton);

    // Wait for domain transition
    await waitFor(() => {
      expect(screen.getByText(/Agora vamos falar sobre bem-estar mental/)).toBeInTheDocument();
    });

    // Continue to completion
    const nextSectionButton = screen.getByText('Continuar para Próxima Seção');
    fireEvent.click(nextSectionButton);

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Avaliação Concluída')).toBeInTheDocument();
    });

    const finalContinueButton = screen.getByText('Continuar para Próxima Etapa');
    fireEvent.click(finalContinueButton);

    // Verify completion callback
    expect(mockOnComplete).toHaveBeenCalledWith(expect.objectContaining({
      responses: { age: 30 },
      riskLevel: 'low',
      totalRiskScore: 5
    }));

    // Verify progress updates were called
    expect(mockOnProgressUpdate).toHaveBeenCalledWith(10);
    expect(mockOnProgressUpdate).toHaveBeenCalledWith(50);
    expect(mockOnProgressUpdate).toHaveBeenCalledWith(100);
  });

  it('should handle validation errors throughout the flow', async () => {
    const { UnifiedHealthFlow } = require('@/lib/unified-health-flow');
    const mockFlowInstance = new UnifiedHealthFlow();
    
    // Mock validation error
    mockFlowInstance.processResponse.mockRejectedValueOnce(
      new Error('Validation failed: Age is required')
    );

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Iniciando avaliação/)).toBeInTheDocument();
    });

    // Simulate invalid input
    const ageInput = screen.getByPlaceholderText('Digite um número');
    fireEvent.change(ageInput, { target: { value: '' } });

    const continueButton = screen.getByText('Continuar');
    fireEvent.click(continueButton);

    // Should show error handling
    await waitFor(() => {
      expect(screen.getByText(/Houve um erro ao continuar/)).toBeInTheDocument();
    });
  });

  it('should maintain responsive design with all fixes applied', () => {
    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
      />
    );

    // Check for responsive classes
    const container = screen.getByText(/Iniciando avaliação/).closest('.max-w-2xl');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('mx-auto', 'space-y-6');
  });

  it('should handle domain changes with proper progress tracking', async () => {
    const { UnifiedHealthFlow } = require('@/lib/unified-health-flow');
    const mockFlowInstance = new UnifiedHealthFlow();
    
    mockFlowInstance.processResponse.mockResolvedValueOnce({
      type: 'domain_transition',
      domain: {
        id: 'mental_health',
        name: 'Bem-estar Mental',
        description: 'Avaliação do seu bem-estar emocional',
        priority: 9,
        estimatedMinutes: 4,
        triggerConditions: [],
        layers: []
      },
      message: 'Agora vamos falar sobre bem-estar mental.',
      progress: 45,
      currentDomain: 'Bem-estar Mental',
      currentLayer: 'Avaliação de Bem-estar',
      estimatedTimeRemaining: 8
    });

    render(
      <UnifiedHealthQuestionnaire
        onComplete={mockOnComplete}
        onProgressUpdate={mockOnProgressUpdate}
        onDomainChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Iniciando avaliação/)).toBeInTheDocument();
    });

    // Trigger domain change
    const continueButton = screen.getByText('Sim');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText(/Bem-estar Mental/)).toBeInTheDocument();
      expect(screen.getByText(/8min/)).toBeInTheDocument();
    });

    // Verify progress update
    expect(mockOnProgressUpdate).toHaveBeenCalledWith(45);
  });
});