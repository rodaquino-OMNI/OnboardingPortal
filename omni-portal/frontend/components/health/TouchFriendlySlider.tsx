'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import type { HealthQuestion } from '@/lib/unified-health-flow';

interface TouchFriendlySliderProps {
  question: HealthQuestion;
  onComplete: (value: number) => void;
  isProcessing?: boolean;
}

export function TouchFriendlySlider({ question, onComplete, isProcessing }: TouchFriendlySliderProps) {
  const min = question.options?.[0]?.value ?? 0;
  const max = question.options?.[question.options?.length - 1]?.value ?? 10;
  const [value, setValue] = useState<number>(Math.floor((min + max) / 2));
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleValueChange = (newValue: number) => {
    const clampedValue = Math.max(min, Math.min(max, newValue));
    setValue(clampedValue);
  };

  const handleSliderInteraction = (clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = (clientX - rect.left) / rect.width;
    const newValue = Math.round(min + (max - min) * percentage);
    handleValueChange(newValue);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleSliderInteraction(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleSliderInteraction(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSliderInteraction(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleSliderInteraction(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      handleSliderInteraction(e.clientX);
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp, { passive: true });
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setIsDragging(false);
    };
  }, []);

  const percentage = ((value - min) / (max - min)) * 100;
  const currentOption = question.options?.find(opt => opt.value === value);

  return (
    <div className="space-y-6">
      {/* Value Display */}
      <div className="text-center">
        <div className="text-5xl mb-2">
          {currentOption?.emoji || '📊'}
        </div>
        <div className="text-3xl font-bold text-blue-600 mb-1">
          {value}
        </div>
        <div className="text-lg text-gray-600">
          {currentOption?.label || `Valor: ${value}`}
        </div>
      </div>

      {/* Touch-Friendly Slider */}
      <div className="px-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{min} - {question.options?.[0]?.label || 'Mínimo'}</span>
          <span>{max} - {question.options?.[question.options?.length - 1]?.label || 'Máximo'}</span>
        </div>
        
        {/* Custom Slider Track */}
        <div
          ref={sliderRef}
          className="relative h-12 bg-gray-200 rounded-full cursor-pointer select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={question.text}
        >
          {/* Filled Track */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-full pointer-events-none"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-12 h-12 bg-white border-4 border-blue-500 rounded-full shadow-lg pointer-events-none"
            style={{ left: `calc(${percentage}% - 24px)` }}
          >
            <div className="flex items-center justify-center h-full text-sm font-semibold text-blue-600">
              {value}
            </div>
          </div>
        </div>

        {/* Increment/Decrement Buttons for Accessibility */}
        <div className="flex justify-between mt-4 gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleValueChange(value - 1)}
            disabled={value <= min}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Diminuir valor"
          >
            <Minus className="w-5 h-5" />
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleValueChange(value + 1)}
            disabled={value >= max}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Aumentar valor"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Continue Button */}
      <Button
        onClick={() => onComplete(value)}
        className="w-full min-h-[44px] text-lg"
        disabled={isProcessing}
      >
        Continuar
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}