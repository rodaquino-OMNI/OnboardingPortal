<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * MFA/TOTP Service
 *
 * Implements Time-based One-Time Password (TOTP) authentication
 * compliant with RFC 6238 and ADR-002 P1 requirements.
 *
 * Features:
 * - TOTP secret generation and validation
 * - QR code generation for authenticator apps
 * - Recovery codes for account recovery
 * - Time-window validation (30-second intervals)
 */
class MFAService
{
    protected Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA();
    }

    /**
     * Generate a new TOTP secret
     *
     * @return string Base32 encoded secret (32 characters)
     */
    public function generateSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    /**
     * Verify a TOTP code
     *
     * @param string $secret Base32 encoded secret
     * @param string $code 6-digit TOTP code
     * @param int $window Time window for validation (default: 1 = ±30 seconds)
     * @return bool True if code is valid
     */
    public function verifyCode(string $secret, string $code, int $window = 1): bool
    {
        try {
            return $this->google2fa->verifyKey($secret, $code, $window);
        } catch (\Exception $e) {
            logger()->error('MFA verification error', [
                'error' => $e->getMessage(),
                'code_length' => strlen($code),
            ]);
            return false;
        }
    }

    /**
     * Generate recovery codes
     *
     * Creates 10 unique 8-character alphanumeric codes
     *
     * @return array Array of 10 recovery codes
     */
    public function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 10; $i++) {
            $codes[] = strtoupper(Str::random(4) . '-' . Str::random(4));
        }
        return $codes;
    }

    /**
     * Verify and consume a recovery code
     *
     * Recovery codes are single-use. After verification,
     * the code is removed from the user's recovery codes list.
     *
     * @param User $user User attempting recovery
     * @param string $code Recovery code to verify
     * @return bool True if code is valid and consumed
     */
    public function verifyRecoveryCode(User $user, string $code): bool
    {
        if (!$user->mfa_enabled || !$user->mfa_recovery_codes) {
            return false;
        }

        try {
            $recoveryCodes = json_decode(Crypt::decryptString($user->mfa_recovery_codes), true);

            if (!is_array($recoveryCodes)) {
                return false;
            }

            // Find and remove the code
            $codeIndex = array_search(strtoupper($code), $recoveryCodes, true);

            if ($codeIndex === false) {
                return false;
            }

            // Remove the used code
            unset($recoveryCodes[$codeIndex]);
            $recoveryCodes = array_values($recoveryCodes); // Re-index array

            // Save updated codes
            $user->mfa_recovery_codes = Crypt::encryptString(json_encode($recoveryCodes));
            $user->mfa_last_verified_at = now();
            $user->save();

            // Log recovery code usage
            logger()->warning('MFA recovery code used', [
                'user_id' => $user->id,
                'email' => $user->email,
                'remaining_codes' => count($recoveryCodes),
                'ip' => request()->ip(),
            ]);

            return true;
        } catch (\Exception $e) {
            logger()->error('MFA recovery code verification error', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Generate QR code for TOTP setup
     *
     * Creates a data URI containing an SVG QR code that can be
     * scanned by authenticator apps (Google Authenticator, Authy, etc.)
     *
     * @param string $secret Base32 encoded secret
     * @param string $email User's email address
     * @param string $issuer Application name (default: config('app.name'))
     * @return string Data URI containing SVG QR code
     */
    public function generateQRCode(string $secret, string $email, ?string $issuer = null): string
    {
        $issuer = $issuer ?? config('app.name', 'OmniPortal');

        // Generate otpauth:// URL
        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            $issuer,
            $email,
            $secret
        );

        // Create SVG QR code
        $renderer = new ImageRenderer(
            new RendererStyle(200, 0),
            new SvgImageBackEnd()
        );

        $writer = new Writer($renderer);
        $qrCodeSvg = $writer->writeString($qrCodeUrl);

        // Return as data URI
        return 'data:image/svg+xml;base64,' . base64_encode($qrCodeSvg);
    }

    /**
     * Enable MFA for a user
     *
     * @param User $user User to enable MFA for
     * @param string $secret TOTP secret
     * @param array $recoveryCodes Recovery codes
     * @return void
     */
    public function enableMFA(User $user, string $secret, array $recoveryCodes): void
    {
        $user->mfa_secret = Crypt::encryptString($secret);
        $user->mfa_recovery_codes = Crypt::encryptString(json_encode($recoveryCodes));
        $user->mfa_enabled = true;
        $user->mfa_enforced_at = now();
        $user->mfa_last_verified_at = now();
        $user->save();

        logger()->info('MFA enabled for user', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);
    }

    /**
     * Disable MFA for a user
     *
     * @param User $user User to disable MFA for
     * @return void
     */
    public function disableMFA(User $user): void
    {
        $user->mfa_secret = null;
        $user->mfa_recovery_codes = null;
        $user->mfa_enabled = false;
        $user->mfa_enforced_at = null;
        $user->mfa_last_verified_at = null;
        $user->save();

        logger()->warning('MFA disabled for user', [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);
    }

    /**
     * Check if user's MFA verification is recent
     *
     * @param User $user User to check
     * @param int $maxMinutes Maximum minutes since last verification (default: 15)
     * @return bool True if verification is recent
     */
    public function isRecentlyVerified(User $user, int $maxMinutes = 15): bool
    {
        if (!$user->mfa_enabled || !$user->mfa_last_verified_at) {
            return false;
        }

        return $user->mfa_last_verified_at->diffInMinutes(now()) <= $maxMinutes;
    }

    /**
     * Get decrypted secret for verification
     *
     * @param User $user User to get secret for
     * @return string|null Decrypted secret or null
     */
    public function getDecryptedSecret(User $user): ?string
    {
        if (!$user->mfa_enabled || !$user->mfa_secret) {
            return null;
        }

        try {
            return Crypt::decryptString($user->mfa_secret);
        } catch (\Exception $e) {
            logger()->error('Failed to decrypt MFA secret', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
