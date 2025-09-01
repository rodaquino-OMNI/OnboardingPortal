'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  Phone, 
  User, 
  Mail, 
  MapPin,
  Heart,
  Users,
  AlertTriangle,
  Check
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  address?: string;
}

interface ContactFormProps {
  onComplete: (contact: ContactInfo) => void;
  isProcessing?: boolean;
  initialValue?: ContactInfo;
  title?: string;
  description?: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Cônjuge/Companheiro(a)', emoji: '💕' },
  { value: 'parent', label: 'Pai/Mãe', emoji: '👨‍👩‍👧‍👦' },
  { value: 'child', label: 'Filho(a)', emoji: '👶' },
  { value: 'sibling', label: 'Irmão/Irmã', emoji: '👫' },
  { value: 'relative', label: 'Outro Familiar', emoji: '👥' },
  { value: 'friend', label: 'Amigo(a)', emoji: '🤝' },
  { value: 'other', label: 'Outro', emoji: '👤' }
];

export function ContactForm({ 
  onComplete, 
  isProcessing = false,
  initialValue,
  title = "Contato de Emergência",
  description = "Informe dados de uma pessoa para contatarmos em caso de necessidade"
}: ContactFormProps) {
  const [contact, setContact] = useState<ContactInfo>(initialValue || {
    name: '',
    phone: '',
    email: '',
    relationship: '',
    address: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation rules
  const validateField = (field: keyof ContactInfo, value: string): string => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Nome é obrigatório';
        if (value.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(value.trim())) return 'Nome deve conter apenas letras';
        return '';
      
      case 'phone':
        if (!value.trim()) return 'Telefone é obrigatório';
        const phoneRegex = /^(\(?\d{2}\)?\s?)?(9?\d{4})-?(\d{4})$/;
        const cleanPhone = value.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
          return 'Telefone deve ter 10 ou 11 dígitos';
        }
        return '';
      
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Email inválido';
        }
        return '';
      
      case 'relationship':
        if (!value) return 'Parentesco é obrigatório';
        return '';
      
      default:
        return '';
    }
  };

  // Format phone number
  const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleFieldChange = (field: keyof ContactInfo, value: string) => {
    let processedValue = value;
    
    // Special processing for phone
    if (field === 'phone') {
      processedValue = formatPhone(value);
    }
    
    setContact(prev => ({ ...prev, [field]: processedValue }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFieldBlur = (field: keyof ContactInfo) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, contact[field] || '');
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const isFormValid = (): boolean => {
    const requiredFields: (keyof ContactInfo)[] = ['name', 'phone', 'relationship'];
    
    for (const field of requiredFields) {
      const error = validateField(field, contact[field] || '');
      if (error) return false;
    }
    
    return true;
  };

  const handleSubmit = () => {
    // Validate all required fields
    const requiredFields: (keyof ContactInfo)[] = ['name', 'phone', 'relationship'];
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    
    requiredFields.forEach(field => {
      newTouched[field] = true;
      const error = validateField(field, contact[field] || '');
      if (error) newErrors[field] = error;
    });
    
    // Also validate optional email if provided
    if (contact.email) {
      const emailError = validateField('email', contact.email);
      if (emailError) newErrors.email = emailError;
    }
    
    setTouched(newTouched);
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      onComplete(contact);
    }
  };

  const getFieldError = (field: keyof ContactInfo): string => {
    return touched[field] ? errors[field] || '' : '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Nome Completo *
            </label>
            <Input
              type="text"
              placeholder="Ex: Maria Silva"
              value={contact.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              className={`${getFieldError('name') ? 'border-red-500 focus:ring-red-500' : ''}`}
              aria-invalid={!!getFieldError('name')}
            />
            {getFieldError('name') && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {getFieldError('name')}
              </p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Telefone *
            </label>
            <Input
              type="tel"
              placeholder="(11) 99999-9999"
              value={contact.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              onBlur={() => handleFieldBlur('phone')}
              className={`${getFieldError('phone') ? 'border-red-500 focus:ring-red-500' : ''}`}
              maxLength={15}
              aria-invalid={!!getFieldError('phone')}
            />
            {getFieldError('phone') && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {getFieldError('phone')}
              </p>
            )}
          </div>

          {/* Relationship Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Parentesco/Relação *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFieldChange('relationship', option.value)}
                  className={`p-3 text-left border rounded-lg transition-all hover:shadow-sm ${
                    contact.relationship === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{option.emoji}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {getFieldError('relationship') && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {getFieldError('relationship')}
              </p>
            )}
          </div>

          {/* Email Field (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email (opcional)
            </label>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={contact.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              className={`${getFieldError('email') ? 'border-red-500 focus:ring-red-500' : ''}`}
              aria-invalid={!!getFieldError('email')}
            />
            {getFieldError('email') && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {getFieldError('email')}
              </p>
            )}
          </div>

          {/* Address Field (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Endereço (opcional)
            </label>
            <Input
              type="text"
              placeholder="Cidade, Estado"
              value={contact.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Apenas cidade e estado são suficientes
            </p>
          </div>
        </div>
      </Card>

      {/* Data Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Check className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Seus dados estão seguros</p>
            <p>
              Essas informações são criptografadas e usadas apenas em situações de emergência. 
              Seguimos rigorosamente a LGPD para proteger sua privacidade.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          * Campos obrigatórios
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !isFormValid()}
          className="min-w-[120px]"
        >
          {isProcessing ? 'Salvando...' : 'Continuar'}
        </Button>
      </div>

      {/* Form Preview */}
      {isFormValid() && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-800 mb-2">Informações confirmadas:</p>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Nome:</strong> {contact.name}</p>
                <p><strong>Telefone:</strong> {contact.phone}</p>
                <p><strong>Relação:</strong> {RELATIONSHIP_OPTIONS.find(r => r.value === contact.relationship)?.label}</p>
                {contact.email && <p><strong>Email:</strong> {contact.email}</p>}
                {contact.address && <p><strong>Endereço:</strong> {contact.address}</p>}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}