<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Gamification\Services\PointsEngine;
use App\Modules\Gamification\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * AuthController - Authentication endpoints per API_SPEC.yaml
 *
 * Endpoints:
 * - POST /auth/register - Register new user
 * - GET /auth/verify-email - Verify email via token
 * - POST /auth/login - User login
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/logout - User logout
 * - POST /auth/mfa/enable - Enable MFA (TOTP)
 * - POST /auth/mfa/verify - Verify MFA code
 *
 * @see docs/API_SPEC.yaml - Full contract specification
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-002: Authentication
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly PointsEngine $pointsEngine,
        private readonly AuditLogService $auditLog
    ) {}

    /**
     * Register new user account
     *
     * POST /auth/register
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
            'cpf' => ['required', 'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/'],
            'phone' => ['required', 'regex:/^\(\d{2}\) \d{4,5}-\d{4}$/'],
            'lgpd_consent' => ['boolean'],
            'terms_accepted' => ['boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Check if CPF already exists using hash lookup (ADR-004)
        $existingUser = User::findByEncrypted('cpf', $request->cpf);
        if ($existingUser) {
            return response()->json([
                'errors' => ['cpf' => ['CPF já cadastrado no sistema']],
            ], 422);
        }

        // Check if phone already exists using hash lookup (ADR-004)
        $existingPhone = User::findByEncrypted('phone', $request->phone);
        if ($existingPhone) {
            return response()->json([
                'errors' => ['phone' => ['Telefone já cadastrado no sistema']],
            ], 422);
        }

        $user = User::create([
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'cpf' => $request->cpf,  // Automatically encrypted via EncryptsAttributes trait
            'phone' => $request->phone,  // Automatically encrypted via EncryptsAttributes trait
            'lgpd_consent' => $request->lgpd_consent ?? true,
            'terms_accepted' => $request->terms_accepted ?? true,
            'email_verification_token' => Str::random(64),
        ]);

        // Send verification email (stub - integrate with Mail service)
        // Mail::to($user->email)->send(new VerificationEmail($user));

        $this->auditLog->log($user, 'user_registered', [
            'email' => $user->email,
            'lgpd_consent' => $user->lgpd_consent,
        ]);

        return response()->json([
            'message' => 'Conta criada com sucesso! Verifique seu email.',
            'user' => $user->only(['id', 'email']),
            'verification_email_sent' => true,
        ], 201);
    }

    /**
     * Verify email address
     *
     * GET /auth/verify-email?token={token}
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email_verification_token', $request->token)->first();

        if (!$user) {
            return response()->json(['error' => 'Token inválido ou expirado'], 404);
        }

        $user->update([
            'email_verified_at' => now(),
            'email_verification_token' => null,
        ]);

        // Award 100 points for email verification (per GAMIFICATION_SPEC.md)
        $this->pointsEngine->awardPoints($user, 'registration', [
            'email_verified' => true,
        ]);

        $this->auditLog->log($user, 'email_verified', [
            'email' => $user->email,
        ]);

        // Generate access/refresh tokens (stub - integrate with auth service)
        $accessToken = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Email verificado com sucesso!',
            'access_token' => $accessToken,
            'refresh_token' => Str::random(64), // Stub - implement proper refresh token
            'user' => $user->only(['id', 'email', 'points_balance', 'current_level']),
            'gamification' => [
                'points_earned' => 100,
                'badge_unlocked' => 'first_steps',
            ],
        ]);
    }

    /**
     * User login
     *
     * POST /auth/login
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'password' => ['required'],
            'session_fingerprint' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            $this->auditLog->log(null, 'login_failed', [
                'email' => $request->email,
                'reason' => 'invalid_credentials',
            ]);

            return response()->json(['error' => 'Credenciais inválidas'], 401);
        }

        if (!$user->email_verified_at) {
            return response()->json(['error' => 'Email não verificado'], 401);
        }

        $accessToken = $user->createToken('auth_token')->plainTextToken;

        $this->auditLog->log($user, 'user_logged_in', [
            'email' => $user->email,
            'fingerprint' => $request->session_fingerprint,
        ]);

        return response()->json([
            'access_token' => $accessToken,
            'refresh_token' => Str::random(64), // Stub - implement proper refresh token
            'token_type' => 'Bearer',
            'expires_in' => 900, // 15 minutes
            'user' => $user->only(['id', 'email', 'points_balance', 'current_level']),
        ]);
    }

    /**
     * Refresh access token
     *
     * POST /auth/refresh
     */
    public function refresh(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // TODO: Implement refresh token validation
        // For now, return stub response

        return response()->json([
            'access_token' => Str::random(64),
            'expires_in' => 900,
        ]);
    }

    /**
     * User logout
     *
     * POST /auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->tokens()->delete();

            $this->auditLog->log($user, 'user_logged_out', [
                'email' => $user->email,
            ]);
        }

        return response()->json([
            'message' => 'Logout realizado com sucesso',
        ]);
    }

    /**
     * Enable MFA (TOTP)
     *
     * POST /auth/mfa/enable
     */
    public function enableMfa(Request $request): JsonResponse
    {
        $user = $request->user();

        // TODO: Generate TOTP secret and QR code
        // For now, return stub response

        $secret = Str::upper(Str::random(16));
        $recoveryCodes = collect(range(1, 8))->map(fn() => Str::random(6))->toArray();

        return response()->json([
            'secret' => $secret,
            'qr_code_url' => 'https://example.com/qr/' . base64_encode($secret),
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Verify MFA code
     *
     * POST /auth/mfa/verify
     */
    public function verifyMfa(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => ['required', 'regex:/^\d{6}$/'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // TODO: Verify TOTP code
        // For now, return stub response

        return response()->json([
            'message' => 'MFA verificado com sucesso',
            'mfa_enabled' => true,
        ]);
    }
}
