<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\MFAService;

/**
 * Require MFA Middleware
 *
 * Enforces Multi-Factor Authentication for protected routes.
 *
 * Flow:
 * 1. If user doesn't have MFA enabled -> redirect to /mfa/setup
 * 2. If user has MFA but hasn't verified recently -> redirect to /mfa/verify
 * 3. If user has MFA and verified recently -> allow access
 *
 * Verification window: 15 minutes (configurable)
 *
 * ADR-002 P1 Compliance: Multi-Factor Authentication Enforcement
 */
class RequireMFA
{
    protected MFAService $mfaService;

    public function __construct(MFAService $mfaService)
    {
        $this->mfaService = $mfaService;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // If no authenticated user, let auth middleware handle it
        if (!$user) {
            return $next($request);
        }

        // Check if MFA is enabled for the user
        if (!$user->mfa_enabled) {
            // User needs to set up MFA
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'mfa_required',
                    'message' => 'Multi-factor authentication must be set up for your account.',
                    'redirect' => route('mfa.setup'),
                ], 403);
            }

            return redirect()->route('mfa.setup')
                ->with('warning', 'Please set up multi-factor authentication to continue.');
        }

        // Check if user has verified MFA recently
        $verificationWindow = config('auth_security.mfa_verification_window_minutes', 15);

        if (!$this->mfaService->isRecentlyVerified($user, $verificationWindow)) {
            // Store intended URL for redirect after MFA verification
            session()->put('mfa.intended', $request->fullUrl());

            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'mfa_verification_required',
                    'message' => 'Please verify your identity with your authenticator app.',
                    'redirect' => route('mfa.verify'),
                ], 403);
            }

            return redirect()->route('mfa.verify')
                ->with('info', 'Please verify your identity to continue.');
        }

        // MFA is enabled and recently verified
        return $next($request);
    }
}
