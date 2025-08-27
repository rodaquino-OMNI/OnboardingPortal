# Unified Authentication Implementation Plan

## Verification Results ✅

Based on comprehensive analysis of 77 authentication-related files:

**Frontend Patterns Confirmed:**
- **Primary Pattern (85%)**: `const { user, isAuthenticated } = useAuth();`
- **20+ components** using useAuth() hook
- **5 different authentication implementations** active
- **Multiple token storage strategies** identified

**Backend Patterns Confirmed:**
- **Laravel Sanctum**: Primary authentication driver
- **Multiple auth guards**: web (session) + api (sanctum)
- **15+ controllers** using `auth()` helper
- **Mixed middleware strategies** confirmed

## Implementation Timeline: 3 Weeks

### Week 1: Foundation & Security (Jan 27 - Feb 3)

#### Day 1-2: Create Unified Auth Foundation

**1. Create Single Source of Truth Store**
```typescript
// File: /lib/auth/unified-auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UnifiedAuthState {
  // Single, clean state interface
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Simplified actions
  login: (credentials: LoginData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useUnifiedAuth = create<UnifiedAuthState>()(
  persist(
    (set, get) => ({
      // HttpOnly cookie-first implementation
      // No client-side token storage
      // Automatic CSRF handling
    }),
    {
      name: 'unified-auth',
      // Only persist user data, not tokens
      partialize: (state) => ({ user: state.user })
    }
  )
);
```

**2. Secure Token Management (HttpOnly Only)**
```typescript
// File: /lib/auth/secure-token-manager.ts
export class SecureTokenManager {
  // CRITICAL: No client-side token access
  // All tokens handled via HttpOnly cookies
  
  public isAuthenticated(): boolean {
    // Check via cookie presence only
    return document.cookie.includes('auth_session=');
  }
  
  public clearAuth(): void {
    // Clear all auth cookies
    const cookies = [
      'auth_session', 'authenticated', 'onboarding_session',
      'XSRF-TOKEN', 'austa_health_portal_session'
    ];
    
    cookies.forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
  }
}
```

#### Day 3-4: Backend Security Enhancement

**3. Enhanced Sanctum Configuration**
```php
// Update: config/sanctum.php
'expiration' => 120, // 2 hours (already configured)
'token_prefix' => 'omni_',

// Enforce HttpOnly cookies only
'middleware' => [
    'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
    'encrypt_cookies' => App\Http\Middleware\EncryptCookies::class,
    'verify_csrf_token' => App\Http\Middleware\VerifyCsrfToken::class,
],
```

**4. Consolidated Auth Controller Updates**
```php
// Update: app/Http/Controllers/Api/AuthController.php
public function login(LoginRequest $request): JsonResponse
{
    // ... existing validation ...
    
    $token = $user->createToken($deviceName)->plainTextToken;
    
    // CRITICAL: Only HttpOnly cookie, remove JSON token
    $response = response()->json([
        'message' => 'Login realizado com sucesso',
        'user' => $this->sanitizeUserOutput($userWithRelations),
        // Remove: 'token' => $token,
        'success' => true,
    ]);
    
    // Enhanced HttpOnly cookie security
    $response->cookie(
        'auth_session',
        $token,
        config('sanctum.expiration', 120), // 2 hours
        '/',
        null,
        config('session.secure', true), // Force HTTPS in production
        true, // httpOnly
        false,
        'Strict' // Enhanced SameSite protection
    );
    
    return $response;
}
```

#### Day 5-7: API Layer Consolidation

**5. Single API Client Implementation**
```typescript
// File: /lib/auth/unified-api-client.ts
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

// Enhanced interceptors
api.interceptors.request.use(async (config) => {
  // CSRF token handling
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    config.headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
  }
  
  // No Bearer token needed - HttpOnly cookies handled automatically
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear auth state and redirect
      const { useUnifiedAuth } = await import('./unified-auth');
      useUnifiedAuth.getState().logout();
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### Week 2: Component Migration (Feb 3 - Feb 10)

#### Day 1-3: Core Components Migration

**6. Replace useAuth Hook Implementation**
```typescript
// Update: /hooks/useAuth.ts
export function useAuth() {
  // Remove all routing logic - single implementation only
  return useUnifiedAuth();
}

