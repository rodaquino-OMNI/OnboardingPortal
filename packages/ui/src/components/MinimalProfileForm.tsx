/**
 * MinimalProfileForm - Pure presentation component
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

export interface ProfileData {
  name: string;
  cpf: string;
  birthdate: string;
  phone: string;
  address: string;
  email: string; // Pre-filled, read-only
}

export interface ValidationErrors {
  name?: string;
  cpf?: string;
  birthdate?: string;
  phone?: string;
  address?: string;
}

export interface MinimalProfileFormProps {
  /** Parent-controlled submit handler (orchestration layer) */
  onSubmit: (data: ProfileData) => void;

  /** Loading state from parent (e.g., during API call) */
  isLoading?: boolean;

  /** Server-side validation errors from parent */
  errors?: ValidationErrors;

  /** Pre-filled email (from registration step) */
  initialEmail: string;

  /** Optional className for styling */
  className?: string;
}

/**
 * Format CPF: 12345678901 -> 123.456.789-01
 */
const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 11);

  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}.${limited.slice(3)}`;
  if (limited.length <= 9) return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
  return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
};

/**
 * Format phone: 11987654321 -> (11) 98765-4321
 */
const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 11);

  if (limited.length <= 2) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

/**
 * Validate CPF checksum
 */
const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // All same digit

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let checkDigit = 11 - (sum % 11);
  if (checkDigit >= 10) checkDigit = 0;
  if (checkDigit !== parseInt(cleaned.charAt(9))) return false;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  checkDigit = 11 - (sum % 11);
  if (checkDigit >= 10) checkDigit = 0;
  if (checkDigit !== parseInt(cleaned.charAt(10))) return false;

  return true;
};

/**
 * Client-side validation rules
 * Note: These are UX hints only. Real validation happens in API.
 */
const validateForm = (data: ProfileData): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Nome completo é obrigatório';
  } else if (data.name.trim().length < 3) {
    errors.name = 'Nome deve ter pelo menos 3 caracteres';
  } else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(data.name)) {
    errors.name = 'Nome deve conter apenas letras';
  }

  // CPF validation
  if (!data.cpf) {
    errors.cpf = 'CPF é obrigatório';
  } else if (!validateCPF(data.cpf)) {
    errors.cpf = 'CPF inválido';
  }

  // Birthdate validation
  if (!data.birthdate) {
    errors.birthdate = 'Data de nascimento é obrigatória';
  } else {
    const birthDate = new Date(data.birthdate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (isNaN(birthDate.getTime())) {
      errors.birthdate = 'Data inválida';
    } else if (age < 18) {
      errors.birthdate = 'Você deve ter pelo menos 18 anos';
    } else if (age > 120) {
      errors.birthdate = 'Data de nascimento inválida';
    }
  }

  // Phone validation
  const cleanedPhone = data.phone.replace(/\D/g, '');
  if (!data.phone) {
    errors.phone = 'Telefone é obrigatório';
  } else if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
    errors.phone = 'Telefone inválido';
  }

  // Address validation
  if (!data.address || data.address.trim().length === 0) {
    errors.address = 'Endereço é obrigatório';
  } else if (data.address.trim().length < 10) {
    errors.address = 'Endereço deve ter pelo menos 10 caracteres';
  }

  return errors;
};

export const MinimalProfileForm: React.FC<MinimalProfileFormProps> = ({
  onSubmit,
  isLoading = false,
  errors: serverErrors = {},
  initialEmail,
  className = '',
}) => {
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    cpf: '',
    birthdate: '',
    phone: '',
    address: '',
    email: initialEmail,
  });

  const [clientErrors, setClientErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<keyof ValidationErrors, boolean>>({
    name: false,
    cpf: false,
    birthdate: false,
    phone: false,
    address: false,
  });

  const handleChange = useCallback((field: keyof ProfileData) => {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = e.target.value;

      // Apply formatting for CPF and phone
      if (field === 'cpf') {
        value = formatCPF(value);
      } else if (field === 'phone') {
        value = formatPhone(value);
      }

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

  const handleBlur = useCallback((field: keyof ValidationErrors) => {
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
      name: true,
      cpf: true,
      birthdate: true,
      phone: true,
      address: true,
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
      className={`minimal-profile-form ${className}`}
      noValidate
      aria-label="Formulário de perfil"
    >
      {/* Email (read-only) */}
      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          disabled
          className="form-control"
          aria-readonly="true"
        />
        <div className="form-help">
          Email já verificado. Não pode ser alterado.
        </div>
      </div>

      {/* Name */}
      <div className="form-group">
        <label htmlFor="name" className="form-label">
          Nome Completo <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleChange('name')}
          onBlur={handleBlur('name')}
          disabled={isLoading}
          className={`form-control ${touched.name && displayErrors.name ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.name && !!displayErrors.name}
          aria-describedby={displayErrors.name ? 'name-error' : undefined}
          placeholder="João da Silva"
          autoComplete="name"
        />
        {touched.name && displayErrors.name && (
          <div id="name-error" className="error-message" role="alert">
            {displayErrors.name}
          </div>
        )}
      </div>

      {/* CPF */}
      <div className="form-group">
        <label htmlFor="cpf" className="form-label">
          CPF <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="cpf"
          type="text"
          value={formData.cpf}
          onChange={handleChange('cpf')}
          onBlur={handleBlur('cpf')}
          disabled={isLoading}
          className={`form-control ${touched.cpf && displayErrors.cpf ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.cpf && !!displayErrors.cpf}
          aria-describedby={displayErrors.cpf ? 'cpf-error' : undefined}
          placeholder="123.456.789-01"
          inputMode="numeric"
        />
        {touched.cpf && displayErrors.cpf && (
          <div id="cpf-error" className="error-message" role="alert">
            {displayErrors.cpf}
          </div>
        )}
      </div>

      {/* Birthdate */}
      <div className="form-group">
        <label htmlFor="birthdate" className="form-label">
          Data de Nascimento <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="birthdate"
          type="date"
          value={formData.birthdate}
          onChange={handleChange('birthdate')}
          onBlur={handleBlur('birthdate')}
          disabled={isLoading}
          className={`form-control ${touched.birthdate && displayErrors.birthdate ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.birthdate && !!displayErrors.birthdate}
          aria-describedby={displayErrors.birthdate ? 'birthdate-error' : undefined}
          max={new Date().toISOString().split('T')[0]}
          autoComplete="bday"
        />
        {touched.birthdate && displayErrors.birthdate && (
          <div id="birthdate-error" className="error-message" role="alert">
            {displayErrors.birthdate}
          </div>
        )}
      </div>

      {/* Phone */}
      <div className="form-group">
        <label htmlFor="phone" className="form-label">
          Telefone <span className="required" aria-label="obrigatório">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange('phone')}
          onBlur={handleBlur('phone')}
          disabled={isLoading}
          className={`form-control ${touched.phone && displayErrors.phone ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.phone && !!displayErrors.phone}
          aria-describedby={displayErrors.phone ? 'phone-error' : undefined}
          placeholder="(11) 98765-4321"
          inputMode="tel"
          autoComplete="tel"
        />
        {touched.phone && displayErrors.phone && (
          <div id="phone-error" className="error-message" role="alert">
            {displayErrors.phone}
          </div>
        )}
      </div>

      {/* Address */}
      <div className="form-group">
        <label htmlFor="address" className="form-label">
          Endereço <span className="required" aria-label="obrigatório">*</span>
        </label>
        <textarea
          id="address"
          value={formData.address}
          onChange={handleChange('address')}
          onBlur={handleBlur('address')}
          disabled={isLoading}
          className={`form-control ${touched.address && displayErrors.address ? 'is-invalid' : ''}`}
          aria-required="true"
          aria-invalid={touched.address && !!displayErrors.address}
          aria-describedby={displayErrors.address ? 'address-error' : undefined}
          placeholder="Rua, número, complemento, bairro, cidade - UF"
          rows={3}
          autoComplete="street-address"
        />
        {touched.address && displayErrors.address && (
          <div id="address-error" className="error-message" role="alert">
            {displayErrors.address}
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
        {isLoading ? 'Salvando perfil...' : 'Continuar'}
      </button>

      {/* Loading indicator for screen readers */}
      {isLoading && (
        <div role="status" className="sr-only">
          Salvando seu perfil, por favor aguarde...
        </div>
      )}
    </form>
  );
};

export default MinimalProfileForm;
