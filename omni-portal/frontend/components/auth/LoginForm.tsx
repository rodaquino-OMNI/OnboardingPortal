'use client';

import React, { useState } from 'react';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LoginFormData {
  login: string;
  password: string;
}

export default function LoginForm() {
  const [formData, setFormData] = useState<LoginFormData>({
    login: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const { login, socialLogin, error, clearError, isLoading } = useUnifiedAuth();
  const router = useRouter();

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.login.trim()) {
      errors.login = 'CPF ou Email é obrigatório';
    } else if (!formData.login.includes('@') && !formData.login.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)) {
      errors.login = 'Formato de email ou CPF inválido';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Senha é obrigatória';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await login(formData);
      // Login success is handled by the auth provider
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    clearError();
    try {
      await socialLogin(provider);
    } catch (err) {
      console.error(`${provider} login failed:`, err);
    }
  };

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Bem-vindo de volta!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Acesse sua conta para continuar
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="login" className="sr-only">
                E-mail ou CPF
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="000.000.000-00 ou seu@email.com"
                value={formData.login}
                onChange={handleInputChange('login')}
                aria-label="E-mail ou CPF"
              />
              {validationErrors.login && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.login}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange('password')}
                aria-label="Senha"
              />
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Esqueceu sua senha?
              </Link>
            </div>
            
            <div className="text-sm">
              <Link
                href="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Cadastre-se
              </Link>
            </div>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Ou continue com</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span>Continuar com Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('facebook')}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span>Continuar com Facebook</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}