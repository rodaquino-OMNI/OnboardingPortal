import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Import the clinical decision engine
import { ClinicalDecisionEngine } from '@/lib/clinical-decision-engine';

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
      domain: 'appetite_changes'
    },
    {
      id: 'phq9_6',
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu mal consigo mesmo, ou sentiu que é um fracasso ou que decepcionou sua família ou a si mesmo?',
      instrument: 'PHQ-9',
      domain: 'self_worth'
    },
    {
      id: 'phq9_7',
      text: 'Nas últimas 2 semanas, com que frequência você teve dificuldade para se concentrar em coisas como ler jornal ou assistir televisão?',
      instrument: 'PHQ-9',
      domain: 'concentration'
    },
    {
      id: 'phq9_8',
      text: 'Nas últimas 2 semanas, com que frequência você se moveu ou falou tão devagar que outras pessoas notaram? Ou o oposto - você esteve tão agitado ou inquieto que se moveu muito mais que o normal?',
      instrument: 'PHQ-9',
      domain: 'psychomotor'
    },
    {
      id: 'phq9_9',
      text: 'Nas últimas 2 semanas, teve pensamentos de que seria melhor estar morto ou de se machucar?',
      instrument: 'PHQ-9',
      domain: 'suicidal_ideation',
      isHighRisk: true
    }
  ];

  // Complete GAD-7 questions (all 7)
  const gad7Questions = [
    {
      id: 'gad7_1',
      text: 'Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?',
      instrument: 'GAD-7',
      domain: 'nervousness'
    },
    {
      id: 'gad7_2',
      text: 'Nas últimas 2 semanas, com que frequência você não conseguiu parar ou controlar preocupações?',
      instrument: 'GAD-7',
      domain: 'uncontrollable_worry'
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
      domain: 'restlessness'
    },
    {
      id: 'gad7_5',
      text: 'Nas últimas 2 semanas, com que frequência você ficou tão inquieto que foi difícil ficar parado?',
      instrument: 'GAD-7',
      domain: 'motor_restlessness'
    },
    {
      id: 'gad7_6',
      text: 'Nas últimas 2 semanas, com que frequência você ficou facilmente irritado ou mal-humorado?',
      instrument: 'GAD-7',
      domain: 'irritability'
    },
    {
      id: 'gad7_7',
      text: 'Nas últimas 2 semanas, com que frequência você sentiu medo de que algo terrível pudesse acontecer?',
      instrument: 'GAD-7',
      domain: 'fear_catastrophe'
    }
  ];

  const responseOptions = [
    { value: 0, label: 'Nunca', description: 'Nenhum dia' },
    { value: 1, label: 'Alguns dias', description: '1-7 dias' },
    { value: 2, label: 'Mais da metade dos dias', description: '8-14 dias' },
    { value: 3, label: 'Quase todos os dias', description: 'Praticamente todos os dias' }
  ];

  const getQuestions = () => {
    if (instrument === 'PHQ-9') return phq9Questions;
    if (instrument === 'GAD-7') return gad7Questions;
    return [...phq9Questions, ...gad7Questions]; // BOTH
  };

  const questions = getQuestions();
  const currentQuestion = questions[currentQuestionIndex];

  const calculatePHQ9Score = (responses: Record<string, number>): number => {
    const phq9Items = ['phq9_1', 'phq9_2', 'phq9_3', 'phq9_4', 'phq9_5', 'phq9_6', 'phq9_7', 'phq9_8', 'phq9_9'];
    return phq9Items.reduce((sum, item) => sum + (responses[item] || 0), 0);
  };

  const calculateGAD7Score = (responses: Record<string, number>): number => {
    const gad7Items = ['gad7_1', 'gad7_2', 'gad7_3', 'gad7_4', 'gad7_5', 'gad7_6', 'gad7_7'];
    return gad7Items.reduce((sum, item) => sum + (responses[item] || 0), 0);
  };

  const interpretPHQ9Score = (score: number): string => {
    if (score === 0) return 'No depression (0)';
    if (score >= 1 && score <= 4) return 'Minimal depression (1-4)';
    if (score >= 5 && score <= 9) return 'Mild depression (5-9)';
    if (score >= 10 && score <= 14) return 'Moderate depression (10-14)';
    if (score >= 15 && score <= 19) return 'Moderately severe depression (15-19)';
    if (score >= 20) return 'Severe depression (20-27)';
    return 'Invalid score';
  };

  const interpretGAD7Score = (score: number): string => {
    if (score >= 0 && score <= 4) return 'Minimal anxiety (0-4)';
    if (score >= 5 && score <= 9) return 'Mild anxiety (5-9)';
    if (score >= 10 && score <= 14) return 'Moderate anxiety (10-14)';
    if (score >= 15) return 'Severe anxiety (15-21)';
    return 'Invalid score';
  };

  const handleResponse = (value: number) => {
    const newResponses = { ...responses, [currentQuestion.id]: value };
    setResponses(newResponses);

    // Calculate scores in real-time
    const phq9Score = calculatePHQ9Score(newResponses);
    const gad7Score = calculateGAD7Score(newResponses);
    
    setScores({
      phq9: {
        total: phq9Score,
        interpretation: interpretPHQ9Score(phq9Score),
        suicidalIdeation: newResponses.phq9_9 || 0
      },
      gad7: {
        total: gad7Score,
        interpretation: interpretGAD7Score(gad7Score)
      }
    });

    // Get clinical decisions
    const engine = ClinicalDecisionEngine.getInstance();
    const phq9Decision = engine.analyzePHQ9(newResponses);
    const gad7Decision = engine.analyzeGAD7(newResponses);
    
    setClinicalDecision({
      phq9: phq9Decision,
      gad7: gad7Decision
    });

    // Auto-advance to next question
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Complete assessment
        onComplete({
          responses: newResponses,
          scores: {
            phq9: {
              total: phq9Score,
              interpretation: interpretPHQ9Score(phq9Score),
              suicidalIdeation: newResponses.phq9_9 || 0
            },
            gad7: {
              total: gad7Score,
              interpretation: interpretGAD7Score(gad7Score)
            }
          },
          clinicalDecisions: {
            phq9: phq9Decision,
            gad7: gad7Decision
          }
        });
      }
    }, 300);
  };

  if (!currentQuestion) {
    return (
      <div className="text-center p-8" data-testid="assessment-complete">
        <h2 className="text-xl font-bold mb-4">Assessment Complete</h2>
        {scores && (
          <div className="space-y-4">
            {instrument !== 'GAD-7' && (
              <div data-testid="phq9-final-score">
                <h3 className="font-semibold">PHQ-9 Score: {scores.phq9.total}</h3>
                <p>{scores.phq9.interpretation}</p>
                {scores.phq9.suicidalIdeation > 0 && (
                  <p className="text-red-600 font-bold">⚠️ Suicidal ideation detected (Score: {scores.phq9.suicidalIdeation})</p>
                )}
              </div>
            )}
            {instrument !== 'PHQ-9' && (
              <div data-testid="gad7-final-score">
                <h3 className="font-semibold">GAD-7 Score: {scores.gad7.total}</h3>
                <p>{scores.gad7.interpretation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6" role="main" aria-label={`${instrument} Assessment`}>
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600" data-testid="question-counter">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-600">
            {currentQuestion.instrument}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={(currentQuestionIndex + 1) / questions.length * 100}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Current question */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2" id={`question-${currentQuestion.id}`}>
            {currentQuestion.text}
          </h2>
          {currentQuestion.isHighRisk && (
            <div className="p-3 bg-red-50 border border-red-200 rounded mb-4" role="alert">
              <p className="text-red-800 text-sm">
                ⚠️ Esta pergunta avalia risco de suicídio. Responda com sinceridade - ajuda está disponível.
              </p>
            </div>
          )}
        </div>

        <fieldset className="space-y-3" aria-labelledby={`question-${currentQuestion.id}`}>
          <legend className="sr-only">{currentQuestion.text}</legend>
          {responseOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleResponse(option.value)}
              className={`w-full p-4 text-left border rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 ${
                responses[currentQuestion.id] === option.value 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300'
              }`}
              role="radio"
              aria-checked={responses[currentQuestion.id] === option.value}
              data-testid={`response-${currentQuestion.id}-${option.value}`}
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

      {/* Real-time scoring display */}
      {scores && (
        <div className="mt-8 p-4 bg-gray-50 rounded" data-testid="current-scores">
          <h3 className="font-semibold mb-2">Current Scores:</h3>
          <div className="space-y-2 text-sm">
            {instrument !== 'GAD-7' && (
              <div data-testid="phq9-current-score">
                PHQ-9: {scores.phq9.total} ({scores.phq9.interpretation})
                {scores.phq9.suicidalIdeation > 0 && (
                  <span className="text-red-600 font-bold ml-2">⚠️ Suicide Risk</span>
                )}
              </div>
            )}
            {instrument !== 'PHQ-9' && (
              <div data-testid="gad7-current-score">
                GAD-7: {scores.gad7.total} ({scores.gad7.interpretation})
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical decision display (for testing) */}
      {clinicalDecision && (
        <div className="mt-4 p-4 bg-yellow-50 rounded" data-testid="clinical-decisions">
          <h3 className="font-semibold mb-2">Clinical Decisions:</h3>
          <div className="space-y-2 text-xs">
            {clinicalDecision.phq9 && (
              <div data-testid="phq9-clinical-decision">
                PHQ-9: {clinicalDecision.phq9.condition} ({clinicalDecision.phq9.severity})
                {clinicalDecision.phq9.emergencyProtocol && (
                  <div className="text-red-600 font-bold">EMERGENCY PROTOCOL ACTIVATED</div>
                )}
              </div>
            )}
            {clinicalDecision.gad7 && (
              <div data-testid="gad7-clinical-decision">
                GAD-7: {clinicalDecision.gad7.condition} ({clinicalDecision.gad7.severity})
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

describe('PHQ-9 and GAD-7 Complete Scoring', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PHQ-9 Complete Assessment (9 Questions)', () => {
    it('should render all 9 PHQ-9 questions in sequence', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Start with question 1
      expect(screen.getByText('Nas últimas 2 semanas, com que frequência você teve pouco interesse ou prazer em fazer as coisas?')).toBeInTheDocument();
      expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 9');

      // Answer first question and verify progression
      await user.click(screen.getByTestId('response-phq9_1-1'));

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas, com que frequência você se sentiu deprimido, triste ou sem esperança?')).toBeInTheDocument();
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 9');
      });

      // Continue through all questions
      await user.click(screen.getByTestId('response-phq9_2-1'));
      
      await waitFor(() => {
        expect(screen.getByText(/problemas para adormecer/)).toBeInTheDocument();
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 3 of 9');
      });
    });

    it('should calculate PHQ-9 score correctly for minimal depression', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer all 9 questions with score 0 (minimal depression)
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              phq9: expect.objectContaining({
                total: 0,
                interpretation: 'No depression (0)',
                suicidalIdeation: 0
              })
            })
          })
        );
      });
    });

    it('should calculate PHQ-9 score correctly for moderate depression', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions to achieve moderate depression score (10-14)
      const responses = [1, 1, 2, 1, 1, 2, 1, 1, 0]; // Total: 10
      
      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              phq9: expect.objectContaining({
                total: 10,
                interpretation: 'Moderate depression (10-14)',
                suicidalIdeation: 0
              })
            })
          })
        );
      });
    });

    it('should detect and flag suicidal ideation (PHQ-9 question 9)', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer first 8 questions with low scores
      for (let i = 1; i <= 8; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        await waitFor(() => {
          if (i < 8) {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          }
        });
      }

      // Check that question 9 shows risk warning
      await waitFor(() => {
        expect(screen.getByText(/pensamentos de que seria melhor estar morto/)).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Esta pergunta avalia risco de suicídio');
      });

      // Answer question 9 with positive suicidal ideation
      await user.click(screen.getByTestId('response-phq9_9-2'));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              phq9: expect.objectContaining({
                total: 2,
                suicidalIdeation: 2
              })
            }),
            clinicalDecisions: expect.objectContaining({
              phq9: expect.objectContaining({
                condition: 'Depressive Disorder with Suicidal Ideation',
                severity: 'critical',
                emergencyProtocol: expect.any(Object)
              })
            })
          })
        );
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

      // Answer second question
      await user.click(screen.getByTestId('response-phq9_2-1'));

      await waitFor(() => {
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 3');
      });
    });

    it('should handle severe depression scoring correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer all questions with maximum scores (severe depression: 20+)
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-3`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              phq9: expect.objectContaining({
                total: 27,
                interpretation: 'Severe depression (20-27)',
                suicidalIdeation: 3
              })
            })
          })
        );
      });
    });
  });

  describe('GAD-7 Complete Assessment (7 Questions)', () => {
    it('should render all 7 GAD-7 questions in sequence', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Start with question 1
      expect(screen.getByText('Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?')).toBeInTheDocument();
      expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 1 of 7');

      // Answer first question and verify progression
      await user.click(screen.getByTestId('response-gad7_1-1'));

      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas, com que frequência você não conseguiu parar ou controlar preocupações?')).toBeInTheDocument();
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 7');
      });
    });

    it('should calculate GAD-7 score correctly for minimal anxiety', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer all 7 questions with score 0 (minimal anxiety)
      for (let i = 1; i <= 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i}-0`));
        
        if (i < 7) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 7`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              gad7: expect.objectContaining({
                total: 0,
                interpretation: 'Minimal anxiety (0-4)'
              })
            })
          })
        );
      });
    });

    it('should calculate GAD-7 score correctly for moderate anxiety', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer questions to achieve moderate anxiety score (10-14)
      const responses = [2, 1, 2, 1, 2, 1, 1]; // Total: 10
      
      for (let i = 0; i < 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i + 1}-${responses[i]}`));
        
        if (i < 6) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 7`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              gad7: expect.objectContaining({
                total: 10,
                interpretation: 'Moderate anxiety (10-14)'
              })
            })
          })
        );
      });
    });

    it('should handle severe anxiety scoring correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="GAD-7" />);

      // Answer all questions with maximum scores (severe anxiety: 15+)
      for (let i = 1; i <= 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i}-3`));
        
        if (i < 7) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 7`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              gad7: expect.objectContaining({
                total: 21,
                interpretation: 'Severe anxiety (15-21)'
              })
            })
          })
        );
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

      // Complete PHQ-9 questions (1-9)
      for (let i = 1; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-1`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 16`);
          });
        }
      }

      // Should continue to GAD-7 questions
      await waitFor(() => {
        expect(screen.getByText('Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?')).toBeInTheDocument();
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 10 of 16');
      });

      // Complete GAD-7 questions (1-7)
      for (let i = 1; i <= 7; i++) {
        await user.click(screen.getByTestId(`response-gad7_${i}-1`));
        
        if (i < 7) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${9 + i + 1} of 16`);
          });
        }
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            scores: expect.objectContaining({
              phq9: expect.objectContaining({
                total: 9,
                interpretation: 'Mild depression (5-9)'
              }),
              gad7: expect.objectContaining({
                total: 7,
                interpretation: 'Mild anxiety (5-9)'
              })
            })
          })
        );
      });
    });

    it('should display both scores in real-time during combined assessment', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="BOTH" />);

      // Answer first PHQ-9 question
      await user.click(screen.getByTestId('response-phq9_1-2'));

      await waitFor(() => {
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 2');
        expect(screen.getByTestId('gad7-current-score')).toHaveTextContent('GAD-7: 0');
      });

      // Continue through PHQ-9 and start GAD-7
      for (let i = 2; i <= 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 9) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 16`);
          });
        }
      }

      // First GAD-7 question
      await waitFor(() => {
        expect(screen.getByText(/nervoso, ansioso ou no limite/)).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('response-gad7_1-3'));

      await waitFor(() => {
        expect(screen.getByTestId('phq9-current-score')).toHaveTextContent('PHQ-9: 2');
        expect(screen.getByTestId('gad7-current-score')).toHaveTextContent('GAD-7: 3');
      });
    });
  });

  describe('Clinical Decision Integration', () => {
    it('should generate appropriate clinical decisions for depression with suicidal ideation', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Answer questions to create moderate depression with suicidal ideation
      const responses = [2, 2, 1, 1, 1, 1, 1, 0, 2]; // Total: 11, suicidal ideation: 2
      
      for (let i = 0; i < 9; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i + 1}-${responses[i]}`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 2} of 9`);
          });
        }
      }

      await waitFor(() => {
        const clinicalDecision = mockOnComplete.mock.calls[0][0].clinicalDecisions.phq9;
        expect(clinicalDecision.condition).toBe('Depressive Disorder with Suicidal Ideation');
        expect(clinicalDecision.severity).toBe('critical');
        expect(clinicalDecision.emergencyProtocol).toBeDefined();
        expect(clinicalDecision.emergencyProtocol.immediateActions).toContain('Do not leave person alone');
        expect(clinicalDecision.emergencyProtocol.contactNumbers).toEqual(
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
        expect(screen.getByText('EMERGENCY PROTOCOL ACTIVATED')).toBeInTheDocument();
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
        expect(result.scores.phq9.total).toBe(27);
        expect(result.scores.gad7.total).toBe(21);
        expect(result.scores.phq9.interpretation).toBe('Severe depression (20-27)');
        expect(result.scores.gad7.interpretation).toBe('Severe anxiety (15-21)');
      });
    });

    it('should handle rapid clicking without errors', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      const button = screen.getByTestId('response-phq9_1-2');
      
      // Click rapidly multiple times
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should still progress correctly
      await waitFor(() => {
        expect(screen.getByTestId('question-counter')).toHaveTextContent('Question 2 of 9');
      });
    });

    it('should calculate boundary scores correctly', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Create score exactly at boundary (mild/moderate = 10)
      const responses = [1, 1, 1, 1, 1, 1, 1, 1, 2]; // Total: 10
      
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
        expect(result.scores.phq9.total).toBe(10);
        expect(result.scores.phq9.interpretation).toBe('Moderate depression (10-14)');
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

      // Check radio group behavior
      const radioButtons = screen.getAllByRole('radio');
      radioButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-checked');
      });

      // Check progress bar
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have proper alert for suicide risk question', async () => {
      const user = userEvent.setup();
      render(<MentalHealthScoringTest onComplete={mockOnComplete} instrument="PHQ-9" />);

      // Navigate to question 9
      for (let i = 1; i <= 8; i++) {
        await user.click(screen.getByTestId(`response-phq9_${i}-0`));
        
        if (i < 8) {
          await waitFor(() => {
            expect(screen.getByTestId('question-counter')).toHaveTextContent(`Question ${i + 1} of 9`);
          });
        }
      }

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Esta pergunta avalia risco de suicídio');
      });
    });
  });
});