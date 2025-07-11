import { RegisterForm } from '@/components/auth/RegisterForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cadastro | Portal de Onboarding',
  description: 'Crie sua conta no Portal de Onboarding',
};

export default function RegisterPage() {
  return <RegisterForm />;
}