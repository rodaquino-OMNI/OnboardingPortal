'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Rocket, User, Shield, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Ensure this only runs on client side
  useEffect(() => {
    setIsClient(true);
    // Check auth status when component mounts
    const initAuth = async () => {
      try {
        await checkAuth();
      } catch (error) {
        console.error('[HomePage] Auth check error:', error);
      } finally {
        setInitialLoad(false);
      }
    };
    initAuth();
  }, []); // Remove checkAuth dependency to prevent infinite loop

  useEffect(() => {
    // Only redirect after auth check is complete and we're authenticated
    if (isClient && !initialLoad && isAuthenticated && !isLoading) {
      router.push('/home');
    }
  }, [isClient, initialLoad, isAuthenticated, isLoading, router]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (initialLoad) {
        console.warn('[HomePage] Auth check timeout, forcing load complete');
        setInitialLoad(false);
      }
    }, 3000); // 3 second timeout
    
    return () => clearTimeout(timeout);
  }, [initialLoad]);

  // Show loading during initial auth check or SSR (but only briefly)
  if (!isClient || (initialLoad && isLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // If authenticated after auth check, show redirect loading
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecionando para o dashboard...</p>
        </div>
      </div>
    );
  }

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
              onClick={() => router.push('/login')}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Fazer Login
            </Button>
            <Button
              onClick={() => router.push('/register')}
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
