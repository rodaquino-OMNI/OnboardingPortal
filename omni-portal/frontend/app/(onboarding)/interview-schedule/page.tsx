'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function InterviewSchedulePage() {
  const router = useRouter();

  const timeSlots = [
    { time: '09:00', available: true },
    { time: '10:00', available: false },
    { time: '11:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: false },
    { time: '16:00', available: true },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agendamento de Entrevista</h1>
            <p className="text-gray-600">Passo 4 de 4</p>
          </div>
        </div>
        <Progress value={100} className="h-2" />
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-4">Escolha a data</h3>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i + 1);
                return (
                  <button
                    key={i}
                    className="p-2 text-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </div>
                    <div className="text-sm font-medium">
                      {date.getDate()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-4">Horários disponíveis</h3>
            <div className="grid grid-cols-2 gap-3">
              {timeSlots.map((slot, index) => (
                <button
                  key={index}
                  disabled={!slot.available}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    slot.available
                      ? 'border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Clock className="w-4 h-4 mx-auto mb-1" />
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => router.push('/document-upload')}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={() => router.push('/completion')}
          className="flex items-center gap-2"
        >
          Finalizar
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}