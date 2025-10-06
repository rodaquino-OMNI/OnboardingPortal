# ADR-003: Frontend State Management Strategy

**Status:** Accepted
**Date:** 2025-09-30
**Decision Makers:** Lead Architect, Frontend Lead, UX Lead
**Consulted:** Development Team

---

## Context

The AUSTA OnboardingPortal Next.js frontend requires state management for:
1. **User Authentication State**: Login status, user profile, permissions
2. **Onboarding Progress**: Multi-step form data, completion status
3. **Form Data**: Temporary form state with validation errors
4. **UI State**: Modal visibility, loading states, toasts/notifications
5. **Server Cache**: API response caching and synchronization

### Requirements
- **Performance**: Minimal re-renders, fast updates
- **Developer Experience**: Simple API, easy debugging
- **TypeScript Support**: Full type safety
- **Bundle Size**: < 50KB total for state management
- **Server State Sync**: Integrate with Next.js Server Components

---

## Decision

**We will use Zustand for client state management with SWR for server state.**

This means:
1. **Zustand** for global client state (auth, UI, onboarding progress)
2. **SWR** for server state (API caching, revalidation)
3. **React Hook Form** for local form state (component-level)
4. **URL State** for shareable state (query parameters)

---

## Rationale

### Why Zustand?

| Advantage | Impact |
|-----------|--------|
| **Lightweight** | 8KB vs Redux (47KB) - 83% smaller bundle |
| **Simple API** | No boilerplate, no providers, minimal learning curve |
| **TypeScript Native** | Full type inference, zero configuration |
| **Performance** | Fine-grained subscriptions prevent unnecessary re-renders |
| **DevTools** | Redux DevTools integration for debugging |
| **No Context Providers** | Clean component tree, no provider hell |

### Why SWR for Server State?

| Advantage | Impact |
|-----------|--------|
| **Automatic Revalidation** | Stale-while-revalidate pattern keeps UI fresh |
| **Request Deduplication** | Multiple components can request same data efficiently |
| **Focus Revalidation** | Auto-refresh data when user returns to tab |
| **Optimistic Updates** | Instant UI updates before server confirmation |
| **Error Retry** | Automatic retry with exponential backoff |
| **Small Bundle** | 4KB gzipped |

### State Management Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE LAYER SEPARATION                    │
├─────────────────────────────────────────────────────────────┤
│  URL State (Query Parameters)                                │
│  - Shareable state (search, filters, pagination)            │
│  - Browser back/forward navigation                           │
│  └─→ next/navigation useSearchParams()                      │
├─────────────────────────────────────────────────────────────┤
│  Server State (SWR)                                          │
│  - API response caching                                      │
│  - Automatic revalidation                                    │
│  - Optimistic updates                                        │
│  └─→ useSWR() for GET, useSWRMutation() for POST/PUT       │
├─────────────────────────────────────────────────────────────┤
│  Global Client State (Zustand)                               │
│  - Authentication state                                      │
│  - Onboarding progress                                       │
│  - UI state (modals, toasts)                                │
│  └─→ useAuthStore(), useOnboardingStore(), useUIStore()    │
├─────────────────────────────────────────────────────────────┤
│  Local Component State (React Hook Form)                     │
│  - Form field values                                         │
│  - Validation errors                                         │
│  - Temporary UI state                                        │
│  └─→ useForm(), useState()                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Alternatives Considered

### Alternative 1: Redux + Redux Toolkit

**Pros:**
- Industry standard
- Excellent DevTools
- Predictable state updates
- Large ecosystem

**Cons:**
- Heavy bundle (47KB)
- Boilerplate code (actions, reducers, selectors)
- Complex setup
- Overkill for application size
- **Decision:** ❌ Rejected - Too complex and large for our needs

### Alternative 2: React Context + useReducer

**Pros:**
- Built-in React solution
- No additional dependencies
- Simple mental model

**Cons:**
- Performance issues (entire context re-renders)
- No DevTools integration
- Manual optimization required
- Difficult to split contexts without prop drilling
- **Decision:** ❌ Rejected - Performance concerns at scale

### Alternative 3: Recoil (Facebook)

**Pros:**
- Atom-based state management
- Fine-grained subscriptions
- Good TypeScript support

**Cons:**
- Experimental status
- Larger bundle (21KB)
- Less mature ecosystem
- Facebook-specific patterns
- **Decision:** ❌ Rejected - Experimental status risk

