'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface NavigationButtonsProps {
  // Navigation handlers
  onNext: () => void;
  onPrevious: () => void;
  
  // State
  canGoNext: boolean;
  canGoPrevious: boolean;
  isNavigating: boolean;
  
  // Auto-advance configuration
  showAutoAdvance: boolean;
  autoAdvanceDelay?: number;
  remainingTime?: number;
  
  // Customization
  nextLabel?: string;
  previousLabel?: string;
  showProgress?: boolean;
  isLastQuestion?: boolean;
  
  // Styling
  className?: string;
}

export const NavigationButtons = memo(function NavigationButtons({
  onNext,
  onPrevious,
  canGoNext,
  canGoPrevious,
  isNavigating,
  showAutoAdvance,
  autoAdvanceDelay = 1800,
  remainingTime = 0,
  nextLabel,
  previousLabel,
  showProgress = true,
  isLastQuestion = false,
  className = ''
}: NavigationButtonsProps) {
  
  // Calculate auto-advance progress percentage
  const autoAdvanceProgress = showAutoAdvance && autoAdvanceDelay > 0 
    ? Math.max(0, (autoAdvanceDelay - remainingTime) / autoAdvanceDelay * 100)
    : 0;

  const defaultNextLabel = isLastQuestion ? 'Finalizar' : 'Continuar';
  const defaultPreviousLabel = 'Voltar';

  return (
    <div className={`flex items-center justify-between gap-4 mt-6 ${className}`}>
      {/* Previous Button */}
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={!canGoPrevious || isNavigating}
        className="flex items-center gap-2 min-w-[120px]"
        aria-label={previousLabel || defaultPreviousLabel}
      >
        <ChevronLeft className="w-4 h-4" />
        {previousLabel || defaultPreviousLabel}
      </Button>

      {/* Auto-advance indicator or Next button */}
      <div className="flex-1 flex justify-end">
        <AnimatePresence mode="wait">
          {showAutoAdvance && !isNavigating ? (
            <motion.div
              key="auto-advance"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200"
            >
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <div className="relative w-4 h-4">
                  <Clock className="w-4 h-4" />
                  {showProgress && (
                    <svg className="absolute inset-0 w-4 h-4 -rotate-90">
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="37.7"
                        strokeDashoffset={37.7 - (37.7 * autoAdvanceProgress) / 100}
                        className="transition-all duration-100 ease-linear"
                      />
                    </svg>
                  )}
                </div>
                <span>Avançando automaticamente...</span>
              </div>
              
              {/* Cancel auto-advance button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                className="text-blue-700 hover:text-blue-900 px-2 py-1 h-auto"
              >
                Avançar agora
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="manual-button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                onClick={onNext}
                disabled={!canGoNext || isNavigating}
                className={`flex items-center gap-2 min-w-[120px] ${
                  isLastQuestion 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : ''
                }`}
                aria-label={nextLabel || defaultNextLabel}
              >
                {isNavigating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {isLastQuestion ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {nextLabel || defaultNextLabel}
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default NavigationButtons;