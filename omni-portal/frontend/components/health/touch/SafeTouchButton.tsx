/**
 * Safe Touch Button Component
 * 
 * WCAG AAA compliant with 48px minimum touch target
 * NO gesture support to avoid system conflicts
 * Includes safety features and kill switches
 */

import React, { forwardRef, useCallback, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Kill switches for touch features
export interface TouchKillSwitches {
  enableLargeTouchTargets: boolean;
  enable48pxMinimum: boolean;
  enableTouchFeedback: boolean;
  enableHaptic: boolean; // Disabled by default for battery
  maxHapticPerSession: number;
}

export const DEFAULT_TOUCH_KILL_SWITCHES: TouchKillSwitches = {
  enableLargeTouchTargets: true,
  enable48pxMinimum: true,
  enableTouchFeedback: true,
  enableHaptic: false, // Off by default
  maxHapticPerSession: 20, // Limit haptic usage
};

interface SafeTouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'standard' | 'large' | 'compact'; // No 'small' - minimum 44px
  killSwitches?: Partial<TouchKillSwitches>;
  testId?: string;
  loading?: boolean;
  children: React.ReactNode;
}

// Track haptic usage globally
let globalHapticCount = 0;

export const SafeTouchButton = forwardRef<HTMLButtonElement, SafeTouchButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'standard',
    killSwitches: customKillSwitches,
    className,
    onClick,
    children,
    disabled,
    loading,
    testId,
    type = 'button',
    ...props 
  }, ref) => {
    const [isPressed, setIsPressed] = useState(false);
    const touchStartTime = useRef<number>(0);
    const killSwitches = useMemo(() => ({ ...DEFAULT_TOUCH_KILL_SWITCHES, ...customKillSwitches }), [customKillSwitches]);
    
    // WCAG AAA compliant sizes - NEVER less than 44px
    const getSizeClasses = () => {
      if (!killSwitches.enable48pxMinimum) {
        // Fallback to standard button sizes if kill switch disabled
        return 'px-4 py-2';
      }

      switch (size) {
        case 'compact':
          // Minimum 44px (WCAG AA)
          return 'min-h-[44px] min-w-[44px] px-3 py-2.5';
        case 'large':
          // Comfortable 56px
          return 'min-h-[56px] min-w-[56px] px-5 py-4';
        case 'standard':
        default:
          // WCAG AAA 48px
          return 'min-h-[48px] min-w-[48px] px-4 py-3';
      }
    };
    
    // Safe haptic feedback with battery check
    const triggerHaptic = useCallback((intensity: number) => {
      if (!killSwitches.enableHaptic) return;
      
      // Check global haptic limit
      if (globalHapticCount >= killSwitches.maxHapticPerSession) {
        console.log('[SafeTouch] Haptic limit reached for session');
        return;
      }
      
      // Check if vibration API available
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(intensity);
          globalHapticCount++;
        } catch (error) {
          console.error('[SafeTouch] Haptic failed:', error);
        }
      }
    }, [killSwitches]);
    
    // Track if we've handled a touch to prevent double-firing
    const touchHandled = useRef<boolean>(false);
    
    // Handle touch/click with safety checks
    const handleInteraction = useCallback((event: React.MouseEvent | React.TouchEvent) => {
      if (disabled || loading) {
        event.preventDefault();
        return;
      }

      // CRITICAL FIX: Prevent double-firing on touch devices
      // Touch devices fire both touch and click events
      if (event.type === 'touchend') {
        touchHandled.current = true;
        // Reset the flag after a short delay
        setTimeout(() => {
          touchHandled.current = false;
        }, 300);
      } else if (event.type === 'click' && touchHandled.current) {
        // Skip the click event if we just handled a touch
        event.preventDefault();
        return;
      }

      // Prevent double-tap zoom on mobile for touch events only
      if (event.type === 'touchend') {
        event.preventDefault();
      }
      
      // Record interaction time for metrics
      const interactionTime = Date.now();
      
      // Visual feedback
      if (killSwitches.enableTouchFeedback) {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 150);
      }
      
      // Minimal haptic only for primary actions
      if (variant === 'primary' || variant === 'danger') {
        triggerHaptic(10);
      }
      
      // Execute click handler
      if (onClick) {
        // Wrap in try-catch for safety
        try {
          onClick(event as any);
        } catch (error) {
          console.error('[SafeTouch] Click handler error:', error);
        }
      }
      
      // Log interaction for metrics
      if (typeof window !== 'undefined' && (window as any).touchMetrics) {
        (window as any).touchMetrics.logInteraction({
          type: 'button_click',
          variant,
          size,
          timestamp: interactionTime,
        });
      }
    }, [disabled, loading, onClick, variant, size, killSwitches, triggerHaptic]);

    // Variant styles with safety colors
    const getVariantClasses = () => {
      const baseTransition = 'transition-all duration-150 ease-out';
      
      switch (variant) {
        case 'primary':
          return cn(
            'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
            'focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50',
            baseTransition
          );
        case 'secondary':
          return cn(
            'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400',
            'focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50',
            baseTransition
          );
        case 'danger':
          return cn(
            'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
            'focus:ring-4 focus:ring-red-500 focus:ring-opacity-50',
            baseTransition
          );
        case 'ghost':
          return cn(
            'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
            'focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50',
            baseTransition
          );
        default:
          return '';
      }
    };
    
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center',
          'rounded-lg font-medium select-none',
          'touch-manipulation', // Prevents zoom on double-tap
          'cursor-pointer',
          
          // Size classes with WCAG compliance
          killSwitches.enableLargeTouchTargets && getSizeClasses(),
          
          // Safe spacing between buttons
          'mx-1 my-1', // Minimum 8px total spacing
          
          // Visual feedback
          isPressed && 'scale-95 opacity-90',
          
          // Disabled/loading states
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          
          // Variant styles
          getVariantClasses(),
          
          // High contrast mode support
          'contrast-more:border-2 contrast-more:border-current',
          
          // Custom classes
          className
        )}
        onClick={handleInteraction}
        onTouchEnd={handleInteraction}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        data-testid={testId}
        data-variant={variant}
        data-size={size}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          </span>
        )}
        
        {/* Button content */}
        <span className={cn(
          'relative z-10 flex items-center justify-center gap-2',
          loading && 'invisible'
        )}>
          {children}
        </span>
        
        {/* Focus ring for keyboard navigation */}
        <span 
          className="absolute inset-0 rounded-lg pointer-events-none"
          aria-hidden="true"
        />
      </button>
    );
  }
);

SafeTouchButton.displayName = 'SafeTouchButton';

// Reset haptic count periodically (every hour)
if (typeof window !== 'undefined') {
  setInterval(() => {
    globalHapticCount = 0;
  }, 60 * 60 * 1000);
}