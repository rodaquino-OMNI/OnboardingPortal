'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronLeft, ChevronRight, Video, Award, Star, CheckCircle, AlertCircle, Users, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface AppointmentType {
  id: number;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  preparation_time_minutes: number;
  base_price: number;
  formatted_price: string;
  preparation_checklist: string[];
  gamification: {
    points_for_booking: number;
    points_for_completion: number;
    points_for_preparation: number;
    bonus_for_punctuality: number;
  };
}

interface TimeSlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  display_time: string;
  display_date: string;
  display_datetime: string;
  available_spots: number;
  is_soon: boolean;
  is_today: boolean;
  is_tomorrow: boolean;
  professional: {
    id: number;
    name: string;
    specialization: string;
    rating: number;
  };
  gamification_preview: {
    points_for_booking: number;
    bonus_available?: string;
  };
}

interface EligibilityData {
  eligible: boolean;
  requirements: Record<string, {
    completed: boolean;
    title: string;
    description: string;
  }>;
  total_points: number;
  minimum_points_required: number;
  points_sufficient: boolean;
  completion_percentage: number;
  reward_type: string;
  reward_description: string;
  next_steps: string[];
}

export default function TelemedicineSchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(null);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [step, setStep] = useState<'eligibility' | 'types' | 'slots' | 'confirmation'>('eligibility');

  const checkEligibility = useCallback(async () => {
    try {
      const response = await fetch('/api/telemedicine/eligibility', {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Redirecionando para login...');
          router.push('/login?redirect=/telemedicine-schedule');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setEligibilityData(data.data);
        if (data.eligible) {
          loadAppointmentTypes();
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      toast.error('Erro ao verificar elegibilidade');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadAppointmentTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/telemedicine/appointment-types', {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Redirecionando para login...');
          router.push('/login?redirect=/telemedicine-schedule');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAppointmentTypes(data.data.appointment_types);
        setStep('types');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error loading appointment types:', error);
      toast.error('Erro ao carregar tipos de consulta');
    }
  }, [router]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  const loadAvailableSlots = async (appointmentTypeId: number) => {
    try {
      const response = await fetch(`/api/telemedicine/available-slots?appointment_type_id=${appointmentTypeId}`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Redirecionando para login...');
          router.push('/login?redirect=/telemedicine-schedule');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAvailableSlots(data.data.slots);
        setStep('slots');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      toast.error('Erro ao carregar horários disponíveis');
    }
  };

  const handleSelectType = (type: AppointmentType) => {
    setSelectedType(type);
    loadAvailableSlots(type.id);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('confirmation');
  };

  const handleBookAppointment = async () => {
    if (!selectedType || !selectedSlot) return;

    setIsBooking(true);
    
    try {
      const response = await fetch('/api/telemedicine/book', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          appointment_type_id: selectedType.id,
          interview_slot_id: selectedSlot.id,
          preferred_language: 'pt',
        }),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Redirecionando para login...');
          router.push('/login?redirect=/telemedicine-schedule');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Consulta agendada com sucesso!');
        router.push('/completion?telemedicine=true');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Erro ao agendar consulta');
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando elegibilidade...</p>
        </div>
      </div>
    );
  }

  // Eligibility Check Step
  if (step === 'eligibility' && eligibilityData && !eligibilityData.eligible) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Award className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Consulta de Telemedicina</h1>
            <p className="text-gray-600">Recompensa exclusiva para quem completa o onboarding</p>
          </div>

          <Card className="card-modern p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Progresso da Elegibilidade</h2>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Conclusão do Onboarding</span>
                <span>{eligibilityData.completion_percentage}%</span>
              </div>
              <Progress value={eligibilityData.completion_percentage} className="h-3" />
            </div>

            <div className="space-y-3 mb-6">
              {Object.entries(eligibilityData.requirements).map(([key, req]) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  {req.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{req.title}</h4>
                    <p className="text-sm text-gray-600">{req.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Pontos Necessários</h4>
              <div className="flex justify-between items-center">
                <span className="text-blue-700">
                  {eligibilityData.total_points} / {eligibilityData.minimum_points_required} pontos
                </span>
                <span className={`text-sm font-medium ${
                  eligibilityData.points_sufficient ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {eligibilityData.points_sufficient ? '✓ Suficiente' : 'Necessário mais pontos'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="card-modern p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Próximos Passos</h3>
            <ul className="space-y-2">
              {eligibilityData.next_steps.map((step, index) => (
                <li key={index} className="flex items-center gap-2 text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  {step}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => router.push('/document-upload')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button
              onClick={() => router.push('/home')}
              className="flex items-center gap-2"
            >
              Ir para Dashboard
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Appointment Types Step
  if (step === 'types') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Video className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Parabéns! Recompensa Desbloqueada</h1>
            <p className="text-gray-600">Escolha o tipo de consulta de telemedicina</p>
          </div>

          <div className="grid gap-4 mb-8">
            {appointmentTypes.map((type) => (
              <Card
                key={type.id}
                className="card-modern p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
                onClick={() => handleSelectType(type)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{type.name}</h3>
                    <p className="text-gray-600 mb-3">{type.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {type.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Concierge de Saúde
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{type.formatted_price}</div>
                    <div className="text-sm text-gray-500">Como recompensa</div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <h4 className="font-medium text-amber-900 mb-2">Pontos de Gamificação</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-amber-700">Agendamento: +{type.gamification.points_for_booking}</span>
                    <span className="text-amber-700">Conclusão: +{type.gamification.points_for_completion}</span>
                    <span className="text-amber-700">Preparação: +{type.gamification.points_for_preparation}</span>
                    <span className="text-amber-700">Pontualidade: +{type.gamification.bonus_for_punctuality}</span>
                  </div>
                </div>

                {type.preparation_checklist && type.preparation_checklist.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Checklist de Preparação</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {type.preparation_checklist.slice(0, 3).map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                          {item}
                        </li>
                      ))}
                      {type.preparation_checklist.length > 3 && (
                        <li className="text-gray-500">+{type.preparation_checklist.length - 3} mais itens</li>
                      )}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep('eligibility')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Available Slots Step
  if (step === 'slots') {
    const slotsByDate = availableSlots.reduce((acc, slot) => {
      const date = slot.display_date;
      if (!acc[date]) acc[date] = [];
      acc[date]!.push(slot);
      return acc;
    }, {} as Record<string, TimeSlot[]>);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Escolha o Horário</h1>
            <p className="text-gray-600">
              {selectedType?.name} - {selectedType?.duration_minutes} minutos
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {Object.entries(slotsByDate).map(([date, slots]) => (
              <Card key={date} className="card-modern p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{date}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSelectSlot(slot)}
                      className="p-4 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-center touch-target-48"
                    >
                      <Clock className="w-4 h-4 mx-auto mb-1" />
                      <div className="font-medium">{slot.display_time}</div>
                      <div className="text-xs text-gray-500">{slot.professional.name}</div>
                      {slot.is_soon && (
                        <div className="text-xs text-amber-600 font-medium mt-1">Em breve</div>
                      )}
                      {slot.gamification_preview.bonus_available && (
                        <div className="text-xs text-green-600 font-medium mt-1">Bônus disponível</div>
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {availableSlots.length === 0 && (
            <Card className="card-modern p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum horário disponível</h3>
              <p className="text-gray-600">Tente novamente mais tarde ou escolha outro tipo de consulta.</p>
            </Card>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep('types')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation Step
  if (step === 'confirmation' && selectedType && selectedSlot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="mb-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirmar Agendamento</h1>
            <p className="text-gray-600">Revise os detalhes da sua consulta</p>
          </div>

          <Card className="card-modern p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalhes da Consulta</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Tipo de Consulta</span>
                <span className="font-medium text-gray-900">{selectedType.name}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Data e Horário</span>
                <span className="font-medium text-gray-900">{selectedSlot.display_datetime}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Duração</span>
                <span className="font-medium text-gray-900">{selectedType.duration_minutes} minutos</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-600">Profissional</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{selectedSlot.professional.name}</div>
                  <div className="text-sm text-gray-500">{selectedSlot.professional.specialization}</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Valor</span>
                <div className="text-right">
                  <div className="font-medium text-green-600">{selectedType.formatted_price}</div>
                  <div className="text-sm text-gray-500">Recompensa de conclusão</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="card-modern p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Recompensas de Gamificação
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="font-medium text-green-900">Agendamento</div>
                <div className="text-green-700">+{selectedType.gamification.points_for_booking} pontos</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="font-medium text-blue-900">Conclusão</div>
                <div className="text-blue-700">+{selectedType.gamification.points_for_completion} pontos</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="font-medium text-purple-900">Preparação</div>
                <div className="text-purple-700">+{selectedType.gamification.points_for_preparation} pontos</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg">
                <div className="font-medium text-amber-900">Pontualidade</div>
                <div className="text-amber-700">+{selectedType.gamification.bonus_for_punctuality} pontos</div>
              </div>
            </div>
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-blue-900 mb-3">🎉 Parabéns pela Conclusão!</h3>
            <p className="text-blue-800 mb-3">
              Esta consulta é sua recompensa especial por completar todos os passos do onboarding. 
              Você terá acesso prioritário e recursos exclusivos!
            </p>
            <div className="text-sm text-blue-700">
              <strong>Benefícios especiais:</strong> Pontos extras, emblemas exclusivos e acompanhamento personalizado.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setStep('slots')}
              className="flex items-center gap-2"
              disabled={isBooking}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
            <Button
              onClick={handleBookAppointment}
              disabled={isBooking}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {isBooking ? 'Agendando...' : 'Confirmar Agendamento'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}