'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import type { HealthQuestion } from '@/lib/unified-health-flow';

interface ScaleQuestionProps {
  question: HealthQuestion;
  onComplete: (value: number) => void;
  isProcessing?: boolean;
}

export function ScaleQuestion({ question, onComplete, isProcessing }: ScaleQuestionProps) {
  const [scaleValue, setScaleValue] = useState<number>(5);
  
  const min = question.options?.[0]?.value ?? 0;
  const max = question.options?.[question.options?.length - 1]?.value ?? 10;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>{min} - Mínimo</span>
          <span>{max} - Máximo</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={scaleValue}
          onChange={(e) => setScaleValue(parseInt(e.target.value))}
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="mt-4 text-4xl">
          {question.options?.find(opt => opt.value === scaleValue)?.emoji || '📊'}
        </div>
        <div className="mt-2 text-lg font-semibold">
          {question.options?.find(opt => opt.value === scaleValue)?.label || scaleValue}
        </div>
        <Button 
          onClick={() => onComplete(scaleValue)}
          className="w-full mt-4"
          disabled={isProcessing}
        >
          Continuar
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}