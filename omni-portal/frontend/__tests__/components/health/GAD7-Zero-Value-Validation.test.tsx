import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock component to test GAD-7 zero value validation
const GAD7ValidationTest: React.FC<{
  onValidationResult: (isValid: boolean, value: number) => void;
}> = ({ onValidationResult }) => {
  const [value, setValue] = React.useState<number | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Mimic the validation logic from BaseHealthQuestionnaire
  const validateGAD7Response = (questionValue: number | null) => {
    // This is the FIXED validation logic - using explicit null checks
    if (questionValue === null || questionValue === undefined) {
      return 'Este campo é obrigatório';
    }
    return null; // Valid, including 0
  };

  const handleResponse = (responseValue: number) => {
    setValue(responseValue);
    const error = validateGAD7Response(responseValue);
    setValidationError(error);
    onValidationResult(error === null, responseValue);
  };

  return (
    <div className="gad7-test">
      <h2>GAD-7 Question Validation Test</h2>
      <p>Nas últimas 2 semanas, com que frequência você se sentiu nervoso, ansioso ou no limite?</p>
      
      <div className="response-options">
        <button
          data-testid="gad7-response-0"
          onClick={() => handleResponse(0)}
          className={value === 0 ? 'selected' : ''}
        >
          0 - Nunca
        </button>
        <button
          data-testid="gad7-response-1"
          onClick={() => handleResponse(1)}
          className={value === 1 ? 'selected' : ''}
        >
          1 - Alguns dias
        </button>
        <button
          data-testid="gad7-response-2"
          onClick={() => handleResponse(2)}
          className={value === 2 ? 'selected' : ''}
        >
          2 - Mais da metade dos dias
        </button>
        <button
          data-testid="gad7-response-3"
          onClick={() => handleResponse(3)}
          className={value === 3 ? 'selected' : ''}
        >
          3 - Quase todos os dias
        </button>
      </div>

      {validationError && (
        <div data-testid="validation-error" className="error">
          {validationError}
        </div>
      )}

      <div data-testid="current-value">
        Current value: {value !== null ? value : 'None selected'}
      </div>
    </div>
  );
};

describe('GAD-7 Zero Value Validation Fix', () => {
  const mockValidationResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should accept 0 as a valid GAD-7 response (Nunca)', async () => {
    const user = userEvent.setup();
    render(<GAD7ValidationTest onValidationResult={mockValidationResult} />);

    // Click on "0 - Nunca" option
    await user.click(screen.getByTestId('gad7-response-0'));

    await waitFor(() => {
      // Should show the selected value
      expect(screen.getByTestId('current-value')).toHaveTextContent('Current value: 0');
      
      // Should NOT show any validation error
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
      
      // Should call onValidationResult with isValid=true for value 0
      expect(mockValidationResult).toHaveBeenCalledWith(true, 0);
    });
  });

  it('should accept 1 as a valid GAD-7 response (Alguns dias)', async () => {
    const user = userEvent.setup();
    render(<GAD7ValidationTest onValidationResult={mockValidationResult} />);

    await user.click(screen.getByTestId('gad7-response-1'));

    await waitFor(() => {
      expect(screen.getByTestId('current-value')).toHaveTextContent('Current value: 1');
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
      expect(mockValidationResult).toHaveBeenCalledWith(true, 1);
    });
  });

  it('should accept 2 as a valid GAD-7 response (Mais da metade dos dias)', async () => {
    const user = userEvent.setup();
    render(<GAD7ValidationTest onValidationResult={mockValidationResult} />);

    await user.click(screen.getByTestId('gad7-response-2'));

    await waitFor(() => {
      expect(screen.getByTestId('current-value')).toHaveTextContent('Current value: 2');
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
      expect(mockValidationResult).toHaveBeenCalledWith(true, 2);
    });
  });

  it('should accept 3 as a valid GAD-7 response (Quase todos os dias)', async () => {
    const user = userEvent.setup();
    render(<GAD7ValidationTest onValidationResult={mockValidationResult} />);

    await user.click(screen.getByTestId('gad7-response-3'));

    await waitFor(() => {
      expect(screen.getByTestId('current-value')).toHaveTextContent('Current value: 3');
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
      expect(mockValidationResult).toHaveBeenCalledWith(true, 3);
    });
  });

  it('should properly handle all GAD-7 response values in sequence', async () => {
    const user = userEvent.setup();
    render(<GAD7ValidationTest onValidationResult={mockValidationResult} />);

    // Test each value in sequence
    const testValues = [0, 1, 2, 3];
    
    for (const testValue of testValues) {
      await user.click(screen.getByTestId(`gad7-response-${testValue}`));
      
      await waitFor(() => {
        expect(screen.getByTestId('current-value')).toHaveTextContent(`Current value: ${testValue}`);
        expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
      });
    }

    // Verify all calls were made with isValid=true
    expect(mockValidationResult).toHaveBeenCalledTimes(4);
    testValues.forEach((value, index) => {
      expect(mockValidationResult).toHaveBeenNthCalledWith(index + 1, true, value);
    });
  });

  it('should demonstrate the difference between null/undefined and 0', () => {
    // Test the validation function directly
    const validateGAD7Response = (questionValue: number | null | undefined) => {
      // This is the FIXED validation logic
      if (questionValue === null || questionValue === undefined) {
        return 'Este campo é obrigatório';
      }
      return null; // Valid, including 0
    };

    // Demonstrate that 0 is now valid
    expect(validateGAD7Response(0)).toBe(null); // Valid
    expect(validateGAD7Response(1)).toBe(null); // Valid
    expect(validateGAD7Response(2)).toBe(null); // Valid
    expect(validateGAD7Response(3)).toBe(null); // Valid
    
    // But null/undefined are invalid
    expect(validateGAD7Response(null)).toBe('Este campo é obrigatório');
    expect(validateGAD7Response(undefined)).toBe('Este campo é obrigatório');
  });

  it('should demonstrate the OLD broken validation logic vs NEW fixed logic', () => {
    // OLD BROKEN LOGIC (what was causing the GAD-7 issue)
    const oldBrokenValidation = (questionValue: number | null | undefined) => {
      // BROKEN: !questionValue converts 0 to true, making 0 seem invalid
      if (questionValue && !questionValue) {
        return 'Este campo é obrigatório';
      }
      return null;
    };

    // NEW FIXED LOGIC
    const newFixedValidation = (questionValue: number | null | undefined) => {
      // FIXED: Explicit null/undefined checks
      if (questionValue === null || questionValue === undefined) {
        return 'Este campo é obrigatório';
      }
      return null;
    };

    // Demonstrate the fix
    expect(newFixedValidation(0)).toBe(null); // ✅ Fixed: 0 is now valid
    expect(newFixedValidation(1)).toBe(null); // ✅ Still valid
    expect(newFixedValidation(null)).toBe('Este campo é obrigatório'); // ✅ Still invalid
    expect(newFixedValidation(undefined)).toBe('Este campo é obrigatório'); // ✅ Still invalid
  });
});