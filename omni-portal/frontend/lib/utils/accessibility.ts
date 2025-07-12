export const a11y = {
  // Screen reader only text
  srOnly: 'sr-only',
  
  // Focus styles
  focusVisible: 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  
  // Skip navigation link
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white p-2 rounded shadow-lg',
  
  // Keyboard navigation helpers
  keyboardNav: {
    tabIndex: (isActive: boolean) => (isActive ? 0 : -1),
    role: (role: string) => ({ role }),
    ariaLabel: (label: string) => ({ 'aria-label': label }),
    ariaLabelledBy: (id: string) => ({ 'aria-labelledby': id }),
    ariaDescribedBy: (id: string) => ({ 'aria-describedby': id }),
    ariaExpanded: (expanded: boolean) => ({ 'aria-expanded': expanded }),
    ariaHidden: (hidden: boolean) => ({ 'aria-hidden': hidden }),
    ariaLive: (level: 'polite' | 'assertive' | 'off' = 'polite') => ({ 'aria-live': level }),
    ariaCurrent: (current: boolean | 'page' | 'step' | 'location' | 'date' | 'time') => ({ 
      'aria-current': current 
    }),
  },
  
  // WCAG color contrast helpers
  contrast: {
    // Ensure AA compliance (4.5:1 for normal text, 3:1 for large text)
    textOnLight: 'text-gray-900',
    textOnDark: 'text-white',
    // High contrast mode support
    highContrast: 'contrast-more:font-semibold contrast-more:border-2',
  },
  
  // Focus trap helper
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    firstFocusable?.focus();

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  },
};

// Announce to screen readers
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Get appropriate motion class based on user preference
export function motionSafe(className: string): string {
  return `motion-safe:${className}`;
}

// Keyboard event handlers
export const keyboard = {
  onEnterOrSpace: (handler: () => void) => ({
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    },
  }),
  
  onEscape: (handler: () => void) => ({
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handler();
      }
    },
  }),
  
  onArrowNavigation: (handlers: {
    onUp?: () => void;
    onDown?: () => void;
    onLeft?: () => void;
    onRight?: () => void;
  }) => ({
    onKeyDown: (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          handlers.onUp?.();
          break;
        case 'ArrowDown':
          handlers.onDown?.();
          break;
        case 'ArrowLeft':
          handlers.onLeft?.();
          break;
        case 'ArrowRight':
          handlers.onRight?.();
          break;
      }
    },
  }),
};