<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Str;
use Exception;

class SocialAuthController extends Controller
{
    /**
     * Redirect to OAuth provider
     */
    public function redirect(string $provider): JsonResponse
    {
        try {
            $providers = ['google', 'facebook', 'instagram'];
            
            if (!in_array($provider, $providers)) {
                return response()->json([
                    'error' => 'Provedor não suportado'
                ], 400);
            }
            
            // For Instagram, we need to use Facebook's Instagram Basic Display API
            if ($provider === 'instagram') {
                $url = Socialite::driver('facebook')
                    ->scopes(['instagram_basic', 'pages_show_list'])
                    ->stateless()
                    ->redirect()
                    ->getTargetUrl();
            } else {
                $url = Socialite::driver($provider)
                    ->stateless()
                    ->redirect()
                    ->getTargetUrl();
            }
            
            return response()->json([
                'url' => $url
            ]);
            
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Erro ao redirecionar para o provedor: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Handle OAuth callback
     */
    public function callback(string $provider)
    {
        try {
            $providers = ['google', 'facebook', 'instagram'];
            
            if (!in_array($provider, $providers)) {
                return response()->json([
                    'error' => 'Provedor não suportado'
                ], 400);
            }
            
            // Get user from OAuth provider
            if ($provider === 'instagram') {
                $socialUser = Socialite::driver('facebook')->stateless()->user();
                // Instagram data will be in the user object
            } else {
                $socialUser = Socialite::driver($provider)->stateless()->user();
            }
            
            // Find or create user
            $user = $this->findOrCreateUser($socialUser, $provider);
            
            // Login user
            Auth::login($user);
            
            // Create token
            $token = $user->createToken('social-auth')->plainTextToken;
            
            // Load relationships
            $user->load(['beneficiary', 'gamificationProgress']);
            
            // Redirect to frontend with token
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');
            $callbackUrl = $frontendUrl . '/callback?token=' . $token;
            
            return redirect($callbackUrl);
            
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Erro na autenticação social: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Find or create user from social provider data
     */
    private function findOrCreateUser($socialUser, string $provider): User
    {
        // Check if user exists with social ID
        $user = User::where($provider . '_id', $socialUser->getId())->first();
        
        if ($user) {
            return $user;
        }
        
        // Check if user exists with same email
        if ($socialUser->getEmail()) {
            $user = User::where('email', $socialUser->getEmail())->first();
            
            if ($user) {
                // Link social account to existing user
                $user->update([
                    $provider . '_id' => $socialUser->getId(),
                    'social_provider' => $provider,
                    'social_login' => true,
                    'avatar_url' => $socialUser->getAvatar()
                ]);
                
                return $user;
            }
        }
        
        // Create new user
        $user = User::create([
            'name' => $socialUser->getName(),
            'email' => $socialUser->getEmail() ?: $socialUser->getId() . '@' . $provider . '.social',
            'password' => null, // No password for social users
            $provider . '_id' => $socialUser->getId(),
            'social_provider' => $provider,
            'social_login' => true,
            'avatar_url' => $socialUser->getAvatar(),
            'email_verified_at' => now(),
            'role' => 'beneficiary',
            'is_active' => true,
            'registration_step' => 'personal', // They'll need to complete registration
            'preferred_language' => 'pt-BR',
            'preferences' => json_encode([
                'notifications' => ['email' => true, 'sms' => false, 'push' => true],
                'theme' => 'light'
            ])
        ]);
        
        // Note: Beneficiary and gamification progress will be created 
        // during the onboarding process when user provides required information
        
        return $user;
    }
}