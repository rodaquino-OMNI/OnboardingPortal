import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useRegistration } from '@/hooks/useRegistration';
import { useLGPD } from '@/hooks/useLGPD';

// Mock dependencies
jest.mock('next/navigation');
// Mock zustand stores
jest.mock('@/hooks/useRegistration', () => ({
  useRegistration: jest.fn(() => ({
    currentStep: 'step1',
    registrationToken: null,
    userId: null,
    step1Data: {},
    step2Data: {},
    step3Data: {},
    register: jest.fn(),
    completeStep1: jest.fn(),
    completeStep2: jest.fn(),
    completeStep3: jest.fn(),
    reset: jest.fn(),
  })),
}));
jest.mock('@/hooks/useLGPD');
jest.mock('@/hooks/useAuth');
jest.mock('@/lib/schemas/auth', () => ({
  registerSchema: {
    parse: jest.fn((data) => data),
    safeParse: jest.fn((data) => ({ success: true, data }))
  }
}));

const mockPush = jest.fn();
const mockRegister = jest.fn();
const mockAcceptTerms = jest.fn();
const mockRegisterUser = jest.fn();
const mockClearError = jest.fn();
const mockAddPoints = jest.fn();

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    const useRegistrationMock = require('@/hooks/useRegistration').useRegistration as jest.Mock;
    useRegistrationMock.mockReturnValue({ 
      currentStep: 'step1',
      registrationToken: null,
      userId: null,
      step1Data: {},
      step2Data: {},
      step3Data: {},
      register: mockRegister,
      completeStep1: jest.fn(),
      completeStep2: jest.fn(),
      completeStep3: jest.fn(),
      reset: jest.fn(),
    });
    (useLGPD as jest.Mock).mockReturnValue({ acceptTerms: mockAcceptTerms });
    (require('@/hooks/useAuth').useAuth as jest.Mock).mockReturnValue({
      register: mockRegisterUser,
      error: null,
      clearError: mockClearError,
      addPoints: mockAddPoints
    });
  });

  describe('Rendering', () => {
    it('renders all form fields correctly', () => {
      render(<RegisterForm />);
      
      expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
    });

    it('displays LGPD consent checkboxes', () => {
      render(<RegisterForm />);
      
      expect(screen.getByText(/li e aceito os termos de uso/i)).toBeInTheDocument();
      expect(screen.getByText(/li e aceito a política de privacidade/i)).toBeInTheDocument();
      expect(screen.getByText(/aceito receber comunicações/i)).toBeInTheDocument();
    });

    it('shows password strength indicator', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const passwordInput = screen.getByLabelText(/^senha$/i);
      
      await user.type(passwordInput, 'weak');
      expect(screen.getByText(/senha fraca/i)).toBeInTheDocument();
      
      await user.clear(passwordInput);
      await user.type(passwordInput, 'StrongP@ss123');
      expect(screen.getByText(/senha forte/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(submitButton);
      
      expect(await screen.findByText(/nome completo é obrigatório/i)).toBeInTheDocument();
      expect(await screen.findByText(/e-mail é obrigatório/i)).toBeInTheDocument();
      expect(await screen.findByText(/senha é obrigatória/i)).toBeInTheDocument();
      expect(await screen.findByText(/cpf é obrigatório/i)).toBeInTheDocument();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const emailInput = screen.getByLabelText(/e-mail/i);
      await user.type(emailInput, 'invalid-email');
      await user.tab();
      
      expect(await screen.findByText(/e-mail inválido/i)).toBeInTheDocument();
    });

    it('validates CPF format', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const cpfInput = screen.getByLabelText(/cpf/i);
      await user.type(cpfInput, '123456789');
      await user.tab();
      
      expect(await screen.findByText(/cpf inválido/i)).toBeInTheDocument();
    });

    it('validates password confirmation', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const passwordInput = screen.getByLabelText(/^senha$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmar senha/i);
      
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password456');
      await user.tab();
      
      expect(await screen.findByText(/as senhas não coincidem/i)).toBeInTheDocument();
    });

    it('validates password strength requirements', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const passwordInput = screen.getByLabelText(/^senha$/i);
      await user.type(passwordInput, 'weak');
      await user.tab();
      
      expect(await screen.findByText(/a senha deve ter pelo menos 8 caracteres/i)).toBeInTheDocument();
    });

    it('requires LGPD consent', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      // Fill all required fields
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/e-mail/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      
      // Try to submit without accepting terms
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(submitButton);
      
      expect(await screen.findByText(/você deve aceitar os termos/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({ success: true });
      
      render(<RegisterForm />);
      
      // Fill all fields
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/e-mail/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      await user.type(screen.getByLabelText(/telefone/i), '(11) 98765-4321');
      
      // Accept terms
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          name: 'João Silva',
          email: 'joao@example.com',
          password: 'StrongP@ss123',
          cpf: '123.456.789-00',
          phone: '(11) 98765-4321',
          acceptedTerms: true,
          acceptedPrivacy: true,
          acceptedMarketing: false
        });
        expect(mockPush).toHaveBeenCalledWith('/welcome');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      mockRegister.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<RegisterForm />);
      
      // Fill minimum required fields
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/e-mail/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(submitButton);
      
      expect(screen.getByRole('button', { name: /criando conta.../i })).toBeDisabled();
    });

    it('handles registration errors', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));
      
      render(<RegisterForm />);
      
      // Fill all fields
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/e-mail/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      await user.click(screen.getByRole('checkbox', { name: /termos de uso/i }));
      await user.click(screen.getByRole('checkbox', { name: /política de privacidade/i }));
      
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(submitButton);
      
      expect(await screen.findByText(/este e-mail já está cadastrado/i)).toBeInTheDocument();
    });
  });

  describe('Input Formatting', () => {
    it('formats CPF input automatically', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const cpfInput = screen.getByLabelText(/cpf/i);
      await user.type(cpfInput, '12345678900');
      
      expect(cpfInput).toHaveValue('123.456.789-00');
    });

    it('formats phone input automatically', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const phoneInput = screen.getByLabelText(/telefone/i);
      await user.type(phoneInput, '11987654321');
      
      expect(phoneInput).toHaveValue('(11) 98765-4321');
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure and labels', () => {
      render(<RegisterForm />);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Formulário de registro');
      
      // Check all inputs have associated labels
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveAccessibleName();
      });
    });

    it('announces validation errors', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      const emailInput = screen.getByLabelText(/e-mail/i);
      await user.type(emailInput, 'invalid');
      await user.tab();
      
      const errorMessage = await screen.findByText(/e-mail inválido/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<RegisterForm />);
      
      // Tab through all form elements
      await user.tab(); // Name
      expect(screen.getByLabelText(/nome completo/i)).toHaveFocus();
      
      await user.tab(); // Email
      expect(screen.getByLabelText(/e-mail/i)).toHaveFocus();
      
      await user.tab(); // Password
      expect(screen.getByLabelText(/^senha$/i)).toHaveFocus();
      
      await user.tab(); // Confirm password
      expect(screen.getByLabelText(/confirmar senha/i)).toHaveFocus();
      
      await user.tab(); // CPF
      expect(screen.getByLabelText(/cpf/i)).toHaveFocus();
    });
  });

  describe('LGPD Compliance', () => {
    it('tracks consent properly', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue({ success: true });
      
      render(<RegisterForm />);
      
      // Fill required fields
      await user.type(screen.getByLabelText(/nome completo/i), 'João Silva');
      await user.type(screen.getByLabelText(/e-mail/i), 'joao@example.com');
      await user.type(screen.getByLabelText(/^senha$/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongP@ss123');
      await user.type(screen.getByLabelText(/cpf/i), '123.456.789-00');
      
      // Check individual consents
      const termsCheckbox = screen.getByRole('checkbox', { name: /termos de uso/i });
      const privacyCheckbox = screen.getByRole('checkbox', { name: /política de privacidade/i });
      const marketingCheckbox = screen.getByRole('checkbox', { name: /receber comunicações/i });
      
      await user.click(termsCheckbox);
      await user.click(privacyCheckbox);
      await user.click(marketingCheckbox);
      
      await user.click(screen.getByRole('button', { name: /criar conta/i }));
      
      await waitFor(() => {
        expect(mockAcceptTerms).toHaveBeenCalledWith({
          terms_accepted: true,
          privacy_accepted: true,
          marketing_accepted: true
        });
      });
    });

    it('shows links to terms and privacy policy', () => {
      render(<RegisterForm />);
      
      const termsLink = screen.getByRole('link', { name: /termos de uso/i });
      const privacyLink = screen.getByRole('link', { name: /política de privacidade/i });
      
      expect(termsLink).toHaveAttribute('href', '/terms');
      expect(privacyLink).toHaveAttribute('href', '/privacy');
      expect(termsLink).toHaveAttribute('target', '_blank');
      expect(privacyLink).toHaveAttribute('target', '_blank');
    });
  });
});