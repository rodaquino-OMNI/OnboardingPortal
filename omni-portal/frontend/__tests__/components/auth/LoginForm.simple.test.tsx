import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/components/auth/LoginForm';

// Mock the modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const mockLogin = jest.fn();
const mockSocialLogin = jest.fn();
const mockClearError = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    socialLogin: mockSocialLogin,
    error: null,
    clearError: mockClearError,
  }),
}));

describe('LoginForm - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(true);
    mockSocialLogin.mockResolvedValue(true);
  });

  it('renders login form with all elements', () => {
    render(<LoginForm />);
    
    // Check form title
    expect(screen.getByText('Bem-vindo de volta')).toBeInTheDocument();
    
    // Check inputs exist
    expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/senha/i)).toBeInTheDocument();
    
    // Check submit button
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    
    // Check social login buttons
    expect(screen.getByText(/continuar com google/i)).toBeInTheDocument();
    expect(screen.getByText(/continuar com facebook/i)).toBeInTheDocument();
    
    // Check links
    expect(screen.getByText(/esqueceu sua senha/i)).toBeInTheDocument();
    expect(screen.getByText(/criar uma conta/i)).toBeInTheDocument();
  });

  it('allows user to type in email and password fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const emailInput = screen.getByPlaceholderText(/000.000.000-00 ou seu@email.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('shows validation errors for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    
    const emailInput = screen.getByPlaceholderText(/000.000.000-00 ou seu@email.com/i);
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm />);
    
    const emailInput = screen.getByPlaceholderText(/000.000.000-00 ou seu@email.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/);
    const submitButton = screen.getByRole('button', { name: /entrar/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    // Check that the form was submitted
    await waitFor(() => {
      expect(submitButton).toBeDisabled(); // Button is disabled during submission
    });
  });
});