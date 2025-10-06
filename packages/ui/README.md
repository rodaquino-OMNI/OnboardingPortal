# @onboarding/ui

Pure presentation UI components following ADR-003 strict boundaries.

## Architecture Compliance

All components in this package are **PURE PRESENTATION** components:

✅ **ALLOWED:**
- Receive data via props
- Emit callbacks for parent orchestration
- Client-side validation (UX hints only)
- Local component state (form fields, UI state)
- CSS animations and styling

❌ **FORBIDDEN:**
- Network calls (fetch/axios)
- Storage access (localStorage/sessionStorage/IndexedDB)
- Orchestration logic (business rules)
- Imports from @/hooks, @/services, @/lib

## Components

### RegistrationForm
Email/password registration form with client-side validation.

```tsx
import { RegistrationForm } from '@onboarding/ui';

<RegistrationForm
  onSubmit={(data) => console.log(data)}
  isLoading={false}
  errors={{}}
/>
```

### MinimalProfileForm
Profile completion form with CPF/phone formatting.

```tsx
import { MinimalProfileForm } from '@onboarding/ui';

<MinimalProfileForm
  initialEmail="user@example.com"
  onSubmit={(data) => console.log(data)}
  isLoading={false}
  errors={{}}
/>
```

### CompletionMessage
Success message with confetti animation.

```tsx
import { CompletionMessage } from '@onboarding/ui';

<CompletionMessage
  userName="João"
  pointsEarned={300}
  dashboardUrl="/dashboard"
/>
```

## Validation

Run security guards to verify component purity:

```bash
npm run lint
npm run typecheck
```

ESLint rules enforce:
- No imports from hooks/services/lib
- No network calls
- No storage access
