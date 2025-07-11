'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Rocket, User, FileText, Calendar, CheckCircle } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();

  const steps = [
    { icon: User, title: 'Informações da Empresa', description: 'Configure os dados da sua empresa' },
    { icon: FileText, title: 'Questionário de Saúde', description: 'Preencha o formulário de saúde' },
    { icon: Calendar, title: 'Documentos', description: 'Envie os documentos necessários' },
    { icon: CheckCircle, title: 'Agendamento', description: 'Agende sua entrevista' },
  ];

  return (
    <div className="text-center">
      <div className="mb-8">
        <Rocket className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Bem-vindo ao Processo de Onboarding!
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Vamos completar alguns passos para finalizar seu cadastro e ter tudo pronto para começar.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Estimativa de Tempo
        </h2>
        <p className="text-gray-600">
          O processo completo leva cerca de 15-20 minutos para ser concluído.
        </p>
      </div>

      <Button
        onClick={() => router.push('/company-info')}
        size="lg"
        className="px-8 py-3 text-lg"
      >
        Começar Onboarding
      </Button>
    </div>
  );
}