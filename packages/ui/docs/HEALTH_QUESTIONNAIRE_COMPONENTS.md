# Health Questionnaire UI Components

## Overview

Phase 3 presentation-only UI components for the health questionnaire system, following ADR-003 purity principles with full WCAG 2.1 AA accessibility compliance.

## Components

### 1. DynamicFormRenderer

**Location**: `packages/ui/src/forms/DynamicFormRenderer.tsx`

**Purpose**: Renders dynamic form fields based on question configuration.

**ADR-003 Compliance**:
- ✅ Presentation-only (ZERO network calls)
- ✅ All data passed via props
- ✅ Uses callbacks for state changes
- ✅ No side effects

**Accessibility**:
- ✅ WCAG 2.1 AA compliant
- ✅ Full keyboard navigation
- ✅ ARIA labels and descriptions
- ✅ Error announcements
- ✅ Required field indicators

**Supported Question Types**:
- `text` - Single-line text input
- `number` - Numeric input with validation
- `textarea` - Multi-line text input
- `select` - Dropdown selection
- `radio` - Radio button group
- `checkbox` - Checkbox input
- `scale` - PHQ-9/GAD-7 standardized 0-3 scale

**Usage**:
```typescript
import { DynamicFormRenderer } from '@onboarding/ui/forms';

<DynamicFormRenderer
  questions={questions}
  values={formValues}
  errors={validationErrors}
  onChange={(questionId, value) => setFormValue(questionId, value)}
  onBlur={(questionId) => validateField(questionId)}
/>
```

### 2. QuestionnaireProgress

**Location**: `packages/ui/src/forms/QuestionnaireProgress.tsx`

**Purpose**: Visual progress indicator for multi-step questionnaires.

**Features**:
- Current step display (e.g., "Step 2 of 5")
- Percentage completion
- Visual progress bar
- Optional step labels
- Live region updates for screen readers

**Accessibility**:
- ✅ ARIA progressbar role
- ✅ Live region announcements
- ✅ Semantic step navigation

**Usage**:
```typescript
import { QuestionnaireProgress } from '@onboarding/ui/forms';

<QuestionnaireProgress
  currentStep={1}
  totalSteps={5}
  completionPercentage={20}
  stepLabels={['Demographics', 'Health', 'Mental Health', 'Lifestyle', 'Review']}
/>
```

### 3. ErrorSummary

**Location**: `packages/ui/src/forms/ErrorSummary.tsx`

**Purpose**: Accessible error summary with focus management.

**Features**:
- Error count display
- Clickable error list
- Auto-focus on appearance
- Field focusing on click
- Smooth scrolling to errors

**Accessibility**:
- ✅ ARIA alert region
- ✅ Assertive live region
- ✅ Keyboard accessible links
- ✅ Auto-focus management

**Usage**:
```typescript
import { ErrorSummary } from '@onboarding/ui/forms';

<ErrorSummary
  errors={{
    firstName: 'First name is required',
    age: 'Age must be at least 18'
  }}
  onErrorClick={(fieldId) => console.log(`Focus ${fieldId}`)}
/>
```

### 4. SectionHeader

**Location**: `packages/ui/src/forms/SectionHeader.tsx`

**Purpose**: Semantic section headers for questionnaire sections.

**Features**:
- Title with optional icon
- Description text
- Proper heading hierarchy

**Accessibility**:
- ✅ Semantic HTML structure
- ✅ Heading levels for screen readers

**Usage**:
```typescript
import { SectionHeader } from '@onboarding/ui/forms';

<SectionHeader
  title="Mental Health Assessment"
  description="Please answer the following questions about your mental well-being"
  icon={<HeartIcon />}
/>
```

## Accessible Form Primitives

### FormField

Wrapper component providing:
- Label association
- Error display
- Help text
- Required indicators
- ARIA attributes

### Input, Textarea, Select

Basic form inputs with:
- Consistent styling
- Error states
- Focus management
- Keyboard support

### RadioGroup

Accessible radio button group with:
- ARIA radiogroup role
- Keyboard navigation
- Visual hover states

### Checkbox

Accessible checkbox with:
- Optional label integration
- Focus indicators
- Error states

## Testing

### Accessibility Tests

**Location**: `packages/ui/tests/forms/DynamicFormRenderer.a11y.test.tsx`

**Coverage**:
- ✅ axe-core violations check
- ✅ ARIA attribute validation
- ✅ Label associations
- ✅ Required field indicators
- ✅ Error state handling
- ✅ Keyboard navigation

**Run Tests**:
```bash
cd packages/ui
npm test -- DynamicFormRenderer.a11y.test
```

### Component Tests

**Files**:
- `ErrorSummary.test.tsx` - Error display and focus management
- `QuestionnaireProgress.test.tsx` - Progress indication and ARIA

**Run All Tests**:
```bash
cd packages/ui
npm test
```

## Installation

```bash
cd packages/ui
npm install
```

**Dependencies**:
- `clsx` - Conditional class names
- `tailwind-merge` - Tailwind class merging
- `react` (peer) - React 18+
- `react-dom` (peer) - React DOM 18+

**Dev Dependencies**:
- `@axe-core/react` - Accessibility testing
- `@testing-library/react` - Component testing
- `jest-axe` - Jest accessibility matchers

## Architecture Decisions

### ADR-003: Pure Presentation Components

**Rationale**: Health questionnaire UI components must be:
1. **Side-effect free**: No network calls, no storage access
2. **Prop-driven**: All data via props, changes via callbacks
3. **Testable**: Pure functions are easy to test
4. **Reusable**: Can be used in any context without dependencies

**Benefits**:
- Easier to test (no mocking required)
- Better performance (predictable rendering)
- Improved maintainability
- Clear separation of concerns

### WCAG 2.1 AA Compliance

**Requirements Met**:
- ✅ 1.3.1 Info and Relationships (Level A)
- ✅ 1.4.3 Contrast (Minimum) (Level AA)
- ✅ 2.1.1 Keyboard (Level A)
- ✅ 2.4.3 Focus Order (Level A)
- ✅ 2.4.6 Headings and Labels (Level AA)
- ✅ 3.2.2 On Input (Level A)
- ✅ 3.3.1 Error Identification (Level A)
- ✅ 3.3.2 Labels or Instructions (Level A)
- ✅ 4.1.2 Name, Role, Value (Level A)
- ✅ 4.1.3 Status Messages (Level AA)

## Integration Example

```typescript
import {
  DynamicFormRenderer,
  QuestionnaireProgress,
  ErrorSummary,
  SectionHeader,
  type Question
} from '@onboarding/ui/forms';

function HealthQuestionnaire() {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  const questions: Question[] = [
    {
      id: 'phq9_q1',
      type: 'scale',
      label: 'Little interest or pleasure in doing things?',
      required: true,
      ariaLabel: 'Rate frequency: Little interest or pleasure in doing things'
    },
    // ... more questions
  ];

  return (
    <div>
      <QuestionnaireProgress
        currentStep={currentStep}
        totalSteps={5}
        completionPercentage={(currentStep / 5) * 100}
      />

      <SectionHeader
        title="PHQ-9 Assessment"
        description="Over the last 2 weeks, how often have you been bothered by any of the following problems?"
      />

      <ErrorSummary errors={errors} />

      <DynamicFormRenderer
        questions={questions}
        values={values}
        errors={errors}
        onChange={(id, value) => setValues(prev => ({ ...prev, [id]: value }))}
        onBlur={(id) => validateField(id)}
      />
    </div>
  );
}
```

## File Structure

```
packages/ui/
├── src/
│   ├── forms/
│   │   ├── DynamicFormRenderer.tsx    # Main form renderer
│   │   ├── QuestionnaireProgress.tsx  # Progress indicator
│   │   ├── ErrorSummary.tsx          # Error display
│   │   ├── SectionHeader.tsx         # Section headers
│   │   ├── types.ts                  # TypeScript types
│   │   └── index.ts                  # Barrel export
│   ├── form-accessible/
│   │   ├── FormField.tsx             # Field wrapper
│   │   ├── Input.tsx                 # Text input
│   │   ├── Textarea.tsx              # Multiline input
│   │   ├── Select.tsx                # Dropdown
│   │   ├── RadioGroup.tsx            # Radio buttons
│   │   ├── Checkbox.tsx              # Checkbox
│   │   └── index.ts                  # Barrel export
│   └── lib/
│       └── utils.ts                  # Utility functions
└── tests/
    └── forms/
        ├── DynamicFormRenderer.a11y.test.tsx  # Accessibility tests
        ├── ErrorSummary.test.tsx              # Error summary tests
        └── QuestionnaireProgress.test.tsx     # Progress tests
```

## Next Steps

### Phase 4: State Management Layer
- Create React Context for questionnaire state
- Implement validation logic
- Add submission handlers

### Phase 5: API Integration
- Connect to backend endpoints
- Handle loading states
- Error handling and retry logic

### Phase 6: Clinical Scoring
- PHQ-9 scoring algorithm
- GAD-7 scoring algorithm
- Risk assessment logic

## Support

For questions or issues, refer to:
- [ADR-003: Component Purity Guidelines](/docs/ADR-003-component-purity.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Docs](https://react.dev/learn/accessibility)

---

**Status**: ✅ Phase 3 Complete - All UI components implemented with full WCAG 2.1 AA compliance
