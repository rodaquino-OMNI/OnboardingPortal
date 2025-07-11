<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Handle user login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // Rate limiting key
        $throttleKey = strtolower($request->input('email')) . '|' . $request->ip();
        
        // Check rate limit (5 attempts per minute)
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            
            throw ValidationException::withMessages([
                'email' => ["Muitas tentativas de login. Por favor, tente novamente em {$seconds} segundos."],
            ]);
        }
        
        // Get credentials
        $credentials = $request->getCredentials();
        $field = $request->getLoginField();
        
        // Find user
        $user = User::where($field, $credentials[$field])->first();
        
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);
            
            // If user exists, increment failed attempts
            if ($user) {
                $user->incrementFailedLoginAttempts();
            }
            
            throw ValidationException::withMessages([
                'email' => ['As credenciais fornecidas estão incorretas.'],
            ]);
        }
        
        // Check if account is locked
        if ($user->isLocked()) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta está bloqueada devido a múltiplas tentativas de login falhadas. Tente novamente mais tarde.'],
            ]);
        }
        
        // Check if user is active
        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Sua conta está inativa. Entre em contato com o administrador.'],
            ]);
        }
        
        // Check if registration is completed
        if (!$user->isRegistrationCompleted()) {
            return response()->json([
                'message' => 'Registro incompleto',
                'registration_step' => $user->registration_step,
                'user_id' => $user->id,
            ], 200);
        }
        
        // Clear rate limiter on successful login
        RateLimiter::clear($throttleKey);
        
        // Record successful login
        $user->recordSuccessfulLogin($request->ip());
        
        // Create token
        $deviceName = $request->input('device_name', 'web');
        $token = $user->createToken($deviceName)->plainTextToken;
        
        // Load relationships
        $user->load(['roles', 'beneficiary', 'gamificationProgress']);
        
        return response()->json([
            'message' => 'Login realizado com sucesso',
            'user' => $user,
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }
    
    /**
     * Handle user logout
     */
    public function logout(Request $request): JsonResponse
    {
        // Revoke current token
        $request->user()->currentAccessToken()->delete();
        
        return response()->json([
            'message' => 'Logout realizado com sucesso',
        ]);
    }
    
    /**
     * Handle logout from all devices
     */
    public function logoutAll(Request $request): JsonResponse
    {
        // Revoke all tokens
        $request->user()->tokens()->delete();
        
        return response()->json([
            'message' => 'Logout realizado em todos os dispositivos',
        ]);
    }
    
    /**
     * Refresh token (get new token)
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Delete current token
        $request->user()->currentAccessToken()->delete();
        
        // Create new token
        $deviceName = $request->input('device_name', 'web');
        $token = $user->createToken($deviceName)->plainTextToken;
        
        return response()->json([
            'message' => 'Token renovado com sucesso',
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }
    
    /**
     * Get current authenticated user
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['roles', 'beneficiary', 'gamificationProgress']);
        
        return response()->json([
            'user' => $user,
        ]);
    }
    
    /**
     * Verify if email exists (for registration)
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);
        
        $exists = User::where('email', $request->email)->exists();
        
        return response()->json([
            'exists' => $exists,
        ]);
    }
    
    /**
     * Verify if CPF exists (for registration)
     */
    public function checkCpf(Request $request): JsonResponse
    {
        $request->validate([
            'cpf' => ['required', 'string'],
        ]);
        
        // Clean CPF
        $cpf = preg_replace('/[^0-9]/', '', $request->cpf);
        
        $exists = User::where('cpf', $cpf)->exists();
        
        return response()->json([
            'exists' => $exists,
        ]);
    }
}