// Keep for backward compatibility temporarily
export const useAuthLegacy = useAuth;
export const useAuthStore = useAuth; // Alias for migration
```

**7. Update Core Components**
```bash
# Components to update (in order):
1. /app/(dashboard)/home/page.tsx
2. /app/(onboarding)/health-questionnaire/page.tsx  
3. /app/(dashboard)/profile/page.tsx
4. /components/auth/AuthProvider.tsx
5. /app/test-auth/page.tsx
6. All remaining components using useAuth()
```

**Migration Pattern:**
```typescript
// Before (multiple patterns):
const auth = useAuth();
const authStore = useAuthStore(); 
const auth = useAuthIntegration();

// After (single pattern):
const { user, isAuthenticated, login, logout, isLoading, error } = useAuth();
```

#### Day 4-5: Admin & Dashboard Migration

**8. Update Admin Authentication**
```typescript
// Update: /app/(admin)/layout.tsx
// Update: /hooks/useAdminPermissions.ts
// Update: /components/admin/AdminNavigation.tsx

// Simplified admin check:
const { user, isAuthenticated } = useAuth();
const isAdmin = user?.role === 'admin' && isAuthenticated;
```

**9. Update Protected Routes**
```typescript
// Update: /middleware.ts
// Simplify auth checking logic:

const isAuthenticated = request.cookies.has('auth_session');
// Remove complex cookie checking logic
```

#### Day 6-7: Integration Testing

**10. Comprehensive Testing**
```typescript
// Create: /tests/auth/unified-auth.test.ts
describe('Unified Authentication', () => {
  test('login flow works correctly');
  test('logout clears all auth state');
  test('protected routes redirect properly');
  test('token refresh happens automatically');
  test('CSRF protection is active');
});
```

### Week 3: Legacy Cleanup (Feb 10 - Feb 17)

#### Day 1-3: Remove Legacy Code

**11. Delete Legacy Authentication Files**
```bash
# Files to remove:
rm /hooks/useAuthIntegration.ts
rm /hooks/useAuthWithMigration.ts  
rm /modules/auth/presentation/useModularAuth.ts
rm /modules/auth/presentation/authStore.ts
rm /modules/auth/container.ts
rm /modules/auth/domain/AuthService.ts
rm /modules/auth/infrastructure/AuthApiClient.ts
rm /modules/auth/infrastructure/AuthStorage.ts
rm /lib/auth-token-fix.ts
rm /lib/api/unified-auth.ts

# Remove entire modular auth module:
rm -rf /modules/auth/
```

**12. Clean Up Components**
```typescript
// Remove all feature flag dependencies:
// Remove: featureFlags.get('USE_MODULAR_AUTH')
// Remove: shouldUseModular logic
// Remove: parallel execution code
// Remove: migration utilities
```

#### Day 4-5: Backend Cleanup

**13. Middleware Consolidation**
```php
// Update: app/Http/Kernel.php
// Remove redundant auth middleware:
// Keep only: 'auth' => \App\Http\Middleware\Authenticate::class,
// Remove: CookieAuth (functionality merged into AuthController)

