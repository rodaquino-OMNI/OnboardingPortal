<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    /**
     * Handle user login using unified auth logic
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $authService = app(AuthService::class);
        $credentials = $request->getCredentials();
        $field = $request->getLoginField();
        
        $result = $authService->login($credentials, $field, $request);
        
        // Handle registration incomplete case
        if ($result['type'] === 'registration_incomplete') {
            return response()->json([
                'message' => $result['message'],
                'registration_step' => $result['registration_step'],
                'user_id' => $result['user_id'],
            ], 200);
        }
        
        // Create response with auth cookie
        $response = response()->json([
            'message' => htmlspecialchars($result['message'], ENT_QUOTES, 'UTF-8'),
            'user' => $result['user'],
            'token' => $result['token'],
            'success' => $result['success'],
            'performance' => $result['performance'],
        ]);
        
        return $authService->createAuthCookie($result['token'], $response);
    }
    
    /**
     * Handle user logout using unified auth logic
     */
    public function logout(Request $request): JsonResponse
    {
        $authService = app(AuthService::class);
        $result = $authService->logout($request);
        
        $response = response()->json($result);
        
        return $authService->clearAuthCookie($response);
    }
    
    /**
     * Handle logout from all devices using unified auth logic
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $authService = app(AuthService::class);
        $result = $authService->logoutAll($request);
        
        $response = response()->json($result);
        
        return $authService->clearAuthCookie($response);
    }
    
    /**
     * Refresh token using unified auth logic
     */
    public function refresh(Request $request): JsonResponse
    {
        $authService = app(AuthService::class);
        $result = $authService->refreshToken($request);
        
        return response()->json($result);
    }
    
    /**
     * Get current authenticated user using unified auth logic
     */
    public function user(Request $request): JsonResponse
    {
        $authService = app(AuthService::class);
        $result = $authService->getAuthenticatedUser($request);
        
        return response()->json($result);
    }
    
    /**
     * Verify if email exists using unified auth logic
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);
        
        $authService = app(AuthService::class);
        $result = $authService->checkEmailExists($request->email);
        
        return response()->json($result);
    }
    
    /**
     * Verify if CPF exists using unified auth logic
     */
    public function checkCpf(Request $request): JsonResponse
    {
        $request->validate([
            'cpf' => ['required', 'string'],
        ]);
        
        $authService = app(AuthService::class);
        $result = $authService->checkCpfExists($request->cpf);
        
        return response()->json($result);
    }
}