# Technical Fix Plan - OnboardingPortal Stabilization

## Phase 1: Immediate Critical Fixes (Week 1)

### 1.1 Fix Webpack Chunk Splitting Issues

#### Problem
- Files split into too many small chunks causing 404 errors
- Service worker caching stale chunk references
- Unstable chunk names between builds

#### Step-by-Step Solution

**Step 1: Update Webpack Configuration**
```javascript
// next.config.mjs - Update lines 59-92
if (!isServer) {
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      minSize: 50000,      // 50KB minimum (was 20KB)
      maxSize: 2000000,    // 2MB maximum (was 244KB)
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      cacheGroups: {
        // Stable vendor chunks
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 20,
          reuseExistingChunk: true,
        },
        nextjs: {
          test: /[\\/]node_modules[\\/](next|@next)[\\/]/,
          name: 'nextjs-vendor',
          priority: 19,
          reuseExistingChunk: true,
        },
        ui: {
          test: /[\\/]node_modules[\\/](@radix-ui|@heroicons|lucide-react|framer-motion)[\\/]/,
          name: 'ui-vendor',
          priority: 18,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: 10,
          reuseExistingChunk: true,
          enforce: true,
          name(module, chunks, cacheGroupKey) {
            return `${cacheGroupKey}-common`;
          },
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
    moduleIds: 'deterministic', // Stable module IDs
    chunkIds: 'deterministic',  // Stable chunk IDs
  };
}
```

**Step 2: Create Build Validation Script**
```javascript
// scripts/validate-build.js
const fs = require('fs');
const path = require('path');

function validateBuild() {
  const buildDir = path.join(__dirname, '../.next');
  const manifestPath = path.join(buildDir, 'build-manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Build manifest not found');
    process.exit(1);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const chunks = new Set();
  
  // Collect all chunks
  Object.values(manifest.pages).forEach(page => {
    page.forEach(chunk => chunks.add(chunk));
  });
  
  // Verify each chunk exists
  let missingChunks = 0;
  chunks.forEach(chunk => {
    const chunkPath = path.join(buildDir, chunk);
    if (!fs.existsSync(chunkPath)) {
      console.error(`❌ Missing chunk: ${chunk}`);
      missingChunks++;
    }
  });
  
  if (missingChunks > 0) {
    console.error(`\n❌ Build validation failed: ${missingChunks} missing chunks`);
    process.exit(1);
  }
  
  console.log(`✅ Build validated: ${chunks.size} chunks verified`);
}

validateBuild();
```

**Step 3: Update Package Scripts**
```json
// package.json
{
  "scripts": {
    "build": "npm run clean:build && next build && npm run validate:build",
    "clean:build": "rm -rf .next .next-*.log",
    "validate:build": "node scripts/validate-build.js"
  }
}
```

### 1.2 Remove PWA/Service Worker Completely

#### Step-by-Step Removal

**Step 1: Remove PWA Dependencies**
```bash
npm uninstall @ducanh2912/next-pwa
```

**Step 2: Update next.config.mjs**
```javascript
// next.config.mjs - Remove all PWA code
import { withSentryConfig } from '@sentry/nextjs'; // If using Sentry

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config without PWA
};

// Remove withPWA wrapper, export directly
export default nextConfig;
```

**Step 3: Remove Service Worker Files**
```bash
# Create cleanup script
cat > scripts/remove-pwa.sh << 'EOF'
#!/bin/bash
echo "🧹 Removing PWA/Service Worker files..."

# Remove public service worker files
rm -f public/sw.js
rm -f public/sw.js.map
rm -f public/workbox-*.js
rm -f public/workbox-*.js.map
rm -f public/manifest.json

# Remove PWA meta tags (manually check)
echo "⚠️  Check and remove PWA meta tags from:"
echo "   - app/layout.tsx"
echo "   - Any custom document files"

echo "✅ PWA removal complete"
EOF

chmod +x scripts/remove-pwa.sh
./scripts/remove-pwa.sh
```

