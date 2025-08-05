import { z } from 'zod';

// Password requirements
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const loginSchema = z.object({
  login: z.string().min(1, 'CPF ou Email é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const registerSchema = z.object({
  // Step 1: Personal Information
  fullName: z.string().min(1, 'Campo obrigatório').min(3, 'Nome completo deve ter pelo menos 3 caracteres'),
  cpf: z.string()
    .min(1, 'Campo obrigatório')
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 11, 'CPF deve ter 11 dígitos')
    .refine(val => {
      // Validate CPF checksum
      if (!val || val.length !== 11) return false;
      
      // Check if all digits are the same
      if (/^(\d)\1+$/.test(val)) return false;
      
      // Calculate first digit
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(val.charAt(i)) * (10 - i);
      }
      let firstDigit = 11 - (sum % 11);
      if (firstDigit >= 10) firstDigit = 0;
      
      // Calculate second digit
      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(val.charAt(i)) * (11 - i);
      }
      let secondDigit = 11 - (sum % 11);
      if (secondDigit >= 10) secondDigit = 0;
      
      return firstDigit === parseInt(val.charAt(9)) && secondDigit === parseInt(val.charAt(10));
    }, 'CPF inválido'),
  birthDate: z.string().min(1, 'Campo obrigatório'),
  phone: z.string().min(1, 'Campo obrigatório').min(10, 'Telefone inválido'),
  
  // Step 2: Address
  address: z.object({
    street: z.string().min(1, 'Campo obrigatório').min(3, 'Rua deve ter pelo menos 3 caracteres'),
    number: z.string().min(1, 'Campo obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(1, 'Campo obrigatório').min(3, 'Bairro deve ter pelo menos 3 caracteres'),
    city: z.string().min(1, 'Campo obrigatório').min(3, 'Cidade deve ter pelo menos 3 caracteres'),
    state: z.string().min(1, 'Campo obrigatório').length(2, 'Estado deve ter 2 caracteres'),
    zipCode: z.string().min(1, 'Campo obrigatório').regex(/^\d{5}-\d{3}$/, 'CEP inválido. Use o formato: 00000-000'),
  }),
  
  // Step 3: Account Security
  email: z.string().min(1, 'Campo obrigatório').email('Email inválido'),
  password: z.string()
    .min(1, 'Campo obrigatório')
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(passwordRegex, 'Senha deve conter maiúsculas, minúsculas, números e caracteres especiais'),
  confirmPassword: z.string().min(1, 'Campo obrigatório'),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: 'Você deve aceitar os termos de uso',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(passwordRegex, 'Senha deve conter maiúsculas, minúsculas, números e caracteres especiais'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;