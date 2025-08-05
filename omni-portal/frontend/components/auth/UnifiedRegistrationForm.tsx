'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Lock, Mail, Phone, Calendar, Home, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { unifiedAuthApi } from '@/lib/api/unified-auth';

// Comprehensive registration schema matching backend validation exactly
const unifiedRegistrationSchema = z.object({
  // Step 1: Personal Information (RegisterStep1Request)
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(255, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  cpf: z.string()
    .min(11, 'CPF deve ter 11 dígitos')
    .max(11, 'CPF deve ter 11 dígitos')
    .regex(/^\d{11}$/, 'CPF deve conter apenas números'),

  // Step 2: Contact and Personal Details (RegisterStep2Request) - NEW REQUIRED FIELDS
  birth_date: z.string()
    .min(1, 'Data de nascimento é obrigatória')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 16 && age <= 120;
    }, 'Você deve ter entre 16 e 120 anos'),
  
  gender: z.enum(['masculine', 'feminine', 'non_binary', 'prefer_not_to_say'], {
    errorMap: () => ({ message: 'Selecione uma opção de gênero' })
  }),
  
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed', 'separated', 'common_law'], {
    errorMap: () => ({ message: 'Selecione um estado civil' })
  }),
  
  phone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(11, 'Telefone deve ter no máximo 11 dígitos')
    .regex(/^\d{10,11}$/, 'Telefone deve conter apenas números'),
  
  department: z.string().min(1, 'Departamento é obrigatório').max(100, 'Departamento muito longo'),
  job_title: z.string().min(1, 'Cargo é obrigatório').max(100, 'Cargo muito longo'),
  employee_id: z.string().min(1, 'ID do funcionário é obrigatório').max(50, 'ID muito longo'),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  preferred_language: z.enum(['pt-BR', 'en', 'es']).default('pt-BR'),

  // Optional address fields
  address: z.string().max(255, 'Endereço muito longo').optional(),
  number: z.string().max(20, 'Número muito longo').optional(),
  complement: z.string().max(100, 'Complemento muito longo').optional().nullable(),
  neighborhood: z.string().max(100, 'Bairro muito longo').optional(),
  city: z.string().max(100, 'Cidade muito longa').optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  zip_code: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos').optional(),
  emergency_contact_name: z.string().max(255, 'Nome muito longo').optional(),
  emergency_contact_phone: z.string().regex(/^\d{10,11}$/, 'Telefone deve conter apenas números').optional(),
  emergency_contact_relationship: z.string().max(100, 'Relacionamento muito longo').optional(),

  // Step 3: Security
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Senha deve conter maiúsculas, minúsculas, números e símbolos'),
  confirmPassword: z.string(),
  security_question: z.string().min(1, 'Pergunta de segurança é obrigatória'),
  security_answer: z.string().min(1, 'Resposta de segurança é obrigatória'),
  two_factor_enabled: z.boolean().default(false),

  // Terms and Privacy
  terms_accepted: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos de uso',
  }),
  lgpd_consent: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar o tratamento de dados pessoais (LGPD)',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type UnifiedRegistrationData = z.infer<typeof unifiedRegistrationSchema>;

interface RegistrationStep {
  title: string;
  description: string;
  fields: (keyof UnifiedRegistrationData)[];
}

const registrationSteps: RegistrationStep[] = [
  {
    title: 'Informações Pessoais',
    description: 'Dados básicos e identificação',
    fields: ['name', 'email', 'cpf', 'lgpd_consent']
  },
  {
    title: 'Detalhes do Perfil',
    description: 'Informações pessoais e profissionais',
    fields: [
      'birth_date', 'gender', 'marital_status', 'phone', 
      'department', 'job_title', 'employee_id', 'start_date', 'preferred_language'
    ]
  },
  {
    title: 'Endereço (Opcional)',
    description: 'Informações de endereço e contato de emergência',
    fields: [
      'address', 'number', 'complement', 'neighborhood', 
      'city', 'state', 'zip_code', 'emergency_contact_name', 
      'emergency_contact_phone', 'emergency_contact_relationship'
    ]
  },
  {
    title: 'Segurança',
    description: 'Senha e configurações de segurança',
    fields: ['password', 'confirmPassword', 'security_question', 'security_answer', 'two_factor_enabled', 'terms_accepted']
  }
];

