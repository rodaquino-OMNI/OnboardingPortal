'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Building, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useStep2 } from '@/hooks/useRegistration';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { RegisterStep2Data } from '@/services/api';

export default function CompanyInfoPage() {
  const router = useRouter();
  const { } = useAuth();
  const { data, setData, submit, isLoading, error, clearError } = useStep2();
  
  // Form state
  const [formData, setFormData] = useState<RegisterStep2Data>({
    phone: data.phone || '',
    department: data.department || '',
    job_title: data.job_title || '',
    employee_id: data.employee_id || '',
    start_date: data.start_date || '',
    birth_date: data.birth_date || '',
    gender: data.gender || undefined,
    marital_status: data.marital_status || undefined,
    preferred_language: data.preferred_language || 'pt-BR'
  });
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (error) {
      // Auto-clear error after 5 seconds
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);
  
  const handleInputChange = (field: keyof RegisterStep2Data, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setData({ [field]: value });
    
    // Clear field error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (!/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(formData.phone)) {
      newErrors.phone = 'Formato de telefone inválido';
    }
    
    if (!formData.department.trim()) {
      newErrors.department = 'Departamento é obrigatório';
    }
    
    if (!formData.job_title.trim()) {
      newErrors.job_title = 'Cargo é obrigatório';
    }
    
    if (!formData.employee_id.trim()) {
      newErrors.employee_id = 'ID do funcionário é obrigatório';
    }
    
    if (!formData.start_date.trim()) {
      newErrors.start_date = 'Data de início é obrigatória';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await submit(formData);
      router.push('/health-questionnaire');
    } catch (error) {
      // Error is handled by the hook
      console.error('Step 2 submission error:', error);
    }
  };
  
  const handleBack = () => {
    setData(formData);
    router.push('/welcome');
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Building className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Informações da Empresa</h1>
            <p className="text-gray-600">Passo 1 de 4</p>
          </div>
        </div>
        <Progress value={25} className="h-2" />
      </div>

      <Card className="p-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full ${errors.phone ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departamento *
              </label>
              <Input
                type="text"
                placeholder="Recursos Humanos"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className={`w-full ${errors.department ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.department && (
                <p className="mt-1 text-sm text-red-600">{errors.department}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargo *
              </label>
              <Input
                type="text"
                placeholder="Analista de Sistemas"
                value={formData.job_title}
                onChange={(e) => handleInputChange('job_title', e.target.value)}
                className={`w-full ${errors.job_title ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.job_title && (
                <p className="mt-1 text-sm text-red-600">{errors.job_title}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID do Funcionário *
              </label>
              <Input
                type="text"
                placeholder="12345"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                className={`w-full ${errors.employee_id ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.employee_id && (
                <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Início *
              </label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                className={`w-full ${errors.start_date ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Nascimento
              </label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gênero
              </label>
              <select
                value={formData.gender || ''}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="">Selecione...</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro</option>
                <option value="prefer_not_to_say">Prefiro não dizer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado Civil
              </label>
              <select
                value={formData.marital_status || ''}
                onChange={(e) => handleInputChange('marital_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                <option value="">Selecione...</option>
                <option value="single">Solteiro(a)</option>
                <option value="married">Casado(a)</option>
                <option value="divorced">Divorciado(a)</option>
                <option value="widowed">Viúvo(a)</option>
                <option value="other">Outro</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Próximo
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}