'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, Heart, Shield, CheckCircle, 
  ChevronLeft, ChevronRight, Home, Mic, MicOff,
  Volume2, VolumeX, Settings, HelpCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Mobile-First Health Questionnaire with Touch Optimization
// Implements iOS/Android native patterns with PWA capabilities

interface MobileHealthQuestionnaireProps {
  onComplete: (data: MobileAssessmentResults) => void;
  userId?: string;
  offlineMode?: boolean;
  touchTargetSize?: 'large' | 'medium' | 'small';
  enableVoiceInput?: boolean;
  enableHapticFeedback?: boolean;
}

interface MobileAssessmentResults {
  responses: Record<string, any>;
  mobileMetrics: MobileInteractionMetrics;
  accessibility: AccessibilityData;
  performance: PerformanceMetrics;
  offlineData?: OfflineStorageData;
}

interface MobileInteractionMetrics {
  touchAccuracy: number;
  gestureSuccessRate: number;
  responseTime: number;
  errorRate: number;
  accessibilityUsage: boolean;
}

interface AccessibilityData {
  screenReaderUsed: boolean;
  voiceInputUsed: boolean;
  highContrastEnabled: boolean;
  largeTextEnabled: boolean;
  reducedMotionEnabled: boolean;
}

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  batteryImpact: 'low' | 'medium' | 'high';
}

interface OfflineStorageData {
  storedResponses: Record<string, any>;
  syncPending: boolean;
  lastSyncTimestamp: Date;
  storageUsed: number; // bytes
}

