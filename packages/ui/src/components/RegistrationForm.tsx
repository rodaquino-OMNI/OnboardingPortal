/**
 * RegistrationForm - Pure presentation component
 *
 * ADR-003 Compliance:
 * ✅ NO network calls (fetch/axios)
 * ✅ NO storage (localStorage/sessionStorage/IndexedDB)
 * ✅ NO orchestration logic
 * ✅ ALL data via props
 * ✅ ALL interactions via callbacks
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: Component Boundaries
 */

import React, { useState, useCallback, FormEvent, ChangeEvent } from 'react';

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface ValidationErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
}

export interface RegistrationFormProps {
  /** Parent-controlled submit handler (orchestration layer) */
  onSubmit: (data: RegisterData) => void;

  /** Loading state from parent (e.g., during API call) */
  isLoading?: boolean;

  /** Server-side validation errors from parent */
  errors?: ValidationErrors;

  /** Optional className for styling */
  className?: string;
}

/**
 * Client-side validation rules
 * Note: These are UX hints only. Real validation happens in API.
 */
const validateForm = (data: RegisterData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email) {
    errors.email = 'Email é obrigatório';
  } else if (!emailRegex.test(data.email)) {
    errors.email = 'Email inválido';
  }

  // Password strength validation
  if (!data.password) {
    errors.password = 'Senha é obrigatória';
  } else if (data.password.length < 8) {
    errors.password = 'Senha deve ter pelo menos 8 caracteres';
  } else if (!/[A-Z]/.test(data.password)) {
    errors.password = 'Senha deve conter pelo menos uma letra maiúscula';
  } else if (!/[a-z]/.test(data.password)) {
    errors.password = 'Senha deve conter pelo menos uma letra minúscula';
  } else if (!/[0-9]/.test(data.password)) {
    errors.password = 'Senha deve conter pelo menos um número';
  } else if (!/[^A-Za-z0-9]/.test(data.password)) {
    errors.password = 'Senha deve conter pelo menos um caractere especial';
  }

  // Password confirmation
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirmação de senha é obrigatória';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem';
  }

  // Terms acceptance
  if (!data.termsAccepted) {
    errors.termsAccepted = 'Você deve aceitar os termos de uso';
  }

  return errors;
};

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onSubmit,
  isLoading = false,
  errors: serverErrors = {},
  className = '',
}) => {
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  });

  const [clientErrors, setClientErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<keyof RegisterData, boolean>>({
    email: false,
    password: false,
    confirmPassword: false,
    termsAccepted: false,
  });

  const handleChange = useCallback((field: keyof RegisterData) => {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = field === 'termsAccepted' ? e.target.checked : e.target.value;

      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));

      // Clear client error for this field
      setClientErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    };
  }, []);

  const handleBlur = useCallback((field: keyof RegisterData) => {
    return () => {
      setTouched(prev => ({
        ...prev,
        [field]: true,
      }));

      // Validate on blur
      const errors = validateForm(formData);
      setClientErrors(errors);
    };
  }, [formData]);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      termsAccepted: true,
    });

    // Validate before submission
    const errors = validateForm(formData);
    setClientErrors(errors);

    // Only submit if no client-side errors
    if (Object.keys(errors).length === 0) {
      onSubmit(formData);
    }
  }, [formData, onSubmit]);

  // Merge client and server errors (server errors take precedence)
  const displayErrors: ValidationErrors = {
    ...clientErrors,
    ...serverErrors,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`registration-form ${className}`}
      noValidate
      aria-label="Formulário de cadastro"
    >
      {/* Email Field */}
      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          disabled={isLoading}
          className={`form-control ${touched.email && displayErrors.email ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.email && !!displayErrors.email}
          aria-describedby={displayErrors.email ? 'email-error' : undefined}
          placeholder="seu@email.com"
          autoComplete="email"
        />
        {touched.email && displayErrors.email && (
          <div id="email-error" className="error-message" role="alert">
            {displayErrors.email}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Senha <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          disabled={isLoading}
          className={`form-control ${touched.password && displayErrors.password ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.password && !!displayErrors.password}
          aria-describedby={displayErrors.password ? 'password-error password-requirements' : 'password-requirements'}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
        <div id="password-requirements" className="form-help">
          Mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial
        </div>
        {touched.password && displayErrors.password && (
          <div id="password-error" className="error-message" role="alert">
            {displayErrors.password}
          </div>
        )}
      </div>

      {/* Confirm Password Field */}
      <div className="form-group">
        <label htmlFor="confirmPassword" className="form-label">
          Confirmar Senha <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange('confirmPassword')}
          onBlur={handleBlur('confirmPassword')}
          disabled={isLoading}
          className={`form-control ${touched.confirmPassword && displayErrors.confirmPassword ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.confirmPassword && !!displayErrors.confirmPassword}
          aria-describedby={displayErrors.confirmPassword ? 'confirm-password-error' : undefined}
          placeholder="Digite a senha novamente"
          autoComplete="new-password"
        />
        {touched.confirmPassword && displayErrors.confirmPassword && (
          <div id="confirm-password-error" className="error-message" role="alert">
            {displayErrors.confirmPassword}
          </div>
        )}
      </div>

      {/* Terms Acceptance */}
      <div className="form-group">
        <div className="form-check">
          <input
            id="termsAccepted"
            type="checkbox"
            checked={formData.termsAccepted}
            onChange={handleChange('termsAccepted')}
            onBlur={handleBlur('termsAccepted')}
            disabled={isLoading}
            className={`form-check-input ${touched.termsAccepted && displayErrors.termsAccepted ? 'is-invalid' : ''}`}
            aria-required="true"
            aria-invalid={touched.termsAccepted && !!displayErrors.termsAccepted}
            aria-describedby={displayErrors.termsAccepted ? 'terms-error' : undefined}
          />
          <label htmlFor="termsAccepted" className="form-check-label">
            Aceito os <a href="/terms" target="_blank" rel="noopener noreferrer">termos de uso</a> e{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">política de privacidade</a>
            <span className="required" aria-label="obrigatório">*</span>
          </label>
        </div>
        {touched.termsAccepted && displayErrors.termsAccepted && (
          <div id="terms-error" className="error-message" role="alert">
            {displayErrors.termsAccepted}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary btn-block"
        aria-busy={isLoading}
      >
        {isLoading ? 'Criando conta...' : 'Criar Conta'}
      </button>

      {/* Loading indicator for screen readers */}
      {isLoading && (
        <div role="status" className="sr-only">
          Criando sua conta, por favor aguarde...
        </div>
      )}
    </form>
  );
};

export default RegistrationForm;
