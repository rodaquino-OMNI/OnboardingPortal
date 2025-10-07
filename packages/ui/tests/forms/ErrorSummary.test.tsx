/**
 * ErrorSummary component tests
 * Focus management and ARIA compliance
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ErrorSummary } from '../../src/forms/ErrorSummary';

describe('ErrorSummary', () => {
  test('renders nothing when no errors', () => {
    const { container } = render(<ErrorSummary errors={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test('displays error count correctly', () => {
    const errors = {
      field1: 'Error 1',
      field2: 'Error 2',
    };

    render(<ErrorSummary errors={errors} />);
    expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
  });

  test('singular error message for single error', () => {
    const errors = { field1: 'Error 1' };
    render(<ErrorSummary errors={errors} />);
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
  });

  test('has proper ARIA attributes', () => {
    const errors = { field1: 'Error message' };
    render(<ErrorSummary errors={errors} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });

  test('clicking error focuses the field', () => {
    const mockOnClick = jest.fn();
    const errors = { username: 'Username is required' };

    // Create a mock field in the DOM
    const mockField = document.createElement('input');
    mockField.id = 'username';
    mockField.focus = jest.fn();
    document.body.appendChild(mockField);

    render(<ErrorSummary errors={errors} onErrorClick={mockOnClick} />);

    const errorButton = screen.getByText(/username is required/i);
    fireEvent.click(errorButton);

    expect(mockOnClick).toHaveBeenCalledWith('username');
    expect(mockField.focus).toHaveBeenCalled();

    document.body.removeChild(mockField);
  });

  test('has no a11y violations', async () => {
    const errors = {
      field1: 'Error 1',
      field2: 'Error 2',
    };

    const { container } = render(<ErrorSummary errors={errors} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('error buttons are keyboard accessible', () => {
    const errors = { field1: 'Error message' };
    render(<ErrorSummary errors={errors} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('underline');
    expect(button).toHaveAttribute('type', 'button');
  });
});
