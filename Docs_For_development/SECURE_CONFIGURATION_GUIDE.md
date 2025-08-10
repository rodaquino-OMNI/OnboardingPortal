# 🔒 Secure Configuration Guide

## Overview

This guide explains the secure configuration approach implemented to prevent sensitive environment variables from being exposed in client-side code.

## ⚠️ Security Issue Fixed

Previously, sensitive configuration like API keys, client IDs, and other secrets were exposed through `NEXT_PUBLIC_*` environment variables, making them accessible in the browser. This has been fixed by implementing a secure configuration service.

## ✅ New Secure Approach

### 1. Backend Configuration Service

All configuration is now served from the backend through two endpoints:

- **`GET /api/config/public`** - Returns non-sensitive configuration for all users
- **`GET /api/config/user`** - Returns user-specific configuration (requires authentication)

### 2. Frontend Configuration Service

The frontend now uses a `ConfigService` that:
- Fetches configuration from the backend
- Caches configuration to avoid multiple requests
- Provides fallback configuration for offline scenarios
- Never exposes sensitive data in the client bundle

### 3. Environment Variables

#### ❌ OLD (Insecure) Approach:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=sensitive-key-here
NEXT_PUBLIC_FACEBOOK_APP_ID=sensitive-key-here
NEXT_PUBLIC_API_KEY=sensitive-key-here
```

#### ✅ NEW (Secure) Approach:
```env
# Only non-sensitive base URL
NEXT_PUBLIC_API_URL=https://api.domain.com/api

# All sensitive config stored server-side only
GOOGLE_CLIENT_ID=sensitive-key-here  # Backend only
FACEBOOK_APP_ID=sensitive-key-here   # Backend only
API_KEY=sensitive-key-here           # Backend only
```

## 📋 Implementation Steps

### Backend Setup

1. **Store all sensitive configuration in backend `.env` file**
   - Remove `NEXT_PUBLIC_` prefix from sensitive variables
   - Keep them only in backend environment

2. **Use ConfigController to expose safe configuration**
   ```php
   // Only return what's safe for public consumption
   return [
       'features' => ['enabled' => true],
       'social_providers' => ['google', 'facebook'], // Just names, no keys
   ];
   ```

### Frontend Setup

1. **Use the ConfigService to access configuration**
   ```typescript
   import { configService } from '@/lib/config';
   
   // Get entire config
   const config = await configService.getConfig();
   
   // Get specific value
   const isEnabled = await configService.get('features.ocr.enabled');
   ```

2. **React Hook for Components**
   ```typescript
   import { useConfig } from '@/lib/config';
   
   function MyComponent() {
     const { config, loading, error } = useConfig();
     
     if (loading) return <div>Loading configuration...</div>;
     if (error) return <div>Error loading configuration</div>;
     
     return <div>{config.app.name}</div>;
   }
   ```

## 🔑 Security Benefits

1. **No Sensitive Data in Client Bundle**: API keys, client secrets, and other sensitive data never reach the browser
2. **Dynamic Configuration**: Configuration can be changed without rebuilding the frontend
3. **User-Specific Config**: Different configurations for different users/roles
4. **Audit Trail**: All configuration access can be logged and monitored
5. **Centralized Management**: All configuration managed from one place

## 🚨 Important Notes

1. **Never use `NEXT_PUBLIC_` for sensitive data**
2. **Always validate configuration on the backend**
3. **Use feature flags to control functionality**
4. **Log configuration access for security monitoring**
5. **Cache configuration appropriately to reduce API calls**

## 📝 Migration Checklist

When migrating existing code:

- [ ] Remove all sensitive `NEXT_PUBLIC_*` variables from `.env` files
- [ ] Move sensitive configuration to backend `.env`
- [ ] Update frontend code to use `ConfigService`
- [ ] Test configuration loading in development and production
- [ ] Verify no sensitive data in browser DevTools
- [ ] Update deployment scripts to use new `.env` structure

## 🔍 Verification

To verify the implementation:

1. **Check Browser Network Tab**: The `/api/config/public` response should not contain any API keys or secrets
2. **View Page Source**: Search for exposed environment variables - none should contain sensitive data
3. **Build Analysis**: Run `npm run build` and check the output bundle for exposed secrets

## 📚 Further Reading

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [OWASP Configuration Security](https://owasp.org/www-project-application-security-verification-standard/)
- [12-Factor App Config](https://12factor.net/config)