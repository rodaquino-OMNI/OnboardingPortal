# Coding Standards & Best Practices - OnboardingPortal

## 📋 Overview

This document establishes comprehensive coding standards, best practices, and development guidelines for the OnboardingPortal project to ensure code quality, maintainability, and team collaboration.

## 🎯 General Principles

### Code Quality Foundations
1. **Readability**: Code should be self-documenting and clear
2. **Consistency**: Follow established patterns throughout the codebase
3. **Simplicity**: Prefer simple, straightforward solutions
4. **Maintainability**: Write code that's easy to modify and extend
5. **Performance**: Optimize for both development speed and runtime performance
6. **Security**: Security-first approach in all implementations

### SOLID Principles
- **Single Responsibility**: Each class/function has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable for their base types
- **Interface Segregation**: Clients shouldn't depend on unused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

---

## 🔤 Naming Conventions

### TypeScript/JavaScript
```typescript
// ✅ Good - Clear, descriptive names
const isUserAuthenticated = true;
const maxRetryAttempts = 3;
const userRegistrationDate = new Date();

// ❌ Bad - Unclear, abbreviated names  
const isAuth = true;
const maxRetry = 3;
const regDate = new Date();

// Functions - Use verbs that describe action
const calculateUserDiscount = (user: User): number => { /* */ };
const validateDocumentFormat = (document: Document): boolean => { /* */ };
const fetchOnboardingProgress = async (userId: string): Promise<Progress> => { /* */ };

// Classes - Use PascalCase nouns
class UserAuthenticationService { /* */ }
class DocumentValidationError extends Error { /* */ }
class OnboardingProgressTracker { /* */ }

// Interfaces - Use descriptive names with 'I' prefix or descriptive suffix
interface IUserRepository { /* */ }
interface DatabaseConnection { /* */ }
interface OnboardingFormData { /* */ }

// Types - Use descriptive names
type UserRole = 'admin' | 'user' | 'moderator';
type ValidationResult = { isValid: boolean; errors: string[] };

// Enums - Use PascalCase
enum OnboardingStep {
  Welcome = 'WELCOME',
  CompanyInfo = 'COMPANY_INFO',
  HealthQuestionnaire = 'HEALTH_QUESTIONNAIRE',
  DocumentUpload = 'DOCUMENT_UPLOAD',
  InterviewSchedule = 'INTERVIEW_SCHEDULE',
  Completion = 'COMPLETION'
}

// Constants - Use SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE_MB = 10;
const API_TIMEOUT_MS = 30000;
const SUPPORTED_DOCUMENT_TYPES = ['pdf', 'jpg', 'png'] as const;
```

### File and Directory Naming
```
// ✅ Good - kebab-case for files, PascalCase for components
components/
├── ui/
│   ├── button.tsx
│   ├── input-field.tsx
│   └── progress-bar.tsx
├── forms/
│   ├── CompanyInfoForm.tsx
│   ├── HealthQuestionnaireForm.tsx
│   └── DocumentUploadForm.tsx
└── hooks/
    ├── use-onboarding-progress.ts
    ├── use-file-upload.ts
    └── use-form-validation.ts

// Pages - kebab-case
app/
├── (onboarding)/
│   ├── company-info/
│   ├── health-questionnaire/
│   └── document-upload/
└── (auth)/
    ├── login/
    └── register/

// API routes - kebab-case
app/api/
├── auth/
│   ├── login/route.ts
│   └── register/route.ts
├── onboarding/
│   ├── progress/route.ts
│   └── company-info/route.ts
└── documents/
    ├── upload/route.ts
    └── validation/route.ts
```

---

## 📁 Project Structure

### Frontend Structure (Next.js)
```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Authentication pages
│   ├── (onboarding)/            # Onboarding flow pages
│   ├── (dashboard)/             # Dashboard pages
│   ├── api/                     # API routes
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/                   # Reusable components
│   ├── ui/                      # Base UI components
│   ├── forms/                   # Form components
│   ├── layout/                  # Layout components
│   └── features/                # Feature-specific components
├── hooks/                       # Custom React hooks
│   ├── use-auth.ts
│   ├── use-onboarding.ts
│   └── use-api.ts
├── lib/                         # Utility libraries
│   ├── utils.ts                 # General utilities
│   ├── validations.ts           # Schema validations
│   ├── api-client.ts            # API client
│   └── constants.ts             # Application constants
├── stores/                      # State management
│   ├── auth-store.ts
│   ├── onboarding-store.ts
│   └── ui-store.ts
├── types/                       # TypeScript type definitions
│   ├── api.ts                   # API response types
│   ├── auth.ts                  # Authentication types
│   ├── onboarding.ts            # Onboarding types
│   └── global.ts                # Global types
├── styles/                      # Styling
│   ├── globals.css
│   └── components.css
└── __tests__/                   # Test files
    ├── components/
    ├── hooks/
    └── utils/
```

