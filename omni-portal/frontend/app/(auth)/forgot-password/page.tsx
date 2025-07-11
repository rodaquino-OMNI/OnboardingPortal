import { PasswordResetForm } from '@/components/auth/PasswordResetForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recuperar Senha | Portal de Onboarding',
  description: 'Recupere sua senha do Portal de Onboarding',
};

export default function ForgotPasswordPage() {
  return <PasswordResetForm />;
}