"use client";

import React, { useState, useRef, useCallback } from 'react';

interface TouchFriendlySliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  label?: string;
  className?: string;
  disabled?: boolean;
  marks?: { value: number; label: string }[];
  'aria-label'?: string;
  'data-testid'?: string;
}

export const TouchFriendlySlider: React.FC<TouchFriendlySliderProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  label,
  className = '',
  disabled = false,
  marks = [],
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateValue = useCallback((clientX: number): number => {
    if (!sliderRef.current) return value;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);
    
    // Round to nearest step
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(min, Math.min(max, steppedValue));
  }, [min, max, step, value]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    
    setIsDragging(true);
    const newValue = calculateValue(e.clientX);
    onChange(newValue);
  }, [disabled, calculateValue, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    const newValue = calculateValue(e.clientX);
    onChange(newValue);
  }, [isDragging, disabled, calculateValue, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = calculateValue(touch.clientX);
    onChange(newValue);
  }, [disabled, calculateValue, onChange]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const newValue = calculateValue(touch.clientX);
    onChange(newValue);
  }, [isDragging, disabled, calculateValue, onChange]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Add event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`touch-friendly-slider ${className}`} data-testid={dataTestId}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Slider track */}
        <div
          ref={sliderRef}
          className={`relative h-6 bg-gray-200 rounded-full cursor-pointer touch-manipulation ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          aria-label={ariaLabel || label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
        >
          {/* Progress track */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Thumb */}
          <div
            className={`absolute top-1/2 w-6 h-6 bg-white border-2 border-blue-600 rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 transition-all duration-150 ${
              isDragging ? 'scale-110' : ''
            } ${disabled ? 'bg-gray-300 border-gray-400' : ''}`}
            style={{ left: `${percentage}%` }}
          />
        </div>

        {/* Value display */}
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-500">{min}</span>
          <span className="text-lg font-medium text-gray-900">{value}</span>
          <span className="text-sm text-gray-500">{max}</span>
        </div>

        {/* Marks */}
        {marks.length > 0 && (
          <div className="relative mt-1">
            {marks.map((mark) => {
              const markPercentage = ((mark.value - min) / (max - min)) * 100;
              return (
                <div
                  key={mark.value}
                  className="absolute text-xs text-gray-500 transform -translate-x-1/2"
                  style={{ left: `${markPercentage}%` }}
                >
                  {mark.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TouchFriendlySlider;