### Component Organization
```typescript
// components/forms/CompanyInfoForm.tsx
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFormValidation } from '@/hooks/use-form-validation';
import { companyInfoSchema } from '@/lib/validations';
import type { CompanyFormData } from '@/types/onboarding';

// Component interface
interface CompanyInfoFormProps {
  initialData?: Partial<CompanyFormData>;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

// Main component
export function CompanyInfoForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: CompanyInfoFormProps) {
  // Hooks at the top
  const { formData, errors, isValid, updateField, validate } = useFormValidation(
    initialData || {},
    companyInfoSchema
  );

  // Event handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Render
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form content */}
    </form>
  );
}

// Default export
export default CompanyInfoForm;
```

---

## 🎨 Component Guidelines

### React Component Standards
```typescript
// ✅ Good - Functional component with proper TypeScript
import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        {
          'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary',
          'bg-gray-200 text-gray-900 hover:bg-gray-300': variant === 'secondary',
          'border border-gray-300 bg-white hover:bg-gray-50': variant === 'outline',
        },
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        },
        fullWidth && 'w-full',
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
```

### Custom Hooks Pattern
```typescript
// hooks/use-onboarding-progress.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api-client';
import type { OnboardingProgress, OnboardingStep } from '@/types/onboarding';

interface UseOnboardingProgressReturn {
  progress: OnboardingProgress | null;
  currentStep: OnboardingStep;
  isLoading: boolean;
  error: string | null;
  nextStep: () => Promise<void>;
  previousStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  saveProgress: (data: Partial<OnboardingProgress>) => Promise<void>;
  markStepComplete: (step: OnboardingStep) => Promise<void>;
}

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const { user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch progress on mount
  useEffect(() => {
    if (user?.id) {
      fetchProgress();
    }
  }, [user?.id]);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.get<OnboardingProgress>('/onboarding/progress');
      setProgress(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProgress = useCallback(async (data: Partial<OnboardingProgress>) => {
    try {
      const updated = await apiClient.patch<OnboardingProgress>(
        '/onboarding/progress', 
        data
      );
      setProgress(updated);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save progress');
    }
  }, []);

  const nextStep = useCallback(async () => {
    if (!progress) return;
    
    const nextStepIndex = progress.currentStep + 1;
    if (nextStepIndex < progress.totalSteps) {
      await saveProgress({ currentStep: nextStepIndex });
    }
  }, [progress, saveProgress]);

  return {
    progress,
    currentStep: progress?.currentStep || 0,
    isLoading,
    error,
    nextStep,
    previousStep: () => {/* implementation */},
    goToStep: () => {/* implementation */},
    saveProgress,
    markStepComplete: () => {/* implementation */}
  };
}
```

---

## 🛡️ Error Handling

### Frontend Error Handling
```typescript
// lib/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error boundary component
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Sentry, LogRocket, etc.
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Algo deu errado
            </h2>
            <p className="text-gray-600 mb-4">
              Um erro inesperado ocorreu. Por favor, recarregue a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// API error handling
export async function handleAPIError(response: Response): Promise<never> {
  let errorData;
  
  try {
    errorData = await response.json();
  } catch {
    throw new APIError(
      'Network error occurred',
      response.status
    );
  }

  throw new APIError(
    errorData.message || 'An error occurred',
    response.status,
    errorData.code,
    errorData.details
  );
}
```

### Backend Error Handling (Laravel)
```php
<?php
// app/Exceptions/Handler.php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $exception): JsonResponse
    {
        // Always return JSON for API requests
        if ($request->wantsJson() || $request->is('api/*')) {
            return $this->renderJsonException($request, $exception);
        }

        return parent::render($request, $exception);
    }

    protected function renderJsonException($request, Throwable $exception): JsonResponse
    {
        $status = 500;
        $message = 'Internal Server Error';
        $code = 'INTERNAL_ERROR';
        $details = null;

        // Handle specific exception types
        if ($exception instanceof ValidationException) {
            $status = 422;
            $message = 'Validation failed';
            $code = 'VALIDATION_ERROR';
            $details = $exception->errors();
        } elseif ($exception instanceof NotFoundHttpException) {
            $status = 404;
            $message = 'Resource not found';
            $code = 'NOT_FOUND';
        } elseif ($exception instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
            $status = 404;
            $message = 'Resource not found';
            $code = 'MODEL_NOT_FOUND';
        }

        $response = [
            'success' => false,
            'error' => [
                'message' => $message,
                'code' => $code,
                'timestamp' => now()->toISOString(),
            ]
        ];

        if ($details) {
            $response['error']['details'] = $details;
        }

        // Add trace in development
        if (config('app.debug')) {
            $response['error']['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, $status);
    }
}
```

