# Design System - Onboarding Portal

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production Design Specification

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Design Tokens](#design-tokens)
3. [Component Library](#component-library)
4. [State Management Patterns](#state-management-patterns)
5. [Gamification UI Patterns](#gamification-ui-patterns)
6. [Accessibility Guidelines](#accessibility-guidelines)
7. [Responsive Design](#responsive-design)
8. [Animation Guidelines](#animation-guidelines)

---

## Design Principles

### 1. Progressive Disclosure
- Show only relevant information at each step
- Unlock features as users progress
- Avoid overwhelming users with choices

### 2. Clear Feedback
- Immediate visual feedback for all actions
- Celebrate achievements (points, badges, levels)
- Guide users with contextual nudges

### 3. Accessibility First
- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- Respect user preferences (reduced motion, high contrast)

### 4. Performance
- Components load <100ms
- Animations run at 60fps
- Images lazy-loaded
- Code-split by route

---

## Design Tokens

### Colors

#### Brand Colors
```typescript
// tokens/colors.ts
export const colors = {
  // Primary Brand
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3', // Main brand color
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Success (Health, Approval)
  success: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    500: '#4CAF50', // Main success
    700: '#388E3C',
  },

  // Warning (Pending, Review)
  warning: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    500: '#FF9800', // Main warning
    700: '#F57C00',
  },

  // Error (Rejection, Failure)
  error: {
    50: '#FFEBEE',
    100: '#FFCDD2',
    500: '#F44336', // Main error
    700: '#D32F2F',
  },

  // Neutral (Text, Backgrounds)
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  // Gamification Colors
  gamification: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    points: '#FFC107', // Amber for point indicators
    streak: '#FF5722', // Deep orange for streaks
  },

  // Badge Rarity Colors
  badge: {
    common: '#2196F3', // Blue
    uncommon: '#9C27B0', // Purple
    rare: '#FF9800', // Orange/Gold
    legendary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Gradient
  },
};
```

#### Semantic Colors
```typescript
export const semanticColors = {
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[600],
    disabled: colors.neutral[400],
    inverse: colors.neutral[0],
  },

  background: {
    default: colors.neutral[0],
    paper: colors.neutral[50],
    elevated: colors.neutral[100],
  },

  border: {
    default: colors.neutral[300],
    light: colors.neutral[200],
    focus: colors.primary[500],
  },

  interactive: {
    default: colors.primary[500],
    hover: colors.primary[600],
    active: colors.primary[700],
    disabled: colors.neutral[300],
  },

  status: {
    success: colors.success[500],
    warning: colors.warning[500],
    error: colors.error[500],
    info: colors.primary[500],
  },
};
```

### Typography

```typescript
// tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"Fira Code", "Courier New", monospace',
  },

  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
};
```

### Spacing

```typescript
// tokens/spacing.ts
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
};
```

### Shadows

```typescript
// tokens/shadows.ts
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};
```

### Border Radius

```typescript
// tokens/borderRadius.ts
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  default: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',   // Pill shape
};
```

---

## Component Library

### Buttons

#### Primary Button
```tsx
// components/Button/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
}) => {
  const baseStyles = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 focus:ring-neutral-500',
    outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
    ghost: 'text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {loading ? <Spinner size={size} /> : children}
    </button>
  );
};
```

#### Button States
```tsx
// Disabled state
<Button disabled>Cannot Click</Button>

// Loading state
<Button loading>Processing...</Button>

// With icon
<Button>
  <ArrowRightIcon className="w-5 h-5 mr-2" />
  Continue
</Button>
```

### Forms

#### Input Field
```tsx
// components/Input/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  required,
  ...props
}) => {
  const id = useId();

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-700"
      >
        {label}
        {required && <span className="text-error-500 ml-1" aria-label="required">*</span>}
      </label>

      <input
        id={id}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${error ? 'border-error-500' : 'border-neutral-300'}
        `}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        {...props}
      />

      {error && (
        <p id={`${id}-error`} className="text-sm text-error-500" role="alert">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={`${id}-helper`} className="text-sm text-neutral-500">
          {helperText}
        </p>
      )}
    </div>
  );
};
```

#### Form with React Hook Form
```tsx
// Example: ProfileForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  birthDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data inválida'),
  email: z.string().email('Email inválido'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfileForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const onSubmit = async (data: ProfileFormData) => {
    // Submit to API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Nome Completo"
        error={errors.fullName?.message}
        required
        {...register('fullName')}
      />

      <Input
        label="Data de Nascimento"
        type="date"
        error={errors.birthDate?.message}
        required
        {...register('birthDate')}
      />

      <Button type="submit">Salvar</Button>
    </form>
  );
};
```

### Cards

```tsx
// components/Card/Card.tsx
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  children,
}) => {
  const variantStyles = {
    default: 'bg-white border border-neutral-200',
    elevated: 'bg-white shadow-lg',
    outlined: 'bg-white border-2 border-primary-500',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={`rounded-lg ${variantStyles[variant]} ${paddingStyles[padding]}`}>
      {children}
    </div>
  );
};
```

### Progress Bar

```tsx
// components/ProgressBar/ProgressBar.tsx
interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'gamification';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showPercentage = true,
  color = 'primary',
}) => {
  const colorStyles = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    gamification: 'bg-gamification-points',
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium text-neutral-700">{label}</span>
          {showPercentage && (
            <span className="text-neutral-500">{value}%</span>
          )}
        </div>
      )}

      <div
        className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`h-full ${colorStyles[color]} transition-all duration-500 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};
```

