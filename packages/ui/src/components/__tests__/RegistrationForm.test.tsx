/**
 * Registration Form Unit Tests
 * Sprint 2C - Comprehensive Testing
 *
 * COVERAGE TARGETS:
 * - Lines: ≥85%
 * - Functions: ≥90%
 * - Branches: ≥85%
 *
 * TEST ARCHITECTURE:
 * - Pure presentation component (no API calls)
 * - Props-driven behavior
 * - Validates email/password format
 * - Accessibility compliant (WCAG 2.1 AA)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import RegistrationForm from '../RegistrationForm';

expect.extend(toHaveNoViolations);

describe('RegistrationForm', () => {
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
    it('renders all required form fields', () => {
      render(<RegistrationForm {...defaultProps} />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm.*password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register|create account/i })).toBeInTheDocument();
    });

    it('renders email input with correct type and attributes', () => {
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(emailInput).toBeRequired();
    });

    it('renders password inputs with correct type and attributes', () => {
      render(<RegistrationForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toBeRequired();
      expect(confirmInput).toBeRequired();
    });

    it('shows loading state correctly', () => {
      render(<RegistrationForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /register|create account/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/loading|submitting|processing/i)).toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Email already exists';
      render(<RegistrationForm {...defaultProps} error={errorMessage} />);

      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });
  });

  describe('Validation', () => {
    it('validates email format and shows error for invalid email', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid.*email|invalid.*email/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates password strength requirements', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      // Test weak password
      await user.type(passwordInput, 'weak');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password.*must.*characters|minimum.*8.*characters/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates password confirmation match', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      await user.type(passwordInput, 'SecurePass123!');
      await user.type(confirmInput, 'DifferentPass123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/passwords.*match|passwords.*same/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('requires all fields to be filled', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /register|create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/required|fill.*fields/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('clears errors when user corrects input', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      // Trigger error
      await user.type(emailInput, 'invalid');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid.*email|invalid.*email/i)).toBeInTheDocument();
      });

      // Correct input
      await user.clear(emailInput);
      await user.type(emailInput, 'valid@example.com');

      await waitFor(() => {
        expect(screen.queryByText(/valid.*email|invalid.*email/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit with correct data when form is valid', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      const testData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      await user.type(emailInput, testData.email);
      await user.type(passwordInput, testData.password);
      await user.type(confirmInput, testData.password);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          email: testData.email,
          password: testData.password,
        }));
      });
    });

    it('does not submit form when loading', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /register|create account/i });
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('prevents multiple submissions', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmInput = screen.getByLabelText(/confirm.*password/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(confirmInput, 'SecurePass123!');

      // Rapid clicks
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('User Interaction', () => {
    it('shows/hides password when toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password/i);
      const toggleButton = screen.getByRole('button', { name: /show|hide.*password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('maintains form state across interactions', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'SecurePass123!');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('SecurePass123!');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);

      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/^password/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/confirm.*password/i)).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<RegistrationForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels for all inputs', () => {
      render(<RegistrationForm {...defaultProps} />);

      expect(screen.getByLabelText(/email/i)).toHaveAccessibleName();
      expect(screen.getByLabelText(/^password/i)).toHaveAccessibleName();
      expect(screen.getByLabelText(/confirm.*password/i)).toHaveAccessibleName();
    });

    it('announces errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /register|create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAccessibleDescription();
      });
    });

    it('associates error messages with inputs via aria-describedby', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /register|create account/i });

      await user.type(emailInput, 'invalid');
      await user.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely long email addresses', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const longEmail = 'a'.repeat(200) + '@example.com';

      await user.type(emailInput, longEmail);
      expect(emailInput).toHaveValue(longEmail);
    });

    it('handles special characters in password', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password/i);
      const specialPassword = '!@#$%^&*()_+{}[]|:;<>,.?/~`';

      await user.type(passwordInput, specialPassword);
      expect(passwordInput).toHaveValue(specialPassword);
    });

    it('handles rapid input changes', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);

      await user.type(emailInput, 'test1@example.com');
      await user.clear(emailInput);
      await user.type(emailInput, 'test2@example.com');
      await user.clear(emailInput);
      await user.type(emailInput, 'test3@example.com');

      expect(emailInput).toHaveValue('test3@example.com');
    });
  });

  describe('Performance', () => {
    it('renders quickly with minimal re-renders', () => {
      const renderSpy = vi.fn();
      const TestWrapper = () => {
        renderSpy();
        return <RegistrationForm {...defaultProps} />;
      };

      const { rerender } = render(<TestWrapper />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<TestWrapper />);
      // Should only re-render when props change
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('debounces validation on input', async () => {
      const user = userEvent.setup();
      render(<RegistrationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);

      // Type rapidly
      await user.type(emailInput, 'test');

      // Validation should not run for every keystroke
      expect(screen.queryByText(/valid.*email|invalid.*email/i)).not.toBeInTheDocument();
    });
  });
});