---

## 📝 Documentation Standards

### Code Documentation
```typescript
/**
 * Validates user onboarding data and calculates completion progress
 * 
 * @param userData - The user data to validate
 * @param steps - Array of onboarding steps to check
 * @returns Promise containing validation results and progress percentage
 * 
 * @example
 * ```typescript
 * const result = await validateOnboardingData(
 *   { email: 'user@example.com', company: 'ACME' },
 *   ['company-info', 'health-questionnaire']
 * );
 * console.log(`Progress: ${result.progressPercentage}%`);
 * ```
 * 
 * @throws {ValidationError} When user data is invalid
 * @throws {APIError} When external validation services fail
 */
export async function validateOnboardingData(
  userData: UserOnboardingData,
  steps: OnboardingStep[]
): Promise<ValidationResult> {
  // Implementation
}

/**
 * Custom hook for managing file uploads with progress tracking
 * 
 * @param options - Configuration options for upload behavior
 * @returns Object containing upload functions and state
 * 
 * @example
 * ```typescript
 * const { uploadFile, progress, error, isUploading } = useFileUpload({
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf']
 * });
 * ```
 */
export function useFileUpload(options: UploadOptions): UploadHookReturn {
  // Implementation
}
```

### Component Documentation
```typescript
/**
 * A reusable progress bar component for showing onboarding completion
 * 
 * @component
 * @example
 * ```tsx
 * <ProgressBar 
 *   value={75} 
 *   max={100}
 *   label="75% Complete"
 *   variant="success"
 * />
 * ```
 */
interface ProgressBarProps {
  /** Current progress value */
  value: number;
  /** Maximum progress value (default: 100) */
  max?: number;
  /** Optional label to display */
  label?: string;
  /** Visual variant of the progress bar */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Additional CSS classes */
  className?: string;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  label, 
  variant = 'default',
  className 
}: ProgressBarProps) {
  // Implementation
}
```

---

## 🧪 Testing Standards

### Unit Test Structure
```typescript
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state correctly', () => {
    render(<Button isLoading>Loading Button</Button>);
    
    expect(screen.getByText('Loading Button')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-200');
  });
});

// __tests__/hooks/use-onboarding-progress.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn()
  }
}));

describe('useOnboardingProgress', () => {
  it('loads progress on mount', async () => {
    const mockProgress = { currentStep: 2, totalSteps: 5 };
    vi.mocked(apiClient.get).mockResolvedValue(mockProgress);

    const { result } = renderHook(() => useOnboardingProgress());

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.progress).toEqual(mockProgress);
    });
  });

  it('handles next step correctly', async () => {
    const mockProgress = { currentStep: 2, totalSteps: 5 };
    const updatedProgress = { currentStep: 3, totalSteps: 5 };
    
    vi.mocked(apiClient.get).mockResolvedValue(mockProgress);
    vi.mocked(apiClient.patch).mockResolvedValue(updatedProgress);

    const { result } = renderHook(() => useOnboardingProgress());

    await waitFor(() => {
      expect(result.current.progress).toEqual(mockProgress);
    });

    await act(async () => {
      await result.current.nextStep();
    });

    expect(result.current.progress).toEqual(updatedProgress);
  });
});
```

### Integration Test Example
```typescript
// __tests__/integration/onboarding-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { mockServer } from '../mocks/server';

describe('Onboarding Flow Integration', () => {
  beforeEach(() => {
    mockServer.resetHandlers();
  });

  it('completes full onboarding process', async () => {
    render(
      <BrowserRouter>
        <OnboardingFlow />
      </BrowserRouter>
    );

    // Welcome step
    expect(screen.getByText('Bem-vindo ao Onboarding')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Começar'));

    // Company info step
    await waitFor(() => {
      expect(screen.getByText('Informações da Empresa')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Nome da Empresa'), {
      target: { value: 'ACME Corp' }
    });
    fireEvent.change(screen.getByLabelText('CNPJ'), {
      target: { value: '12.345.678/0001-90' }
    });
    fireEvent.click(screen.getByText('Próximo'));

    // Health questionnaire step
    await waitFor(() => {
      expect(screen.getByText('Questionário de Saúde')).toBeInTheDocument();
    });

    // Continue through remaining steps...
    
    // Completion
    await waitFor(() => {
      expect(screen.getByText('Onboarding Concluído!')).toBeInTheDocument();
    });
  });
});
```

