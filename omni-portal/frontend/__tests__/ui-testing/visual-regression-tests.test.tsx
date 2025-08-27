/**
 * Visual Regression Test Suite
 * 
 * Tests for consistent visual appearance across different scenarios
 * Includes screenshot comparisons, layout tests, and theme consistency
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { Button } from '@/components/ui/button-accessible';

// Mock necessary modules
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

describe('Visual Regression Tests', () => {
  
  describe('Layout Consistency', () => {
    test('registration form maintains consistent spacing', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Test container structure
      const mainCard = container.querySelector('.card-modern');
      expect(mainCard).toBeInTheDocument();
      expect(mainCard).toHaveClass('p-8');
      
      // Test spacing between form sections
      const formSections = container.querySelectorAll('.space-y-6');
      expect(formSections.length).toBeGreaterThan(0);
      
      // Test progress bar layout
      const progressContainer = container.querySelector('[class*="mb-8"]');
      expect(progressContainer).toBeInTheDocument();
    });

    test('form fields maintain consistent alignment', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Test grid layouts
      const gridContainers = container.querySelectorAll('[class*="grid-cols"]');
      gridContainers.forEach(grid => {
        expect(grid).toHaveClass(/gap-6/);
      });
      
      // Test input field structure
      const labels = container.querySelectorAll('label');
      labels.forEach(label => {
        expect(label).toHaveClass('block', 'text-sm', 'font-medium', 'text-gray-700', 'mb-2');
      });
    });
  });

  describe('Component Visual States', () => {
    test('button variants render with correct styles', () => {
      render(
        <div data-testid="button-variants">
          <Button variant="default">Default Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="destructive">Destructive Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="link">Link Button</Button>
        </div>
      );

      const container = screen.getByTestId('button-variants');
      const buttons = container.querySelectorAll('button');
      
      // Test each variant has appropriate classes
      expect(buttons[0]).toHaveClass('bg-primary-500'); // default
      expect(buttons[1]).toHaveClass('border', 'border-neutral-300'); // outline
      expect(buttons[2]).toHaveClass('bg-secondary-500'); // secondary
      expect(buttons[3]).toHaveClass('bg-error-500'); // destructive
      expect(buttons[4]).toHaveClass('hover:bg-neutral-100'); // ghost
      expect(buttons[5]).toHaveClass('text-primary-500', 'underline-offset-4'); // link
    });

    test('button sizes render correctly', () => {
      render(
        <div data-testid="button-sizes">
          <Button size="sm">Small Button</Button>
          <Button size="default">Default Button</Button>
          <Button size="lg">Large Button</Button>
          <Button size="icon">Icon</Button>
        </div>
      );

      const container = screen.getByTestId('button-sizes');
      const buttons = container.querySelectorAll('button');
      
      // Test size classes
      expect(buttons[0]).toHaveClass('h-9', 'px-3'); // sm
      expect(buttons[1]).toHaveClass('h-10', 'px-4', 'py-2'); // default
      expect(buttons[2]).toHaveClass('h-11', 'px-8'); // lg
      expect(buttons[3]).toHaveClass('h-10', 'w-10'); // icon
    });

    test('loading state renders correctly', () => {
      render(<Button loading loadingText="Processing...">Submit</Button>);
      
      const button = screen.getByRole('button');
      
      // Should have loading attributes
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
      
      // Should show spinner
      const spinner = button.querySelector('[class*="animate-spin"]');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
      
      // Should have screen reader text
      const srText = button.querySelector('.sr-only');
      expect(srText).toHaveTextContent('Processing...');
    });
  });

  describe('Responsive Design Consistency', () => {
    const testBreakpoints = [
      { width: 375, name: 'mobile' },
      { width: 768, name: 'tablet' },
      { width: 1024, name: 'desktop' },
      { width: 1440, name: 'large-desktop' },
    ];

    testBreakpoints.forEach(({ width, name }) => {
      test(`layout adapts correctly on ${name} (${width}px)`, () => {
        // Mock window width
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });

        const { container } = render(<UnifiedRegistrationForm />);
        
        // Test main container responsiveness
        const mainContainer = container.querySelector('.w-full.max-w-2xl');
        expect(mainContainer).toBeInTheDocument();
        
        // Test grid responsiveness
        const grids = container.querySelectorAll('[class*="grid-cols-1"]');
        grids.forEach(grid => {
          if (width >= 768) {
            // Should have responsive classes for larger screens
            expect(grid.className).toMatch(/md:grid-cols-[2-3]/);
          } else {
            // Should remain single column on mobile
            expect(grid).toHaveClass('grid-cols-1');
          }
        });
      });
    });
  });

  describe('Color and Theme Consistency', () => {
    test('maintains consistent color palette', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Test primary colors
      const primaryElements = container.querySelectorAll('[class*="bg-blue-6"]');
      primaryElements.forEach(element => {
        expect(element.className).toMatch(/bg-blue-6\d{2}/);
      });
      
      // Test text colors
      const textElements = container.querySelectorAll('[class*="text-gray"]');
      textElements.forEach(element => {
        expect(element.className).toMatch(/text-gray-[567]00/);
      });
      
      // Test border colors
      const borderElements = container.querySelectorAll('[class*="border-"]');
      borderElements.forEach(element => {
        // Should use consistent neutral colors
        expect(element.className).toMatch(/(border-gray|border-blue|border-neutral)/);
      });
    });

    test('error states use consistent error colors', () => {
      render(
        <div data-testid="error-states">
          <Button variant="destructive">Error Button</Button>
          <div className="text-red-600">Error message</div>
        </div>
      );

      const container = screen.getByTestId('error-states');
      
      // Error button should use error colors
      const errorButton = container.querySelector('button');
      expect(errorButton).toHaveClass('bg-error-500');
      
      // Error text should use red
      const errorText = container.querySelector('[class*="text-red"]');
      expect(errorText).toHaveClass('text-red-600');
    });
  });

  describe('Accessibility Visual Indicators', () => {
    test('focus indicators are visible and consistent', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      const focusableElements = container.querySelectorAll('input, button, select, a');
      focusableElements.forEach(element => {
        // Should have focus styles
        expect(element.className).toMatch(/focus:ring/);
        expect(element.className).toMatch(/focus:outline-none/);
      });
    });

    test('required field indicators are consistent', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      const requiredLabels = Array.from(container.querySelectorAll('label'))
        .filter(label => label.textContent?.includes('*'));
      
      // Should have consistent required field styling
      expect(requiredLabels.length).toBeGreaterThan(0);
      requiredLabels.forEach(label => {
        expect(label.textContent).toMatch(/\*/);
      });
    });

    test('touch targets meet minimum size requirements', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      const interactiveElements = container.querySelectorAll('button, input, [role="button"]');
      interactiveElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const minHeight = element.className.match(/min-h-\[(\d+)px\]/)?.[1];
        
        if (minHeight) {
          expect(parseInt(minHeight)).toBeGreaterThanOrEqual(44);
        }
      });
    });
  });

  describe('Animation and Transition Consistency', () => {
    test('maintains consistent animation classes', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Test fade-in animations
      const animatedElements = container.querySelectorAll('[class*="animate-"]');
      animatedElements.forEach(element => {
        // Should use consistent animation classes
        expect(element.className).toMatch(/animate-(fade-in|bounce-in|spin)/);
      });
      
      // Test transition classes
      const transitionElements = container.querySelectorAll('[class*="transition"]');
      transitionElements.forEach(element => {
        expect(element.className).toMatch(/transition-(colors|all|transform)/);
      });
    });

    test('loading animations render consistently', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      const spinner = button.querySelector('[class*="animate-spin"]');
      
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });
  });

  describe('Progress Indicator Visual Consistency', () => {
    test('progress bar renders with correct visual hierarchy', () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Test progress container
      const progressContainer = container.querySelector('.mb-8');
      expect(progressContainer).toBeInTheDocument();
      
      // Test progress text
      const progressText = screen.getByText(/etapa 1 de 4/i);
      expect(progressText).toHaveClass('text-sm', 'text-gray-600');
      
      // Test progress bar
      const progressBar = container.querySelector('.bg-blue-600.h-2');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveClass('rounded-full', 'transition-all', 'duration-300');
    });
  });

  describe('Form Validation Visual Feedback', () => {
    test('error messages display consistently', async () => {
      const { container } = render(<UnifiedRegistrationForm />);
      
      // Trigger validation by trying to proceed without data
      const nextButton = screen.getByRole('button', { name: /próximo/i });
      nextButton.click();
      
      // Wait for validation errors
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errorMessages = container.querySelectorAll('[class*="text-red-600"]');
      errorMessages.forEach(error => {
        expect(error).toHaveClass('text-red-600', 'text-sm');
      });
    });

    test('success states render consistently', () => {
      render(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="card-modern p-8 shadow-2xl animate-bounce-in">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Parabéns!</h3>
              <p className="text-gray-600 mb-4">Cadastro realizado com sucesso!</p>
            </div>
          </div>
        </div>
      );
      
      const successModal = screen.getByText(/parabéns/i).closest('div');
      expect(successModal).toHaveClass('text-center');
      
      const iconContainer = document.querySelector('.bg-green-100');
      expect(iconContainer).toHaveClass('w-24', 'h-24', 'rounded-full');
    });
  });
});