**Step 4: Update Layout to Remove PWA References**
```typescript
// app/layout.tsx - Remove these lines
export const metadata: Metadata = {
  title: "Omni Portal - Employee Onboarding",
  description: "Your onboarding journey starts here",
  // REMOVE: manifest: "/manifest.json",
  // REMOVE: appleWebApp: { ... }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // REMOVE: themeColor: "#0080FF",
};
```

**Step 5: Create Service Worker Unregistration Script**
```javascript
// public/unregister-sw.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function(success) {
        console.log('SW unregistered:', success);
      });
    }
  });
  
  // Clear all caches
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
  });
}
```

**Step 6: Add Unregistration to App**
```typescript
// components/ServiceWorkerCleanup.tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerCleanup() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/unregister-sw.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  return null;
}

// Add to app/layout.tsx
<body>
  <ServiceWorkerCleanup />
  {/* rest of layout */}
</body>
```

### 1.3 Fix Development Environment Cache Issues

**Step 1: Enhanced Clean Script**
```bash
# scripts/deep-clean.sh
#!/bin/bash

echo "🚀 Deep Clean - OnboardingPortal"
echo "================================"

# Kill all Node processes
echo "1️⃣ Killing Node processes..."
pkill -f "node" || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Remove all caches
echo "2️⃣ Removing all caches..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .eslintcache
rm -rf .next-*.log
rm -rf tsconfig.tsbuildinfo

# Clean package manager caches
echo "3️⃣ Cleaning package manager..."
npm cache clean --force

# Remove lock file issues
echo "4️⃣ Refreshing dependencies..."
rm -f package-lock.json
npm install

# Browser cache reminder
echo "
⚠️  IMPORTANT: Clear browser data:
   
   Chrome/Edge:
   1. Open DevTools (F12)
   2. Application tab → Storage
   3. Click 'Clear site data'
   
   Firefox:
   1. Open DevTools (F12)
   2. Storage tab
   3. Right-click → Clear All

✅ Deep clean complete!
"
```

**Step 2: Development Environment Variables**
```bash
# .env.development
# Disable all caching in development
NEXT_TELEMETRY_DISABLED=1
NEXT_DISABLE_SWC_WASM_FALLBACK=1

# Force fresh builds
NEXT_PRIVATE_MINIMIZE=false
NEXT_PRIVATE_TEST_PROXY=false
```

**Step 3: Update Development Scripts**
```json
// package.json
{
  "scripts": {
    "dev": "npm run clean:dev && NODE_OPTIONS='--max-old-space-size=4096' next dev",
    "dev:fresh": "npm run deep-clean && npm run dev",
    "clean:dev": "rm -rf .next .eslintcache",
    "deep-clean": "./scripts/deep-clean.sh"
  }
}
```

## Phase 2: Code Quality & Stability (Week 2)

### 2.1 Fix React Hook Violations

**Step 1: Create ESLint Rule**
```javascript
// .eslintrc.js - Add to rules
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-conditional-hooks": ["error", {
      "enforceForJSX": true
    }]
  }
}
```

**Step 2: Create Hook Validation Script**
```javascript
// scripts/validate-hooks.js
const { ESLint } = require('eslint');

async function validateHooks() {
  const eslint = new ESLint({
    overrideConfig: {
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error'
      }
    }
  });
  
  const results = await eslint.lintFiles([
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}'
  ]);
  
  const formatter = await eslint.loadFormatter('stylish');
  const resultText = formatter.format(results);
  
  if (results.some(r => r.errorCount > 0)) {
    console.error(resultText);
    process.exit(1);
  }
  
  console.log('✅ All hooks follow React rules');
}

validateHooks().catch(console.error);
```

**Step 3: Fix Common Hook Violations**
```typescript
// Example: Fix conditional hook usage
// ❌ WRONG
function Component({ condition }) {
  if (condition) {
    const [state, setState] = useState(0); // Hook in condition!
    return <div>{state}</div>;
  }
  return null;
}

// ✅ CORRECT
function Component({ condition }) {
  const [state, setState] = useState(0); // Always call hook
  
  if (!condition) {
    return null;
  }
  
  return <div>{state}</div>;
}
```

