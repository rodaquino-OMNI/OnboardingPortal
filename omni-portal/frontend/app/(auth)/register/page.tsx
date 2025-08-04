import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cadastro | Portal de Onboarding',
  description: 'Crie sua conta no Portal de Onboarding com validação completa',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <UnifiedRegistrationForm />
    </div>
  );
}