import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the allergies section component - this would be part of the health questionnaire
// For testing purposes, we'll create a focused allergies section component
const AllergiesSection: React.FC<{
  onComplete: (data: any) => void;
  responses?: Record<string, any>;
}> = ({ onComplete, responses = {} }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [localResponses, setLocalResponses] = React.useState<Record<string, any>>(responses);
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const allergiesQuestions = [
    {
      id: 'has_allergies',
      text: 'Você tem alguma alergia conhecida?',
      type: 'boolean',
      required: true
    },
    {
      id: 'medication_allergies',
      text: 'Selecione todas as alergias a medicamentos que você tem:',
      type: 'multiselect',
      required: false,
      conditionalOn: { questionId: 'has_allergies', values: [true] },
      options: [
        { value: 'penicillin', label: 'Penicilina' },
        { value: 'aspirin', label: 'Aspirina' },
        { value: 'ibuprofen', label: 'Ibuprofeno' },
        { value: 'sulfa', label: 'Sulfa' },
        { value: 'contrast_dye', label: 'Contraste radiológico' },
        { value: 'anesthesia', label: 'Anestesia' },
        { value: 'none', label: 'Nenhuma alergia a medicamentos' },
        { value: 'other', label: 'Outra (especificar)' }
      ]
    },
    {
      id: 'medication_allergy_reactions',
      text: 'Que tipo de reação você teve?',
      type: 'multiselect',
      required: true,
      conditionalOn: { questionId: 'medication_allergies', values: ['*'] },
      options: [
        { value: 'rash', label: 'Erupção cutânea/Urticária' },
        { value: 'breathing_difficulty', label: 'Dificuldade para respirar' },
        { value: 'swelling', label: 'Inchaço (face, lábios, língua)' },
        { value: 'nausea', label: 'Náusea/Vômito' },
        { value: 'diarrhea', label: 'Diarreia' },
        { value: 'anaphylaxis', label: 'Anafilaxia (reação grave)' },
        { value: 'other', label: 'Outra reação' }
      ]
    },
    {
      id: 'food_allergies',
      text: 'Você tem alergias alimentares?',
      type: 'multiselect',
      required: false,
      conditionalOn: { questionId: 'has_allergies', values: [true] },
      options: [
        { value: 'peanuts', label: 'Amendoim' },
        { value: 'tree_nuts', label: 'Castanhas/Nozes' },
        { value: 'shellfish', label: 'Frutos do mar/Crustáceos' },
        { value: 'fish', label: 'Peixes' },
        { value: 'eggs', label: 'Ovos' },
        { value: 'milk', label: 'Leite/Laticínios' },
        { value: 'soy', label: 'Soja' },
        { value: 'wheat', label: 'Trigo/Glúten' },
        { value: 'none', label: 'Nenhuma alergia alimentar' },
        { value: 'other', label: 'Outra (especificar)' }
      ]
    },
    {
      id: 'environmental_allergies',
      text: 'Você tem alergias ambientais?',
      type: 'multiselect',
      required: false,
      conditionalOn: { questionId: 'has_allergies', values: [true] },
      options: [
        { value: 'pollen', label: 'Pólen' },
        { value: 'dust_mites', label: 'Ácaros' },
        { value: 'pet_dander', label: 'Pelos de animais' },
        { value: 'mold', label: 'Mofo/Fungos' },
        { value: 'latex', label: 'Látex' },
        { value: 'insects', label: 'Picadas de insetos' },
        { value: 'none', label: 'Nenhuma alergia ambiental' },
        { value: 'other', label: 'Outra (especificar)' }
      ]
    },
    {
      id: 'allergy_severity',
      text: 'Em geral, como você classificaria a gravidade das suas alergias?',
      type: 'select',
      required: true,
      conditionalOn: { questionId: 'has_allergies', values: [true] },
      options: [
        { value: 'mild', label: 'Leve (sintomas menores, controláveis)' },
        { value: 'moderate', label: 'Moderada (requer medicação regularmente)' },
        { value: 'severe', label: 'Grave (interfere nas atividades diárias)' },
        { value: 'life_threatening', label: 'Risco de vida (anafilaxia/emergência)' }
      ]
    },
    {
      id: 'carries_epinephrine',
      text: 'Você carrega um auto-injetor de epinefrina (EpiPen)?',
      type: 'boolean',
      required: true,
      conditionalOn: { questionId: 'allergy_severity', values: ['severe', 'life_threatening'] }
    }
  ];

  const currentQuestion = allergiesQuestions[currentQuestionIndex];
  const shouldShowQuestion = (question: any) => {
    if (!question.conditionalOn) return true;
    
    const conditionValue = localResponses[question.conditionalOn.questionId];
    if (question.conditionalOn.values.includes('*')) {
      return conditionValue && (Array.isArray(conditionValue) ? conditionValue.length > 0 : true);
    }
    return question.conditionalOn.values.includes(conditionValue);
  };

  const visibleQuestions = allergiesQuestions.filter(shouldShowQuestion);
  const currentVisibleQuestion = visibleQuestions[currentQuestionIndex] || null;

  const handleResponse = (value: any) => {
    if (!currentVisibleQuestion) return;
    
    const newResponses = { ...localResponses, [currentVisibleQuestion.id]: value };
    setLocalResponses(newResponses);
    
    // Clear validation error
    if (validationErrors[currentVisibleQuestion.id]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[currentVisibleQuestion.id];
        return newErrors;
      });
    }
    
    // Auto-advance for boolean and select questions
    if (currentVisibleQuestion.type === 'boolean' || currentVisibleQuestion.type === 'select') {
      setTimeout(() => {
        if (currentQuestionIndex < visibleQuestions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        } else {
          onComplete(newResponses);
        }
      }, 300);
    }
  };

  const validateResponse = (question: any, value: any): string | null => {
    if (question.required && (!value || (Array.isArray(value) && value.length === 0))) {
      return 'Este campo é obrigatório';
    }
    return null;
  };

  const handleNext = () => {
    if (!currentVisibleQuestion) return;
    
    const error = validateResponse(currentVisibleQuestion, localResponses[currentVisibleQuestion.id]);
    if (error) {
      setValidationErrors(prev => ({ ...prev, [currentVisibleQuestion.id]: error }));
      return;
    }
    
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      onComplete(localResponses);
    }
  };

  const renderQuestion = () => {
    if (!currentVisibleQuestion) return null;

    switch (currentVisibleQuestion.type) {
      case 'boolean':
        return (
          <fieldset className="grid grid-cols-2 gap-4" aria-labelledby={`question-${currentVisibleQuestion.id}`}>
            <legend className="sr-only">{currentVisibleQuestion.text}</legend>
            <button
              type="button"
              onClick={() => handleResponse(true)}
              className={`p-4 border rounded ${localResponses[currentVisibleQuestion.id] === true ? 'bg-blue-500 text-white' : 'bg-white'}`}
              role="radio"
              aria-checked={localResponses[currentVisibleQuestion.id] === true}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => handleResponse(false)}
              className={`p-4 border rounded ${localResponses[currentVisibleQuestion.id] === false ? 'bg-blue-500 text-white' : 'bg-white'}`}
              role="radio"
              aria-checked={localResponses[currentVisibleQuestion.id] === false}
            >
              Não
            </button>
          </fieldset>
        );

      case 'select':
        return (
          <fieldset className="space-y-3" aria-labelledby={`question-${currentVisibleQuestion.id}`}>
            <legend className="sr-only">{currentVisibleQuestion.text}</legend>
            {currentVisibleQuestion.options?.map((option: any, index: number) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleResponse(option.value)}
                className={`w-full p-3 text-left border rounded ${localResponses[currentVisibleQuestion.id] === option.value ? 'bg-blue-500 text-white' : 'bg-white'}`}
                role="radio"
                aria-checked={localResponses[currentVisibleQuestion.id] === option.value}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        );

      case 'multiselect':
        const selectedValues = localResponses[currentVisibleQuestion.id] || [];
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Selecione todas as opções que se aplicam:</p>
            <fieldset className="space-y-3" aria-labelledby={`question-${currentVisibleQuestion.id}`}>
              <legend className="sr-only">{currentVisibleQuestion.text}</legend>
              {currentVisibleQuestion.options?.map((option: any) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      let newValues;
                      if (option.value === 'none') {
                        newValues = ['none'];
                      } else if (selectedValues.includes('none')) {
                        newValues = [option.value];
                      } else {
                        newValues = isSelected
                          ? selectedValues.filter((v: string) => v !== option.value)
                          : [...selectedValues, option.value];
                      }
                      handleResponse(newValues);
                    }}
                    className={`w-full p-3 text-left border rounded ${isSelected ? 'bg-blue-500 text-white' : 'bg-white'}`}
                    role="checkbox"
                    aria-checked={isSelected}
                  >
                    {isSelected && <span className="mr-2">✓</span>}
                    {option.label}
                  </button>
                );
              })}
            </fieldset>
            {currentVisibleQuestion.type === 'multiselect' && (
              <button
                type="button"
                onClick={handleNext}
                className="w-full mt-4 p-3 bg-green-500 text-white rounded"
                disabled={currentVisibleQuestion.required && selectedValues.length === 0}
              >
                Continuar
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!currentVisibleQuestion) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-4">Seção de Alergias Concluída</h2>
        <p>Obrigado por fornecer informações sobre suas alergias.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6" role="main" aria-label="Questionário de alergias">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">
            Pergunta {currentQuestionIndex + 1} de {visibleQuestions.length}
          </span>
          <span className="text-sm text-gray-600">
            Seção: Alergias
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / visibleQuestions.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={(currentQuestionIndex + 1) / visibleQuestions.length * 100}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
      
      <div className="space-y-6">
        <h2 className="text-xl font-semibold" id={`question-${currentVisibleQuestion.id}`}>
          {currentVisibleQuestion.text}
          {currentVisibleQuestion.required && <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>}
        </h2>
        
        {validationErrors[currentVisibleQuestion.id] && (
          <div role="alert" className="text-red-600 text-sm">
            {validationErrors[currentVisibleQuestion.id]}
          </div>
        )}
        
        {renderQuestion()}
        
        {currentVisibleQuestion.type !== 'boolean' && currentVisibleQuestion.type !== 'select' && currentVisibleQuestion.type !== 'multiselect' && (
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 text-gray-600 border rounded disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={currentVisibleQuestion.required && !localResponses[currentVisibleQuestion.id]}
            >
              {currentQuestionIndex < visibleQuestions.length - 1 ? 'Próximo' : 'Finalizar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

describe('AllergiesSection', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render the initial allergies question', () => {
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      expect(screen.getByText('Você tem alguma alergia conhecida?')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /sim/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /não/i })).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('should have proper ARIA labels', () => {
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Questionário de alergias');
      expect(screen.getByText('*')).toHaveAttribute('aria-label', 'obrigatório');
    });
  });

  describe('Question Flow - No Allergies Path', () => {
    it('should complete questionnaire when user has no allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Answer "No" to having allergies
      await user.click(screen.getByRole('radio', { name: /não/i }));
      
      // Should complete questionnaire immediately
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith({
          has_allergies: false
        });
      });
    });
  });

  describe('Question Flow - With Allergies Path', () => {
    it('should show medication allergies question after confirming allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Answer "Yes" to having allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Should progress to medication allergies question
      await waitFor(() => {
        expect(screen.getByText('Selecione todas as alergias a medicamentos que você tem:')).toBeInTheDocument();
      });
    });

    it('should handle medication allergy selection correctly', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to medication allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Penicilina')).toBeInTheDocument();
      });
      
      // Select penicillin allergy
      await user.click(screen.getByRole('checkbox', { name: /penicilina/i }));
      expect(screen.getByRole('checkbox', { name: /penicilina/i })).toHaveAttribute('aria-checked', 'true');
      
      // Select aspirin allergy as well
      await user.click(screen.getByRole('checkbox', { name: /aspirina/i }));
      expect(screen.getByRole('checkbox', { name: /aspirina/i })).toHaveAttribute('aria-checked', 'true');
      
      // Continue to next question
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Que tipo de reação você teve?')).toBeInTheDocument();
      });
    });

    it('should handle "none" selection in medication allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to medication allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      // First select a specific allergy
      await user.click(screen.getByRole('checkbox', { name: /penicilina/i }));
      expect(screen.getByRole('checkbox', { name: /penicilina/i })).toHaveAttribute('aria-checked', 'true');
      
      // Then select "none" - should clear other selections
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      expect(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('checkbox', { name: /penicilina/i })).toHaveAttribute('aria-checked', 'false');
    });

    it('should show allergy reactions question conditionally', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate through questions
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Penicilina')).toBeInTheDocument();
      });
      
      // Select a medication allergy
      await user.click(screen.getByRole('checkbox', { name: /penicilina/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Should show reaction types question
      await waitFor(() => {
        expect(screen.getByText('Que tipo de reação você teve?')).toBeInTheDocument();
        expect(screen.getByText('Erupção cutânea/Urticária')).toBeInTheDocument();
        expect(screen.getByText('Anafilaxia (reação grave)')).toBeInTheDocument();
      });
    });

    it('should not show reactions question if no medication allergies selected', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate through questions
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      // Select "none" for medication allergies
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Should skip to food allergies question
      await waitFor(() => {
        expect(screen.getByText('Você tem alergias alimentares?')).toBeInTheDocument();
      });
      
      // Should not show reactions question
      expect(screen.queryByText('Que tipo de reação você teve?')).not.toBeInTheDocument();
    });
  });

  describe('Food Allergies Functionality', () => {
    it('should handle common food allergies selection', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to food allergies (simulate having allergies but no medication allergies)
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Você tem alergias alimentares?')).toBeInTheDocument();
      });
      
      // Select multiple food allergies
      await user.click(screen.getByRole('checkbox', { name: /amendoim/i }));
      await user.click(screen.getByRole('checkbox', { name: /frutos do mar/i }));
      
      expect(screen.getByRole('checkbox', { name: /amendoim/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('checkbox', { name: /frutos do mar/i })).toHaveAttribute('aria-checked', 'true');
    });

    it('should handle shellfish allergy specifically', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to food allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Frutos do mar/Crustáceos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /frutos do mar/i }));
      expect(screen.getByRole('checkbox', { name: /frutos do mar/i })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Environmental Allergies Functionality', () => {
    it('should handle environmental allergens selection', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate through to environmental allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia alimentar')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia alimentar/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Você tem alergias ambientais?')).toBeInTheDocument();
        expect(screen.getByText('Pólen')).toBeInTheDocument();
        expect(screen.getByText('Ácaros')).toBeInTheDocument();
        expect(screen.getByText('Pelos de animais')).toBeInTheDocument();
      });
      
      // Select environmental allergies
      await user.click(screen.getByRole('checkbox', { name: /pólen/i }));
      await user.click(screen.getByRole('checkbox', { name: /ácaros/i }));
      
      expect(screen.getByRole('checkbox', { name: /pólen/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('checkbox', { name: /ácaros/i })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Allergy Severity Assessment', () => {
    it('should show severity question after selecting allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate through minimal path to severity
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia alimentar')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia alimentar/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia ambiental')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia ambiental/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Em geral, como você classificaria a gravidade das suas alergias?')).toBeInTheDocument();
        expect(screen.getByText('Leve (sintomas menores, controláveis)')).toBeInTheDocument();
        expect(screen.getByText('Grave (interfere nas atividades diárias)')).toBeInTheDocument();
        expect(screen.getByText('Risco de vida (anafilaxia/emergência)')).toBeInTheDocument();
      });
    });

    it('should show epinephrine question for severe allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to severity and select severe
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Skip through questions to get to severity
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia alimentar')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia alimentar/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia ambiental')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia ambiental/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Grave (interfere nas atividades diárias)')).toBeInTheDocument();
      });
      
      // Select severe allergy
      await user.click(screen.getByRole('radio', { name: /grave \(interfere nas atividades diárias\)/i }));
      
      // Should show epinephrine question
      await waitFor(() => {
        expect(screen.getByText('Você carrega um auto-injetor de epinefrina (EpiPen)?')).toBeInTheDocument();
      });
    });

    it('should show epinephrine question for life-threatening allergies', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to severity and select life-threatening
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Skip through to severity question
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia a medicamentos')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia a medicamentos/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia alimentar')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia alimentar/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Nenhuma alergia ambiental')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /nenhuma alergia ambiental/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Risco de vida (anafilaxia/emergência)')).toBeInTheDocument();
      });
      
      // Select life-threatening allergy
      await user.click(screen.getByRole('radio', { name: /risco de vida \(anafilaxia\/emergência\)/i }));
      
      // Should show epinephrine question
      await waitFor(() => {
        expect(screen.getByText('Você carrega um auto-injetor de epinefrina (EpiPen)?')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Questionnaire Flow', () => {
    it('should complete with comprehensive allergy data', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Complete full questionnaire with allergies
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      // Medication allergies
      await waitFor(() => {
        expect(screen.getByText('Penicilina')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('checkbox', { name: /penicilina/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Reaction types
      await waitFor(() => {
        expect(screen.getByText('Erupção cutânea/Urticária')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('checkbox', { name: /erupção cutânea/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Food allergies
      await waitFor(() => {
        expect(screen.getByText('Amendoim')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('checkbox', { name: /amendoim/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Environmental allergies
      await waitFor(() => {
        expect(screen.getByText('Pólen')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('checkbox', { name: /pólen/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Severity
      await waitFor(() => {
        expect(screen.getByText('Moderada (requer medicação regularmente)')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('radio', { name: /moderada \(requer medicação regularmente\)/i }));
      
      // Should complete questionnaire
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith({
          has_allergies: true,
          medication_allergies: ['penicillin'],
          medication_allergy_reactions: ['rash'],
          food_allergies: ['peanuts'],
          environmental_allergies: ['pollen'],
          allergy_severity: 'moderate'
        });
      });
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Navigate to a required multiselect field
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Penicilina')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('checkbox', { name: /penicilina/i }));
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Que tipo de reação você teve?')).toBeInTheDocument();
      });
      
      // Try to continue without selecting required reaction
      await user.click(screen.getByRole('button', { name: /continuar/i }));
      
      // Should show validation error
      expect(screen.getByRole('alert')).toHaveTextContent('Este campo é obrigatório');
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AllergiesSection onComplete={mockOnComplete} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Tab to first radio button
      await user.tab();
      expect(screen.getByRole('radio', { name: /sim/i })).toHaveFocus();
      
      // Use keyboard to select
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Selecione todas as alergias a medicamentos que você tem:')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes for multiselect', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      await user.click(screen.getByRole('radio', { name: /sim/i }));
      
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach(checkbox => {
          expect(checkbox).toHaveAttribute('aria-checked');
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicking without errors', async () => {
      const user = userEvent.setup();
      render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Rapidly click the same option multiple times
      const yesButton = screen.getByRole('radio', { name: /sim/i });
      await user.click(yesButton);
      await user.click(yesButton);
      await user.click(yesButton);
      
      // Should still work correctly
      await waitFor(() => {
        expect(screen.getByText('Selecione todas as alergias a medicamentos que você tem:')).toBeInTheDocument();
      });
    });

    it('should handle component unmounting gracefully', () => {
      const { unmount } = render(<AllergiesSection onComplete={mockOnComplete} />);
      
      // Should not throw error when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });
});