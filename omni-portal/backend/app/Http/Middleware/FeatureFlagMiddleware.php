<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use App\Services\FeatureFlagService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * FeatureFlagMiddleware - Route-level feature flag enforcement
 *
 * Usage:
 * Route::get('/endpoint', [Controller::class, 'method'])
 *     ->middleware('feature.flag:sliceC_health');
 *
 * Features:
 * - Blocks access to feature-flagged routes
 * - Returns 403 Forbidden if flag is disabled
 * - Audit logs all feature flag checks
 * - Supports percentage-based rollout
 *
 * @see app/Services/FeatureFlagService.php
 * @see database/seeders/FeatureFlagSeeder.php
 */
class FeatureFlagMiddleware
{
    /**
     * Feature flag service
     */
    private FeatureFlagService $featureFlags;

    /**
     * Constructor - inject dependencies
     */
    public function __construct(FeatureFlagService $featureFlags)
    {
        $this->featureFlags = $featureFlags;
    }

    /**
     * Handle an incoming request
     *
     * @param Request $request
     * @param Closure(Request): (Response) $next
     * @param string $flagKey Feature flag key
     * @return Response
     */
    public function handle(Request $request, Closure $next, string $flagKey): Response
    {
        $userId = auth()->id();

        // Check if feature flag is enabled
        $isEnabled = $this->featureFlags->isEnabled($flagKey, $userId);

        // Audit log - feature flag check
        $this->auditLog($flagKey, $isEnabled, $userId);

        if (!$isEnabled) {
            Log::warning('Feature flag denied access', [
                'flag_key' => $flagKey,
                'user_id' => $userId,
                'route' => $request->path(),
            ]);

            return response()->json([
                'error' => 'Feature not available',
                'message' => 'This feature is currently unavailable',
                'flag_key' => $flagKey,
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }

    /**
     * Create audit log entry for feature flag check
     *
     * @param string $flagKey Feature flag key
     * @param bool $isEnabled Whether flag is enabled
     * @param int|null $userId User ID
     */
    private function auditLog(string $flagKey, bool $isEnabled, ?int $userId): void
    {
        try {
            AuditLog::create([
                'user_id' => $userId,
                'action' => 'feature_flag.checked',
                'resource_type' => 'feature_flag',
                'resource_id' => null,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'phi_accessed' => false,
                'metadata' => [
                    'flag_key' => $flagKey,
                    'is_enabled' => $isEnabled,
                    'route' => request()->path(),
                ],
                'occurred_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Log but don't throw - audit logging shouldn't block requests
            Log::error('Failed to create feature flag audit log', [
                'flag_key' => $flagKey,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
