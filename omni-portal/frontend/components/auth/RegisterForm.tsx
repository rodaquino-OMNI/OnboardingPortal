'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, MapPin, Lock, ChevronLeft, ChevronRight, Calendar, Phone, Mail, Home, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { registerSchema, type RegisterData } from '@/lib/schemas/auth';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, title: 'Dados Pessoais', icon: User },
  { id: 2, title: 'Endereço', icon: MapPin },
  { id: 3, title: 'Segurança', icon: Lock },
];

export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser, error: authError, clearError, addPoints } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    // watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      clearError();
      await registerUser(data);
      setShowSuccess(true);
      
      // Add gamification points
      setTimeout(() => {
        addPoints(100);
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
    }
  };

  const handleNextStep = async () => {
    let fieldsToValidate: (keyof RegisterData)[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ['fullName', 'cpf', 'birthDate', 'phone'];
        break;
      case 2:
        fieldsToValidate = ['address'];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // const password = watch('password'); // Will be used for password strength indicator

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Crie sua conta</h1>
        <p className="text-gray-600">Complete o formulário abaixo para começar</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="relative">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                      isActive && 'bg-blue-600 text-white',
                      isCompleted && 'bg-green-600 text-white',
                      !isActive && !isCompleted && 'bg-gray-200 text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap">
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-24 h-0.5 mx-2 transition-all',
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-12">
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="João da Silva"
                  icon={User}
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />
              </div>

              <div>
                <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-2">
                  CPF
                </label>
                <Input
                  id="cpf"
                  type="text"
                  mask="cpf"
                  placeholder="000.000.000-00"
                  icon={User}
                  error={errors.cpf?.message}
                  {...register('cpf')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Nascimento
                </label>
                <Input
                  id="birthDate"
                  type="date"
                  icon={Calendar}
                  error={errors.birthDate?.message}
                  {...register('birthDate')}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone
                </label>
                <Input
                  id="phone"
                  type="text"
                  mask="phone"
                  placeholder="(00) 00000-0000"
                  icon={Phone}
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-2">
                  Rua
                </label>
                <Input
                  id="street"
                  type="text"
                  placeholder="Rua das Flores"
                  icon={Home}
                  error={errors.address?.street?.message}
                  {...register('address.street')}
                />
              </div>

              <div>
                <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-2">
                  Número
                </label>
                <Input
                  id="number"
                  type="text"
                  placeholder="123"
                  error={errors.address?.number?.message}
                  {...register('address.number')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="complement" className="block text-sm font-medium text-gray-700 mb-2">
                  Complemento (opcional)
                </label>
                <Input
                  id="complement"
                  type="text"
                  placeholder="Apto 101"
                  {...register('address.complement')}
                />
              </div>

              <div>
                <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700 mb-2">
                  Bairro
                </label>
                <Input
                  id="neighborhood"
                  type="text"
                  placeholder="Centro"
                  error={errors.address?.neighborhood?.message}
                  {...register('address.neighborhood')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  Cidade
                </label>
                <Input
                  id="city"
                  type="text"
                  placeholder="São Paulo"
                  error={errors.address?.city?.message}
                  {...register('address.city')}
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <Input
                  id="state"
                  type="text"
                  placeholder="SP"
                  maxLength={2}
                  error={errors.address?.state?.message}
                  {...register('address.state')}
                />
              </div>

              <div>
                <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-2">
                  CEP
                </label>
                <Input
                  id="zipCode"
                  type="text"
                  mask="cep"
                  placeholder="00000-000"
                  error={errors.address?.zipCode?.message}
                  {...register('address.zipCode')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Account Security */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="joao@exemplo.com"
                icon={Mail}
                error={errors.email?.message}
                {...register('email')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                icon={Lock}
                error={errors.password?.message}
                {...register('password')}
              />
              <p className="mt-1 text-xs text-gray-500">
                Mínimo 8 caracteres, com maiúsculas, minúsculas, números e caracteres especiais
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                icon={Lock}
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>

            <div className="flex items-start">
              <input
                id="termsAccepted"
                type="checkbox"
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                {...register('termsAccepted')}
              />
              <label htmlFor="termsAccepted" className="ml-2 text-sm text-gray-600">
                Li e aceito os{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                  Termos de Uso
                </Link>
                {' '}e a{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                  Política de Privacidade
                </Link>
              </label>
            </div>
            {errors.termsAccepted && (
              <p className="text-xs text-red-500">{errors.termsAccepted.message}</p>
            )}
          </div>
        )}

        {authError && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{authError}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handlePreviousStep}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          ) : (
            <Link href="/login">
              <Button type="button" variant="ghost">
                Já tenho conta
              </Button>
            </Link>
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              className="flex items-center gap-2"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="flex items-center gap-2"
            >
              Criar Conta
            </Button>
          )}
        </div>
      </form>

      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl animate-bounce-in">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Parabéns!</h3>
              <p className="text-gray-600 mb-4">Conta criada com sucesso</p>
              <div className="animate-pulse text-3xl font-bold text-green-600">
                +100 pontos!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}