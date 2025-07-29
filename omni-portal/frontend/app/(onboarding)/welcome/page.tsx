'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Rocket, User, FileText, Calendar, CheckCircle, ArrowRight, Clock, Sparkles } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  const steps = [
    { 
      icon: User, 
      title: 'Informações da Empresa', 
      description: 'Configure os dados da sua empresa',
      color: 'blue',
      gradient: 'from-blue-400 to-blue-600'
    },
    { 
      icon: FileText, 
      title: 'Avaliação de Saúde Inteligente', 
      description: 'Experiência personalizada com pathway dual',
      color: 'purple',
      gradient: 'from-purple-400 to-purple-600'
    },
    { 
      icon: Calendar, 
      title: 'Documentos', 
      description: 'Envie os documentos necessários',
      color: 'green',
      gradient: 'from-green-400 to-green-600'
    },
    { 
      icon: CheckCircle, 
      title: 'Agendamento', 
      description: 'Agende sua entrevista',
      color: 'orange',
      gradient: 'from-orange-400 to-orange-600'
    },
  ];

  return (
    <div className="text-center">
      {/* Hero Section with Gradient Background */}
      <div className="mb-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 rounded-3xl -z-10 opacity-50"></div>
        <div className="py-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
            <Rocket className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4 font-['Inter']">
            Bem-vindo ao Processo de Onboarding!
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto font-['Inter']">
            Vamos completar alguns passos para finalizar seu cadastro e ter tudo pronto para começar.
          </p>
        </div>
      </div>

      {/* Steps Grid with Modern Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div 
              key={index} 
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 group cursor-pointer transform hover:-translate-y-1"
            >
              <div className="flex items-start gap-5">
                <div className={`w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 font-['Inter'] group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 font-['Inter'] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-gray-400 font-['Inter']">
                <span className="mr-2">Passo {index + 1}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full">
                  <div className={`h-full bg-gradient-to-r ${step.gradient} rounded-full`} style={{ width: '25%' }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Estimation Card */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 shadow-lg border border-gray-200 mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-purple-200 rounded-full -translate-y-16 translate-x-16 opacity-30"></div>
        <div className="relative">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-900 font-['Inter']">
              Estimativa de Tempo
            </h2>
          </div>
          <p className="text-gray-700 font-['Inter'] text-lg">
            O processo completo leva cerca de <span className="font-bold text-blue-600">15-20 minutos</span> para ser concluído.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Sparkles className="w-4 h-4" />
            <span className="font-['Inter']">Processo simplificado e intuitivo</span>
          </div>
        </div>
      </div>

      {/* CTA Button with Gradient */}
      <Button
        onClick={() => router.push('/company-info')}
        size="lg"
        className="px-10 py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-['Inter'] group"
      >
        Começar Onboarding
        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </Button>
    </div>
  );
}