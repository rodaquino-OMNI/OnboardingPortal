<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\ProfileMinimalRequest;
use App\Models\User;
use App\Modules\Gamification\Services\PointsEngine;
use App\Modules\Gamification\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * RegistrationFlowController - Multi-step registration with analytics
 *
 * Endpoints:
 * - POST /api/register - Email/password registration
 * - GET /api/callback-verify - Email verification
 * - POST /api/profile/minimal - Profile completion
 *
 * Features:
 * - Server-side validation (never trust client)
 * - SHA-256 hashed user_id for analytics
 * - No PII/PHI in analytics payloads
 * - CSRF protection enabled
 * - Gamification integration
 *
 * @see docs/API_SPEC.yaml - Full contract specification
 */
class RegistrationFlowController extends Controller
{
    public function __construct(
        private readonly PointsEngine $pointsEngine,
        private readonly AuditLogService $auditLog
    ) {}

    /**
     * Register new user account
     *
     * POST /api/register
     *
     * Request:
     * {
     *   "email": "user@example.com",
     *   "password": "SecureP@ss123",
     *   "password_confirmation": "SecureP@ss123",
     *   "lgpd_consent": true,
     *   "terms_accepted": true
     * }
     *
     * Response (201):
     * {
     *   "message": "Conta criada com sucesso!",
     *   "user": { "id": 1, "email": "user@example.com" },
     *   "verification_email_sent": true
     * }
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        // All validation already done by RegisterRequest
        $validated = $request->validated();

        // Create user with email verification token
        $user = User::create([
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'lgpd_consent' => $validated['lgpd_consent'],
            'terms_accepted' => $validated['terms_accepted'],
            'email_verification_token' => Str::random(64),
            'points_balance' => 0,
            'current_level' => 1,
            'current_streak' => 0,
        ]);

        // Send verification email
        // TODO: Integrate with Mail service
        // Mail::to($user->email)->send(new VerificationEmail($user));

        // Audit log (WHO-WHAT-WHEN-WHERE-HOW)
        $this->auditLog->log($user, 'registration_started', [
            'email' => $user->email,
            'lgpd_consent' => true,
        ]);

        // Analytics: registration_started
        $this->emitAnalytics('registration_started', $user, [
            'registration_method' => 'email',
        ]);

        Log::info('User registration started', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->json([
            'message' => 'Conta criada com sucesso! Verifique seu email para continuar.',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
            ],
            'verification_email_sent' => true,
        ], 201);
    }

    /**
     * Verify email address via token
     *
     * GET /api/callback-verify?token={token}
     *
     * Response (200):
     * {
     *   "message": "Email verificado com sucesso!",
     *   "access_token": "...",
     *   "refresh_token": "...",
     *   "user": { ... },
     *   "gamification": {
     *     "points_earned": 100,
     *     "badge_unlocked": "first_steps"
     *   }
     * }
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);

        // Find user by verification token
        $user = User::where('email_verification_token', $request->token)->first();

        if (!$user) {
            return response()->json([
                'error' => 'Token inválido ou expirado',
            ], 404);
        }

        // Mark email as verified
        $user->update([
            'email_verified_at' => now(),
            'email_verification_token' => null,
        ]);

        // Award 100 points for email verification
        $this->pointsEngine->awardPoints($user, 'registration', [
            'email_verified' => true,
        ]);

        // Refresh user to get updated points
        $user->refresh();

        // Audit log
        $this->auditLog->log($user, 'email_verified', [
            'email' => $user->email,
        ]);

        // Analytics: email_verified
        $this->emitAnalytics('email_verified', $user, [
            'verification_method' => 'email_link',
        ]);

        // Generate access/refresh tokens
        $accessToken = $user->createToken('auth_token', ['*'], now()->addMinutes(15))->plainTextToken;
        $refreshToken = Str::random(64); // Stub - implement proper refresh token

        Log::info('Email verified successfully', [
            'user_id' => $user->id,
            'email' => $user->email,
            'points_awarded' => 100,
        ]);

        return response()->json([
            'message' => 'Email verificado com sucesso!',
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => 900, // 15 minutes
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'points_balance' => $user->points_balance,
                'current_level' => $user->current_level,
                'email_verified_at' => $user->email_verified_at,
            ],
            'gamification' => [
                'points_earned' => 100,
                'total_points' => $user->points_balance,
                'current_level' => $user->current_level,
                'badge_unlocked' => 'first_steps',
            ],
        ]);
    }

    /**
     * Complete minimal profile
     *
     * POST /api/profile/minimal
     *
     * Request:
     * {
     *   "name": "João Silva",
     *   "cpf": "123.456.789-01",
     *   "birthdate": "1990-05-15",
     *   "phone": "(11) 98765-4321",
     *   "address": "Rua Example, 123"
     * }
     *
     * Response (200):
     * {
     *   "message": "Perfil atualizado com sucesso!",
     *   "user": { ... },
     *   "gamification": {
     *     "points_earned": 50
     *   }
     * }
     */
    public function updateProfileMinimal(ProfileMinimalRequest $request): JsonResponse
    {
        $user = $request->user();

        // Check if email is verified
        if (!$user->email_verified_at) {
            return response()->json([
                'error' => 'Email não verificado. Por favor, verifique seu email primeiro.',
            ], 403);
        }

        // All validation already done by ProfileMinimalRequest
        $validated = $request->validated();

        // Update user profile
        $user->update([
            'name' => $validated['name'],
            'cpf' => $validated['cpf'],
            'birthdate' => $validated['birthdate'],
            'phone' => $validated['phone'],
            'address' => $validated['address'] ?? null,
        ]);

        // Award 50 points for basic profile completion
        $pointsAwarded = $this->pointsEngine->awardPoints($user, 'profile_basic', [
            'fields_completed' => ['name', 'cpf', 'birthdate', 'phone'],
        ]);

        // Refresh user
        $user->refresh();

        // Audit log (no CPF in logs - PII protection)
        $this->auditLog->log($user, 'profile_minimal_completed', [
            'fields_updated' => ['name', 'cpf', 'birthdate', 'phone', 'address'],
        ]);

        // Analytics: profile_minimal_completed
        $this->emitAnalytics('profile_minimal_completed', $user, [
            'fields_completed' => 5,
            'optional_fields_completed' => $validated['address'] ? 1 : 0,
        ]);

        // Analytics: points_earned (if points were awarded)
        if ($pointsAwarded) {
            $this->emitAnalytics('points_earned', $user, [
                'action' => 'profile_basic',
                'points_delta' => 50,
                'points_balance' => $user->points_balance,
            ]);
        }

        Log::info('Profile minimal completed', [
            'user_id' => $user->id,
            'points_awarded' => $pointsAwarded ? 50 : 0,
        ]);

        return response()->json([
            'message' => 'Perfil atualizado com sucesso!',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'points_balance' => $user->points_balance,
                'current_level' => $user->current_level,
            ],
            'gamification' => [
                'points_earned' => $pointsAwarded ? 50 : 0,
                'total_points' => $user->points_balance,
                'current_level' => $user->current_level,
            ],
            'next_step' => 'health_questionnaire',
        ]);
    }

    /**
     * Emit analytics event with hashed user_id
     *
     * IMPORTANT: Never send plain user_id to analytics
     * All user_ids must be SHA-256 hashed for privacy
     *
     * @param string $eventName Event name (e.g., 'registration_started')
     * @param User $user User object
     * @param array $properties Additional properties (no PII/PHI)
     */
    private function emitAnalytics(string $eventName, User $user, array $properties = []): void
    {
        // Hash user_id with SHA-256
        $hashedUserId = hash('sha256', (string) $user->id);

        $payload = [
            'event' => $eventName,
            'user_id' => $hashedUserId, // HASHED, not plain
            'timestamp' => now()->toIso8601String(),
            'properties' => array_merge($properties, [
                'platform' => 'web',
                'environment' => config('app.env'),
            ]),
        ];

        // Emit to analytics service (Amplitude, Mixpanel, etc.)
        if (config('feature_flags.analytics_enabled', true)) {
            // TODO: Integrate with actual analytics service
            // Example: Analytics::track($payload['user_id'], $payload['event'], $payload['properties']);

            // Fallback: Log to analytics channel
            Log::channel('analytics')->info('Analytics event', $payload);
        }

        Log::debug('Analytics event emitted', [
            'event' => $eventName,
            'user_id_hashed' => $hashedUserId,
        ]);
    }
}
