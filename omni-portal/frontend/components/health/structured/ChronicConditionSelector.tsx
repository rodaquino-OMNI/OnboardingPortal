'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Droplets, 
  Zap, 
  Wind, // Using Wind instead of Lung
  Bone, 
  Shield, 
  Brain,
  Droplet,
  Circle,
  Activity,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary, useErrorHandler } from '../ErrorBoundary';

interface ChronicCondition {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  riskScore: number;
  commonAge?: string;
  description?: string;
}

interface DiagnosisInfo {
  conditionId: string;
  diagnosisTime: string;
  ageAtDiagnosis?: number;
  severity?: 'mild' | 'moderate' | 'severe';
  treatment?: string;
  controlled?: boolean;
}

interface ChronicConditionSelectorProps {
  onComplete: (conditions: DiagnosisInfo[]) => void;
  isProcessing?: boolean;
  initialValue?: DiagnosisInfo[];
  title?: string;
  description?: string;
}

// Structured chronic conditions with mobile-first design
const CHRONIC_CONDITIONS: ChronicCondition[] = [
  {
    id: 'diabetes',
    name: 'Diabetes',
    category: 'Metabólica',
    icon: Droplets as any,
    color: 'bg-red-100 border-red-200 text-red-700',
    riskScore: 3,
    commonAge: 'Adultos 45+',
    description: 'Diabetes Tipo 1 ou Tipo 2'
  },
  {
    id: 'hypertension',
    name: 'Pressão Alta',
    category: 'Cardiovascular',
    icon: Heart as any,
    color: 'bg-orange-100 border-orange-200 text-orange-700',
    riskScore: 2,
    commonAge: 'Adultos 40+',
    description: 'Hipertensão arterial'
  },
  {
    id: 'heart_disease',
    name: 'Doença Cardíaca',
    category: 'Cardiovascular',
    icon: Heart as any,
    color: 'bg-red-100 border-red-200 text-red-700',
    riskScore: 4,
    commonAge: 'Adultos 50+',
    description: 'Doença coronariana, insuficiência cardíaca'
  },
  {
    id: 'asthma',
    name: 'Asma',
    category: 'Respiratória',
    icon: Wind as any,
    color: 'bg-blue-100 border-blue-200 text-blue-700',
    riskScore: 2,
    commonAge: 'Qualquer idade',
    description: 'Asma brônquica'
  },
  {
    id: 'copd',
    name: 'DPOC',
    category: 'Respiratória',
    icon: Wind as any,
    color: 'bg-purple-100 border-purple-200 text-purple-700',
    riskScore: 3,
    commonAge: 'Adultos 60+',
    description: 'Doença Pulmonar Obstrutiva Crônica'
  },
  {
    id: 'arthritis',
    name: 'Artrite/Artrose',
    category: 'Articular',
    icon: Bone as any,
    color: 'bg-yellow-100 border-yellow-200 text-yellow-700',
    riskScore: 1,
    commonAge: 'Adultos 50+',
    description: 'Artrite reumatoide ou artrose'
  },
  {
    id: 'cancer',
    name: 'Câncer',
    category: 'Oncológica',
    icon: Shield as any,
    color: 'bg-gray-100 border-gray-200 text-gray-700',
    riskScore: 5,
    commonAge: 'Qualquer idade',
    description: 'Qualquer tipo de câncer'
  },
  {
    id: 'kidney_disease',
    name: 'Doença Renal',
    category: 'Renal',
    icon: Droplet as any,
    color: 'bg-teal-100 border-teal-200 text-teal-700',
    riskScore: 4,
    commonAge: 'Adultos 60+',
    description: 'Doença renal crônica'
  },
  {
    id: 'liver_disease',
    name: 'Doença Hepática',
    category: 'Hepática',
    icon: Circle as any,
    color: 'bg-green-100 border-green-200 text-green-700',
    riskScore: 3,
    commonAge: 'Adultos 40+',
    description: 'Hepatite, cirrose, esteatose'
  },
  {
    id: 'thyroid',
    name: 'Problemas de Tireoide',
    category: 'Endócrina',
    icon: Activity as any,
    color: 'bg-indigo-100 border-indigo-200 text-indigo-700',
    riskScore: 1,
    commonAge: 'Adultos 30+',
    description: 'Hipertireoidismo, hipotireoidismo'
  }
];

// Structured time periods for mobile-friendly selection
const DIAGNOSIS_TIME_OPTIONS = [
  { value: 'recent', label: 'Nos últimos 6 meses', months: 3 },
  { value: '1year', label: 'No último ano', months: 12 },
  { value: '2-3years', label: 'Entre 2-3 anos atrás', months: 30 },
  { value: '4-5years', label: 'Entre 4-5 anos atrás', months: 54 },
  { value: '6-10years', label: 'Entre 6-10 anos atrás', months: 96 },
  { value: '10plus', label: 'Mais de 10 anos atrás', months: 120 },
  { value: 'childhood', label: 'Na infância/adolescência', months: 240 },
  { value: 'birth', label: 'Desde o nascimento', months: 300 }
];

