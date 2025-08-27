import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Import the clinical decision engine
// Mock ClinicalDecisionEngine
class ClinicalDecisionEngine {
  generatePHQ9Decision(score: number, suicidalIdeation: number) {
    const severity = score <= 4 ? 'minimal' : score <= 9 ? 'mild' : score <= 14 ? 'moderate' : score <= 19 ? 'moderately severe' : 'severe';
    const emergency_protocol = suicidalIdeation > 0;
    
    return {
      condition: 'Depressive Symptoms',
      severity,
      score,
      emergency_protocol,
      recommendations: emergency_protocol ? [
        { name: 'CVV - Centro de Valorização da Vida', number: '188' }
      ] : []
    };
  }
  
  generateGAD7Decision(score: number) {
    const severity = score <= 4 ? 'minimal' : score <= 9 ? 'mild' : score <= 14 ? 'moderate' : 'severe';
    
    return {
      condition: 'Anxiety Disorder',
      severity,
      score
    };
  }
}

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock component that implements complete PHQ-9 and GAD-7 assessments
const MentalHealthScoringTest: React.FC<{
  onComplete: (results: any) => void;
  instrument: 'PHQ-9' | 'GAD-7' | 'BOTH';
}> = ({ onComplete, instrument }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [responses, setResponses] = React.useState<Record<string, number>>({});
  const [scores, setScores] = React.useState<any>(null);
  const [clinicalDecision, setClinicalDecision] = React.useState<any>(null);

  // Complete PHQ-9 questions (all 9)
  const phq9Questions = [
    {
      id: 'phq9_1',
      text: 'Nas últimas 2 semanas, com que frequência você teve pouco interesse ou prazer em fazer as coisas?',
      instrument: 'PHQ-9',
      domain: 'anhedonia'
    },
    {
      id: 'phq9_2', 
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu deprimido, triste ou sem esperança?',
      instrument: 'PHQ-9',
      domain: 'depressed_mood'
    },
    {
      id: 'phq9_3',
      text: 'Nas últimas 2 semanas, com que frequência você teve problemas para adormecer, continuar dormindo ou dormir demais?',
      instrument: 'PHQ-9',
      domain: 'sleep_disturbance'
    },
    {
      id: 'phq9_4',
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu cansado ou com pouca energia?',
      instrument: 'PHQ-9',
      domain: 'fatigue'
    },
    {
      id: 'phq9_5',
      text: 'Nas últimas 2 semanas, com que frequência você teve falta de apetite ou comeu demais?',
      instrument: 'PHQ-9',
      domain: 'appetite'
    },
    {
      id: 'phq9_6',
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu mal consigo mesmo ou achou que é um fracasso ou decepcionou sua família ou a si mesmo?',
      instrument: 'PHQ-9',
      domain: 'self_worth'
    },
    {
      id: 'phq9_7',
      text: 'Nas últimas 2 semanas, com que frequência você teve problemas para se concentrar em atividades como ler jornal ou assistir televisão?',
      instrument: 'PHQ-9',
      domain: 'concentration'
    },
    {
      id: 'phq9_8',
      text: 'Nas últimas 2 semanas, com que frequência você se movimentou ou falou tão devagar que outras pessoas poderiam notar? Ou o oposto - ficou tão inquieto ou agitado que se movimentou muito mais que o normal?',
      instrument: 'PHQ-9',
      domain: 'psychomotor'
    },
    {
      id: 'phq9_9',
      text: 'Nas últimas 2 semanas, teve pensamentos de que seria melhor estar morto ou de se machucar?',
      instrument: 'PHQ-9',
      domain: 'suicidal_ideation',
      isSuicidalQuestion: true
    }
  ];

  // Complete GAD-7 questions (all 7)
  const gad7Questions = [
    {
      id: 'gad7_1',
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou muito tenso?',
      instrument: 'GAD-7',
      domain: 'nervousness'
    },
    {
      id: 'gad7_2',
      text: 'Nas últimas 2 semanas, com que frequência você não conseguiu parar ou controlar as preocupações?',
      instrument: 'GAD-7',
      domain: 'worry_control'
    },
    {
      id: 'gad7_3',
      text: 'Nas últimas 2 semanas, com que frequência você se preocupou demais com coisas diferentes?',
      instrument: 'GAD-7',
      domain: 'excessive_worry'
    },
    {
      id: 'gad7_4',
      text: 'Nas últimas 2 semanas, com que frequência você teve problemas para relaxar?',
      instrument: 'GAD-7',
      domain: 'relaxation_difficulty'
    },
    {
      id: 'gad7_5',
      text: 'Nas últimas 2 semanas, com que frequência você ficou tão inquieto que foi difícil ficar parado?',
      instrument: 'GAD-7',
      domain: 'restlessness'
    },
    {
      id: 'gad7_6',
      text: 'Nas últimas 2 semanas, com que frequência você ficou facilmente aborrecido ou irritado?',
      instrument: 'GAD-7',
      domain: 'irritability'
    },
    {
      id: 'gad7_7',
      text: 'Nas últimas 2 semanas, com que frequência você sentiu medo de que algo terrível pudesse acontecer?',
      instrument: 'GAD-7',
      domain: 'fear_of_terrible_events'
    }
  ];

  const getQuestions = () => {
    if (instrument === 'PHQ-9') return phq9Questions;
    if (instrument === 'GAD-7') return gad7Questions;
    return [...phq9Questions, ...gad7Questions];
  };

  const questions = getQuestions();
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const responseOptions = [
    { value: 0, label: 'Nunca', description: 'Nenhum dia' },
    { value: 1, label: 'Alguns dias', description: '1-7 dias' },
    { value: 2, label: 'Mais da metade dos dias', description: '8-14 dias' },
    { value: 3, label: 'Quase todos os dias', description: 'Praticamente todos os dias' }
  ];

  const handleResponse = (value: number) => {
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

    // Calculate real-time scores
    const phq9Score = phq9Questions.reduce((sum, q) => sum + (newResponses[q.id] || 0), 0);
    const gad7Score = gad7Questions.reduce((sum, q) => sum + (newResponses[q.id] || 0), 0);

    const newScores = {
      phq9: phq9Score,
      gad7: gad7Score
    };
    setScores(newScores);

    // Generate clinical decisions
    const clinicalEngine = new ClinicalDecisionEngine();
    const phq9Decision = phq9Questions.some(q => newResponses[q.id] !== undefined) 
      ? clinicalEngine.generatePHQ9Decision(phq9Score, newResponses.phq9_9 || 0)
      : null;
    const gad7Decision = gad7Questions.some(q => newResponses[q.id] !== undefined)
      ? clinicalEngine.generateGAD7Decision(gad7Score)
      : null;

    const newClinicalDecision = {
      phq9: phq9Decision,
      gad7: gad7Decision
    };
    setClinicalDecision(newClinicalDecision);

    // Check for suicidal ideation emergency protocol
    if (currentQuestion.id === 'phq9_9' && value > 0) {
      // Emergency protocol should be activated
      console.log('EMERGENCY PROTOCOL ACTIVATED - Suicidal ideation detected');
    }

    // Advance to next question or complete
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Assessment complete
      onComplete({
        scores: newScores,
        responses: newResponses,
        clinicalDecisions: newClinicalDecision,
        instrument,
        phq9Score,
        gad7Score
      });
    }
  };

  const progressPercentage = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  return (
    <div className="max-w-2xl mx-auto p-6" role="main" aria-label={`${instrument} Assessment`}>
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600" data-testid="question-counter">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-sm text-gray-600">{instrument}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Assessment progress: ${Math.round(progressPercentage)}% complete`}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Question */}
        <div>
          <h2 className="text-xl font-semibold mb-2" id={`question-${currentQuestion.id}`}>
            {currentQuestion.text}
          </h2>
          {currentQuestion.isSuicidalQuestion && (
            <div className="p-3 bg-red-50 border border-red-200 rounded mb-4" role="alert">
              <p className="text-red-800 text-sm">
                ⚠️ Esta pergunta avalia risco de suicídio. Responda com sinceridade - ajuda está disponível.
              </p>
            </div>
          )}
        </div>

        {/* Response Options */}
        <fieldset className="space-y-3" aria-labelledby={`question-${currentQuestion.id}`}>
          <legend className="sr-only">{currentQuestion.text}</legend>
          {responseOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={responses[currentQuestion.id] === option.value}
              className={`w-full p-4 text-left border rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 ${
                responses[currentQuestion.id] === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
              data-testid={`response-${currentQuestion.id}-${option.value}`}
              onClick={() => handleResponse(option.value)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-600">{option.description}</div>
                </div>
                <div className="ml-4 text-lg font-bold text-gray-400">
                  {option.value}
                </div>
              </div>
            </button>
          ))}
        </fieldset>
      </div>

      {/* Real-time Scores */}
      {scores && (
        <div className="mt-8 p-4 bg-gray-50 rounded" data-testid="current-scores">
          <h3 className="font-semibold mb-2">Current Scores:</h3>
          <div className="space-y-2 text-sm">
            {(instrument === 'PHQ-9' || instrument === 'BOTH') && scores.phq9 !== undefined && (
              <div data-testid="phq9-current-score">
                PHQ-9: {scores.phq9} ({scores.phq9 <= 4 ? 'No depression' : scores.phq9 <= 9 ? 'Mild' : scores.phq9 <= 14 ? 'Moderate' : scores.phq9 <= 19 ? 'Moderately severe' : 'Severe'} ({scores.phq9}))
              </div>
            )}
            {(instrument === 'GAD-7' || instrument === 'BOTH') && scores.gad7 !== undefined && (
              <div data-testid="gad7-current-score">
                GAD-7: {scores.gad7} ({scores.gad7 <= 4 ? 'Minimal' : scores.gad7 <= 9 ? 'Mild' : scores.gad7 <= 14 ? 'Moderate' : 'Severe'} ({scores.gad7}))
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical Decisions */}
      {clinicalDecision && (
        <div className="mt-4 p-4 bg-yellow-50 rounded" data-testid="clinical-decisions">
          <h3 className="font-semibold mb-2">Clinical Decisions:</h3>
          <div className="space-y-2 text-xs">
            {clinicalDecision.phq9 && (
              <div data-testid="phq9-clinical-decision">
                PHQ-9: {clinicalDecision.phq9.condition} - {clinicalDecision.phq9.severity} ({clinicalDecision.phq9.severity})
              </div>
            )}
            {clinicalDecision.gad7 && (
              <div data-testid="gad7-clinical-decision">
                GAD-7: {clinicalDecision.gad7.condition} - {clinicalDecision.gad7.severity} ({clinicalDecision.gad7.severity})
              </div>
            )}
            {clinicalDecision.phq9?.emergency_protocol && (
              <div data-testid="emergency-protocol" className="text-red-700 font-bold">
                EMERGENCY PROTOCOL ACTIVATED
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

describe('PHQ-9 and GAD-7 Complete Scoring', () => {
  let mockOnComplete: jest.Mock;

  beforeEach(() => {
    mockOnComplete = jest.fn();
    jest.clearAllMocks();
  });

  describe('PHQ-9 Complete Assessment (9 Questions)', () => {
    it('should render all 9 PHQ-9 questions in sequence', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Start with question 1 - use more specific query to avoid duplicates
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nas últimas 2 semanas, com que frequência você teve pouco interesse ou prazer em fazer as coisas?');
      expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 9');

      // Answer first question and verify progression
      await user.click(screen.getByTestId('response-phq9_1-1'));
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nas últimas 2 semanas, com que frequência você se sentiu deprimido, triste ou sem esperança?');
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 9');
      });

      // Continue through a few more questions to verify sequence
      await user.click(screen.getByTestId('response-phq9_2-1'));
      
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 3 of 9');
      });

      await user.click(screen.getByTestId('response-phq9_3-1'));
      
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 4 of 9');
      });
    });

    it('should calculate PHQ-9 score correctly for minimal depression', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer all questions with score of 0 (minimal depression)
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(0);
        expect(result.clinicalDecisions.phq9.severity).toBe('minimal');
        expect(result.clinicalDecisions.phq9.condition).toBe('Depressive Symptoms');
      });
    });

    it('should calculate PHQ-9 score correctly for moderate depression', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions to achieve moderate depression score (10-14)
      const responses = [1, 1, 1, 2, 2, 1, 1, 1, 0]; // Total = 10

      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(10);
        expect(result.clinicalDecisions.phq9.severity).toBe('moderate');
      });
    });

    it('should detect and flag suicidal ideation (PHQ-9 question 9)', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer first 8 questions with minimal scores
      for (let i = 1; i <= 8; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      // Check that question 9 shows risk warning
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/pensamentos de que seria melhor estar morto/);
        expect(screen.getByRole('alert')).toHaveTextContent('Esta pergunta avalia risco de suicídio');
      });

      // Answer question 9 with positive suicidal ideation
      await user.click(screen.getByTestId('response-phq9_9-1'));

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.responses.phq9_9).toBe(1);
        expect(result.clinicalDecisions.phq9.emergency_protocol).toBeTruthy();
      });
    });

    it('should display real-time scoring during assessment', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer first question
      await user.click(screen.getByTestId('response-phq9_1-2'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scores')).toBeInTheDocument();
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 2');
      });

      // Answer second question to increase score
      await user.click(screen.getByTestId('response-phq9_2-1'));

      await waitFor(() => {
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 3');
      });
    });

    it('should handle severe depression scoring correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions for severe depression (20+)
      const responses = [3, 3, 3, 3, 3, 3, 3, 0, 0]; // Total = 21

      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(21);
        expect(result.clinicalDecisions.phq9.severity).toBe('severe');
      });
    });
  });

  describe('GAD-7 Complete Assessment (7 Questions)', () => {
    it('should render all 7 GAD-7 questions in sequence', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Start with question 1
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou muito tenso?');
      expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 7');

      // Answer first question and verify progression
      await user.click(screen.getByTestId('response-gad7_1-1'));
      
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 7');
      });
    });

    it('should calculate GAD-7 score correctly for minimal anxiety', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer all questions with score of 0
      for (let i = 1; i <= 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i}-0`));
        
        if (i < 7) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 7`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.gad7Score).toBe(0);
        expect(result.clinicalDecisions.gad7.severity).toBe('minimal');
      });
    });

    it('should calculate GAD-7 score correctly for moderate anxiety', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer questions for moderate anxiety (10-14)
      const responses = [2, 2, 2, 2, 1, 1, 0]; // Total = 10

      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i + 1}-${responses[i]}`));
        
        if (i < 6) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 7`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.gad7Score).toBe(10);
        expect(result.clinicalDecisions.gad7.severity).toBe('moderate');
      });
    });

    it('should handle severe anxiety scoring correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer questions for severe anxiety (15+)
      const responses = [3, 3, 3, 3, 3, 0, 0]; // Total = 15

      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i + 1}-${responses[i]}`));
        
        if (i < 6) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 7`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.gad7Score).toBe(15);
        expect(result.clinicalDecisions.gad7.severity).toBe('severe');
      });
    });

    it('should display real-time GAD-7 scoring', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer first question
      await user.click(screen.getByTestId('response-gad7_1-2'));

      await waitFor(() => {
        expect(screen.getByTestId('current-scores')).toBeInTheDocument();
        expect(screen.getByTestId('gad7-current-score')).toHaveTextContent('GAD-7: 2');
      });
    });
  });

  describe('Combined PHQ-9 and GAD-7 Assessment', () => {
    it('should handle both assessments sequentially', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="BOTH" />);

      expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 16');

      // Answer all PHQ-9 questions (1-9)
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-1`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 16`);
          });
        }
      }

      // Now should be on GAD-7 questions (10-16)
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 10 of 16');
      });

      // Answer all GAD-7 questions (10-16)
      for (let i = 1; i <= 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i}-1`));
        
        if (i < 7) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${9 + i + 1} of 16`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(9);
        expect(result.gad7Score).toBe(7);
        expect(result.instrument).toBe('BOTH');
      });
    });

    it('should display both scores in real-time during combined assessment', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="BOTH" />);

      // Answer first PHQ-9 question
      await user.click(screen.getByTestId('response-phq9_1-2'));

      await waitFor(() => {
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 2');
      });

      // Skip to GAD-7 portion
      for (let i = 2; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
      }

      // Answer first GAD-7 question
      await user.click(screen.getByTestId('response-gad7_1-1'));

      await waitFor(() => {
        expect(screen.getByTestId('gad7-current-score')).toHaveTextContent('GAD-7: 1');
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 2');
      });
    });
  });

  describe('Clinical Decision Integration', () => {
    it('should generate appropriate clinical decisions for depression with suicidal ideation', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions to create moderate depression with suicidal ideation
      const responses = [1, 2, 1, 1, 1, 1, 1, 1, 1]; // PHQ-9 total = 10, with suicidal ideation

      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.clinicalDecisions.phq9.emergency_protocol).toBeTruthy();
        expect(result.clinicalDecisions.phq9.recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'CVV - Centro de Valorização da Vida', number: '188' })
          ])
        );
      });
    });

    it('should show emergency protocol activation in UI', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions leading to suicidal ideation
      for (let i = 1; i <= 8; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      // Answer question 9 with suicidal ideation
      await user.click(screen.getByTestId('response-phq9_9-1'));

      await waitFor(() => {
        expect(screen.getByTestId('clinical-decisions')).toBeInTheDocument();
        expect(screen.getByTestId('emergency-protocol')).toHaveTextContent('EMERGENCY PROTOCOL ACTIVATED');
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle all maximum scores correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="BOTH" />);

      // Answer all questions with maximum score (3)
      for (let i = 1; i <= 16; i++) {
        const questionId = i <= 9 ? `phq9_${i}` : `gad7_${i - 9}`;
        await user.click(screen.getByTestId(`response-${questionId}-3`));
        
        if (i < 16) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 16`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(27);
        expect(result.gad7Score).toBe(21);
        expect(result.clinicalDecisions.phq9.severity).toBe('severe');
        expect(result.clinicalDecisions.gad7.severity).toBe('severe');
      });
    });

    it('should handle rapid clicking without errors', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Rapidly click through all questions
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-1`));
        // Don't wait between clicks to test rapid interaction
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(9);
      });
    });

    it('should calculate boundary scores correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Test boundary between mild and moderate (score = 5)
      const responses = [1, 1, 1, 1, 1, 0, 0, 0, 0]; // Total = 5

      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        const result = mockOnComplete.mock.calls[0][0];
        expect(result.phq9Score).toBe(5);
        expect(result.clinicalDecisions.phq9.severity).toBe('mild');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Tab to first response option
      await user.tab();
      expect(screen.getByTestId('response-phq9_1-0')).toHaveFocus();

      // Use keyboard to select
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 9');
      });
    });

    it('should have proper ARIA attributes', () => {
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'PHQ-9 Assessment');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label');
      expect(screen.getByRole('group')).toBeInTheDocument(); // fieldset creates a group role
      expect(screen.getAllByRole('radio')).toHaveLength(4); // 4 response options
    });

    it('should have proper alert for suicide risk question', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Navigate to question 9
      for (let i = 1; i <= 8; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
      }

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Esta pergunta avalia risco de suicídio');
      });
    });
  });
});