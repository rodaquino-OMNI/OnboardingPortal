<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use App\Services\BrazilianDocumentService;

/**
 * Unified Authentication Service
 * Consolidates all auth logic from the fragmented AuthController
 */
class AuthService
{
    private const CACHE_TTL_USER_LOOKUP = 300; // 5 minutes
    private const CACHE_TTL_USER_DATA = 600; // 10 minutes
    private const CACHE_TTL_RELATIONSHIPS = 900; // 15 minutes
    private const RATE_LIMIT_MAX_ATTEMPTS = 5;
    private const RATE_LIMIT_DURATION = 60; // seconds
    private const AUTH_CHECK_THROTTLE = 500; // milliseconds
    
    // Removed BrazilianDocumentService dependency to fix constructor issues
    // The service can be injected when needed using app() helper

    /**
     * Authenticate user with email/CPF and password
     *
     * @param array $credentials
     * @param string $field
     * @param Request $request
     * @return array
     * @throws ValidationException
     */
    public function login(array $credentials, string $field, Request $request): array
    {
        $startTime = microtime(true);
        
        // Validate field type
        $this->validateLoginField($field);
        
        // Check rate limiting
        $this->checkRateLimit($credentials[$field], $request->ip());
        
        // Find and validate user
        $user = $this->findUserForLogin($credentials, $field);
        
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            $this->handleFailedLogin($credentials[$field], $request->ip(), $user);
        }
        
        // Validate user account state
        $this->validateUserAccount($user);
        
        // Check registration completion
        if (!$user->isRegistrationCompleted()) {
            return [
                'type' => 'registration_incomplete',
                'message' => 'Registro incompleto',
                'registration_step' => $user->registration_step,
                'user_id' => $user->id,
            ];
        }
        
        // Clear rate limiter on successful login
        $this->clearRateLimit($credentials[$field], $request->ip());
        
        // Record successful login
        $user->recordSuccessfulLogin($request->ip());
        
        // Generate token
        $deviceName = $this->sanitizeDeviceName($request->input('device_name', 'web'));
        $token = $user->createToken($deviceName)->plainTextToken;
        
