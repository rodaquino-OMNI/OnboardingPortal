'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { forgotPasswordSchema, type ForgotPasswordData } from '@/lib/schemas/auth';
import { authApi } from '@/lib/api/auth';
import { useApi } from '@/hooks/useApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PasswordResetForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { execute, isLoading, error } = useApi();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      await execute(() => authApi.forgotPassword(data));
      setIsSubmitted(true);
    } catch (error) {
      console.error('Password reset error:', error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-md">
        <div className="card-modern p-8 animate-fade-in">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounce-in">
              <Mail className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Email enviado!</h1>
            <p className="text-gray-600 mb-8">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Link href="/login">
              <Button className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="card-modern p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Esqueceu sua senha?</h1>
          <p className="text-gray-600">
            Não se preocupe! Digite seu email e enviaremos instruções para recuperá-la.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 animate-fade-in">
              <p className="text-sm text-red-600 font-medium">{error.message}</p>
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            className="shadow-md hover:shadow-lg transition-all duration-300"
          >
            Enviar Email de Recuperação
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-700 flex items-center justify-center gap-2 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}