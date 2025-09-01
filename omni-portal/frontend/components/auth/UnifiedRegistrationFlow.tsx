'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Mail, CheckCircle, Calendar, Phone, Building, MapPin, Heart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';

/**
 * Unified Registration Flow Architecture
 * 
 * Supports both single-step and multi-step registration modes:
 * - mode="single": Complete registration in one step
 * - mode="multi": Progressive registration with validation
 * 
 * Features:
 * - Consistent API data structure
 * - Proper validation for all fields
 * - LGPD compliance
 * - Gamification integration
 * - Real-time validation feedback
 * - Mobile-responsive design
 */

// Comprehensive validation schema that supports both modes
const registrationSchema = z.object({
  // Step 1: Basic Information
  name: z.string().min(1, 'Nome é obrigatório').min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  cpf: z.string()
    .min(1, 'CPF é obrigatório')
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido. Use o formato: 000.000.000-00')
    .transform(val => val.replace(/\D/g, '')),
  lgpd_consent: z.boolean().refine(val => val === true, 'Você deve aceitar os termos da LGPD'),
  
  // Step 2: Personal & Contact Information - NOW REQUIRED
  birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
  gender: z.enum(['masculine', 'feminine', 'non_binary', 'prefer_not_to_say'], {
    errorMap: () => ({ message: 'Selecione uma opção de gênero' }),
  }),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'separated', 'common_law'], {
    errorMap: () => ({ message: 'Selecione um estado civil' }),
  }),
  phone: z.string()
    .min(1, 'Telefone é obrigatório')
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$|^\d{10,11}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX'),
  
  // Work Information
  department: z.string().min(1, 'Departamento é obrigatório').max(100),
  job_title: z.string().min(1, 'Cargo é obrigatório').max(100),
  employee_id: z.string().min(1, 'ID do funcionário é obrigatório').max(50),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  preferred_language: z.enum(['pt-BR', 'en', 'es']).optional(),
  
  // Optional Address Information
  address: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX')
    .optional()
    .or(z.literal('')),
  
  // Emergency Contact (Optional)
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string()
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$|^\d{10,11}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
    .optional()
    .or(z.literal('')),
  emergency_contact_relationship: z.string().optional(),
  
  // Step 3: Security
  password: z.string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Senha deve conter: maiúscula, minúscula, número e símbolo'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
  security_question: z.string().min(1, 'Pergunta de segurança é obrigatória').max(255),
  security_answer: z.string().min(1, 'Resposta de segurança é obrigatória').min(3, 'Resposta deve ter pelo menos 3 caracteres'),
  two_factor_enabled: z.boolean().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegistrationData = z.infer<typeof registrationSchema>;

interface UnifiedRegistrationFlowProps {
  mode?: 'single' | 'multi';
  onSuccess?: (data: any) => void;
  initialData?: Partial<RegistrationData>;
}

