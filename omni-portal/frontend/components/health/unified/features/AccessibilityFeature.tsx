'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, Eye, Keyboard, Languages, Accessibility } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuestionnaire, QuestionnaireFeature, FeatureHooks } from '../BaseHealthQuestionnaire';

interface AccessibilityConfig {
  enabled: boolean;
  screenReaderSupport: boolean;
  keyboardNavigation: boolean;
  textToSpeech: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  language: string;
}

export function AccessibilityFeatureComponent({ config }: { config?: AccessibilityConfig }) {
  const { state, getCurrentQuestion } = useQuestionnaire();
  const [isReading, setIsReading] = useState(false);
  const [fontSize, setFontSize] = useState(config?.fontSize || 'medium');
  const [highContrast, setHighContrast] = useState(config?.highContrast || false);

  // Read current question aloud
  const readCurrentQuestion = useCallback(() => {
    if (!config?.textToSpeech) return;

    const question = getCurrentQuestion();
    if (!question || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.text);
    utterance.lang = config.language || 'pt-BR';
    utterance.rate = 0.9;
    
    utterance.onstart = () => setIsReading(true);
    utterance.onend = () => setIsReading(false);
    
    window.speechSynthesis.speak(utterance);
    announce(`Lendo pergunta: ${question.text}`);
  }, [config?.textToSpeech, config?.language, getCurrentQuestion]);

  // Announce help information
  const announceHelp = useCallback(() => {
    const helpText = `
      Atalhos de teclado disponíveis:
      Alt + R: Ler pergunta atual em voz alta.
      Alt + H: Ouvir esta ajuda.
      Alt + C: Alternar modo de alto contraste.
      Tab: Navegar entre elementos.
      Enter ou Espaço: Selecionar opção.
    `;
    announce(helpText);
  }, []);

  // Toggle high contrast
  const toggleHighContrast = useCallback(() => {
    setHighContrast(!highContrast);
    document.body.classList.toggle('high-contrast');
    announce(`Modo de alto contraste ${!highContrast ? 'ativado' : 'desativado'}`);
  }, [highContrast]);

  // Setup keyboard navigation
  const setupKeyboardNavigation = useCallback(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab navigation is handled by default
      // Add custom shortcuts
      if (e.altKey) {
        switch (e.key) {
          case 'r': // Alt+R to read current question
            readCurrentQuestion();
            break;
          case 'h': // Alt+H for help
            announceHelp();
            break;
          case 'c': // Alt+C to toggle high contrast
            toggleHighContrast();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [announceHelp, readCurrentQuestion, toggleHighContrast]);

  // Setup screen reader announcements
  const setupScreenReaderAnnouncements = () => {
    // Create live region if it doesn't exist
    if (!document.getElementById('aria-live-region')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
  };

  // Announce to screen readers
  const announce = (message: string) => {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  };

  // Initialize accessibility features
  useEffect(() => {
    if (config?.keyboardNavigation !== false) {
      setupKeyboardNavigation();
    }

    // Add ARIA live region for screen readers
    if (config?.screenReaderSupport !== false) {
      setupScreenReaderAnnouncements();
    }

    return () => {
      // Cleanup
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [config, setupKeyboardNavigation]);

  // Stop reading
  const stopReading = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      announce('Leitura interrompida');
    }
  };

  // Apply font size class
  useEffect(() => {
    const sizeClasses = {
      'small': 'text-sm',
      'medium': 'text-base',
      'large': 'text-lg',
      'extra-large': 'text-xl'
    };

    document.body.className = document.body.className
      .replace(/text-(sm|base|lg|xl)/g, '')
      + ` ${sizeClasses[fontSize]}`;
  }, [fontSize]);

  return (
    <div className="accessibility-container">
      {/* Accessibility Controls */}
      <Card className="p-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Accessibility className="w-4 h-4" />
            <span className="text-sm font-medium">Acessibilidade</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Text to Speech */}
            {config?.textToSpeech && (
              <Button
                size="sm"
                variant={isReading ? 'primary' : 'outline'}
                onClick={isReading ? stopReading : readCurrentQuestion}
                aria-label={isReading ? 'Parar leitura' : 'Ler pergunta em voz alta'}
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            )}

            {/* Font Size */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const sizes: AccessibilityConfig['fontSize'][] = ['small', 'medium', 'large', 'extra-large'];
                  const currentIndex = sizes.indexOf(fontSize);
                  const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                  const newSize = sizes[newIndex];
                  if (newSize) {
                    setFontSize(newSize);
                    announce(`Tamanho da fonte: ${newSize}`);
                  }
                }}
                aria-label="Diminuir tamanho da fonte"
                disabled={fontSize === 'small'}
              >
                A-
              </Button>
              <Badge variant="secondary" className="px-2">
                {fontSize === 'small' ? 'P' : 
                 fontSize === 'medium' ? 'M' :
                 fontSize === 'large' ? 'G' : 'GG'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const sizes: AccessibilityConfig['fontSize'][] = ['small', 'medium', 'large', 'extra-large'];
                  const currentIndex = sizes.indexOf(fontSize);
                  const newIndex = currentIndex < sizes.length - 1 ? currentIndex + 1 : sizes.length - 1;
                  const newSize = sizes[newIndex];
                  if (newSize) {
                    setFontSize(newSize);
                    announce(`Tamanho da fonte: ${newSize}`);
                  }
                }}
                aria-label="Aumentar tamanho da fonte"
                disabled={fontSize === 'extra-large'}
              >
                A+
              </Button>
            </div>

            {/* High Contrast */}
            <Button
              size="sm"
              variant={highContrast ? 'primary' : 'outline'}
              onClick={toggleHighContrast}
              aria-label={`${highContrast ? 'Desativar' : 'Ativar'} alto contraste`}
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Keyboard Help */}
            <Button
              size="sm"
              variant="outline"
              onClick={announceHelp}
              aria-label="Ajuda de atalhos de teclado"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Language Selection */}
        {config?.language && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Languages className="w-4 h-4" />
            <span>Idioma: {config.language === 'pt-BR' ? 'Português' : config.language}</span>
          </div>
        )}
      </Card>

      {/* Skip to Main Content */}
      <a href="#main-question" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded">
        Pular para pergunta principal
      </a>

      {/* Keyboard shortcuts info */}
      <div className="sr-only" aria-live="polite">
        Pressione Alt + H para ouvir os atalhos de teclado disponíveis
      </div>
    </div>
  );
}

// Accessibility Hooks
export const accessibilityHooks: FeatureHooks = {
  onInit: (state) => {
    console.log('[Accessibility] Features initialized');
    
    // Check user preferences
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add('reduce-motion');
    }
    
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      document.body.classList.add('high-contrast');
    }
  },

  onQuestionChange: (question, state) => {
    // Announce question change to screen readers
    const announcement = `Nova pergunta: ${question.text}. ${
      question.required ? 'Obrigatória.' : 'Opcional.'
    } Pergunta ${state.currentQuestionIndex + 1} de ${state.sectionProgress[state.currentSectionIndex] || 'várias'}.`;
    
    // Update live region
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    }
  }
};

// Export feature definition
export const AccessibilityFeature: QuestionnaireFeature = {
  id: 'accessibility',
  name: 'Accessibility Support',
  enabled: true,
  priority: 99, // High priority to ensure it loads early
  component: AccessibilityFeatureComponent,
  hooks: accessibilityHooks,
  config: {
    enabled: true,
    screenReaderSupport: true,
    keyboardNavigation: true,
    textToSpeech: true,
    highContrast: false,
    fontSize: 'medium',
    language: 'pt-BR'
  }
};