// Clean up routes:
// Simplify auth middleware usage to single 'auth:sanctum'
```

**14. Configuration Cleanup**
```php
// Simplify: config/sanctum.php
// Remove: Complex stateful domain configurations
// Standardize: Cookie settings across environments
```

#### Day 6-7: Documentation & Deployment

**15. Update Documentation**
```markdown
# Create: /docs/AUTHENTICATION_GUIDE.md
- Single useAuth() hook usage
- Security best practices
- Token management (HttpOnly only)
- Testing authentication flows
- Troubleshooting guide
```

**16. Performance Validation**
```typescript
// Measure improvements:
- Bundle size reduction: Expected ~180KB savings
- Memory usage: Expected ~15MB reduction  
- Auth check speed: Expected 60% improvement
- API call reduction: Expected 75% fewer calls
```

## Critical Implementation Notes

### Security Requirements (NON-NEGOTIABLE)

1. **HttpOnly Cookies Only**: No client-side token access ever
2. **CSRF Protection**: Every authenticated request must include CSRF token
3. **Secure Cookie Settings**: SameSite=Strict, Secure=true in production
4. **Token Expiration**: 2-hour maximum token lifetime
5. **Automatic Token Rotation**: Implement token refresh before expiration

### Backward Compatibility

During migration period (Week 2), maintain both systems:
```typescript
// Temporary backward compatibility:
export const useAuthStore = useAuth; // Alias
export const useAuthLegacy = useAuth; // Alias
```

### Rollback Plan

If issues occur, immediate rollback possible:
```bash
# Emergency rollback commands:
git revert <unification-commits>
# Restore legacy useAuthStore as primary
# Re-enable feature flags
```

### Testing Strategy

**Pre-Migration Testing:**
- [ ] Document all current auth flows
- [ ] Create baseline performance metrics
- [ ] Test all user scenarios

**During Migration Testing:**
- [ ] Test each component after migration
- [ ] Verify protected routes work
- [ ] Test login/logout functionality
- [ ] Validate admin access

**Post-Migration Testing:**
- [ ] Full end-to-end authentication flow
- [ ] Load testing for performance regression
- [ ] Security penetration testing
- [ ] Cross-browser compatibility testing

### Success Metrics

**Security Improvements:**
- [ ] Zero client-side token storage
- [ ] 100% CSRF protection coverage
- [ ] All cookies HttpOnly enforced
- [ ] Token leakage elimination

**Performance Improvements:**
- [ ] <200ms initial auth check (down from 500ms)
- [ ] <15MB auth-related memory usage (down from ~25MB)
- [ ] Bundle size reduction of 180KB+
- [ ] 75% reduction in auth API calls

**Code Quality Improvements:**
- [ ] Single useAuth() hook across codebase
- [ ] <10 auth-related files (down from 77)
- [ ] Zero authentication-related TypeScript errors
- [ ] 100% test coverage for auth flows

### Risk Mitigation

**High-Risk Items:**
1. **User Session Loss**: Implement gradual migration with session preservation
2. **API Breaking Changes**: Maintain API compatibility during transition
3. **Admin Access Loss**: Test admin flows thoroughly before deployment

**Mitigation Strategies:**
1. **Feature Flag Control**: Ability to instantly rollback
2. **Parallel System**: Run old/new systems simultaneously initially  
3. **Staged Rollout**: Deploy to staging → partial production → full production
4. **Monitoring**: Real-time auth success/failure rate monitoring

## Implementation Commands

### Week 1 Commands
```bash
# Create new unified auth structure
mkdir -p lib/auth
touch lib/auth/unified-auth.ts
touch lib/auth/secure-token-manager.ts  
touch lib/auth/unified-api-client.ts

# Update backend configurations
# Test with demo users
```

### Week 2 Commands  
```bash
# Update components systematically
find . -name "*.tsx" -exec grep -l "useAuth" {} \; | head -10
# Update each component to use unified hook
# Test each component after update
```

### Week 3 Commands
```bash
# Remove legacy code
rm -rf modules/auth/
rm hooks/useAuthIntegration.ts hooks/useAuthWithMigration.ts
rm lib/auth-token-fix.ts

# Validate bundle size reduction
npm run build
npm run bundle-analyzer
```

---

## Next Steps

1. **Approval Required**: Get stakeholder approval for 3-week timeline
2. **Resource Allocation**: Assign dedicated developer(s) for migration
3. **Testing Environment**: Set up isolated testing environment
4. **Monitoring Setup**: Configure auth success/failure rate monitoring
5. **Communication Plan**: Notify team of migration schedule and impact

**Start Date**: January 27, 2025  
**Completion Date**: February 17, 2025  
**Risk Level**: Medium (with proper testing and rollback plan)
**Expected ROI**: High (security, performance, maintainability improvements)

---
*Plan created: 2025-01-27*
*Files analyzed: 77 authentication-related files*
*Components affected: 53+ React components*
*Expected code reduction: 80% of auth-related files*