### Alternative 4: Jotai (Similar to Recoil)

**Pros:**
- Lightweight (3KB)
- Atom-based state
- Good TypeScript support

**Cons:**
- Newer, less proven
- Smaller community
- Different mental model (atoms)
- **Decision:** ⚠️ Considered but Zustand more mature

### Alternative 5: Tanstack Query (React Query)

**Pros:**
- Excellent server state management
- Powerful caching
- DevTools

**Cons:**
- Heavier than SWR (11KB vs 4KB)
- More complex API
- Overkill for simple GET requests
- **Decision:** ⚠️ Good alternative, but SWR simpler for our use case

---

## Implementation Details

### Zustand Store Structure

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'provider' | 'admin';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        accessToken: null,
        isAuthenticated: false,

        login: (user, token) => set({
          user,
          accessToken: token,
          isAuthenticated: true
        }, false, 'auth/login'),

        logout: () => set({
          user: null,
          accessToken: null,
          isAuthenticated: false
        }, false, 'auth/logout'),

        updateUser: (updates) => set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        }), false, 'auth/updateUser'),
      }),
      {
        name: 'auth-storage', // localStorage key
        partialize: (state) => ({
          user: state.user,
          // Don't persist token (security)
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// Selectors for fine-grained subscriptions
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
```

```typescript
// stores/onboardingStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface OnboardingState {
  currentStep: number;
  completedSteps: string[];
  formData: {
    company?: CompanyData;
    health?: HealthData;
    documents?: DocumentData[];
  };
  progress: number; // 0-100

  // Actions
  setCurrentStep: (step: number) => void;
  completeStep: (stepName: string) => void;
  updateFormData: (section: string, data: any) => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  devtools(
    persist(
      (set) => ({
        currentStep: 0,
        completedSteps: [],
        formData: {},
        progress: 0,

        setCurrentStep: (step) => set({ currentStep: step }),

        completeStep: (stepName) => set((state) => {
          const newCompletedSteps = [...state.completedSteps, stepName];
          return {
            completedSteps: newCompletedSteps,
            progress: (newCompletedSteps.length / 6) * 100, // 6 total steps
          };
        }),

        updateFormData: (section, data) => set((state) => ({
          formData: {
            ...state.formData,
            [section]: data
          }
        })),

        resetOnboarding: () => set({
          currentStep: 0,
          completedSteps: [],
          formData: {},
          progress: 0
        }),
      }),
      {
        name: 'onboarding-storage',
      }
    )
  )
);
```

### SWR for Server State

```typescript
// hooks/useHealthQuestionnaire.ts
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useHealthQuestionnaire(userId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? `/api/health/questionnaire/${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on network reconnect
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    }
  );

  return {
    questionnaire: data,
    isLoading,
    isError: error,
    refresh: mutate, // Manual refresh
  };
}

// Mutation hook for POST/PUT
export function useSubmitHealthQuestionnaire() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/health/questionnaire',
    async (url, { arg }: { arg: HealthQuestionnaireData }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg),
      });

      if (!response.ok) {
        throw new Error('Failed to submit questionnaire');
      }

      return response.json();
    },
    {
      onSuccess: (data) => {
        // Revalidate related queries
        mutate('/api/health/questionnaire');
        mutate('/api/onboarding/progress');
      },
    }
  );

  return {
    submit: trigger,
    isSubmitting: isMutating,
    error,
  };
}
```

### React Hook Form for Local State

```typescript
// components/forms/CompanyInfoForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const companySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'Invalid CNPJ format'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Invalid phone format'),
});

type CompanyFormData = z.infer<typeof companySchema>;

export function CompanyInfoForm() {
  const { updateFormData } = useOnboardingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    mode: 'onChange', // Real-time validation
  });

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const subscription = watch((formData) => {
      const timer = setTimeout(() => {
        updateFormData('company', formData);
      }, 30000);

      return () => clearTimeout(timer);
    });

    return () => subscription.unsubscribe();
  }, [watch, updateFormData]);

  const onSubmit = async (data: CompanyFormData) => {
    updateFormData('company', data);
    // Navigate to next step...
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      {/* Other fields... */}

      <button type="submit" disabled={isSubmitting}>
        Continue
      </button>
    </form>
  );
}
```

---

## Performance Optimizations

### Prevent Unnecessary Re-renders

```typescript
// ❌ BAD: Component re-renders on any state change
function ProfileBadge() {
  const { user, isAuthenticated, login, logout } = useAuthStore();

  return <div>{user?.firstName}</div>;
}

// ✅ GOOD: Component only re-renders when user.firstName changes
function ProfileBadge() {
  const firstName = useAuthStore((state) => state.user?.firstName);

  return <div>{firstName}</div>;
}

// ✅ BETTER: Use shallow equality for object subscriptions
import { shallow } from 'zustand/shallow';

function ProfileCard() {
  const { firstName, lastName, email } = useAuthStore(
    (state) => ({
      firstName: state.user?.firstName,
      lastName: state.user?.lastName,
      email: state.user?.email,
    }),
    shallow // Only re-render if any of these values change
  );

  return (
    <div>
      <h2>{firstName} {lastName}</h2>
      <p>{email}</p>
    </div>
  );
}
```

### SWR Caching Strategy

```typescript
// Global SWR configuration
import { SWRConfig } from 'swr';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        revalidateOnFocus: false, // Don't refetch on window focus
        revalidateOnReconnect: true, // Refetch on network reconnect
        shouldRetryOnError: true, // Retry on error
        errorRetryCount: 3, // Max 3 retries
        errorRetryInterval: 5000, // 5 seconds between retries
        dedupingInterval: 2000, // Dedupe requests within 2 seconds
        focusThrottleInterval: 5000, // Throttle focus revalidation
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

---

## Testing Strategy

```typescript
// stores/__tests__/authStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('should login user', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.login(
        { id: '1', email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'patient' },
        'token123'
      );
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@example.com');
  });

  it('should logout user', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.login(mockUser, 'token');
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should persist user to localStorage', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.login(mockUser, 'token');
    });

    const stored = localStorage.getItem('auth-storage');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).state.user.email).toBe('test@example.com');
  });
});
```

---

## Consequences

### Positive

- ✅ **Small Bundle**: Zustand (8KB) + SWR (4KB) = 12KB total (vs Redux 47KB)
- ✅ **Performance**: Fine-grained subscriptions minimize re-renders
- ✅ **Developer Experience**: Simple API, minimal boilerplate
- ✅ **TypeScript**: Full type safety and inference
- ✅ **DevTools**: Redux DevTools integration for debugging
- ✅ **Persistence**: Easy localStorage integration
- ✅ **Server Sync**: SWR handles caching and revalidation automatically

### Negative

- ⚠️ **Less Structured**: Zustand provides minimal structure (mitigated by conventions)
- ⚠️ **Less Middleware**: Fewer middleware options compared to Redux
- ⚠️ **Learning Curve**: Team needs to learn new tools (mitigated by simple API)

### Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **State Structure Divergence** | Medium | Medium | - Establish clear store organization conventions<br>- Code review for state management patterns |
| **Over-fetching with SWR** | Low | Low | - Use SWR's dedupingInterval<br>- Implement request batching for related data |
| **LocalStorage Limits** | Low | Medium | - Monitor storage usage<br>- Implement storage quota checks<br>- Clear old data periodically |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Bundle Size** | < 50KB total state management | Webpack bundle analyzer |
| **Re-render Count** | < 5 re-renders per user action | React DevTools profiler |
| **State Update Latency** | < 16ms (1 frame) | Performance.now() measurements |
| **Cache Hit Rate** | > 80% for API requests | SWR stats tracking |
| **Time to Interactive** | < 3 seconds | Lighthouse metrics |

---

## References

- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [SWR Documentation](https://swr.vercel.app/)
- [React Hook Form](https://react-hook-form.com/)
- [You Might Not Need Redux](https://medium.com/@dan_abramov/you-might-not-need-redux-be46360cf367)

---

## Approval

| Role | Name | Decision | Date | Signature |
|------|------|----------|------|-----------|
| **Lead Architect** | [Name] | Approved | 2025-09-30 | ✓ |
| **Frontend Lead** | [Name] | Approved | 2025-09-30 | ✓ |
| **UX Lead** | [Name] | Approved | 2025-09-30 | ✓ |

---

**Next Steps:**
1. Set up Zustand stores (auth, onboarding, UI)
2. Configure SWR global settings
3. Create custom hooks for common API calls
4. Implement persistence for onboarding progress
5. Add Redux DevTools integration
6. Create testing utilities for stores
7. Document state management patterns for team
