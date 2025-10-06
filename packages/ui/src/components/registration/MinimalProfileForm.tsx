/**
 * Minimal Profile Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component for minimal profile completion
 * ADR-003 Compliance: Components only render, pages orchestrate
 */

'use client';

import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card } from '../../ui/card';

export interface MinimalProfileData {
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface MinimalProfileFormProps {
  onSubmit: (data: MinimalProfileData) => void;
  isLoading?: boolean;
  error?: string | null;
  initialData?: Partial<MinimalProfileData>;
}

/**
 * Minimal profile form presentation component
 * Collects essential user information after email verification
 */
export function MinimalProfileForm({
  onSubmit,
  isLoading = false,
  error = null,
  initialData = {}
}: MinimalProfileFormProps) {
  const [formData, setFormData] = React.useState<MinimalProfileData>({
    fullName: initialData.fullName || '',
    dateOfBirth: initialData.dateOfBirth || '',
    address: initialData.address || '',
    city: initialData.city || '',
    state: initialData.state || '',
    zipCode: initialData.zipCode || '',
  });

  const [validationErrors, setValidationErrors] = React.useState<Partial<Record<keyof MinimalProfileData, string>>>({});

  const handleChange = (field: keyof MinimalProfileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof MinimalProfileData, string>> = {};

    if (!formData.fullName || formData.fullName.trim().length < 3) {
      errors.fullName = 'Nome completo é obrigatório (mínimo 3 caracteres)';
    }

    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Data de nascimento é obrigatória';
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const age = (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) {
        errors.dateOfBirth = 'Você deve ter pelo menos 18 anos';
      }
    }

    if (!formData.address || formData.address.trim().length < 5) {
      errors.address = 'Endereço é obrigatório';
    }

    if (!formData.city || formData.city.trim().length < 2) {
      errors.city = 'Cidade é obrigatória';
    }

    if (!formData.state || formData.state.length !== 2) {
      errors.state = 'Estado é obrigatório (sigla de 2 letras)';
    }

    if (!formData.zipCode || !/^\d{5}-?\d{3}$/.test(formData.zipCode)) {
      errors.zipCode = 'CEP inválido (formato: 00000-000)';
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

  const brazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ];

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Complete seu Perfil</h1>
        <p className="text-gray-600">Precisamos de algumas informações adicionais</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Nome Completo</Label>
          <Input
            id="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange('fullName')}
            disabled={isLoading}
            className={validationErrors.fullName ? 'border-red-500' : ''}
          />
          {validationErrors.fullName && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.fullName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Data de Nascimento</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={handleChange('dateOfBirth')}
            disabled={isLoading}
            className={validationErrors.dateOfBirth ? 'border-red-500' : ''}
          />
          {validationErrors.dateOfBirth && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            type="text"
            placeholder="Rua, número, complemento"
            value={formData.address}
            onChange={handleChange('address')}
            disabled={isLoading}
            className={validationErrors.address ? 'border-red-500' : ''}
          />
          {validationErrors.address && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.address}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              type="text"
              value={formData.city}
              onChange={handleChange('city')}
              disabled={isLoading}
              className={validationErrors.city ? 'border-red-500' : ''}
            />
            {validationErrors.city && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.city}</p>
            )}
          </div>

          <div>
            <Label htmlFor="state">Estado</Label>
            <select
              id="state"
              value={formData.state}
              onChange={handleChange('state')}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-md ${validationErrors.state ? 'border-red-500' : ''}`}
            >
              <option value="">Selecione</option>
              {brazilianStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {validationErrors.state && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.state}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="zipCode">CEP</Label>
          <Input
            id="zipCode"
            type="text"
            placeholder="00000-000"
            value={formData.zipCode}
            onChange={handleChange('zipCode')}
            disabled={isLoading}
            className={validationErrors.zipCode ? 'border-red-500' : ''}
          />
          {validationErrors.zipCode && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.zipCode}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Salvando...' : 'Continuar'}
        </Button>
      </form>
    </Card>
  );
}