export function UnifiedRegistrationFlow({ 
  mode = 'multi', 
  onSuccess,
  initialData = {} 
}: UnifiedRegistrationFlowProps) {
  const router = useRouter();
  const { error: authError, clearError } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationToken, setRegistrationToken] = useState<string>('');
  const [completionPercentage, setCompletionPercentage] = useState(0);

  const totalSteps = mode === 'single' ? 1 : 3;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    trigger,
    getValues,
  } = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
    defaultValues: {
      preferred_language: 'pt-BR',
      two_factor_enabled: false,
      ...initialData,
    },
  });

  // Real-time completion tracking
  useEffect(() => {
    const values = getValues();
    const requiredFields = ['name', 'email', 'cpf', 'birth_date', 'gender', 'marital_status', 'phone', 'department', 'job_title', 'employee_id', 'start_date', 'password', 'confirmPassword', 'security_question', 'security_answer'];
    const completedFields = requiredFields.filter(field => values[field as keyof RegistrationData]);
    setCompletionPercentage(Math.round((completedFields.length / requiredFields.length) * 100));
  }, [watch(), getValues]);

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (numbers.length === 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const formatZipCode = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const stepFields: Record<number, (keyof RegistrationData)[]> = {
      1: ['name', 'email', 'cpf', 'lgpd_consent'],
      2: ['birth_date', 'gender', 'marital_status', 'phone', 'department', 'job_title', 'employee_id', 'start_date'],
      3: ['password', 'confirmPassword', 'security_question', 'security_answer'],
    };

    const fieldsToValidate = stepFields[step] || [];
    const result = await trigger(fieldsToValidate);
    return result;
  };

  const nextStep = async () => {
    const isStepValid = await validateStep(currentStep);
    if (isStepValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: RegistrationData) => {
    try {
      clearError();
      setIsSubmitting(true);

      if (mode === 'single') {
        // Single-step registration - submit everything at once
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            cpf: data.cpf,
            password: data.password,
            password_confirmation: data.confirmPassword,
            birth_date: data.birth_date,
            gender: data.gender,
            marital_status: data.marital_status,
            phone: data.phone,
            department: data.department,
            job_title: data.job_title,
            employee_id: data.employee_id,
            start_date: data.start_date,
            preferred_language: data.preferred_language,
            lgpd_consent: data.lgpd_consent,
            // Optional fields
            address: data.address,
            number: data.number,
            complement: data.complement,
            neighborhood: data.neighborhood,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
            emergency_contact_name: data.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone,
            emergency_contact_relationship: data.emergency_contact_relationship,
            // Security fields
            security_question: data.security_question,
            security_answer: data.security_answer,
            two_factor_enabled: data.two_factor_enabled,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Registration failed');
        }

        setShowSuccess(true);
        
        if (onSuccess) {
          onSuccess(result);
        } else {
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        }
      } else {
        // Multi-step registration
        await handleMultiStepSubmission(data);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      // Error handling is managed by useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMultiStepSubmission = async (data: RegistrationData) => {
    switch (currentStep) {
      case 1:
        // Step 1: Basic information + LGPD
        const step1Response = await fetch('/api/register/step1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            cpf: data.cpf,
            lgpd_consent: data.lgpd_consent,
          }),
        });

        const step1Result = await step1Response.json();

        if (!step1Response.ok) {
          throw new Error(step1Result.message || 'Step 1 failed');
        }

        setRegistrationToken(step1Result.token);
        nextStep();
        break;

      case 2:
        // Step 2: Personal and work information
        const step2Response = await fetch('/api/register/step2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${registrationToken}`,
          },
          body: JSON.stringify({
            birth_date: data.birth_date,
            gender: data.gender,
            marital_status: data.marital_status,
            phone: data.phone,
            department: data.department,
            job_title: data.job_title,
            employee_id: data.employee_id,
            start_date: data.start_date,
            preferred_language: data.preferred_language,
            // Optional fields
            address: data.address,
            number: data.number,
            complement: data.complement,
            neighborhood: data.neighborhood,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
            emergency_contact_name: data.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone,
            emergency_contact_relationship: data.emergency_contact_relationship,
          }),
        });

        const step2Result = await step2Response.json();

        if (!step2Response.ok) {
          throw new Error(step2Result.message || 'Step 2 failed');
        }

        nextStep();
        break;

      case 3:
        // Step 3: Security information
        const step3Response = await fetch('/api/register/step3', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${registrationToken}`,
          },
          body: JSON.stringify({
            password: data.password,
            password_confirmation: data.confirmPassword,
            security_question: data.security_question,
            security_answer: data.security_answer,
            two_factor_enabled: data.two_factor_enabled,
          }),
        });

        const step3Result = await step3Response.json();

        if (!step3Response.ok) {
          throw new Error(step3Result.message || 'Step 3 failed');
        }

        setShowSuccess(true);
        
        if (onSuccess) {
          onSuccess(step3Result);
        } else {
          setTimeout(() => {
            router.push('/home');
          }, 2000);
        }
        break;
    }
  };

  const renderStepContent = () => {
    if (mode === 'single') {
      return renderAllFields();
    }

    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  const renderStep1 = () => (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Informações Básicas</h2>
        <p className="text-gray-600">Vamos começar com suas informações pessoais</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Nome Completo *
          </label>
          <Input
            id="name"
            type="text"
            placeholder="João da Silva"
            icon={User}
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email *
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
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-2">
            CPF *
          </label>
          <Input
            id="cpf"
            type="text"
            placeholder="000.000.000-00"
            icon={User}
            error={errors.cpf?.message}
            {...register('cpf')}
            onChange={(e) => {
              const formatted = formatCPF(e.target.value);
              setValue('cpf', formatted);
            }}
          />
          <p className="mt-1 text-xs text-gray-500">
            Para teste, use: 529.982.247-25
          </p>
        </div>

        <div className="flex items-center">
          <input
            id="lgpd_consent"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            {...register('lgpd_consent')}
          />
          <label htmlFor="lgpd_consent" className="ml-2 block text-sm text-gray-900">
            Aceito os <Link href="/privacy" className="text-blue-600 hover:text-blue-700">termos da LGPD</Link> e política de privacidade *
          </label>
        </div>
        {errors.lgpd_consent && (
          <p className="text-sm text-red-600">{errors.lgpd_consent.message}</p>
        )}
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Informações Pessoais e Profissionais</h2>
        <p className="text-gray-600">Agora precisamos de mais alguns detalhes</p>
      </div>

      <div className="space-y-4">
        {/* Personal Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Heart className="w-5 h-5 mr-2 text-red-500" />
            Informações Pessoais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-2">
                Data de Nascimento *
              </label>
              <Input
                id="birth_date"
                type="date"
                icon={Calendar}
                error={errors.birth_date?.message}
                {...register('birth_date')}
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                Gênero *
              </label>
              <select
                id="gender"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                {...register('gender')}
              >
                <option value="">Selecione...</option>
                <option value="masculine">Masculino</option>
                <option value="feminine">Feminino</option>
                <option value="non_binary">Não-binário</option>
                <option value="prefer_not_to_say">Prefiro não informar</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="marital_status" className="block text-sm font-medium text-gray-700 mb-2">
                Estado Civil *
              </label>
              <select
                id="marital_status"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                {...register('marital_status')}
              >
                <option value="">Selecione...</option>
                <option value="single">Solteiro(a)</option>
                <option value="married">Casado(a)</option>
                <option value="divorced">Divorciado(a)</option>
                <option value="widowed">Viúvo(a)</option>
                <option value="separated">Separado(a)</option>
                <option value="common_law">União Estável</option>
              </select>
              {errors.marital_status && (
                <p className="mt-1 text-sm text-red-600">{errors.marital_status.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <Input
                id="phone"
                type="text"
                placeholder="(11) 99999-9999"
                icon={Phone}
                error={errors.phone?.message}
                {...register('phone')}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  setValue('phone', formatted);
                }}
              />
            </div>
          </div>
        </div>

        {/* Work Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Building className="w-5 h-5 mr-2 text-blue-500" />
            Informações Profissionais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                Departamento *
              </label>
              <Input
                id="department"
                type="text"
                placeholder="Tecnologia da Informação"
                error={errors.department?.message}
                {...register('department')}
              />
            </div>

            <div>
              <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-2">
                Cargo *
              </label>
              <Input
                id="job_title"
                type="text"
                placeholder="Desenvolvedor Full Stack"
                error={errors.job_title?.message}
                {...register('job_title')}
              />
            </div>

            <div>
              <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
                ID do Funcionário *
              </label>
              <Input
                id="employee_id"
                type="text"
                placeholder="EMP001"
                error={errors.employee_id?.message}
                {...register('employee_id')}
              />
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                Data de Início *
              </label>
              <Input
                id="start_date"
                type="date"
                error={errors.start_date?.message}
                {...register('start_date')}
              />
            </div>
          </div>
        </div>

        {/* Optional Address Information */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-green-500" />
            Endereço (Opcional)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Endereço
              </label>
              <Input
                id="address"
                type="text"
                placeholder="Rua das Flores, 123"
                error={errors.address?.message}
                {...register('address')}
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                Cidade
              </label>
              <Input
                id="city"
                type="text"
                placeholder="São Paulo"
                error={errors.city?.message}
                {...register('city')}
              />
            </div>

            <div>
              <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 mb-2">
                CEP
              </label>
              <Input
                id="zip_code"
                type="text"
                placeholder="01234-567"
                error={errors.zip_code?.message}
                {...register('zip_code')}
                onChange={(e) => {
                  const formatted = formatZipCode(e.target.value);
                  setValue('zip_code', formatted);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Segurança da Conta</h2>
        <p className="text-gray-600">Finalize criando uma senha segura</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Senha *
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
            Mínimo 8 caracteres com maiúscula, minúscula, número e símbolo
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
            Confirmar Senha *
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

        <div>
          <label htmlFor="security_question" className="block text-sm font-medium text-gray-700 mb-2">
            Pergunta de Segurança *
          </label>
          <select
            id="security_question"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            {...register('security_question')}
          >
            <option value="">Selecione uma pergunta...</option>
            <option value="pet_name">Qual é o nome do seu primeiro animal de estimação?</option>
            <option value="birth_city">Em que cidade você nasceu?</option>
            <option value="mother_maiden">Qual é o nome de solteira da sua mãe?</option>
            <option value="favorite_teacher">Qual é o nome do seu professor favorito?</option>
            <option value="childhood_friend">Qual é o nome do seu melhor amigo de infância?</option>
          </select>
          {errors.security_question && (
            <p className="mt-1 text-sm text-red-600">{errors.security_question.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="security_answer" className="block text-sm font-medium text-gray-700 mb-2">
            Resposta de Segurança *
          </label>
          <Input
            id="security_answer"
            type="text"
            placeholder="Sua resposta"
            error={errors.security_answer?.message}
            {...register('security_answer')}
          />
        </div>

        <div className="flex items-center">
          <input
            id="two_factor_enabled"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            {...register('two_factor_enabled')}
          />
          <label htmlFor="two_factor_enabled" className="ml-2 block text-sm text-gray-900">
            Habilitar autenticação de dois fatores (recomendado)
          </label>
        </div>
      </div>
    </>
  );

  const renderAllFields = () => (
    <div className="space-y-6">
      {renderStep1()}
      <hr className="my-6" />
      {renderStep2()}
      <hr className="my-6" />
      {renderStep3()}
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="card-modern p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            {mode === 'single' ? 'Criar Conta' : 'Cadastro Completo'}
          </h1>
          {mode === 'multi' && (
            <p className="text-gray-600">Etapa {currentStep} de {totalSteps}</p>
          )}
        </div>

        {/* Progress Indicator */}
        {mode === 'multi' && (
          <div className="mb-8">
            <ProgressBar 
              current={currentStep} 
              total={totalSteps} 
              steps={[
                'Informações Básicas',
                'Dados Pessoais',
                'Segurança'
              ]}
            />
          </div>
        )}

        {/* Completion Percentage */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progresso do cadastro</span>
            <span>{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {renderStepContent()}

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-fade-in">
              <p className="text-sm text-red-600 font-medium">{authError}</p>
            </div>
          )}

          <div className="flex justify-between">
            {mode === 'multi' && currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={previousStep}
              >
                Voltar
              </Button>
            )}
            
            <div className={mode === 'multi' && currentStep === 1 ? 'ml-auto' : ''}>
              {mode === 'single' || currentStep === totalSteps ? (
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {mode === 'single' ? 'Criar Conta' : 'Finalizar Cadastro'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="w-full md:w-auto"
                >
                  Continuar
                </Button>
              )}
            </div>
          </div>

          <div className="text-center mt-4">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">
              Já tenho uma conta
            </Link>
          </div>
        </form>
      </div>

      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="card-modern p-8 shadow-2xl animate-bounce-in">
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