# Infinite Reload Loop Fix for /home

## Root Cause Analysis

The infinite reload loop at http://localhost:3000/home is caused by multiple interconnected issues:

### 1. **Cookie Domain Mismatch**
- Backend sets cookie with `domain=localhost` 
- Frontend middleware checks for `auth_token` cookie
- Cookie is set but not accessible due to domain/path issues

### 2. **API URL Misconfiguration**
- Frontend container tries to reach backend at `localhost:8000`
- From inside Docker container, `localhost` doesn't reach the backend
- Should use `austa_nginx` or `austa_backend_fixed:9000`

### 3. **Authentication State Desync**
- Middleware redirects to `/login` when no auth cookie found
- Login page redirects to `/home` when authenticated
- Dashboard layout also redirects to `/login` when not authenticated
- Creates loop: `/home` → `/login` → `/home` → `/login`

### 4. **Multiple Redirect Sources**
- middleware.ts (line 105): Redirects to login
- DashboardLayout (line 60): Redirects to login  
- OptimizedLoginForm (line 31): Redirects to home
- API interceptor (line 90): Redirects to login

## Technical Excellence Fix

### Step 1: Fix Backend Cookie Settings

Edit `/omni-portal/backend/app/Http/Controllers/Api/AuthController.php`:

```php
// Line 108-118 - Fix cookie settings
$response->cookie(
    'auth_token',
    $token,
    config('sanctum.expiration', 525600),
    '/',
    null, // Remove domain restriction
    false, // Not secure for localhost
    true, // httpOnly
    false, // raw
    'lax' // SameSite
);
```

### Step 2: Fix Frontend Middleware

Edit `/omni-portal/frontend/middleware.ts`:

```typescript
// Line 30-37 - Simplify auth check
const authToken = request.cookies.get('auth_token');
const isAuthenticated = !!authToken?.value;

// Line 90-106 - Fix redirect logic
if (isProtectedRoute && !isAuthenticated) {
  // Prevent infinite loops
  const from = request.headers.get('referer');
  if (from?.includes('/login')) {
    return NextResponse.next();
  }
  
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}
```

### Step 3: Fix Dashboard Layout

Edit `/omni-portal/frontend/app/(dashboard)/layout.tsx`:

```typescript
// Remove redundant auth check that causes loops
// Lines 54-62 should be removed
// Keep only the cookie monitoring, not the redirect
```

### Step 4: Fix API Configuration

Edit `/omni-portal/frontend/lib/api-config.ts`:

```typescript
export function getApiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: Use Docker service name
    return 'http://austa_backend_fixed:9000';
  }
  // Client-side: Use public URL
  return 'http://localhost:8000/api';
}
```

### Step 5: Environment Variables

Create `/omni-portal/frontend/.env.production`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
API_URL=http://austa_backend_fixed:9000
BACKEND_URL=http://austa_backend_fixed:9000
```

## Implementation Commands

```bash
# 1. Fix backend cookie
docker exec austa_backend_fixed sed -i "s/'localhost'/null/g" app/Http/Controllers/Api/AuthController.php
docker exec austa_backend_fixed sed -i "s/config('session.secure', false)/false/g" app/Http/Controllers/Api/AuthController.php

# 2. Restart backend
docker restart austa_backend_fixed

# 3. Clear frontend cache
docker exec austa_frontend_fixed rm -rf .next

# 4. Rebuild frontend
docker exec austa_frontend_fixed npm run build

# 5. Test login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  -c cookies.txt

# 6. Test /home with cookie
curl http://localhost:3000/home -b cookies.txt -v
```

## Verification

After applying fixes:

1. Login at http://localhost:3000/login
2. Should redirect to /home without loops
3. Check browser DevTools:
   - Network tab: No repeated redirects
   - Application > Cookies: `auth_token` present
   - Console: No infinite loop errors

## Success Criteria

✅ Single redirect from login to /home
✅ No redirect loops
✅ API calls succeed (no 500 errors)
✅ Authentication state persists
✅ Page loads completely