const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Leve', emoji: '🟢', description: 'Pouco impacto no dia a dia' },
  { value: 'moderate', label: 'Moderada', emoji: '🟡', description: 'Impacto perceptível' },
  { value: 'severe', label: 'Grave', emoji: '🔴', description: 'Impacto significativo' }
];

const CONTROL_STATUS = [
  { value: true, label: 'Bem controlada', emoji: '✅', description: 'Com tratamento eficaz' },
  { value: false, label: 'Não controlada', emoji: '⚠️', description: 'Precisa de ajustes no tratamento' }
];

function ChronicConditionSelectorInner({
  onComplete,
  isProcessing = false,
  initialValue = [],
  title = "Condições Crônicas de Saúde",
  description = "Selecione as condições que você tem ou já teve, e nos forneça detalhes estruturados"
}: ChronicConditionSelectorProps) {
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    initialValue.map(d => d.conditionId)
  );
  const [diagnosisData, setDiagnosisData] = useState<Record<string, DiagnosisInfo>>(
    initialValue.reduce((acc, d) => ({ ...acc, [d.conditionId]: d }), {})
  );
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { captureError } = useErrorHandler();

  // Auto-expand first selected condition
  useEffect(() => {
    if (selectedConditions.length === 1 && !expandedCondition) {
      setExpandedCondition(selectedConditions[0] || null);
    }
  }, [selectedConditions, expandedCondition]);

  const toggleCondition = useCallback((conditionId: string) => {
    try {
      setSelectedConditions(prev => {
        const isSelected = prev.includes(conditionId);
        
        if (isSelected) {
          // Remove condition and its data
          const newSelected = prev.filter(id => id !== conditionId);
          setDiagnosisData(prevData => {
            const newData = { ...prevData };
            delete newData[conditionId];
            return newData;
          });
          
          // Close expansion if removing current expanded
          if (expandedCondition === conditionId) {
            setExpandedCondition(newSelected.length > 0 ? (newSelected[0] || null) : null);
          }
          
          setErrors(prevErrors => {
            const newErrors = { ...prevErrors };
            delete newErrors[conditionId];
            return newErrors;
          });
          
          return newSelected;
        } else {
          // Add condition and expand it
          const newSelected = [...prev, conditionId];
          setExpandedCondition(conditionId);
          
          // Initialize with basic data
          setDiagnosisData(prevData => ({
            ...prevData,
            [conditionId]: {
              conditionId,
              diagnosisTime: '',
              controlled: true
            }
          }));
          
          return newSelected;
        }
      });
    } catch (error) {
      console.error('Error toggling condition:', error);
      captureError(error as Error);
    }
  }, [expandedCondition, captureError]);

  const updateDiagnosisData = useCallback((conditionId: string, field: keyof DiagnosisInfo, value: any) => {
    setDiagnosisData(prev => ({
      ...prev,
      [conditionId]: {
        conditionId,
        diagnosisTime: undefined,
        ageAtDiagnosis: undefined,
        severity: undefined,
        treatment: undefined,
        controlled: undefined,
        ...prev[conditionId],
        [field]: value
      } as DiagnosisInfo
    }));

    // Clear error for this field
    const errorKey = `${conditionId}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  }, [errors]);

  const validateDiagnosisData = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    selectedConditions.forEach(conditionId => {
      const data = diagnosisData[conditionId];
      if (!data?.diagnosisTime) {
        newErrors[`${conditionId}_diagnosisTime`] = 'Período do diagnóstico é obrigatório';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [selectedConditions, diagnosisData]);

  const handleComplete = useCallback(() => {
    if (!validateDiagnosisData()) {
      return;
    }

    const results: DiagnosisInfo[] = selectedConditions
      .map(conditionId => diagnosisData[conditionId])
      .filter((data): data is DiagnosisInfo => Boolean(data));

    onComplete(results);
  }, [selectedConditions, diagnosisData, validateDiagnosisData, onComplete]);

  const getConditionIcon = (condition: ChronicCondition) => {
    const IconComponent = condition.icon;
    return <IconComponent className="w-6 h-6" />;
  };

  const isFormValid = selectedConditions.length === 0 || 
    selectedConditions.every(id => diagnosisData[id]?.diagnosisTime);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      {/* Conditions Grid - Mobile First */}
      <div className="space-y-3">
        {CHRONIC_CONDITIONS.map((condition) => {
          const isSelected = selectedConditions.includes(condition.id);
          const isExpanded = expandedCondition === condition.id;
          const conditionData = diagnosisData[condition.id];
          const hasError = Object.keys(errors).some(key => key.startsWith(condition.id));

          return (
            <motion.div
              key={condition.id}
              layout
              className={`border-2 rounded-xl transition-all ${
                isSelected 
                  ? condition.color 
                  : 'border-gray-200 hover:border-gray-300'
              } ${hasError ? 'border-red-300 bg-red-50' : ''}`}
            >
              {/* Condition Header - Always Visible */}
              <button
                onClick={() => toggleCondition(condition.id)}
                className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/80' : 'bg-gray-100'}`}>
                      {getConditionIcon(condition)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{condition.name}</h4>
                      <p className="text-sm text-gray-600">{condition.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {isSelected && (
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details - Mobile Optimized */}
              <AnimatePresence>
                {isSelected && isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4 border-t border-white/50 pt-4">
                      {/* Diagnosis Time Selection */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                          <Calendar className="w-4 h-4" />
                          Quando foi diagnosticada?
                        </label>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {DIAGNOSIS_TIME_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateDiagnosisData(condition.id, 'diagnosisTime', option.value)}
                              className={`p-3 text-left border rounded-lg transition-all ${
                                conditionData?.diagnosisTime === option.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="font-medium text-sm">{option.label}</div>
                            </button>
                          ))}
                        </div>
                        
                        {errors[`${condition.id}_diagnosisTime`] && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            {errors[`${condition.id}_diagnosisTime`]}
                          </div>
                        )}
                      </div>

                      {/* Severity Selection */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                          <Activity className="w-4 h-4" />
                          Como está a gravidade atual?
                        </label>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {SEVERITY_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateDiagnosisData(condition.id, 'severity', option.value)}
                              className={`p-3 text-left border rounded-lg transition-all ${
                                conditionData?.severity === option.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{option.emoji}</span>
                                <div>
                                  <div className="font-medium text-sm">{option.label}</div>
                                  <div className="text-xs text-gray-600">{option.description}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Control Status */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                          <Shield className="w-4 h-4" />
                          A condição está controlada?
                        </label>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {CONTROL_STATUS.map((option) => (
                            <button
                              key={option.value.toString()}
                              type="button"
                              onClick={() => updateDiagnosisData(condition.id, 'controlled', option.value)}
                              className={`p-3 text-left border rounded-lg transition-all ${
                                conditionData?.controlled === option.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{option.emoji}</span>
                                <div>
                                  <div className="font-medium text-sm">{option.label}</div>
                                  <div className="text-xs text-gray-600">{option.description}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Completion Status */}
                      {conditionData?.diagnosisTime && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div className="text-sm text-green-700">
                            <strong>{condition.name}</strong> - Informações completas
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* No Conditions Option */}
      <Card 
        className={`p-4 cursor-pointer transition-all ${
          selectedConditions.length === 0 && selectedConditions.includes('none')
            ? 'border-blue-500 bg-blue-50'
            : 'hover:bg-gray-50'
        }`}
        onClick={() => {
          if (selectedConditions.length === 0) return;
          setSelectedConditions([]);
          setDiagnosisData({});
          setExpandedCondition(null);
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Não tenho condições crônicas</h4>
            <p className="text-sm text-gray-600">Sou uma pessoa saudável sem condições crônicas conhecidas</p>
          </div>
        </div>
      </Card>

      {/* Summary */}
      {selectedConditions.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">
                {selectedConditions.length} condição{selectedConditions.length > 1 ? 'ões' : ''} selecionada{selectedConditions.length > 1 ? 's' : ''}
              </h4>
              <div className="space-y-1 text-sm text-blue-800">
                {selectedConditions.map(conditionId => {
                  const condition = CHRONIC_CONDITIONS.find(c => c.id === conditionId);
                  const data = diagnosisData[conditionId];
                  const timeOption = DIAGNOSIS_TIME_OPTIONS.find(t => t.value === data?.diagnosisTime);
                  
                  return (
                    <div key={conditionId} className="flex justify-between items-center">
                      <span>{condition?.name}</span>
                      {timeOption && (
                        <Badge variant="outline" className="text-xs bg-white/80">
                          {timeOption.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          {selectedConditions.length === 0 
            ? 'Selecione suas condições ou marque "Não tenho condições crônicas"'
            : `${selectedConditions.length} condição${selectedConditions.length > 1 ? 'ões' : ''} - ${
                isFormValid ? 'Informações completas' : 'Complete os detalhes'
              }`
          }
        </div>
        
        <Button
          onClick={handleComplete}
          disabled={isProcessing || !isFormValid}
          className="min-w-[120px]"
        >
          {isProcessing ? 'Salvando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}

// Main component with error boundary wrapper
export function ChronicConditionSelector(props: ChronicConditionSelectorProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Chronic Condition Selector error:', error, errorInfo);
        // Could send to error tracking service here
      }}
      resetKeys={[props.initialValue?.length || 0]}
      fallback={
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">Erro no Seletor de Condições</h3>
          <p className="text-gray-600 mb-4">
            Houve um problema ao carregar o seletor de condições crônicas.
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      }
    >
      <ChronicConditionSelectorInner {...props} />
    </ErrorBoundary>
  );
}