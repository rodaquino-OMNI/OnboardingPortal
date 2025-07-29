'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Building, ChevronLeft, ChevronRight, Loader2, Briefcase, Phone, Calendar, User, Hash } from 'lucide-react';
import { useStep2 } from '@/hooks/useRegistration';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { RegisterStep2Data } from '@/services/api';

export default function CompanyInfoPage() {
  const router = useRouter();
  const { } = useAuth();
  const { data, setData, submit, isLoading, error, clearError } = useStep2();
  
  // Form state
  const [formData, setFormData] = useState<RegisterStep2Data>(() => ({
    phone: data.phone || '',
    department: data.department || '',
    job_title: data.job_title || '',
    employee_id: data.employee_id || '',
    start_date: data.start_date || '',
    ...(data.birth_date && { birth_date: data.birth_date }),
    ...(data.gender && { gender: data.gender }),
    ...(data.marital_status && { marital_status: data.marital_status }),
    ...(data.preferred_language && { preferred_language: data.preferred_language })
  }));
  
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
    return () => {}; // Ensure all code paths return a value
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
      {/* Header with Progress */}
      <div className="mb-10">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Building className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-['Inter']">Informações da Empresa</h1>
            <p className="text-gray-600 font-['Inter'] mt-1">Passo 1 de 4</p>
          </div>
        </div>
        <div className="relative">
          <Progress value={25} className="h-3 bg-gray-100" />
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm" style={{ width: '25%' }}></div>
        </div>
        <div className="mt-2 text-sm text-gray-500 font-['Inter']">25% concluído</div>
      </div>

      <Card className="p-8 shadow-xl border-0 rounded-2xl bg-white">
        <form className="space-y-8" onSubmit={handleSubmit}>
          {/* Contact Information Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 font-['Inter'] flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              Informações de Contato
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Telefone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full pl-10 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-['Inter'] ${errors.phone ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.phone}
                disabled={isLoading}
              />
                </div>
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
              </div>
            </div>
          </div>

          {/* Work Information Section */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 font-['Inter'] flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-600" />
              Informações Profissionais
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Departamento *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="text"
                placeholder="Recursos Humanos"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className={`w-full pl-10 rounded-lg border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-['Inter'] ${errors.department ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.department}
                disabled={isLoading}
              />
                </div>
              {errors.department && (
                <p className="mt-2 text-sm text-red-600 font-['Inter']">{errors.department}</p>
              )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Cargo *
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="text"
                placeholder="Analista de Sistemas"
                value={formData.job_title}
                onChange={(e) => handleInputChange('job_title', e.target.value)}
                className={`w-full pl-10 rounded-lg border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-['Inter'] ${errors.job_title ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.job_title}
                disabled={isLoading}
              />
                </div>
              {errors.job_title && (
                <p className="mt-2 text-sm text-red-600 font-['Inter']">{errors.job_title}</p>
              )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  ID do Funcionário *
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="text"
                placeholder="12345"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                className={`w-full pl-10 rounded-lg border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-['Inter'] ${errors.employee_id ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.employee_id}
                disabled={isLoading}
              />
                </div>
              {errors.employee_id && (
                <p className="mt-2 text-sm text-red-600 font-['Inter']">{errors.employee_id}</p>
              )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Data de Início *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                className={`w-full pl-10 rounded-lg border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all font-['Inter'] ${errors.start_date ? 'border-red-500' : ''}`}
                aria-invalid={!!errors.start_date}
                disabled={isLoading}
              />
                </div>
              {errors.start_date && (
                <p className="mt-2 text-sm text-red-600 font-['Inter']">{errors.start_date}</p>
              )}
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 font-['Inter'] flex items-center gap-2">
              <User className="w-5 h-5 text-green-600" />
              Informações Pessoais (Opcional)
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Data de Nascimento
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                className="w-full pl-10 rounded-lg border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all font-['Inter']"
                disabled={isLoading}
              />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Gênero
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                value={formData.gender || ''}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all font-['Inter'] appearance-none bg-white"
                disabled={isLoading}
              >
                <option value="">Selecione...</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro</option>
                <option value="prefer_not_to_say">Prefiro não dizer</option>
              </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 font-['Inter']">
                  Estado Civil
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                value={formData.marital_status || ''}
                onChange={(e) => handleInputChange('marital_status', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 transition-all font-['Inter'] appearance-none bg-white"
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
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-pulse">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800 font-['Inter']">{error}</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        <Button
          variant="outline"
          onClick={handleBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 hover:bg-gray-50 transition-all font-['Inter'] group"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 font-['Inter'] group"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Próximo
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}