        // Load user relationships
        $userWithRelations = $this->loadUserRelationships($user);
        
        
        return [
            'type' => 'success',
            'message' => 'Login realizado com sucesso',
            'user' => $this->sanitizeUserOutput($userWithRelations),
            'token' => $token,
            'success' => true,
            'performance' => [
                'response_time' => round((microtime(true) - $startTime) * 1000, 2) . 'ms',
            ],
        ];
    }

    /**
     * Log out user by revoking current token
     */
    public function logout(Request $request): array
    {
        $request->user()->currentAccessToken()->delete();
        
        return [
            'message' => 'Logout realizado com sucesso',
        ];
    }

    /**
     * Log out user from all devices
     */
    public function logoutAll(Request $request): array
    {
        $request->user()->tokens()->delete();
        
        return [
            'message' => 'Logout realizado em todos os dispositivos',
        ];
    }

    /**
     * Refresh user token
     */
    public function refreshToken(Request $request): array
    {
        $user = $request->user();
        
        // Delete current token
        $request->user()->currentAccessToken()->delete();
        
        // Create new token
        $deviceName = $this->sanitizeDeviceName($request->input('device_name', 'web'));
        $token = $user->createToken($deviceName)->plainTextToken;
        
        return [
            'message' => 'Token renovado com sucesso',
            'token' => $token,
            'token_type' => 'Bearer',
        ];
    }

    /**
     * Get authenticated user data with caching
     */
    public function getAuthenticatedUser(Request $request): array
    {
        $startTime = microtime(true);
        $user = $request->user();
        
        $cacheKey = "user_data_v3_{$user->id}";
        $userData = Cache::store('auth')->remember($cacheKey, self::CACHE_TTL_USER_DATA, function () use ($user) {
            return $user->loadMissing([
                'beneficiary:id,user_id,full_name,phone,email',
                'gamificationProgress'  // Removed column specification to avoid conflicts
            ])->makeHidden(['password', 'remember_token'])->toArray();
        });
        
        return [
            'user' => $userData,
            'performance' => [
                'response_time' => round((microtime(true) - $startTime) * 1000, 2) . 'ms',
                'cache_hit' => Cache::store('auth')->has($cacheKey)
            ],
        ];
    }

    /**
     * Check if email exists
     */
    public function checkEmailExists(string $email): array
    {
        $exists = User::where('email', $email)->exists();
        
        return ['exists' => $exists];
    }

    /**
     * Check if CPF exists
     */
    public function checkCpfExists(string $cpf): array
    {
        // Clean CPF - remove all non-numeric characters
        $cleanCpf = preg_replace('/[^0-9]/', '', $cpf);
        $exists = User::where('cpf', $cleanCpf)->exists();
        
        return ['exists' => $exists];
    }

    /**
     * Create authentication cookies
     */
    public function createAuthCookie(string $token, JsonResponse $response): JsonResponse
    {
        return $response->cookie(
            'auth_token',
            $token,
            config('auth_security.cookie.expiration', config('sanctum.expiration', 525600)),
            config('auth_security.cookie.path', '/'),
            config('auth_security.cookie.domain', null),
            config('auth_security.cookie.secure', app()->environment('production')),
            config('auth_security.cookie.httponly', true),
            false, // raw (don't encode)
            config('auth_security.cookie.samesite', app()->environment('production') ? 'Strict' : 'Lax')
        );
    }

    /**
     * Clear authentication cookies
     */
    public function clearAuthCookie(JsonResponse $response): JsonResponse
    {
        return $response->cookie(
            'auth_token',
            '',
            -1, // Expire immediately
            config('auth_security.cookie.path', '/'),
            config('auth_security.cookie.domain', null),
            config('auth_security.cookie.secure', app()->environment('production')),
            config('auth_security.cookie.httponly', true),
            false,
            config('auth_security.cookie.samesite', app()->environment('production') ? 'Strict' : 'Lax')
        );
    }

    /**
     * Validate login field type
     */
    private function validateLoginField(string $field): void
    {
        $allowedFields = ['email', 'cpf'];
        if (!in_array($field, $allowedFields, true)) {
            throw ValidationException::withMessages([
                'email' => ['Campo de login inválido.'],
            ]);
        }
    }

    /**
     * Check rate limiting
     */
    private function checkRateLimit(string $identifier, string $ip): void
    {
        $throttleKey = "login_throttle:{$identifier}|{$ip}";
        $attempts = Cache::get($throttleKey, 0);
        
        if ($attempts >= self::RATE_LIMIT_MAX_ATTEMPTS) {
            // For cache-based TTL, we use remaining cache time or default
            $seconds = self::RATE_LIMIT_DURATION; // Use default duration as fallback
            
            throw ValidationException::withMessages([
                'email' => ["Muitas tentativas de login. Por favor, tente novamente em {$seconds} segundos."],
            ]);
        }
    }

    /**
     * Clear rate limiting
     */
    private function clearRateLimit(string $identifier, string $ip): void
    {
        $throttleKey = "login_throttle:{$identifier}|{$ip}";
        Cache::forget($throttleKey);
    }

    /**
     * Handle failed login attempt
     */
    private function handleFailedLogin(string $identifier, string $ip, ?User $user): void
    {
        // Increment cache-based rate limiter
        $throttleKey = "login_throttle:{$identifier}|{$ip}";
        $attempts = Cache::get($throttleKey, 0) + 1;
        Cache::put($throttleKey, $attempts, now()->addSeconds(self::RATE_LIMIT_DURATION));
        
        // If user exists, increment failed attempts
        if ($user) {
            $user->incrementFailedLoginAttempts();
            $this->clearUserCache($user);
        }
        
        throw ValidationException::withMessages([
            'email' => ['As credenciais fornecidas estão incorretas.'],
        ]);
    }

    /**
     * Find user for login with caching and proper CPF handling
     */
    private function findUserForLogin(array $credentials, string $field): ?User
    {
        $lookupValue = $credentials[$field];
        
        // If searching by CPF, clean it first
        if ($field === 'cpf') {
            $lookupValue = preg_replace('/[^0-9]/', '', $lookupValue);
        }
        
        $cacheKey = "user_lookup:{$field}:" . hash('sha256', $lookupValue);
        
        $user = Cache::store('auth')->remember($cacheKey, self::CACHE_TTL_USER_LOOKUP, function () use ($field, $lookupValue) {
            // Load the full user object with all necessary fields
            return User::where($field, '=', $lookupValue)->first();
        });
        
        return $user;
    }

    /**
     * Validate user account state
     */
    private function validateUserAccount(User $user): void
    {
        if ($user->isLocked()) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta está bloqueada devido a múltiplas tentativas de login falhadas. Tente novamente mais tarde.'],
            ]);
        }
        
        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta está inativa. Entre em contato com o administrador.'],
            ]);
        }
    }

    /**
     * Load user relationships with caching
     */
    private function loadUserRelationships(User $user): User
    {
        $relationshipCacheKey = "user_relationships:{$user->id}";
        
        return Cache::store('auth')->remember($relationshipCacheKey, self::CACHE_TTL_RELATIONSHIPS, function () use ($user) {
            return $user->loadMissing([
                'beneficiary:id,user_id,full_name', 
                'gamificationProgress'  // Removed column specification to avoid conflicts
            ]);
        });
    }

    /**
     * Clear user-related cache
     */
    private function clearUserCache(User $user): void
    {
        $cacheKeys = [
            "user_lookup:email:" . hash('sha256', $user->email),
            "user_lookup:cpf:" . hash('sha256', $user->cpf),
            "user_relationships:{$user->id}",
            "user_data_v3_{$user->id}",
        ];
        
        foreach ($cacheKeys as $key) {
            Cache::store('auth')->forget($key);
        }
    }

    /**
     * Sanitize device name
     */
    private function sanitizeDeviceName(string $deviceName): string
    {
        $sanitized = strip_tags($deviceName);
        $sanitized = htmlspecialchars($sanitized, ENT_QUOTES, 'UTF-8');
        $sanitized = Str::limit($sanitized, 100);
        
        return empty(trim($sanitized)) ? 'web' : $sanitized;
    }

    /**
     * Sanitize user output
     */
    private function sanitizeUserOutput($user): array
    {
        $userData = $user->toArray();
        
        // Sanitize string fields
        $stringFields = ['name', 'email', 'department', 'job_title'];
        
        foreach ($stringFields as $field) {
            if (isset($userData[$field]) && is_string($userData[$field])) {
                $userData[$field] = htmlspecialchars($userData[$field], ENT_QUOTES, 'UTF-8');
            }
        }
        
        // Sanitize nested beneficiary data
        if (isset($userData['beneficiary']) && is_array($userData['beneficiary'])) {
            $beneficiaryStringFields = ['full_name', 'address', 'city', 'state', 'neighborhood'];
            
            foreach ($beneficiaryStringFields as $field) {
                if (isset($userData['beneficiary'][$field]) && is_string($userData['beneficiary'][$field])) {
                    $userData['beneficiary'][$field] = htmlspecialchars($userData['beneficiary'][$field], ENT_QUOTES, 'UTF-8');
                }
            }
        }
        
        return $userData;
    }
}