### Modals

```tsx
// components/Modal/Modal.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeStyles[size]} transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all`}>
                {title && (
                  <Dialog.Title className="text-lg font-medium leading-6 text-neutral-900 mb-4">
                    {title}
                  </Dialog.Title>
                )}

                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
```

---

## State Management Patterns

### Zustand Stores

```typescript
// stores/authStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }), // Only persist user, not methods
    }
  )
);
```

### SWR Hooks

```typescript
// hooks/useProfile.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useProfile = () => {
  const { data, error, mutate } = useSWR<Profile>('/api/profile', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  return {
    profile: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
};

// Usage in component
const { profile, isLoading, mutate } = useProfile();

const updateProfile = async (updates: Partial<Profile>) => {
  // Optimistic update
  mutate({ ...profile, ...updates }, false);

  // Send to API
  await fetch('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  // Revalidate
  mutate();
};
```

### React Hook Form Pattern

```typescript
// hooks/useProfileForm.ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema } from '@/schemas/profile';

export const useProfileForm = (defaultValues?: Partial<ProfileFormData>) => {
  const form = useForm<ProfileFormData>({
    mode: 'onBlur',
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  // Auto-save on change (debounced)
  const watchedValues = form.watch();
  useEffect(() => {
    const timer = setTimeout(() => {
      // Save draft to localStorage
      localStorage.setItem('profile-draft', JSON.stringify(watchedValues));
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchedValues]);

  return form;
};
```

---

## Gamification UI Patterns

### Points Counter

```tsx
// components/Gamification/PointsCounter.tsx
interface PointsCounterProps {
  points: number;
  animateChange?: boolean;
}

export const PointsCounter: React.FC<PointsCounterProps> = ({
  points,
  animateChange = true,
}) => {
  const [displayPoints, setDisplayPoints] = useState(points);

  // Animate number change
  useEffect(() => {
    if (!animateChange) {
      setDisplayPoints(points);
      return;
    }

    const increment = Math.ceil((points - displayPoints) / 20);
    const timer = setInterval(() => {
      setDisplayPoints((prev) => {
        if (Math.abs(points - prev) < Math.abs(increment)) {
          clearInterval(timer);
          return points;
        }
        return prev + increment;
      });
    }, 20);

    return () => clearInterval(timer);
  }, [points, animateChange]);

  return (
    <div className="flex items-center space-x-2">
      <span className="text-2xl font-bold text-gamification-points">
        {displayPoints.toLocaleString('pt-BR')}
      </span>
      <span className="text-sm text-neutral-500">pontos</span>
    </div>
  );
};
```

### Level Badge

```tsx
// components/Gamification/LevelBadge.tsx
interface LevelBadgeProps {
  level: 'iniciante' | 'bronze' | 'prata' | 'ouro' | 'platina';
  size?: 'sm' | 'md' | 'lg';
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = 'md',
}) => {
  const levelConfig = {
    iniciante: { icon: '🆕', color: 'bg-neutral-400', label: 'Iniciante' },
    bronze: { icon: '🥉', color: 'bg-gamification-bronze', label: 'Bronze' },
    prata: { icon: '🥈', color: 'bg-gamification-silver', label: 'Prata' },
    ouro: { icon: '🥇', color: 'bg-gamification-gold', label: 'Ouro' },
    platina: { icon: '💎', color: 'bg-gamification-platinum', label: 'Platina' },
  };

  const sizeStyles = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
  };

  const config = levelConfig[level];

  return (
    <div
      className={`${sizeStyles[size]} ${config.color} rounded-full flex items-center justify-center shadow-md`}
      role="img"
      aria-label={`Nível ${config.label}`}
    >
      <span className="text-2xl">{config.icon}</span>
    </div>
  );
};
```

### Badge Display

```tsx
// components/Gamification/BadgeCard.tsx
interface BadgeCardProps {
  badge: {
    id: string;
    name: string;
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    icon: string;
    unlocked: boolean;
  };
  onClick?: () => void;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, onClick }) => {
  const rarityColors = {
    common: 'border-badge-common',
    uncommon: 'border-badge-uncommon',
    rare: 'border-badge-rare',
    legendary: 'border-4 bg-gradient-to-br from-purple-600 to-blue-500',
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border-2 transition-all
        ${badge.unlocked ? rarityColors[badge.rarity] : 'border-neutral-300 opacity-50'}
        hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500
      `}
      aria-label={badge.unlocked ? `${badge.name} - ${badge.description}` : `${badge.name} - Bloqueado`}
    >
      <div className="text-4xl mb-2">{badge.icon}</div>
      <p className="font-medium text-sm">{badge.name}</p>
      {!badge.unlocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LockIcon className="w-8 h-8 text-neutral-400" />
        </div>
      )}
    </button>
  );
};
```

### Confetti Animation

```tsx
// components/Gamification/Confetti.tsx
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface ConfettiProps {
  duration?: number;
  particleCount?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({
  duration = 3000,
  particleCount = 200,
}) => {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return; // Skip animation
    }

    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });

      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, [duration]);

  return null; // No visual component, just side effect
};
```

---

## Accessibility Guidelines

### WCAG 2.1 AA Compliance Checklist

#### Perceivable
- [ ] All images have descriptive `alt` text
- [ ] Text contrast ratio ≥ 4.5:1 (large text ≥ 3:1)
- [ ] No information conveyed by color alone
- [ ] Video/audio has captions and transcripts

#### Operable
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Skip navigation links provided
- [ ] Focus indicators visible (2px solid outline)
- [ ] No time limits (or adjustable)

#### Understandable
- [ ] Language of page declared (`<html lang="pt-BR">`)
- [ ] Form labels clearly associated with inputs
- [ ] Error messages descriptive and actionable
- [ ] Navigation consistent across pages

#### Robust
- [ ] Valid HTML5 markup
- [ ] ARIA landmarks used (`<nav>`, `<main>`, `<aside>`)
- [ ] Status messages use `role="status"` or `aria-live`
- [ ] Form validation errors use `aria-invalid` and `aria-describedby`

### Keyboard Navigation

```tsx
// Example: Dropdown Menu with Keyboard Support
export const DropdownMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Menu
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute mt-2 bg-white shadow-lg rounded-md"
        >
          <a
            href="/profile"
            role="menuitem"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && window.location.assign('/profile')}
          >
            Perfil
          </a>
          <a
            href="/logout"
            role="menuitem"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && window.location.assign('/logout')}
          >
            Sair
          </a>
        </div>
      )}
    </div>
  );
};
```

---

## Responsive Design

### Breakpoints

```typescript
// tokens/breakpoints.ts
export const breakpoints = {
  sm: '640px',  // Mobile landscape
  md: '768px',  // Tablet portrait
  lg: '1024px', // Tablet landscape / Desktop
  xl: '1280px', // Desktop
  '2xl': '1536px', // Large desktop
};
```

### Mobile-First Approach

```tsx
// Example: Responsive Card Grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {badges.map((badge) => (
    <BadgeCard key={badge.id} badge={badge} />
  ))}
</div>
```

---

## Animation Guidelines

### Respect User Preferences

```tsx
// Hook: useReducedMotion
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Usage
const prefersReducedMotion = useReducedMotion();

return (
  <motion.div
    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
  >
    Content
  </motion.div>
);
```

### Animation Durations

```typescript
export const durations = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
};
```

---

**End of Design System v1.0.0**
