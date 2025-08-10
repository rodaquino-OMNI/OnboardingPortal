<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ConfigController extends Controller
{
    /**
     * Get public configuration for frontend
     * This endpoint provides only non-sensitive configuration
     */
    public function getPublicConfig(Request $request): JsonResponse
    {
        // Cache the config for performance
        $config = Cache::remember('public_frontend_config', 3600, function () {
            return [
                'app' => [
                    'name' => config('app.name', 'AUSTA Health Portal'),
                    'version' => config('app.version', '1.0.0'),
                    'environment' => app()->environment() === 'production' ? 'production' : 'development',
                    'locale' => config('app.locale', 'pt-BR'),
                    'timezone' => config('app.timezone', 'America/Sao_Paulo'),
                ],
                'features' => [
                    'registration' => [
                        'enabled' => config('features.registration.enabled', true),
                        'multi_step' => config('features.registration.multi_step', true),
                        'social_login' => config('features.registration.social_login', true),
                    ],
                    'documents' => [
                        'enabled' => config('features.documents.enabled', true),
                        'ocr_enabled' => config('features.documents.ocr_enabled', true),
                        'max_file_size' => config('features.documents.max_file_size', 10485760),
                        'allowed_types' => config('features.documents.allowed_types', ['jpg', 'jpeg', 'png', 'pdf']),
                    ],
                    'video_conferencing' => [
                        'enabled' => config('features.video_conferencing.enabled', true),
                        'max_duration' => config('features.video_conferencing.max_duration', 3600),
                    ],
                    'gamification' => [
                        'enabled' => config('features.gamification.enabled', true),
                        'points_enabled' => config('features.gamification.points_enabled', true),
                        'badges_enabled' => config('features.gamification.badges_enabled', true),
                    ],
                    'analytics' => [
                        'enabled' => config('features.analytics.enabled', false),
                    ],
                    'monitoring' => [
                        'enabled' => config('features.monitoring.enabled', false),
                    ],
                ],
                'security' => [
                    'session_timeout' => config('session.lifetime', 60) * 60 * 1000, // Convert to milliseconds
                    'session_warning_time' => 5 * 60 * 1000, // 5 minutes in milliseconds
                    'password_requirements' => [
                        'min_length' => config('security.password.min_length', 8),
                        'require_uppercase' => config('security.password.require_uppercase', true),
                        'require_lowercase' => config('security.password.require_lowercase', true),
                        'require_numbers' => config('security.password.require_numbers', true),
                        'require_symbols' => config('security.password.require_symbols', true),
                    ],
                    'two_factor_enabled' => config('security.2fa.enabled', true),
                ],
                'api' => [
                    'version' => config('api.version', 'v1'),
                    'timeout' => config('api.timeout', 30000),
                    'rate_limits' => [
                        'per_minute' => config('security.rate_limits.api', 60),
                    ],
                ],
                'social_providers' => $this->getSocialProviders(),
                'locales' => [
                    'available' => config('app.available_locales', ['pt-BR', 'en', 'es']),
                    'default' => config('app.locale', 'pt-BR'),
                ],
                'urls' => [
                    'terms' => config('app.urls.terms', '/terms'),
                    'privacy' => config('app.urls.privacy', '/privacy'),
                    'support' => config('app.urls.support', '/support'),
                ],
            ];
        });
        
        return response()->json([
            'success' => true,
            'config' => $config,
        ]);
    }
    
    /**
     * Get authenticated user configuration
     * This includes user-specific configuration
     */
    public function getUserConfig(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $config = [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'permissions' => $user->getAllPermissions()->pluck('name'),
                'preferences' => $user->preferences ?? [],
                'registration_completed' => $user->isRegistrationCompleted(),
                'two_factor_enabled' => $user->two_factor_enabled ?? false,
            ],
            'organization' => [
                'name' => $user->organization->name ?? null,
                'features' => $user->organization->features ?? [],
            ],
            'quotas' => [
                'documents' => [
                    'max_uploads_per_day' => $user->getMaxUploadsPerDay(),
                    'uploads_today' => $user->getUploadsToday(),
                ],
                'video_calls' => [
                    'max_duration' => $user->getMaxVideoDuration(),
                    'minutes_used_today' => $user->getVideoMinutesToday(),
                ],
            ],
        ];
        
        return response()->json([
            'success' => true,
            'config' => $config,
        ]);
    }
    
    /**
     * Get social provider configuration
     * Only returns enabled providers, no keys
     */
    private function getSocialProviders(): array
    {
        $providers = [];
        
        if (config('services.google.client_id')) {
            $providers[] = 'google';
        }
        
        if (config('services.facebook.client_id')) {
            $providers[] = 'facebook';
        }
        
        if (config('services.instagram.client_id')) {
            $providers[] = 'instagram';
        }
        
        return $providers;
    }
    
    /**
     * Clear configuration cache
     * Admin only endpoint
     */
    public function clearCache(Request $request): JsonResponse
    {
        // Check admin permission
        if (!$request->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }
        
        Cache::forget('public_frontend_config');
        
        return response()->json([
            'success' => true,
            'message' => 'Configuration cache cleared',
        ]);
    }
}