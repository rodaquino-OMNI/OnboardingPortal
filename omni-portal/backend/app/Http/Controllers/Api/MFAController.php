<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MFAService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * MFA Controller
 *
 * Handles Multi-Factor Authentication (MFA/TOTP) operations:
 * - Setup: Enable MFA for user account
 * - Verify: Verify TOTP code
 * - Disable: Disable MFA (requires password + current code)
 * - Recovery Codes: Regenerate recovery codes
 * - Verify Recovery: Verify and consume recovery code
 *
 * ADR-002 P1 Compliance: Multi-Factor Authentication Enforcement
 */
class MFAController extends Controller
{
    protected MFAService $mfaService;

    public function __construct(MFAService $mfaService)
    {
        $this->mfaService = $mfaService;
        $this->middleware('auth:sanctum');
    }

    /**
     * Set up MFA for the authenticated user
     *
     * POST /api/mfa/setup
     *
     * Request:
     * {
     *   "code": "123456" // TOTP code from authenticator app
     * }
     *
     * Response:
     * {
     *   "message": "MFA enabled successfully",
     *   "recovery_codes": ["ABCD-1234", "EFGH-5678", ...]
     * }
     */
    public function setup(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|size:6|regex:/^[0-9]+$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'validation_error',
                'message' => 'Invalid TOTP code format.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        // Check if MFA is already enabled
        if ($user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_already_enabled',
                'message' => 'Multi-factor authentication is already enabled for your account.',
            ], 400);
        }

        // Generate secret if not already in session
        if (!session()->has('mfa.secret')) {
            $secret = $this->mfaService->generateSecret();
            session()->put('mfa.secret', $secret);
        } else {
            $secret = session()->get('mfa.secret');
        }

        // Verify the TOTP code
        if (!$this->mfaService->verifyCode($secret, $request->code)) {
            return response()->json([
                'error' => 'invalid_code',
                'message' => 'The provided code is invalid. Please try again.',
            ], 422);
        }

        // Generate recovery codes
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();

        // Enable MFA for the user
        $this->mfaService->enableMFA($user, $secret, $recoveryCodes);

        // Clear session data
        session()->forget('mfa.secret');

        return response()->json([
            'message' => 'Multi-factor authentication enabled successfully.',
            'recovery_codes' => $recoveryCodes,
            'warning' => 'Save these recovery codes in a secure location. They can only be used once each.',
        ], 200);
    }

    /**
     * Get QR code for MFA setup
     *
     * GET /api/mfa/qr-code
     *
     * Response:
     * {
     *   "qr_code": "data:image/svg+xml;base64,...",
     *   "secret": "JBSWY3DPEHPK3PXP" // For manual entry
     * }
     */
    public function getQRCode(Request $request): JsonResponse
    {
        $user = $request->user();

        // Don't allow QR code generation if MFA is already enabled
        if ($user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_already_enabled',
                'message' => 'Multi-factor authentication is already enabled.',
            ], 400);
        }

        // Generate secret and store in session
        $secret = $this->mfaService->generateSecret();
        session()->put('mfa.secret', $secret);

        // Generate QR code
        $qrCode = $this->mfaService->generateQRCode($secret, $user->email);

        return response()->json([
            'qr_code' => $qrCode,
            'secret' => $secret,
            'message' => 'Scan this QR code with your authenticator app or enter the secret manually.',
        ], 200);
    }

    /**
     * Verify TOTP code
     *
     * POST /api/mfa/verify
     *
     * Request:
     * {
     *   "code": "123456"
     * }
     *
     * Response:
     * {
     *   "message": "Code verified successfully",
     *   "redirect": "https://..."
     * }
     */
    public function verify(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|size:6|regex:/^[0-9]+$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'validation_error',
                'message' => 'Invalid TOTP code format.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        // Check if MFA is enabled
        if (!$user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_not_enabled',
                'message' => 'Multi-factor authentication is not enabled for your account.',
            ], 400);
        }

        // Get decrypted secret
        $secret = $this->mfaService->getDecryptedSecret($user);

        if (!$secret) {
            logger()->error('Failed to retrieve MFA secret for verification', [
                'user_id' => $user->id,
            ]);

            return response()->json([
                'error' => 'mfa_error',
                'message' => 'An error occurred. Please contact support.',
            ], 500);
        }

        // Verify the TOTP code
        if (!$this->mfaService->verifyCode($secret, $request->code)) {
            return response()->json([
                'error' => 'invalid_code',
                'message' => 'The provided code is invalid. Please try again.',
            ], 422);
        }

        // Update last verified timestamp
        $user->mfa_last_verified_at = now();
        $user->save();

        // Get intended URL
        $intendedUrl = session()->pull('mfa.intended', url('/dashboard'));

        return response()->json([
            'message' => 'Code verified successfully.',
            'redirect' => $intendedUrl,
        ], 200);
    }

    /**
     * Disable MFA for the authenticated user
     *
     * POST /api/mfa/disable
     *
     * Request:
     * {
     *   "password": "current_password",
     *   "code": "123456" // Current TOTP code
     * }
     *
     * Response:
     * {
     *   "message": "MFA disabled successfully"
     * }
     */
    public function disable(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'password' => 'required|string',
            'code' => 'required|string|size:6|regex:/^[0-9]+$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'validation_error',
                'message' => 'Invalid request data.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        // Check if MFA is enabled
        if (!$user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_not_enabled',
                'message' => 'Multi-factor authentication is not enabled for your account.',
            ], 400);
        }

        // Verify password
        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'error' => 'invalid_password',
                'message' => 'The provided password is incorrect.',
            ], 422);
        }

        // Get decrypted secret
        $secret = $this->mfaService->getDecryptedSecret($user);

        if (!$secret) {
            return response()->json([
                'error' => 'mfa_error',
                'message' => 'An error occurred. Please contact support.',
            ], 500);
        }

        // Verify TOTP code
        if (!$this->mfaService->verifyCode($secret, $request->code)) {
            return response()->json([
                'error' => 'invalid_code',
                'message' => 'The provided code is invalid.',
            ], 422);
        }

        // Disable MFA
        $this->mfaService->disableMFA($user);

        return response()->json([
            'message' => 'Multi-factor authentication disabled successfully.',
            'warning' => 'Your account is now less secure. We recommend re-enabling MFA.',
        ], 200);
    }

    /**
     * Regenerate recovery codes
     *
     * GET /api/mfa/recovery-codes
     *
     * Response:
     * {
     *   "recovery_codes": ["ABCD-1234", "EFGH-5678", ...],
     *   "message": "Recovery codes regenerated"
     * }
     */
    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $user = $request->user();

        // Check if MFA is enabled
        if (!$user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_not_enabled',
                'message' => 'Multi-factor authentication is not enabled for your account.',
            ], 400);
        }

        // Generate new recovery codes
        $recoveryCodes = $this->mfaService->generateRecoveryCodes();

        // Update user's recovery codes
        $user->mfa_recovery_codes = encrypt(json_encode($recoveryCodes));
        $user->save();

        logger()->info('Recovery codes regenerated', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->json([
            'recovery_codes' => $recoveryCodes,
            'message' => 'Recovery codes regenerated successfully.',
            'warning' => 'Previous recovery codes are no longer valid. Save these new codes in a secure location.',
        ], 200);
    }

    /**
     * Verify recovery code
     *
     * POST /api/mfa/verify-recovery
     *
     * Request:
     * {
     *   "recovery_code": "ABCD-1234"
     * }
     *
     * Response:
     * {
     *   "message": "Recovery code verified",
     *   "redirect": "https://...",
     *   "remaining_codes": 9
     * }
     */
    public function verifyRecoveryCode(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'recovery_code' => 'required|string|min:9|max:9|regex:/^[A-Z0-9]{4}-[A-Z0-9]{4}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'validation_error',
                'message' => 'Invalid recovery code format.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        // Check if MFA is enabled
        if (!$user->mfa_enabled) {
            return response()->json([
                'error' => 'mfa_not_enabled',
                'message' => 'Multi-factor authentication is not enabled for your account.',
            ], 400);
        }

        // Verify and consume recovery code
        if (!$this->mfaService->verifyRecoveryCode($user, $request->recovery_code)) {
            return response()->json([
                'error' => 'invalid_recovery_code',
                'message' => 'The provided recovery code is invalid or has already been used.',
            ], 422);
        }

        // Get remaining recovery codes count
        $recoveryCodes = json_decode(decrypt($user->mfa_recovery_codes), true);
        $remainingCodes = count($recoveryCodes);

        // Get intended URL
        $intendedUrl = session()->pull('mfa.intended', url('/dashboard'));

        $response = [
            'message' => 'Recovery code verified successfully.',
            'redirect' => $intendedUrl,
            'remaining_codes' => $remainingCodes,
        ];

        // Warn if running low on recovery codes
        if ($remainingCodes <= 3) {
            $response['warning'] = "You have only {$remainingCodes} recovery codes remaining. Consider regenerating them soon.";
        }

        return response()->json($response, 200);
    }
}
