# Omni Portal Frontend - Development Features

## Mobile Optimization

### Responsive Design
- Mobile-first approach with Tailwind CSS breakpoints
- Touch-optimized UI components with 44px minimum touch targets
- Viewport management hook for responsive behavior
- Mobile navigation with slide-out drawer and bottom tab bar

### Touch Gestures
- Swipe gestures for navigation drawer
- Touch-friendly form controls
- Optimized scrolling performance

### Performance
- PWA support with offline capabilities
- Optimized images with Next.js Image component
- Lazy loading for heavy components

## Accessibility (WCAG 2.1 Compliance)

### Keyboard Navigation
- Skip links for main content, navigation, and footer
- Proper focus management and visual indicators
- Keyboard trap prevention in modals
- Tab order optimization

### Screen Reader Support
- Semantic HTML structure
- ARIA labels and descriptions
- Live regions for dynamic content
- Proper heading hierarchy

### Visual Accessibility
- AA compliant color contrast ratios
- Focus visible indicators
- Support for prefers-reduced-motion
- Responsive text sizing

### Form Accessibility
- Associated labels with form controls
- Error messages linked via aria-describedby
- Required field indicators
- Inline validation feedback

## Testing Suite

### Unit Tests (Jest + React Testing Library)
```bash
npm run test          # Watch mode
npm run test:ci       # CI mode with coverage
```

### E2E Tests (Playwright)
```bash
npm run test:e2e      # Run all E2E tests
npm run test:e2e:ui   # Run with UI mode
```

### Accessibility Tests (Pa11y)
```bash
npm run test:a11y     # Run accessibility tests
```

### Performance Tests (Lighthouse)
- Automated in CI/CD pipeline
- Targets: Performance > 80%, Accessibility > 90%

## CI/CD Pipeline

### GitHub Actions Workflow
- Triggered on push to main/develop and PRs
- Parallel job execution for efficiency

### Pipeline Stages
1. **Code Quality**
   - ESLint
   - TypeScript type checking
   - Prettier formatting

2. **Testing**
   - Unit tests with coverage
   - E2E tests on multiple browsers
   - Accessibility compliance
   - Performance benchmarks

3. **Build & Deploy**
   - Production build
   - Artifact storage
   - Preview deployments for PRs

## Component Library

### Accessible Components
- `Button` - Fully accessible with loading states
- `FormField` - Wrapper for accessible form controls
- `Input`, `Textarea`, `Select` - ARIA-compliant form inputs
- `Checkbox`, `RadioGroup` - Accessible selection controls
- `SkipLinks` - Keyboard navigation shortcuts
- `MobileNavigation` - Touch-optimized navigation

### Utility Hooks
- `useViewport()` - Responsive viewport information
- `useTouchGestures()` - Touch gesture detection
- `useAuth()` - Authentication state management
- `useGamification()` - Gamification features

### Utility Functions
- `a11y` - Accessibility helpers and styles
- `keyboard` - Keyboard event handlers
- `announce()` - Screen reader announcements
- `prefersReducedMotion()` - Motion preference detection

## Development Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Start production server

# Code Quality
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run type-check    # TypeScript checking
npm run format        # Format with Prettier

# Testing
npm run test          # Unit tests (watch)
npm run test:ci       # Unit tests (CI)
npm run test:e2e      # E2E tests
npm run test:a11y     # Accessibility tests

# Analysis
npm run analyze       # Bundle analysis
```

## Environment Variables

Create `.env.local` for local development:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile Safari (iOS 12+)
- Chrome Mobile (Android 7+)

## Performance Targets

- First Contentful Paint: < 2s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Total Blocking Time: < 300ms
- Lighthouse Score: > 80%

## Accessibility Compliance

- WCAG 2.1 Level AA
- Section 508
- ADA Compliance
- ARIA 1.2 Patterns