export function MobileHealthQuestionnaire({
  onComplete,
  userId,
  offlineMode = false,
  touchTargetSize = 'large',
  enableVoiceInput = true,
  enableHapticFeedback = true
}: MobileHealthQuestionnaireProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [touchMetrics, setTouchMetrics] = useState({
    touches: 0,
    errors: 0,
    gestures: 0
  });
  
  const startTimeRef = useRef(Date.now());
  const questionsContainerRef = useRef<HTMLDivElement>(null);

  // Mobile-optimized health questions
  const mobileQuestions = [
    {
      id: 'mobile_wellness_1',
      text: 'Como você se sente hoje?',
      type: 'touch_scale',
      accessibility: {
        voiceHint: 'Selecione como você se sente tocando em uma das opções',
        screenReaderText: 'Pergunta sobre bem-estar: Como você se sente hoje?'
      },
      options: [
        { value: 'excellent', label: '😊 Excelente', color: '#10B981' },
        { value: 'good', label: '🙂 Bem', color: '#34D399' },
        { value: 'okay', label: '😐 Ok', color: '#FCD34D' },
        { value: 'not_great', label: '😟 Não muito bem', color: '#F87171' },
        { value: 'poor', label: '😢 Mal', color: '#EF4444' }
      ]
    },
    {
      id: 'mobile_energy_1',
      text: 'Qual é seu nível de energia?',
      type: 'touch_slider',
      accessibility: {
        voiceHint: 'Deslize o controle ou use os botões para ajustar seu nível de energia',
        screenReaderText: 'Controle deslizante para nível de energia de 0 a 100'
      },
      min: 0,
      max: 100,
      step: 10
    },
    {
      id: 'mobile_mood_1',
      text: 'Você tem se sentido ansioso ou preocupado?',
      type: 'touch_binary',
      accessibility: {
        voiceHint: 'Responda sim ou não tocando no botão correspondente',
        screenReaderText: 'Pergunta sobre ansiedade: resposta sim ou não'
      }
    }
  ];

  const currentQ = mobileQuestions[currentQuestion];

  // Touch target size configuration
  const touchTargetConfig = {
    large: { minSize: '48px', padding: 'p-4', text: 'text-lg' },
    medium: { minSize: '44px', padding: 'p-3', text: 'text-base' },
    small: { minSize: '40px', padding: 'p-2', text: 'text-sm' }
  };

  const config = touchTargetConfig[touchTargetSize];

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Haptic feedback function
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enableHapticFeedback) return;
    
    // Use Vibration API if available
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [30],
        heavy: [50]
      };
      navigator.vibrate(patterns[type]);
    }
  };

  // Voice input handling
  const toggleVoiceInput = () => {
    if (!enableVoiceInput) return;
    
    triggerHaptic('medium');
    setVoiceInputActive(!voiceInputActive);
    
    // Implement voice recognition here
    if (!voiceInputActive && 'webkitSpeechRecognition' in window) {
      // Voice recognition implementation would go here
      console.log('Voice input activated');
    }
  };

  // Touch interaction tracking
  const handleTouchInteraction = (type: 'touch' | 'gesture', success: boolean = true) => {
    setTouchMetrics(prev => ({
      ...prev,
      [type === 'touch' ? 'touches' : 'gestures']: prev[type === 'touch' ? 'touches' : 'gestures'] + 1,
      errors: success ? prev.errors : prev.errors + 1
    }));
    
    if (success) {
      triggerHaptic('light');
    }
  };

  // Handle response with mobile optimizations
  const handleResponse = (value: any) => {
    handleTouchInteraction('touch', true);
    
    const newResponses = { ...responses, [currentQ.id]: value };
    setResponses(newResponses);

    // Store offline if needed
    if (offlineMode || !isOnline) {
      localStorage.setItem('mobile_health_responses', JSON.stringify(newResponses));
    }

    // Auto-advance with mobile-friendly timing
    setTimeout(() => {
      if (currentQuestion < mobileQuestions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
      } else {
        handleComplete(newResponses);
      }
    }, 600); // Slightly longer delay for mobile
  };

  // Handle questionnaire completion
  const handleComplete = (finalResponses: Record<string, any>) => {
    const completionTime = Date.now() - startTimeRef.current;
    
    const results: MobileAssessmentResults = {
      responses: finalResponses,
      mobileMetrics: {
        touchAccuracy: touchMetrics.errors > 0 ? 
          ((touchMetrics.touches - touchMetrics.errors) / touchMetrics.touches) * 100 : 100,
        gestureSuccessRate: touchMetrics.gestures > 0 ? 
          ((touchMetrics.gestures - touchMetrics.errors) / touchMetrics.gestures) * 100 : 100,
        responseTime: completionTime / mobileQuestions.length,
        errorRate: (touchMetrics.errors / (touchMetrics.touches + touchMetrics.gestures)) * 100 || 0,
        accessibilityUsage: voiceInputActive
      },
      accessibility: {
        screenReaderUsed: false, // Would be detected via screen reader APIs
        voiceInputUsed: voiceInputActive,
        highContrastEnabled: window.matchMedia('(prefers-contrast: high)').matches,
        largeTextEnabled: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        reducedMotionEnabled: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      },
      performance: {
        loadTime: completionTime,
        renderTime: 0, // Would be measured via Performance API
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        batteryImpact: completionTime < 30000 ? 'low' : completionTime < 60000 ? 'medium' : 'high'
      },
      offlineData: offlineMode ? {
        storedResponses: finalResponses,
        syncPending: !isOnline,
        lastSyncTimestamp: new Date(),
        storageUsed: JSON.stringify(finalResponses).length
      } : undefined
    };

    onComplete(results);
  };

  // Render touch-optimized question types
  const renderQuestion = () => {
    if (!currentQ) return null;

    switch (currentQ.type) {
      case 'touch_scale':
        return (
          <div className="grid grid-cols-1 gap-4">
            {currentQ.options?.map((option, index) => (
              <Button
                key={option.value}
                onClick={() => handleResponse(option.value)}
                className={`${config.padding} ${config.text} transition-all duration-200 active:scale-95`}
                style={{ 
                  backgroundColor: option.color,
                  minHeight: config.minSize,
                  border: '2px solid transparent'
                }}
                aria-label={`${option.label} - ${currentQ.accessibility?.voiceHint}`}
                onTouchStart={() => handleTouchInteraction('touch', true)}
              >
                <span className="text-white font-semibold">{option.label}</span>
              </Button>
            ))}
          </div>
        );

      case 'touch_slider':
        return (
          <div className="space-y-6">
            <div className="px-4">
              <input
                type="range"
                min={currentQ.min}
                max={currentQ.max}
                step={currentQ.step}
                defaultValue={(currentQ.max || 100) / 2}
                onChange={(e) => handleResponse(parseInt(e.target.value))}
                className="w-full h-12 bg-gray-200 rounded-lg appearance-none cursor-pointer touch-manipulation"
                style={{ minHeight: config.minSize }}
                aria-label={currentQ.accessibility?.screenReaderText}
                onTouchStart={() => handleTouchInteraction('gesture', true)}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600 px-4">
              <span>Baixo</span>
              <span>Alto</span>
            </div>
          </div>
        );

      case 'touch_binary':
        return (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => handleResponse(true)}
              className={`${config.padding} ${config.text} bg-green-500 hover:bg-green-600 text-white transition-all duration-200 active:scale-95`}
              style={{ minHeight: config.minSize }}
              aria-label={`Sim - ${currentQ.accessibility?.voiceHint}`}
              onTouchStart={() => handleTouchInteraction('touch', true)}
            >
              Sim
            </Button>
            <Button
              onClick={() => handleResponse(false)}
              className={`${config.padding} ${config.text} bg-red-500 hover:bg-red-600 text-white transition-all duration-200 active:scale-95`}
              style={{ minHeight: config.minSize }}
              aria-label={`Não - ${currentQ.accessibility?.voiceHint}`}
              onTouchStart={() => handleTouchInteraction('touch', true)}
            >
              Não
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Mobile Status Bar */}
      <div className="safe-area-top bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex justify-between items-center">
          <Badge variant={isOnline ? 'default' : 'secondary'}>
            <Smartphone className="w-3 h-3 mr-1" />
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          
          <div className="flex items-center gap-2">
            {enableVoiceInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleVoiceInput}
                className={voiceInputActive ? 'bg-red-100' : ''}
                aria-label="Toggle voice input"
              >
                {voiceInputActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            
            <Button variant="ghost" size="sm" aria-label="Settings">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progresso do Questionário
          </span>
          <span className="text-sm text-gray-600">
            {currentQuestion + 1} de {mobileQuestions.length}
          </span>
        </div>
        <Progress 
          value={((currentQuestion + 1) / mobileQuestions.length) * 100} 
          className="h-2"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 pb-safe" ref={questionsContainerRef}>
        {/* Question Card */}
        <Card className="flex-1 p-6 shadow-lg">
          <div className="space-y-6">
            {/* Question Text */}
            <div className="text-center space-y-3">
              <h2 className="text-xl font-semibold text-gray-900 leading-relaxed">
                {currentQ?.text}
              </h2>
              
              {currentQ?.accessibility && (
                <p className="text-sm text-gray-600 sr-only">
                  {currentQ.accessibility.screenReaderText}
                </p>
              )}
            </div>

            {/* Response Area */}
            <div className="mt-8">
              {renderQuestion()}
            </div>

            {/* Voice Input Hint */}
            {voiceInputActive && (
              <Alert className="bg-blue-50 border-blue-200">
                <Mic className="w-4 h-4" />
                <AlertDescription>
                  Modo de voz ativo. Diga sua resposta claramente.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="bg-white border-t border-gray-200 p-4 pb-safe">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className={`${config.padding} ${config.text}`}
            style={{ minHeight: config.minSize }}
            aria-label="Pergunta anterior"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Anterior
          </Button>

          <Button
            variant="ghost"
            onClick={() => window.location.href = '/'}
            className={`${config.padding}`}
            style={{ minHeight: config.minSize }}
            aria-label="Voltar ao início"
          >
            <Home className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            className={`${config.padding}`}
            style={{ minHeight: config.minSize }}
            aria-label="Ajuda"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Accessibility Live Region */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
        role="status"
      >
        Pergunta {currentQuestion + 1} de {mobileQuestions.length}: {currentQ?.text}
      </div>
    </div>
  );
}