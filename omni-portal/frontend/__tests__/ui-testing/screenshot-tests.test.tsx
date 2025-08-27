/**
 * Screenshot and Visual Testing Suite
 * 
 * Comprehensive visual testing using DOM snapshots and layout verification
 * Note: In a real environment, this would use tools like Percy, Chromatic, or Playwright
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { UnifiedRegistrationForm } from '@/components/auth/UnifiedRegistrationForm';
import { Button } from '@/components/ui/button-accessible';
import { renderWithProviders, VIEWPORTS, testHelpers } from './test-utilities';

// Mock dependencies
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

describe('Screenshot and Visual Testing', () => {
  
  describe('Component Screenshots at Different Viewports', () => {
    const components = [
      {
        name: 'UnifiedRegistrationForm',
        component: <UnifiedRegistrationForm />,
        description: 'Multi-step registration form',
      },
      {
        name: 'Button Variants',
        component: (
          <div className="space-y-4 p-8">
            <Button variant="default">Default Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="link">Link Button</Button>
          </div>
        ),
        description: 'All button variants',
      },
    ];

    components.forEach(({ name, component, description }) => {
      describe(`${name} - ${description}`, () => {
        Object.entries(VIEWPORTS).forEach(([category, viewports]) => {
          Object.entries(viewports).forEach(([device, dimensions]) => {
            test(`renders correctly on ${device} (${dimensions.width}×${dimensions.height})`, () => {
              const { container } = renderWithProviders(component, {
                initialViewport: dimensions,
              });

              // Take DOM snapshot
              expect(container.firstChild).toMatchSnapshot(`${name}-${device}-${dimensions.width}x${dimensions.height}`);

              // Verify basic structure
              expect(container.firstChild).toBeInTheDocument();

              // Check responsive adaptations
              if (dimensions.width < 640) {
                // Mobile adaptations
                const gridElements = container.querySelectorAll('[class*="grid-cols"]');
                gridElements.forEach(element => {
                  expect(element).toHaveClass('grid-cols-1');
                });
              }
            });
          });
        });
      });
    });
  });

  describe('Component State Screenshots', () => {
    test('Button states visual verification', () => {
      const { container } = render(
        <div className="grid grid-cols-2 gap-4 p-8">
          <div className="space-y-4">
            <h3>Normal States</h3>
            <Button>Normal</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
          
          <div className="space-y-4">
            <h3>Special States</h3>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('button-all-states');

      // Verify loading state elements
      const loadingButton = screen.getByText('Loading').closest('button');
      const spinner = loadingButton?.querySelector('[class*="animate-spin"]');
      expect(spinner).toBeInTheDocument();

      // Verify disabled state
      const disabledButton = screen.getByText('Disabled').closest('button');
      expect(disabledButton).toBeDisabled();
    });

    test('Form validation states', async () => {
      const { container, user } = renderWithProviders(<UnifiedRegistrationForm />);

      // Trigger validation by trying to proceed
      const nextButton = screen.getByRole('button', { name: /próximo/i });
      await user.click(nextButton);

      // Wait for validation errors to appear
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(container).toMatchSnapshot('form-validation-errors');

      // Verify error messages are visible
      const errorMessages = container.querySelectorAll('[class*="text-red-600"]');
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    test('Form success state', () => {
      const { container } = render(
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="card-modern p-8 shadow-2xl animate-bounce-in">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Parabéns!</h3>
              <p className="text-gray-600 mb-4">Cadastro realizado com sucesso!</p>
              <div className="animate-pulse text-4xl font-bold text-green-600 mb-4">
                +100 pontos!
              </div>
              <p className="text-sm text-gray-500">Redirecionando para o painel...</p>
            </div>
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('form-success-modal');

      // Verify success elements
      expect(screen.getByText('Parabéns!')).toBeInTheDocument();
      expect(screen.getByText('+100 pontos!')).toBeInTheDocument();
    });
  });

  describe('Layout Structure Verification', () => {
    test('Registration form layout structure', () => {
      const { container } = render(<UnifiedRegistrationForm />);

      // Verify main structure
      const mainCard = container.querySelector('.card-modern');
      expect(mainCard).toBeInTheDocument();

      // Verify progress bar structure
      const progressContainer = container.querySelector('.mb-8');
      expect(progressContainer).toBeInTheDocument();

      const progressBar = container.querySelector('.bg-blue-600.h-2');
      expect(progressBar).toBeInTheDocument();

      // Verify form structure
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();

      // Verify step content
      const stepHeader = screen.getByText(/informações pessoais/i);
      expect(stepHeader).toBeInTheDocument();

      // Take structural snapshot
      expect(container).toMatchSnapshot('registration-form-structure');
    });

    test('Grid layout consistency', () => {
      const { container } = renderWithProviders(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
          <div className="bg-gray-100 p-4 rounded">Item 1</div>
          <div className="bg-gray-100 p-4 rounded">Item 2</div>
          <div className="bg-gray-100 p-4 rounded">Item 3</div>
          <div className="bg-gray-100 p-4 rounded">Item 4</div>
          <div className="bg-gray-100 p-4 rounded">Item 5</div>
          <div className="bg-gray-100 p-4 rounded">Item 6</div>
        </div>,
        { initialViewport: VIEWPORTS.desktop.medium }
      );

      expect(container).toMatchSnapshot('grid-layout-desktop');

      // Verify grid structure
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });
  });

  describe('Typography and Text Rendering', () => {
    test('Typography hierarchy', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Main Heading (H1)
          </h1>
          <h2 className="text-2xl font-semibold text-gray-900">
            Section Heading (H2)
          </h2>
          <h3 className="text-lg font-medium text-gray-900">
            Subsection Heading (H3)
          </h3>
          <p className="text-base text-gray-700">
            Regular paragraph text with proper line height and spacing.
          </p>
          <p className="text-sm text-gray-600">
            Small text for captions and secondary information.
          </p>
          <p className="text-xs text-gray-500">
            Extra small text for fine print.
          </p>
        </div>
      );

      expect(container).toMatchSnapshot('typography-hierarchy');

      // Verify gradient text
      const gradientHeading = container.querySelector('.bg-gradient-to-r');
      expect(gradientHeading).toHaveClass('bg-clip-text', 'text-transparent');
    });

    test('Text in different languages', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <p className="text-base">Português: Informações pessoais e dados de contato</p>
          <p className="text-base">English: Personal information and contact details</p>
          <p className="text-base">Español: Información personal y datos de contacto</p>
          <p className="text-base">中文: 个人信息和联系方式</p>
          <p className="text-base">العربية: المعلومات الشخصية وتفاصيل الاتصال</p>
        </div>
      );

      expect(container).toMatchSnapshot('multilingual-text');
    });
  });

  describe('Color Theme Verification', () => {
    test('Color palette consistency', () => {
      const { container } = render(
        <div className="grid grid-cols-4 gap-4 p-8">
          {/* Primary colors */}
          <div className="space-y-2">
            <h4 className="font-medium">Primary</h4>
            <div className="w-16 h-16 bg-blue-500 rounded"></div>
            <div className="w-16 h-16 bg-blue-600 rounded"></div>
            <div className="w-16 h-16 bg-blue-700 rounded"></div>
          </div>
          
          {/* Secondary colors */}
          <div className="space-y-2">
            <h4 className="font-medium">Secondary</h4>
            <div className="w-16 h-16 bg-gray-500 rounded"></div>
            <div className="w-16 h-16 bg-gray-600 rounded"></div>
            <div className="w-16 h-16 bg-gray-700 rounded"></div>
          </div>
          
          {/* Success colors */}
          <div className="space-y-2">
            <h4 className="font-medium">Success</h4>
            <div className="w-16 h-16 bg-green-500 rounded"></div>
            <div className="w-16 h-16 bg-green-600 rounded"></div>
            <div className="w-16 h-16 bg-green-700 rounded"></div>
          </div>
          
          {/* Error colors */}
          <div className="space-y-2">
            <h4 className="font-medium">Error</h4>
            <div className="w-16 h-16 bg-red-500 rounded"></div>
            <div className="w-16 h-16 bg-red-600 rounded"></div>
            <div className="w-16 h-16 bg-red-700 rounded"></div>
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('color-palette');
    });

    test('Contrast verification', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <div className="bg-white text-gray-900 p-4 rounded">
            Dark text on light background (High contrast)
          </div>
          <div className="bg-blue-600 text-white p-4 rounded">
            Light text on dark background (High contrast)
          </div>
          <div className="bg-gray-100 text-gray-600 p-4 rounded">
            Medium contrast text
          </div>
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded border border-yellow-200">
            Warning: Medium contrast with border
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('contrast-examples');

      // Test actual contrast programmatically would require color analysis
      const darkOnLight = container.querySelector('.bg-white.text-gray-900');
      expect(darkOnLight).toBeInTheDocument();
    });
  });

  describe('Interactive State Visualization', () => {
    test('Hover and focus states', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <Button className="hover:bg-blue-700 focus:ring-2 focus:ring-blue-500">
            Hover/Focus Button
          </Button>
          <input 
            className="border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Focus me"
          />
          <select className="border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">
            <option>Select option</option>
          </select>
        </div>
      );

      // Simulate focus states
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      const input = screen.getByPlaceholderText('Focus me');
      input.focus();
      expect(input).toHaveFocus();

      expect(container).toMatchSnapshot('interactive-states');
    });

    test('Animation states', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <div className="animate-pulse bg-gray-200 h-4 rounded"></div>
          <div className="animate-bounce bg-blue-500 w-4 h-4 rounded-full"></div>
          <div className="transition-all duration-300 hover:scale-105 bg-green-500 p-4 rounded">
            Hover to scale
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('animation-states');

      // Verify animation classes
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('animate-spin');

      const pulse = container.querySelector('.animate-pulse');
      expect(pulse).toHaveClass('animate-pulse');
    });
  });

  describe('Error State Visualization', () => {
    test('Error message display', () => {
      const { container } = render(
        <div className="space-y-4 p-8">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex">
              <div className="text-red-600 mr-3">⚠</div>
              <div>
                <h4 className="text-red-800 font-medium">Error occurred</h4>
                <p className="text-red-700 text-sm mt-1">
                  This is an error message with proper styling and contrast.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input 
              className="w-full border border-red-300 rounded px-3 py-2 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500"
              placeholder="Invalid email"
            />
            <p className="text-red-600 text-sm">Please enter a valid email address.</p>
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('error-states');
    });
  });

  describe('Loading State Visualization', () => {
    test('Loading indicators', () => {
      const { container } = render(
        <div className="space-y-8 p-8">
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
          
          {/* Skeleton loading */}
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-200 h-4 rounded w-3/4"></div>
            <div className="animate-pulse bg-gray-200 h-4 rounded w-1/2"></div>
            <div className="animate-pulse bg-gray-200 h-4 rounded w-5/6"></div>
          </div>
          
          {/* Loading button */}
          <Button loading loadingText="Processing...">
            Submit Form
          </Button>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full w-2/3 transition-all duration-300"></div>
          </div>
        </div>
      );

      expect(container).toMatchSnapshot('loading-states');

      // Verify loading button
      const loadingButton = screen.getByRole('button');
      expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    });
  });
});