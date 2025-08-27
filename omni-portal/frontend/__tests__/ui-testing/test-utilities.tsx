/**
 * UI Testing Utilities
 * 
 * Helper functions and utilities for UI testing across the application
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock viewport dimensions for testing
export const mockViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });

  // Dispatch resize event
  window.dispatchEvent(new Event('resize'));
};

// Common viewport sizes for testing
export const VIEWPORTS = {
  mobile: {
    iphone_se: { width: 375, height: 667 },
    iphone_12: { width: 390, height: 844 },
    iphone_12_pro_max: { width: 414, height: 896 },
  },
  tablet: {
    ipad_portrait: { width: 768, height: 1024 },
    ipad_landscape: { width: 1024, height: 768 },
  },
  desktop: {
    small: { width: 1024, height: 768 },
    medium: { width: 1440, height: 900 },
    large: { width: 1920, height: 1080 },
    xl: { width: 2560, height: 1440 },
  },
};

// Mock user agents for browser testing
export const USER_AGENTS = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  mobile_safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  mobile_chrome: 'Mozilla/5.0 (Linux; Android 14; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
};

// Set user agent for testing
export const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
};

// Custom render function with default providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialViewport?: { width: number; height: number };
  userAgent?: string;
}

export const renderWithProviders = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { initialViewport, userAgent, ...renderOptions } = options || {};

  // Set viewport if provided
  if (initialViewport) {
    mockViewport(initialViewport.width, initialViewport.height);
  }

  // Set user agent if provided
  if (userAgent) {
    mockUserAgent(userAgent);
  }

  return {
    user: userEvent.setup(),
    ...render(ui, renderOptions),
  };
};

// Accessibility testing helpers
export const checkAccessibility = {
  // Check if element has proper ARIA attributes
  hasAriaLabel: (element: Element) => {
    return element.hasAttribute('aria-label') || 
           element.hasAttribute('aria-labelledby') ||
           element.closest('label') !== null;
  },

  // Check if element is keyboard accessible
  isKeyboardAccessible: (element: Element) => {
    const tagName = element.tagName.toLowerCase();
    const isInteractive = ['button', 'input', 'select', 'textarea', 'a'].includes(tagName);
    const hasTabIndex = element.hasAttribute('tabindex');
    const hasRole = element.getAttribute('role');
    
    return isInteractive || hasTabIndex || hasRole === 'button';
  },

  // Check if element has sufficient contrast
  hasSufficientContrast: (element: Element) => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    
    // This is a simplified check - in real testing you'd use a proper contrast calculator
    return color !== backgroundColor;
  },

  // Check if touch target is large enough
  hasSufficientTouchTarget: (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  },
};

// Form testing helpers
export const formHelpers = {
  // Fill a form step by step
  fillFormStep: async (user: ReturnType<typeof userEvent.setup>, stepData: Record<string, string>) => {
    for (const [fieldName, value] of Object.entries(stepData)) {
      const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
      await user.clear(field);
      await user.type(field, value);
    }
  },

  // Check form validation
  expectFormErrors: (errors: string[]) => {
    errors.forEach(error => {
      expect(screen.getByText(new RegExp(error, 'i'))).toBeInTheDocument();
    });
  },

  // Submit form and wait for response
  submitForm: async (user: ReturnType<typeof userEvent.setup>) => {
    const submitButton = screen.getByRole('button', { name: /submit|finalizar|próximo/i });
    await user.click(submitButton);
  },
};

// Performance testing helpers
export const performanceHelpers = {
  // Measure render time
  measureRenderTime: (renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  },

  // Measure interaction time
  measureInteractionTime: async (interactionFn: () => Promise<void>) => {
    const start = performance.now();
    await interactionFn();
    const end = performance.now();
    return end - start;
  },

  // Check memory usage
  checkMemoryUsage: () => {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  },
};

// Visual regression helpers
export const visualHelpers = {
  // Check if element has expected classes
  hasExpectedClasses: (element: Element, expectedClasses: string[]) => {
    return expectedClasses.every(className => 
      element.classList.contains(className) || 
      element.className.includes(className)
    );
  },

  // Check if element has expected styles
  hasExpectedStyles: (element: Element, expectedStyles: Record<string, string>) => {
    const styles = window.getComputedStyle(element);
    return Object.entries(expectedStyles).every(([property, value]) => 
      styles.getPropertyValue(property) === value
    );
  },

  // Get element's computed layout
  getLayout: (element: Element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    
    return {
      position: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      styles: {
        margin: styles.margin,
        padding: styles.padding,
        border: styles.border,
      },
    };
  },
};

// Browser compatibility helpers
export const browserHelpers = {
  // Check if browser supports a feature
  supportsFeature: (feature: string) => {
    switch (feature) {
      case 'css-grid':
        return CSS.supports('display', 'grid');
      case 'css-flexbox':
        return CSS.supports('display', 'flex');
      case 'css-custom-properties':
        return CSS.supports('--test', 'value');
      case 'intersection-observer':
        return 'IntersectionObserver' in window;
      case 'resize-observer':
        return 'ResizeObserver' in window;
      default:
        return false;
    }
  },

  // Mock feature support
  mockFeatureSupport: (feature: string, supported: boolean) => {
    switch (feature) {
      case 'intersection-observer':
        if (!supported) {
          delete (window as any).IntersectionObserver;
        }
        break;
      case 'resize-observer':
        if (!supported) {
          delete (window as any).ResizeObserver;
        }
        break;
    }
  },
};

// Responsive design testing helpers
export const responsiveHelpers = {
  // Test component at different breakpoints
  testBreakpoints: async (component: ReactElement, testFn: (viewport: any) => void) => {
    const breakpoints = [
      VIEWPORTS.mobile.iphone_se,
      VIEWPORTS.tablet.ipad_portrait,
      VIEWPORTS.desktop.medium,
    ];

    for (const viewport of breakpoints) {
      mockViewport(viewport.width, viewport.height);
      render(component);
      testFn(viewport);
    }
  },

  // Check if component adapts to screen size
  checkResponsiveness: (element: Element, expectedBehavior: Record<string, string[]>) => {
    const currentWidth = window.innerWidth;
    
    let breakpoint = 'mobile';
    if (currentWidth >= 1024) breakpoint = 'desktop';
    else if (currentWidth >= 768) breakpoint = 'tablet';
    
    const expectedClasses = expectedBehavior[breakpoint];
    return expectedClasses?.every(className => element.classList.contains(className));
  },
};

// Keyboard navigation helpers
export const keyboardHelpers = {
  // Test tab order
  testTabOrder: async (user: ReturnType<typeof userEvent.setup>, expectedOrder: string[]) => {
    for (let i = 0; i < expectedOrder.length; i++) {
      await user.tab();
      const activeElement = document.activeElement;
      const expectedSelector = expectedOrder[i];
      
      if (expectedSelector.startsWith('#')) {
        expect(activeElement).toHaveAttribute('id', expectedSelector.substring(1));
      } else if (expectedSelector.startsWith('.')) {
        expect(activeElement).toHaveClass(expectedSelector.substring(1));
      } else {
        expect(activeElement?.tagName.toLowerCase()).toBe(expectedSelector);
      }
    }
  },

  // Test keyboard shortcuts
  testKeyboardShortcut: async (user: ReturnType<typeof userEvent.setup>, key: string, expectedAction: () => void) => {
    await user.keyboard(`{${key}}`);
    expectedAction();
  },

  // Test arrow key navigation
  testArrowNavigation: async (user: ReturnType<typeof userEvent.setup>, container: Element) => {
    const items = within(container).getAllByRole('menuitem');
    
    // Focus first item
    items[0].focus();
    expect(document.activeElement).toBe(items[0]);
    
    // Test down arrow
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    
    // Test up arrow
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items[0]);
  },
};

// Export all helpers
export const testHelpers = {
  accessibility: checkAccessibility,
  forms: formHelpers,
  performance: performanceHelpers,
  visual: visualHelpers,
  browser: browserHelpers,
  responsive: responsiveHelpers,
  keyboard: keyboardHelpers,
};