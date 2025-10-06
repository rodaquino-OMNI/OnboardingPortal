/**
 * Registration Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component - NO orchestration logic
 * ADR-003 Compliance: Components only render, pages orchestrate
 */

'use client';

import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card } from '../../ui/card';

export interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  cpf: string;
  phone: string;
  lgpdConsent: boolean;
}

export interface RegistrationFormProps {
  onSubmit: (data: RegistrationFormData) => void;
  isLoading?: boolean;
  error?: string | null;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

/**
 * Registration form presentation component
 * Receives data via props, emits events via callbacks
 */
export function RegistrationForm({
  onSubmit,
  isLoading = false,
  error = null,
  utmParams
}: RegistrationFormProps) {
  const [formData, setFormData] = React.useState<RegistrationFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    cpf: '',
    phone: '',
    lgpdConsent: false,
  });

  const [validationErrors, setValidationErrors] = React.useState<Partial<Record<keyof RegistrationFormData, string>>>({});

  const handleChange = (field: keyof RegistrationFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof RegistrationFormData, string>> = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 8) {
      errors.password = 'Senha deve ter no mínimo 8 caracteres';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem';
    }

    // CPF validation (basic)
    if (!formData.cpf) {
      errors.cpf = 'CPF é obrigatório';
    } else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf) && !/^\d{11}$/.test(formData.cpf)) {
      errors.cpf = 'CPF inválido';
    }

    // Phone validation
    if (!formData.phone) {
      errors.phone = 'Telefone é obrigatório';
    }

    // LGPD consent
    if (!formData.lgpdConsent) {
      errors.lgpdConsent = 'É necessário aceitar os termos';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Criar Conta</h1>
        <p className="text-gray-600">Preencha seus dados para começar</p>
        {utmParams?.source && (
          <p className="text-xs text-gray-500 mt-2">Fonte: {utmParams.source}</p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            disabled={isLoading}
            className={validationErrors.email ? 'border-red-500' : ''}
          />
          {validationErrors.email && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
          )}
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            type="text"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={handleChange('cpf')}
            disabled={isLoading}
            className={validationErrors.cpf ? 'border-red-500' : ''}
          />
          {validationErrors.cpf && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.cpf}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={handleChange('phone')}
            disabled={isLoading}
            className={validationErrors.phone ? 'border-red-500' : ''}
          />
          {validationErrors.phone && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            disabled={isLoading}
            className={validationErrors.password ? 'border-red-500' : ''}
          />
          {validationErrors.password && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.password}</p>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirmar Senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange('confirmPassword')}
            disabled={isLoading}
            className={validationErrors.confirmPassword ? 'border-red-500' : ''}
          />
          {validationErrors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.confirmPassword}</p>
          )}
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="lgpdConsent"
            checked={formData.lgpdConsent}
            onChange={handleChange('lgpdConsent')}
            disabled={isLoading}
            className="mt-1"
          />
          <Label htmlFor="lgpdConsent" className="text-sm">
            Aceito os termos de uso e política de privacidade (LGPD)
          </Label>
        </div>
        {validationErrors.lgpdConsent && (
          <p className="text-red-500 text-xs">{validationErrors.lgpdConsent}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Criando conta...' : 'Criar Conta'}
        </Button>
      </form>
    </Card>
  );
}
