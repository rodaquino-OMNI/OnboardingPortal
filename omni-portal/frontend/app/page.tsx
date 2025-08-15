'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Rocket, User, Shield, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, checkAuth, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check authentication status when component mounts
  useEffect(() => {
    if (mounted) {
      checkAuth();
    }
  }, [mounted, checkAuth]);

  useEffect(() => {
    // Only redirect after component is mounted and user is authenticated
    // Add a flag to prevent multiple redirects
    if (mounted && isAuthenticated && !isLoading) {
      console.log('[RootPage] User is authenticated, redirecting to /home');
      // Use replace instead of push to prevent back button issues
      router.replace('/home');
    } else if (mounted && !isLoading) {
      console.log('[RootPage] User not authenticated, showing landing page');
    }
  }, [mounted, isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="mb-8">
            <Rocket className="w-20 h-20 text-blue-600 mx-auto mb-6" />
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Portal de Onboarding AUSTA
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Bem-vindo ao sistema de onboarding da AUSTA. Complete seu processo de integração 
              de forma simples, rápida e gamificada. Ganhe pontos, conquiste badges e 
              acompanhe seu progresso em tempo real.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={useCallback(() => router.push('/login'), [router])}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Fazer Login
            </Button>
            <Button
              onClick={useCallback(() => router.push('/register'), [router])}
              variant="outline"
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Criar Conta
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="p-8 text-center border-none shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Processo Personalizado
            </h3>
            <p className="text-gray-600">
              Experiência de onboarding adaptada às suas necessidades e perfil profissional.
            </p>
          </Card>

          <Card className="p-8 text-center border-none shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Segurança e Conformidade
            </h3>
            <p className="text-gray-600">
              Plataforma segura com conformidade LGPD e proteção total dos seus dados pessoais.
            </p>
          </Card>

          <Card className="p-8 text-center border-none shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Saúde e Bem-estar
            </h3>
            <p className="text-gray-600">
              Questionário inteligente de saúde com IA para melhor cuidado e acompanhamento.
            </p>
          </Card>
        </div>

        <div className="text-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Como Funciona o Processo
            </h2>
            <div className="grid md:grid-cols-4 gap-6 text-left">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  1
                </div>
                <h4 className="font-semibold mb-2">Cadastro</h4>
                <p className="text-sm text-gray-600">Crie sua conta e acesse a plataforma</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  2
                </div>
                <h4 className="font-semibold mb-2">Informações</h4>
                <p className="text-sm text-gray-600">Preencha dados da empresa e pessoais</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  3
                </div>
                <h4 className="font-semibold mb-2">Documentos</h4>
                <p className="text-sm text-gray-600">Envie documentos e questionário de saúde</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  4
                </div>
                <h4 className="font-semibold mb-2">Finalização</h4>
                <p className="text-sm text-gray-600">Agende entrevista e complete o processo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