---

## 🔧 Code Quality Tools

### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/prefer-const": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "prefer-const": "error",
    "no-var": "error",
    "no-console": "warn",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
    "brace-style": ["error", "1tbs"],
    "comma-dangle": ["error", "es5"],
    "quotes": ["error", "single", { "avoidEscape": true }],
    "jsx-quotes": ["error", "prefer-double"],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react-hooks/exhaustive-deps": "error"
  },
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}
```

### Prettier Configuration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "jsxSingleQuote": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### Husky Pre-commit Hooks
```json
// package.json scripts
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "pre-commit": "lint-staged"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### Husky Configuration
```bash
#!/usr/bin/env sh
# .husky/pre-commit
. "$(dirname -- "$0")/_/husky.sh"

npm run type-check
npm run lint
npm run format:check
npm run test
```

---

## 📊 Performance Guidelines

### Code Optimization
```typescript
// ✅ Good - Proper memoization
import { memo, useMemo, useCallback } from 'react';

interface ExpensiveComponentProps {
  items: Item[];
  onItemClick: (id: string) => void;
}

export const ExpensiveComponent = memo<ExpensiveComponentProps>(({ 
  items, 
  onItemClick 
}) => {
  // Memoize expensive calculations
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.priority - b.priority);
  }, [items]);

  // Memoize event handlers
  const handleItemClick = useCallback((id: string) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <div>
      {sortedItems.map(item => (
        <ItemComponent
          key={item.id}
          item={item}
          onClick={handleItemClick}
        />
      ))}
    </div>
  );
});

// ✅ Good - Lazy loading
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}

// ✅ Good - Efficient API calls
import { useQuery } from '@tanstack/react-query';

function useUserData(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### Bundle Optimization
```typescript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

---

## 🛡️ Security Best Practices

### Input Validation
```typescript
// lib/validations.ts
import { z } from 'zod';

// Schemas for validation
export const emailSchema = z.string().email('Email inválido');

export const cnpjSchema = z.string()
  .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX');

export const companyInfoSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .refine(val => !/<script|javascript:/i.test(val), 'Nome contém caracteres inválidos'),
  cnpj: cnpjSchema,
  email: emailSchema,
  phone: z.string()
    .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
    .optional(),
});

// Sanitization utility
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

// API input validation middleware
export function validateInput<T>(schema: z.ZodSchema<T>) {
  return (req: NextRequest, res: NextResponse, next: () => void) => {
    try {
      const body = req.json();
      const validatedData = schema.parse(body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }
  };
}
```

### Authentication & Authorization
```typescript
// lib/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET!;
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '24h',
    issuer: 'onboarding-portal',
    audience: 'onboarding-portal-users'
  });
}

export function verifyToken(token: string): object {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'onboarding-portal',
      audience: 'onboarding-portal-users'
    });
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Rate limiting
import { RateLimiter } from 'limiter';

const loginLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 'hour',
  fireImmediately: true
});

export async function rateLimitLogin(identifier: string): Promise<boolean> {
  return loginLimiter.removeTokens(1, identifier);
}
```

---

## 📋 Code Review Checklist

### Review Criteria
- [ ] **Functionality**: Does the code work as intended?
- [ ] **Readability**: Is the code easy to read and understand?
- [ ] **Performance**: Are there any performance concerns?
- [ ] **Security**: Are there any security vulnerabilities?
- [ ] **Testing**: Is the code properly tested?
- [ ] **Documentation**: Is the code adequately documented?
- [ ] **Standards**: Does the code follow project conventions?
- [ ] **Error Handling**: Are errors handled appropriately?
- [ ] **Accessibility**: Does the UI meet accessibility standards?
- [ ] **Responsive Design**: Does the UI work on all screen sizes?

### Common Issues to Look For
- Hardcoded values that should be constants
- Missing error handling or validation
- Performance bottlenecks (unnecessary re-renders, large bundle sizes)
- Security vulnerabilities (XSS, injection attacks)
- Accessibility issues (missing ARIA labels, poor contrast)
- Inconsistent naming or code style
- Missing or inadequate tests
- Dead code or unused imports
- Memory leaks or resource cleanup issues

---

## 🚀 Deployment Standards

### Environment Management
```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_API_URL: z.string().url(),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
```

### Build Scripts
```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "analyze": "ANALYZE=true next build",
    "clean": "rm -rf .next && rm -rf node_modules/.cache"
  }
}
```

This comprehensive coding standards document ensures consistent, maintainable, and high-quality code across the OnboardingPortal project.