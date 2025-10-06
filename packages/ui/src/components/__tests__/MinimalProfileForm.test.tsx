/**
 * Minimal Profile Form Unit Tests
 * Sprint 2C - Comprehensive Testing
 *
 * COVERAGE TARGETS:
 * - Lines: ≥85%
 * - Functions: ≥90%
 * - Branches: ≥85%
 *
 * BRAZILIAN-SPECIFIC FEATURES:
 * - CPF validation and formatting (###.###.###-##)
 * - Phone formatting (+55 (##) #####-####)
 * - Date of birth validation (DD/MM/YYYY)
 * - Brazilian states dropdown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import MinimalProfileForm from '../MinimalProfileForm';

expect.extend(toHaveNoViolations);

describe('MinimalProfileForm', () => {
  const mockOnSubmit = vi.fn();
  const defaultProps = {
    onSubmit: mockOnSubmit,
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('Rendering', () => {
    it('renders all required profile fields', () => {
      render(<MinimalProfileForm {...defaultProps} />);

      expect(screen.getByLabelText(/nome|name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/telefone|phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/data.*nascimento|date.*birth/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continuar|continue|submit/i })).toBeInTheDocument();
    });

    it('renders with proper initial values when provided', () => {
      const initialValues = {
        name: 'João Silva',
        cpf: '123.456.789-00',
        phone: '+55 (11) 98765-4321',
        dateOfBirth: '01/01/1990',
      };

      render(<MinimalProfileForm {...defaultProps} initialValues={initialValues} />);

      expect(screen.getByLabelText(/nome|name/i)).toHaveValue('João Silva');
      expect(screen.getByLabelText(/cpf/i)).toHaveValue('123.456.789-00');
      expect(screen.getByLabelText(/telefone|phone/i)).toHaveValue('+55 (11) 98765-4321');
    });
  });

  describe('CPF Validation and Formatting', () => {
    it('formats CPF input correctly as user types', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);

      await user.type(cpfInput, '12345678900');

      await waitFor(() => {
        expect(cpfInput).toHaveValue('123.456.789-00');
      });
    });

    it('validates CPF checksum algorithm', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      // Invalid CPF (fails checksum)
      await user.type(cpfInput, '11111111111');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/cpf.*inválido|invalid.*cpf/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('accepts valid CPF numbers', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);
      const nameInput = screen.getByLabelText(/nome|name/i);
      const phoneInput = screen.getByLabelText(/telefone|phone/i);
      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      // Valid CPF: 123.456.789-09 (example - replace with actual valid CPF)
      await user.type(nameInput, 'João Silva');
      await user.type(cpfInput, '12345678909');
      await user.type(phoneInput, '11987654321');
      await user.type(dobInput, '01/01/1990');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('prevents non-numeric characters in CPF', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);

      await user.type(cpfInput, 'abc123def456');

      // Should only contain numbers and formatting
      expect(cpfInput.value).toMatch(/^[\d.-]*$/);
    });

    it('limits CPF to 11 digits', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);

      await user.type(cpfInput, '123456789001234567890');

      await waitFor(() => {
        // Should be formatted as ###.###.###-## (14 chars with formatting)
        expect(cpfInput.value.replace(/\D/g, '')).toHaveLength(11);
      });
    });
  });

  describe('Phone Number Formatting', () => {
    it('formats phone number correctly as user types', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/telefone|phone/i);

      await user.type(phoneInput, '11987654321');

      await waitFor(() => {
        expect(phoneInput).toHaveValue('+55 (11) 98765-4321');
      });
    });

    it('handles different phone number formats', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/telefone|phone/i);

      // Landline (10 digits)
      await user.type(phoneInput, '1133334444');

      await waitFor(() => {
        expect(phoneInput).toHaveValue('+55 (11) 3333-4444');
      });
    });

    it('validates phone number length', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/telefone|phone/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      // Too short
      await user.type(phoneInput, '119876');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/telefone.*inválido|invalid.*phone/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('prevents non-numeric characters in phone', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/telefone|phone/i);

      await user.type(phoneInput, 'abc11def98765ghi4321');

      // Should only contain numbers and formatting
      expect(phoneInput.value).toMatch(/^[+\d\s()-]*$/);
    });
  });

  describe('Date of Birth Validation', () => {
    it('formats date correctly as DD/MM/YYYY', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);

      await user.type(dobInput, '01011990');

      await waitFor(() => {
        expect(dobInput).toHaveValue('01/01/1990');
      });
    });

    it('validates minimum age requirement (18+)', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      // Date that makes user under 18
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() - 10);
      const dateString = `${futureDate.getDate().toString().padStart(2, '0')}${(futureDate.getMonth() + 1).toString().padStart(2, '0')}${futureDate.getFullYear()}`;

      await user.type(dobInput, dateString);
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/idade.*mínima|minimum.*age|18.*anos|18.*years/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates date is not in the future', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateString = `01012050`;

      await user.type(dobInput, dateString);
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*futuro|future.*date|inválida/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates date format and invalid dates', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      // Invalid date (32nd day)
      await user.type(dobInput, '32011990');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/data.*inválida|invalid.*date/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('submits form with all valid data', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/nome|name/i);
      const cpfInput = screen.getByLabelText(/cpf/i);
      const phoneInput = screen.getByLabelText(/telefone|phone/i);
      const dobInput = screen.getByLabelText(/data.*nascimento|date.*birth/i);
      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });

      await user.type(nameInput, 'João da Silva Santos');
      await user.type(cpfInput, '12345678909');
      await user.type(phoneInput, '11987654321');
      await user.type(dobInput, '01011990');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          name: 'João da Silva Santos',
          cpf: '123.456.789-09',
          phone: '+55 (11) 98765-4321',
          dateOfBirth: '01/01/1990',
        }));
      });
    });

    it('requires all fields to be filled', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText(/obrigatório|required/i).length).toBeGreaterThan(0);
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('disables submit button while loading', () => {
      render(<MinimalProfileForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<MinimalProfileForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper labels for all inputs', () => {
      render(<MinimalProfileForm {...defaultProps} />);

      expect(screen.getByLabelText(/nome|name/i)).toHaveAccessibleName();
      expect(screen.getByLabelText(/cpf/i)).toHaveAccessibleName();
      expect(screen.getByLabelText(/telefone|phone/i)).toHaveAccessibleName();
      expect(screen.getByLabelText(/data.*nascimento|date.*birth/i)).toHaveAccessibleName();
    });

    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /continuar|continue|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      await user.tab();
      expect(screen.getByLabelText(/nome|name/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/cpf/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/telefone|phone/i)).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('displays server errors correctly', () => {
      const errorMessage = 'CPF already registered';
      render(<MinimalProfileForm {...defaultProps} error={errorMessage} />);

      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('clears previous errors when form is corrected', async () => {
      const { rerender } = render(<MinimalProfileForm {...defaultProps} error="Previous error" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();

      rerender(<MinimalProfileForm {...defaultProps} error={null} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles paste events correctly for CPF', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const cpfInput = screen.getByLabelText(/cpf/i);

      // Paste unformatted CPF
      await user.click(cpfInput);
      await user.paste('12345678909');

      await waitFor(() => {
        expect(cpfInput).toHaveValue('123.456.789-09');
      });
    });

    it('handles paste events correctly for phone', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/telefone|phone/i);

      await user.click(phoneInput);
      await user.paste('11987654321');

      await waitFor(() => {
        expect(phoneInput).toHaveValue('+55 (11) 98765-4321');
      });
    });

    it('handles names with special characters', async () => {
      const user = userEvent.setup();
      render(<MinimalProfileForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/nome|name/i);

      const specialName = 'José María da Silva O\'Connor-González';
      await user.type(nameInput, specialName);

      expect(nameInput).toHaveValue(specialName);
    });
  });
});
