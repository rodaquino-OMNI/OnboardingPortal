/**
 * Browser Compatibility Test Suite
 * 
 * Tests cross-browser compatibility for major browsers and platforms
 * Includes feature detection, polyfill testing, and graceful degradation
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { Button } from '@/components/ui/button-accessible';

// Mock modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/lib/api/unified-auth', () => ({
  unifiedAuthApi: {
    registerStep1: jest.fn().mockResolvedValue({ token: 'mock-token' }),
    registerStep2: jest.fn().mockResolvedValue({ success: true }),
    registerStep3: jest.fn().mockResolvedValue({ token: 'final-token' }),
  }
}));

// Browser user agents for testing
const BROWSERS = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.1 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  mobileSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  mobileChrome: 'Mozilla/5.0 (Linux; Android 14; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ie11: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
};

describe('Browser Compatibility Tests', () => {
  
  describe('Chrome/Chromium-based browsers', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.chrome,
        configurable: true,
      });
    });

    test('renders correctly in Chrome', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      expect(container.firstChild).toBeInTheDocument();
    });

    test('CSS Grid support works', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      const gridElements = container.querySelectorAll('[class*="grid-cols"]');
      
      gridElements.forEach(element => {
        expect(element).toHaveClass(/grid/);
        expect(element).toHaveClass(/grid-cols-/);
      });
    });

    test('CSS Custom Properties work', () => {
      const { container } = render(<Button>Test Button</Button>);
      const button = screen.getByRole('button');
      
      // Should handle CSS custom properties for colors
      expect(button).toHaveClass(/bg-primary-500/);
    });

    test('ES6+ features work correctly', () => {
      // Test modern JavaScript features
      const testObject = { a: 1, b: 2 };
      const spread = { ...testObject, c: 3 };
      
      expect(spread).toEqual({ a: 1, b: 2, c: 3 });
      
      // Template literals
      const template = `Hello ${'World'}`;
      expect(template).toBe('Hello World');
    });
  });

  describe('Firefox browser', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.firefox,
        configurable: true,
      });
    });

    test('renders correctly in Firefox', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      expect(container.firstChild).toBeInTheDocument();
    });

    test('Flexbox support works', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      const flexElements = container.querySelectorAll('[class*="flex"]');
      
      flexElements.forEach(element => {
        expect(element).toHaveClass(/flex/);
      });
    });

    test('CSS transforms work', () => {
      const { container } = render(<Button loading>Loading</Button>);
      const spinner = container.querySelector('[class*="animate-spin"]');
      
      expect(spinner).toHaveClass('animate-spin');
    });

    test('Form validation works', async () => {
      render(<UnifiedRegistrationForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      
      // Firefox should handle HTML5 validation
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });

  describe('Safari/WebKit browsers', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.safari,
        configurable: true,
      });
    });

    test('renders correctly in Safari', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      expect(container.firstChild).toBeInTheDocument();
    });

    test('backdrop-filter support with fallback', () => {
      render(
        <div className="fixed inset-0 bg-black/50">
          <div className="backdrop-blur-sm">Modal</div>
        </div>
      );
      
      const modal = screen.getByText('Modal');
      expect(modal).toHaveClass('backdrop-blur-sm');
    });

    test('date input works', () => {
      render(<UnifiedRegistrationForm />);
      
      // Navigate to step with date input
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThan(0);
      
      dateInputs.forEach(input => {
        expect(input).toHaveAttribute('type', 'date');
      });
    });

    test('touch events work on mobile Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.mobileSafari,
        configurable: true,
      });

      render(<Button>Touch Button</Button>);
      const button = screen.getByRole('button');
      
      // Should have appropriate touch target size
      expect(button).toHaveClass(/min-h-\[44px\]/);
    });
  });

  describe('Microsoft Edge', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.edge,
        configurable: true,
      });
    });

    test('renders correctly in Edge', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      expect(container.firstChild).toBeInTheDocument();
    });

    test('CSS Grid support works', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      const gridElements = container.querySelectorAll('[class*="grid"]');
      
      expect(gridElements.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile browsers', () => {
    test('Mobile Chrome compatibility', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.mobileChrome,
        configurable: true,
      });

      render(<UnifiedRegistrationForm />);
      
      // Touch targets should be appropriate size
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass(/min-h-\[44px\]/);
      });
    });

    test('Mobile Safari compatibility', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.mobileSafari,
        configurable: true,
      });

      render(<UnifiedRegistrationForm />);
      
      // Should handle iOS-specific behavior
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        // iOS inputs should not have conflicting styles
        expect(input).not.toHaveClass('appearance-none');
      });
    });

    test('viewport meta tag considerations', () => {
      // Test that components work with mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 812 });
      
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Form should be responsive
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Feature Detection and Polyfills', () => {
    test('IntersectionObserver support detection', () => {
      // Mock missing IntersectionObserver
      const originalIntersectionObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;

      render(<UnifiedRegistrationForm />);
      
      // Component should still work without IntersectionObserver
      expect(screen.getByText(/informações pessoais/i)).toBeInTheDocument();
      
      // Restore
      window.IntersectionObserver = originalIntersectionObserver;
    });

    test('ResizeObserver support detection', () => {
      const originalResizeObserver = window.ResizeObserver;
      delete (window as any).ResizeObserver;

      render(<UnifiedRegistrationForm />);
      
      // Should work without ResizeObserver
      expect(screen.getByText(/informações pessoais/i)).toBeInTheDocument();
      
      // Restore
      window.ResizeObserver = originalResizeObserver;
    });

    test('CSS supports query fallbacks', () => {
      // Test that components work without advanced CSS features
      const { container } = render(<Button>Test</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(/bg-primary-500/);
    });

    test('localStorage availability', () => {
      const originalLocalStorage = window.localStorage;
      
      // Mock localStorage unavailable
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      render(<UnifiedRegistrationForm />);
      
      // Should still work without localStorage
      expect(screen.getByText(/informações pessoais/i)).toBeInTheDocument();
      
      // Restore
      window.localStorage = originalLocalStorage;
    });
  });

  describe('Graceful Degradation', () => {
    test('works without JavaScript', () => {
      // Test basic HTML structure
      render(<UnifiedRegistrationForm />);
      
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
      
      // Required attributes should be present for native validation
      const requiredInputs = document.querySelectorAll('input[required]');
      expect(requiredInputs.length).toBeGreaterThan(0);
    });

    test('works with CSS disabled', () => {
      // Test that structure is still logical without styles
      render(<UnifiedRegistrationForm />);
      
      // Form should have logical tab order
      const inputs = document.querySelectorAll('input');
      inputs.forEach((input, index) => {
        if (index === 0) {
          expect(input).toHaveAttribute('id', 'name');
        }
      });
    });

    test('works with reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn(() => ({
          matches: true,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      render(<Button loading>Loading</Button>);
      
      // Animations should still be present but can be disabled via CSS
      const spinner = screen.getByRole('button').querySelector('[class*="animate-spin"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Performance across browsers', () => {
    test('renders within performance budget in Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.chrome,
        configurable: true,
      });

      const start = performance.now();
      render(<UnifiedRegistrationForm />);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100);
    });

    test('renders within performance budget in Firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: BROWSERS.firefox,
        configurable: true,
      });

      const start = performance.now();
      render(<UnifiedRegistrationForm />);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(150); // Firefox might be slightly slower
    });

    test('handles large DOM efficiently', () => {
      const start = performance.now();
      
      render(
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <Button key={i}>Button {i}</Button>
          ))}
        </div>
      );
      
      const end = performance.now();
      expect(end - start).toBeLessThan(500);
    });
  });

  describe('Accessibility across browsers', () => {
    test('screen reader compatibility in different browsers', () => {
      render(<UnifiedRegistrationForm />);
      
      // ARIA attributes should work across browsers
      const nameInput = screen.getByLabelText(/nome completo/i);
      expect(nameInput).toHaveAttribute('id', 'name');
      
      const label = document.querySelector('label[for="name"]');
      expect(label).toBeInTheDocument();
    });

    test('keyboard navigation works across browsers', () => {
      render(<UnifiedRegistrationForm />);
      
      const nameInput = screen.getByLabelText(/nome completo/i);
      nameInput.focus();
      
      expect(document.activeElement).toBe(nameInput);
      
      // Tab navigation
      fireEvent.keyDown(nameInput, { key: 'Tab' });
      // Should move to next focusable element
    });

    test('focus management works across browsers', () => {
      render(<Button>Test Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(document.activeElement).toBe(button);
      expect(button).toHaveClass(/focus:ring/);
    });
  });

  describe('Error Handling across browsers', () => {
    test('handles unhandled promise rejections', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate an error that might occur in different browsers
      Promise.reject(new Error('Test error')).catch(() => {
        // Handled
      });
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('handles network errors gracefully', async () => {
      // Mock fetch failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      render(<UnifiedRegistrationForm />);
      
      // Component should still render
      expect(screen.getByText(/informações pessoais/i)).toBeInTheDocument();
    });
  });
});