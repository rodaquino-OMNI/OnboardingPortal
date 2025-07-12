'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, Lock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { loginSchema, type LoginData } from '@/lib/schemas/auth';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SocialLoginButton } from './SocialLoginButton';
// import { cn } from '@/lib/utils'; // Will be used for future enhancements

export function LoginForm() {
  const router = useRouter();
  const { login, socialLogin, error: authError, clearError } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      clearError();
      await login(data);
      setShowSuccess(true);
      
      // Redirect after success animation
      setTimeout(() => {
        router.push('/home');
      }, 1500);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'instagram') => {
    try {
      clearError();
      setSocialLoading(provider);
      await socialLogin(provider);
    } catch (error) {
      console.error('Social login error:', error);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo de volta!</h1>
        <p className="text-gray-600">Entre com suas credenciais para acessar sua conta</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-2">
            CPF ou Email
          </label>
          <Input
            id="login"
            type="text"
            placeholder="000.000.000-00 ou seu@email.com"
            icon={User}
            error={errors.login?.message}
            {...register('login')}
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
        </div>

        {authError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-600">{authError}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Esqueceu sua senha?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          className="relative"
        >
          Entrar
        </Button>
      </form>

      {/* Social Login Divider */}
      <div className="my-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">ou continue com</span>
          </div>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="space-y-3">
        <SocialLoginButton
          provider="google"
          onClick={() => handleSocialLogin('google')}
          isLoading={socialLoading === 'google'}
        />
        <SocialLoginButton
          provider="facebook"
          onClick={() => handleSocialLogin('facebook')}
          isLoading={socialLoading === 'facebook'}
        />
        <SocialLoginButton
          provider="instagram"
          onClick={() => handleSocialLogin('instagram')}
          isLoading={socialLoading === 'instagram'}
        />
      </div>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-600">
          Não tem uma conta?{' '}
          <Link
            href="/register"
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Cadastre-se
          </Link>
        </p>
      </div>

      {/* Success Animation */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-xl p-8 shadow-2xl animate-bounce-in">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Login realizado!</h3>
              <p className="text-gray-600">Redirecionando...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}