export function UnifiedRegistrationForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationToken, setRegistrationToken] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    trigger
  } = useForm<UnifiedRegistrationData>({
    resolver: zodResolver(unifiedRegistrationSchema),
    mode: 'onChange',
    defaultValues: {
      preferred_language: 'pt-BR',
      two_factor_enabled: false,
      terms_accepted: false,
      lgpd_consent: false,
    }
  });

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return value;
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
    if (numbers.length === 8) {
      return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return value;
  };

  const nextStep = async () => {
    const currentFields = registrationSteps[currentStep].fields;
    const isValid = await trigger(currentFields as any);
    
    if (isValid) {
      if (currentStep === 0) {
        // Submit step 1 to backend
        await submitStep1();
      }
      setCurrentStep(prev => Math.min(prev + 1, registrationSteps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const submitStep1 = async () => {
    const formData = getValues();
    
    try {
      const result = await unifiedAuthApi.registerStep1({
        name: formData.name,
        email: formData.email,
        cpf: formData.cpf.replace(/\D/g, ''),
      });

      setRegistrationToken(result.token || '');
    } catch (error: any) {
      console.error('Step 1 error:', error);
      throw error;
    }
  };

  const onSubmit = async (data: UnifiedRegistrationData) => {
    setIsSubmitting(true);
    
    try {
      // Step 2: Contact and profile information
      await unifiedAuthApi.registerStep2({
        birth_date: data.birth_date,
        gender: data.gender,
        marital_status: data.marital_status,
        phone: data.phone.replace(/\D/g, ''),
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
        zip_code: data.zip_code?.replace(/\D/g, ''),
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone?.replace(/\D/g, ''),
        emergency_contact_relationship: data.emergency_contact_relationship,
      }, registrationToken);

      // Step 3: Security setup
      const step3Result = await unifiedAuthApi.registerStep3({
        password: data.password,
        password_confirmation: data.confirmPassword,
        security_question: data.security_question,
        security_answer: data.security_answer,
        two_factor_enabled: data.two_factor_enabled,
      }, registrationToken);

      setShowSuccess(true);
      
      // Store authentication token
      if (step3Result.token) {
        localStorage.setItem('access_token', step3Result.token);
      }

      // Redirect after success animation
      setTimeout(() => {
        router.push('/home');
      }, 3000);

    } catch (error: any) {
      console.error('Registration error:', error);
      alert(`Erro no cadastro: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = currentStep === registrationSteps.length - 1;
  const progressPercentage = ((currentStep + 1) / registrationSteps.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="card-modern p-8 animate-fade-in">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Etapa {currentStep + 1} de {registrationSteps.length}</span>
            <span>{Math.round(progressPercentage)}% concluído</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Step Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            {registrationSteps[currentStep].title}
          </h1>
          <p className="text-gray-600">{registrationSteps[currentStep].description}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Personal Information */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
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
                  placeholder="seu@email.com"
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
                  {...register('cpf', {
                    onChange: (e) => {
                      const formatted = formatCPF(e.target.value);
                      // Keep the formatted value in the form state
                      setValue('cpf', formatted);
                      e.target.value = formatted;
                    }
                  })}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="lgpd_consent"
                    className="mt-1"
                    {...register('lgpd_consent')}
                  />
                  <label htmlFor="lgpd_consent" className="text-sm text-gray-700">
                    Eu aceito o tratamento dos meus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD) *
                  </label>
                </div>
                {errors.lgpd_consent && (
                  <p className="text-red-600 text-sm mt-2">{errors.lgpd_consent.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Profile Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <Input
                    id="phone"
                    type="text"
                    placeholder="(11) 99999-9999"
                    icon={Phone}
                    error={errors.phone?.message}
                    {...register('phone', {
                      onChange: (e) => {
                        const formatted = formatPhone(e.target.value);
                        setValue('phone', formatted.replace(/\D/g, ''));
                        e.target.value = formatted;
                      }
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                    Gênero *
                  </label>
                  <Select onValueChange={(value) => setValue('gender', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculine">Masculino</SelectItem>
                      <SelectItem value="feminine">Feminino</SelectItem>
                      <SelectItem value="non_binary">Não-binário</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefiro não dizer</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && (
                    <p className="text-red-600 text-sm mt-1">{errors.gender.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="marital_status" className="block text-sm font-medium text-gray-700 mb-2">
                    Estado Civil *
                  </label>
                  <Select onValueChange={(value) => setValue('marital_status', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado civil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Solteiro(a)</SelectItem>
                      <SelectItem value="married">Casado(a)</SelectItem>
                      <SelectItem value="divorced">Divorciado(a)</SelectItem>
                      <SelectItem value="widowed">Viúvo(a)</SelectItem>
                      <SelectItem value="separated">Separado(a)</SelectItem>
                      <SelectItem value="common_law">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.marital_status && (
                    <p className="text-red-600 text-sm mt-1">{errors.marital_status.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                    Departamento *
                  </label>
                  <Input
                    id="department"
                    type="text"
                    placeholder="Ex: Recursos Humanos"
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
                    placeholder="Ex: Analista de RH"
                    error={errors.job_title?.message}
                    {...register('job_title')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
                    ID do Funcionário *
                  </label>
                  <Input
                    id="employee_id"
                    type="text"
                    placeholder="Ex: EMP001"
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
          )}

          {/* Step 3: Address (Optional) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center text-sm text-gray-600 mb-4">
                Estes campos são opcionais, mas recomendamos preenchê-los para um perfil completo
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Endereço
                  </label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="Rua das Flores"
                    icon={Home}
                    error={errors.address?.message}
                    {...register('address')}
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
                    error={errors.number?.message}
                    {...register('number')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="complement" className="block text-sm font-medium text-gray-700 mb-2">
                    Complemento
                  </label>
                  <Input
                    id="complement"
                    type="text"
                    placeholder="Apto 45"
                    error={errors.complement?.message}
                    {...register('complement')}
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
                    error={errors.neighborhood?.message}
                    {...register('neighborhood')}
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
                    error={errors.city?.message}
                    {...register('city')}
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
                    error={errors.state?.message}
                    {...register('state')}
                  />
                </div>

                <div>
                  <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 mb-2">
                    CEP
                  </label>
                  <Input
                    id="zip_code"
                    type="text"
                    placeholder="12345-678"
                    error={errors.zip_code?.message}
                    {...register('zip_code', {
                      onChange: (e) => {
                        const formatted = formatZipCode(e.target.value);
                        setValue('zip_code', formatted.replace(/\D/g, ''));
                        e.target.value = formatted;
                      }
                    })}
                  />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contato de Emergência</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Contato
                    </label>
                    <Input
                      id="emergency_contact_name"
                      type="text"
                      placeholder="Maria Silva"
                      error={errors.emergency_contact_name?.message}
                      {...register('emergency_contact_name')}
                    />
                  </div>

                  <div>
                    <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone do Contato
                    </label>
                    <Input
                      id="emergency_contact_phone"
                      type="text"
                      placeholder="(11) 99999-9999"
                      error={errors.emergency_contact_phone?.message}
                      {...register('emergency_contact_phone', {
                        onChange: (e) => {
                          const formatted = formatPhone(e.target.value);
                          setValue('emergency_contact_phone', formatted.replace(/\D/g, ''));
                          e.target.value = formatted;
                        }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="emergency_contact_relationship" className="block text-sm font-medium text-gray-700 mb-2">
                    Relacionamento
                  </label>
                  <Input
                    id="emergency_contact_relationship"
                    type="text"
                    placeholder="Ex: Mãe, Esposo(a), Irmão(ã)"
                    error={errors.emergency_contact_relationship?.message}
                    {...register('emergency_contact_relationship')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Security */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Mínimo 8 caracteres com maiúsculas, minúsculas, números e símbolos
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
              </div>

              <div>
                <label htmlFor="security_question" className="block text-sm font-medium text-gray-700 mb-2">
                  Pergunta de Segurança *
                </label>
                <Select onValueChange={(value) => setValue('security_question', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma pergunta de segurança" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Qual o nome da sua primeira escola?">Qual o nome da sua primeira escola?</SelectItem>
                    <SelectItem value="Qual o nome do seu primeiro animal de estimação?">Qual o nome do seu primeiro animal de estimação?</SelectItem>
                    <SelectItem value="Em que cidade você nasceu?">Em que cidade você nasceu?</SelectItem>
                    <SelectItem value="Qual o nome de solteira da sua mãe?">Qual o nome de solteira da sua mãe?</SelectItem>
                  </SelectContent>
                </Select>
                {errors.security_question && (
                  <p className="text-red-600 text-sm mt-1">{errors.security_question.message}</p>
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

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="two_factor_enabled"
                    {...register('two_factor_enabled')}
                  />
                  <label htmlFor="two_factor_enabled" className="text-sm text-gray-700">
                    Habilitar autenticação de dois fatores (2FA) para maior segurança
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms_accepted"
                    className="mt-1"
                    {...register('terms_accepted')}
                  />
                  <label htmlFor="terms_accepted" className="text-sm text-gray-700">
                    Eu aceito os{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                      Política de Privacidade
                    </Link>{' '}
                    *
                  </label>
                </div>
                {errors.terms_accepted && (
                  <p className="text-red-600 text-sm mt-2">{errors.terms_accepted.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>

            {!isLastStep ? (
              <Button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                isLoading={isSubmitting}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Finalizar Cadastro
              </Button>
            )}
          </div>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </div>

      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="card-modern p-8 shadow-2xl animate-bounce-in">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Parabéns!</h3>
              <p className="text-gray-600 mb-4">Cadastro realizado com sucesso!</p>
              <div className="animate-pulse text-4xl font-bold text-green-600 mb-4">
                +100 pontos!
              </div>
              <p className="text-sm text-gray-500">Redirecionando para o painel...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UnifiedRegistrationForm;