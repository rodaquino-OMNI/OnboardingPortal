import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { a11y } from '@/lib/utils/accessibility';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
    a11y.focusVisible,
    'touch-target-44' // Ensures 44x44px minimum touch target
  ),
  {
    variants: {
      variant: {
        default: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700',
        destructive: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-700',
        outline: 'border border-neutral-300 bg-white hover:bg-neutral-50 active:bg-neutral-100',
        secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 active:bg-secondary-700',
        ghost: 'hover:bg-neutral-100 active:bg-neutral-200',
        link: 'text-primary-500 underline-offset-4 hover:underline active:text-primary-700',
      },
      size: {
        default: 'h-10 px-4 py-2 min-h-[44px]',
        sm: 'h-9 rounded-md px-3 min-h-[44px]',
        lg: 'h-11 rounded-md px-8 min-h-[48px]',
        icon: 'h-10 w-10 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    loading = false,
    loadingText = 'Loading...',
    disabled,
    children,
    onClick,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;
    
    // Handle keyboard interactions
    const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled && onClick) {
        onClick(e);
      }
    }, [isDisabled, onClick]);

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        onClick={handleClick}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">{loadingText}</span>
            <span aria-hidden="true">{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };