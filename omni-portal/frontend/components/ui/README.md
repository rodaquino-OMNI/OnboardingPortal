# Healthcare Portal UI Components

This directory contains reusable UI components for the healthcare onboarding portal, built with React, TypeScript, and Tailwind CSS. All components follow WCAG 2.1 AA accessibility standards.

## Design System

### Colors
- **Primary**: `#2563eb` (Blue 600)
- **Secondary**: `#7c3aed` (Purple 600)
- **Success**: `#10b981` (Green 500)
- **Warning**: `#f59e0b` (Yellow 500)
- **Error**: `#ef4444` (Red 500)

### Typography
- **Font Family**: Inter
- **Spacing**: 8-point grid system

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`

## Components

### Button
Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui/button'

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="achievement">Achievement</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">🎯</Button>
```

### Card
Container component with header, content, and footer sections.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, ProgressCard } from '@/components/ui/card'

// Standard Card
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

// Progress Card
<ProgressCard progress={65}>
  <CardContent>Content with progress indicator</CardContent>
</ProgressCard>
```

### Input
Form input with built-in mask support for Brazilian formats.

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Basic input
<Input placeholder="Enter text..." />

// With masks
<Input mask="cpf" placeholder="000.000.000-00" />
<Input mask="phone" placeholder="(00) 00000-0000" />
<Input mask="date" placeholder="00/00/0000" />
<Input mask="cep" placeholder="00000-000" />

// With label
<Label htmlFor="name" required>
  Name
</Label>
<Input id="name" />
```

### Badge
Small labeling component for status and categorization.

```tsx
import { Badge } from '@/components/ui/badge'

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="achievement">Achievement</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
```

### Progress
Linear and circular progress indicators.

```tsx
import { Progress, CircularProgress } from '@/components/ui/progress'

// Linear progress
<Progress value={75} max={100} showLabel />

// Circular progress
<CircularProgress value={75} size={64} strokeWidth={4} showLabel />
```

### Alert
Contextual feedback messages with icons.

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

<Alert variant="success">
  <AlertTitle>Success!</AlertTitle>
  <AlertDescription>Operation completed successfully.</AlertDescription>
</Alert>
```

### Modal
Accessible modal dialog component.

```tsx
import { Modal, ModalTrigger, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal'

<Modal>
  <ModalTrigger asChild>
    <Button>Open Modal</Button>
  </ModalTrigger>
  <ModalContent>
    <ModalHeader>
      <ModalTitle>Title</ModalTitle>
      <ModalDescription>Description</ModalDescription>
    </ModalHeader>
    <div>Content</div>
    <ModalFooter>
      <Button>Action</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Skeleton
Loading placeholder component.

```tsx
import { Skeleton } from '@/components/ui/skeleton'

<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-4 w-full" />
<Skeleton className="h-10 w-[100px]" />
```

## Accessibility Features

- All interactive components have proper focus management
- Color contrast ratios meet WCAG AA standards
- Components include proper ARIA labels and roles
- Keyboard navigation support throughout
- Screen reader optimized
- Required fields are clearly marked
- Error states are announced to assistive technologies

## Integration with React Hook Form

All form components are compatible with React Hook Form:

```tsx
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const { register } = useForm()

<div>
  <Label htmlFor="cpf" required>CPF</Label>
  <Input 
    id="cpf"
    mask="cpf"
    {...register('cpf', { required: true })}
  />
</div>
```

## Demo

View all components in action by importing the demo:

```tsx
import { UIComponentsDemo } from '@/components/ui/demo'

function App() {
  return <UIComponentsDemo />
}
```