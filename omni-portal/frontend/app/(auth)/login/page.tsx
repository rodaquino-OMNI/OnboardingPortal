import OptimizedLoginForm from '@/components/auth/OptimizedLoginForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | Portal de Onboarding',
  description: 'Faça login em sua conta do Portal de Onboarding',
};

export default function LoginPage() {
  return <OptimizedLoginForm />;
}