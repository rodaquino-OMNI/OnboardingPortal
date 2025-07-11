'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Shield, ChevronLeft, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useStep3 } from '@/hooks/useRegistration';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { RegisterStep3Data } from '@/services/api';

export default function SecuritySetupPage() {
  const router = useRouter();
  const { } = useAuth();
  const { data, setData, submit, isLoading, error, clearError } = useStep3();
  
  // Form state
  const [formData, setFormData] = useState<RegisterStep3Data>({
    password: data.password || '',
    password_confirmation: data.password_confirmation || '',
    security_question: data.security_question || '',
    security_answer: data.security_answer || '',
    two_factor_enabled: data.two_factor_enabled || false
  });
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
  
  const handleInputChange = (field: keyof RegisterStep3Data, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setData({ [field]: value });
    
    // Clear field error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.password.trim()) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Senha deve ter pelo menos 8 caracteres';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.password)) {
      newErrors.password = 'Senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 símbolo';
    }
    
    if (!formData.password_confirmation.trim()) {
      newErrors.password_confirmation = 'Confirmação de senha é obrigatória';
    } else if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'As senhas não coincidem';
    }
    
    if (!formData.security_question.trim()) {
      newErrors.security_question = 'Pergunta de segurança é obrigatória';
    }
    
    if (!formData.security_answer.trim()) {
      newErrors.security_answer = 'Resposta de segurança é obrigatória';
    } else if (formData.security_answer.length < 3) {
      newErrors.security_answer = 'Resposta deve ter pelo menos 3 caracteres';
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
      router.push('/document-upload');
    } catch (error) {
      // Error is handled by the hook
      console.error('Step 3 submission error:', error);
    }
  };
  
  const handleBack = () => {
    setData(formData);
    router.push('/company-info');
  };
  
  const securityQuestions = [
    'Qual é o nome do seu primeiro animal de estimação?',
    'Qual é o nome da sua primeira escola?',
    'Qual é o nome da cidade onde você nasceu?',
    'Qual é o nome de solteira da sua mãe?',
    'Qual é o seu filme favorito?',
    'Qual é o nome do seu melhor amigo de infância?'
  ];
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuração de Segurança</h1>
            <p className="text-gray-600">Passo 3 de 4</p>
          </div>
        </div>
        <Progress value={75} className="h-2" />
      </div>

      <Card className="p-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha *
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Mínimo 8 caracteres com maiúscula, minúscula, número e símbolo
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha *
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirme sua senha"
                  value={formData.password_confirmation}
                  onChange={(e) => handleInputChange('password_confirmation', e.target.value)}
                  className={`w-full pr-10 ${errors.password_confirmation ? 'border-red-500' : ''}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password_confirmation && (
                <p className="mt-1 text-sm text-red-600">{errors.password_confirmation}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pergunta de Segurança *
              </label>
              <select
                value={formData.security_question}
                onChange={(e) => handleInputChange('security_question', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.security_question ? 'border-red-500' : ''}`}
                disabled={isLoading}
              >
                <option value="">Selecione uma pergunta...</option>
                {securityQuestions.map((question, index) => (
                  <option key={index} value={question}>{question}</option>
                ))}
              </select>
              {errors.security_question && (
                <p className="mt-1 text-sm text-red-600">{errors.security_question}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resposta de Segurança *
              </label>
              <Input
                type="text"
                placeholder="Digite sua resposta"
                value={formData.security_answer}
                onChange={(e) => handleInputChange('security_answer', e.target.value)}
                className={`w-full ${errors.security_answer ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.security_answer && (
                <p className="mt-1 text-sm text-red-600">{errors.security_answer}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Esta resposta será usada para recuperar sua conta se necessário
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="two_factor"
                checked={formData.two_factor_enabled}
                onChange={(e) => handleInputChange('two_factor_enabled', e.target.checked)}
                className="mr-2"
                disabled={isLoading}
              />
              <label htmlFor="two_factor" className="text-sm text-gray-700">
                Ativar autenticação de dois fatores (recomendado)
              </label>
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
              Finalizar Registro
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}