### 2.2 Optimize Bundle Size

**Step 1: Analyze Bundle**
```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Update next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);

# Run analysis
ANALYZE=true npm run build
```

**Step 2: Implement Code Splitting**
```typescript
// components/lazy/index.ts
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component
const Loading = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
  </div>
);

// Lazy load heavy components
export const LazyHealthQuestionnaire = dynamic(
  () => import('@/components/health/UnifiedHealthQuestionnaire'),
  { 
    loading: () => <Loading />,
    ssr: false 
  }
);

export const LazyDocumentUpload = dynamic(
  () => import('@/components/upload/EnhancedDocumentUpload'),
  { 
    loading: () => <Loading />,
    ssr: false 
  }
);

// Usage
import { LazyHealthQuestionnaire } from '@/components/lazy';

function Page() {
  return <LazyHealthQuestionnaire />;
}
```

**Step 3: Optimize Imports**
```typescript
// ❌ WRONG - Imports entire library
import * as Icons from 'lucide-react';

// ✅ CORRECT - Tree-shakeable
import { User, Lock, Eye } from 'lucide-react';

// For dynamic icons
const iconMap = {
  user: User,
  lock: Lock,
  eye: Eye
} as const;

function DynamicIcon({ name }: { name: keyof typeof iconMap }) {
  const Icon = iconMap[name];
  return <Icon className="w-4 h-4" />;
}
```

### 2.3 Implement Proper Error Boundaries

**Step 1: Create Global Error Boundary**
```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Report to Sentry
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Algo deu errado
            </h1>
            <p className="text-gray-600 mb-4">
              Ocorreu um erro inesperado. Por favor, recarregue a página.
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
```

**Step 2: Wrap App with Error Boundary**
```typescript
// app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

## Phase 3: Performance Optimization (Week 3)

### 3.1 Implement Proper Caching Strategy

**Step 1: API Route Caching**
```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

// For Next.js 14 (current)
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };
  
  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
    },
  });
}

// For Next.js 15 (future)
export const dynamic = 'force-static';
export const revalidate = 60; // Revalidate every 60 seconds
```

**Step 2: Fetch Wrapper with Caching**
```typescript
// lib/fetch-wrapper.ts
interface FetchOptions extends RequestInit {
  revalidate?: number | false;
  tags?: string[];
}

export async function fetchWithCache(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { revalidate = 3600, tags = [], ...fetchOptions } = options;
  
  // For Next.js 14
  const cacheOptions: RequestInit = {
    ...fetchOptions,
    next: {
      revalidate,
      tags,
    },
  };
  
  // For Next.js 15 preparation
  if (!fetchOptions.cache) {
    cacheOptions.cache = revalidate === false ? 'no-store' : 'force-cache';
  }
  
  try {
    const response = await fetch(url, cacheOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Usage
const data = await fetchWithCache('/api/data', {
  revalidate: 60, // Cache for 60 seconds
  tags: ['user-data'],
});
```

### 3.2 Optimize Images and Assets

**Step 1: Image Component Wrapper**
```typescript
// components/OptimizedImage.tsx
import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
}: OptimizedImageProps) {
  const [isLoading, setLoading] = useState(true);
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`
          duration-700 ease-in-out
          ${isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'}
        `}
        onLoadingComplete={() => setLoading(false)}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}
```

**Step 2: Font Optimization**
```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});
```

### 3.3 Implement Performance Monitoring

**Step 1: Web Vitals Tracking**
```typescript
// app/components/WebVitals.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(metric);
    }
    
    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        label: metric.label,
        id: metric.id,
      });
      
      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics', body);
      } else {
        fetch('/api/analytics', {
          body,
          method: 'POST',
          keepalive: true,
        });
      }
    }
  });
  
  return null;
}
```

**Step 2: Performance Budget**
```javascript
// scripts/check-performance.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function checkPerformance() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };
  
  const runnerResult = await lighthouse('http://localhost:3000', options);
  
  await chrome.kill();
  
  const performance = runnerResult.lhr.categories.performance.score * 100;
  
  // Performance budget
  const budget = {
    performance: 90,
    firstContentfulPaint: 1.8,
    largestContentfulPaint: 2.5,
    timeToInteractive: 3.8,
    cumulativeLayoutShift: 0.1,
  };
  
  console.log(`Performance Score: ${performance}`);
  
  if (performance < budget.performance) {
    console.error(`❌ Performance score ${performance} is below budget ${budget.performance}`);
    process.exit(1);
  }
  
  console.log('✅ Performance budget passed!');
}

checkPerformance().catch(console.error);
```

## Phase 4: Testing & Quality Assurance (Week 4)

### 4.1 Comprehensive Test Suite

**Step 1: Unit Test Template**
```typescript
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('can be disabled', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

**Step 2: Integration Test Example**
```typescript
// __tests__/integration/auth-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/LoginForm';
import { mockServer } from '@/test/mocks/server';
import { rest } from 'msw';

describe('Authentication Flow', () => {
  it('successful login redirects to dashboard', async () => {
    const user = userEvent.setup();
    
    // Mock successful login
    mockServer.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(
          ctx.json({
            success: true,
            token: 'fake-token',
            user: { id: 1, name: 'Test User' },
          })
        );
      })
    );
    
    render(<LoginForm />);
    
    // Fill form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    // Wait for redirect
    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
```

### 4.2 E2E Testing Strategy

**Step 1: Critical Path E2E Tests**
```typescript
// e2e/critical-paths/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding Critical Path', () => {
  test('complete onboarding flow', async ({ page }) => {
    // 1. Registration
    await page.goto('/register');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button:has-text("Register")');
    
    // 2. Profile completion
    await expect(page).toHaveURL('/onboarding/profile');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.click('button:has-text("Continue")');
    
    // 3. Document upload
    await expect(page).toHaveURL('/onboarding/documents');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-assets/sample-doc.pdf');
    await page.click('button:has-text("Continue")');
    
    // 4. Health questionnaire
    await expect(page).toHaveURL('/onboarding/health');
    // Fill questionnaire...
    
    // 5. Completion
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });
});
```

## Phase 5: Deployment & Monitoring (Week 5)

### 5.1 Production Build Optimization

**Step 1: Production Configuration**
```javascript
// next.config.mjs - Production optimizations
const nextConfig = {
  // ... existing config
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'date-fns',
    ],
  },
  
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],
};
```

**Step 2: Build Pipeline**
```yaml
# .github/workflows/production.yml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run quality checks
        run: |
          npm run lint
          npm run typecheck
          npm run test:ci
      
      - name: Check bundle size
        run: npm run build
        
      - name: Validate build
        run: npm run validate:build

  deploy:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Your deployment script
```

### 5.2 Monitoring Setup

**Step 1: Application Monitoring**
```typescript
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

export function initMonitoring() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        return event;
      },
    });
  }
}

// Custom error tracking
export function trackError(error: Error, context?: Record<string, any>) {
  console.error('Application error:', error);
  
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

// Performance tracking
export function trackPerformance(metric: string, value: number) {
  if (process.env.NODE_ENV === 'production') {
    // Send to analytics
    fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify({ metric, value }),
    });
  }
}
```

## Success Metrics

### Week 1 Goals
- [ ] Zero 404 errors in development
- [ ] Clean build without warnings
- [ ] No service worker conflicts

### Week 2 Goals
- [ ] All React hooks validated
- [ ] Bundle size < 500KB initial
- [ ] Zero console errors

### Week 3 Goals
- [ ] Lighthouse score > 90
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s

### Week 4 Goals
- [ ] Test coverage > 80%
- [ ] All E2E tests passing
- [ ] Zero accessibility issues

### Week 5 Goals
- [ ] Production deployment successful
- [ ] Monitoring active
- [ ] Performance budgets met

## Rollback Plan

If any phase fails:
1. Git revert to last stable commit
2. Redeploy previous version
3. Analyze failure logs
4. Create hotfix branch
5. Test thoroughly before retry

---

This plan provides a systematic approach to fixing all current issues while preparing for future Next.js 15 migration. Execute phases sequentially for best results.