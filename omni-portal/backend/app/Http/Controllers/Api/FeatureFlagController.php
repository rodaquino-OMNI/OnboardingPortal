<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\FeatureFlagService;
use Illuminate\Support\Facades\Auth;

class FeatureFlagController extends Controller
{
    /**
     * Get all feature flags for the current user
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $flags = FeatureFlagService::getAllFlags($user);
        
        return response()->json([
            'success' => true,
            'data' => $flags
        ]);
    }

    /**
     * Get specific feature flag status for current user
     */
    public function show(Request $request, $flag)
    {
        $user = Auth::user();
        $isEnabled = FeatureFlagService::isEnabled($flag, $user);
        $allFlags = FeatureFlagService::getAllFlags($user);
        
        $flagData = $allFlags[$flag] ?? null;
        
        if (!$flagData) {
            return response()->json([
                'success' => false,
                'error' => 'Feature flag not found'
            ], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'enabled' => $isEnabled,
                'user_enabled' => $isEnabled,
                'rollout_percentage' => $flagData['rollout_percentage'] ?? 0,
                'name' => $flagData['name'] ?? $flag,
                'description' => $flagData['description'] ?? null
            ]
        ]);
    }

    /**
     * Enable feature flag (admin only)
     */
    public function enable(Request $request, $flag)
    {
        // Check admin permissions
        if (!$this->hasAdminAccess($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient permissions'
            ], 403);
        }

        $validated = $request->validate([
            'rollout_percentage' => 'nullable|integer|min:0|max:100',
            'allowed_roles' => 'nullable|array',
            'allowed_users' => 'nullable|array',
            'metadata' => 'nullable|array'
        ]);

        $success = FeatureFlagService::enable($flag, $validated);
        
        return response()->json([
            'success' => $success,
            'message' => $success ? 'Feature flag enabled' : 'Failed to enable feature flag'
        ]);
    }

    /**
     * Disable feature flag (admin only)
     */
    public function disable(Request $request, $flag)
    {
        // Check admin permissions
        if (!$this->hasAdminAccess($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient permissions'
            ], 403);
        }

        $success = FeatureFlagService::disable($flag);
        
        return response()->json([
            'success' => $success,
            'message' => $success ? 'Feature flag disabled' : 'Failed to disable feature flag'
        ]);
    }

    /**
     * Set rollout percentage (admin only)
     */
    public function setRolloutPercentage(Request $request, $flag)
    {
        // Check admin permissions
        if (!$this->hasAdminAccess($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient permissions'
            ], 403);
        }

        $validated = $request->validate([
            'percentage' => 'required|integer|min:0|max:100'
        ]);

        $success = FeatureFlagService::setRolloutPercentage($flag, $validated['percentage']);
        
        return response()->json([
            'success' => $success,
            'message' => $success ? 'Rollout percentage updated' : 'Failed to update rollout percentage'
        ]);
    }

    /**
     * Enable feature for specific user (admin only)
     */
    public function enableForUser(Request $request, $flag)
    {
        // Check admin permissions
        if (!$this->hasAdminAccess($request)) {
            return response()->json([
                'success' => false,
                'error' => 'Insufficient permissions'
            ], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id'
        ]);

        $user = \App\Models\User::find($validated['user_id']);
        $success = FeatureFlagService::enableForUser($flag, $user);
        
        return response()->json([
            'success' => $success,
            'message' => $success ? 'Feature enabled for user' : 'Failed to enable feature for user'
        ]);
    }

    /**
     * Check if current user has admin access
     */
    private function hasAdminAccess(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return false;
        }

        // Check Spatie roles
        if ($user->hasRole(['super-admin', 'admin'])) {
            return true;
        }

        // Check custom admin roles
        if (method_exists($user, 'hasAdminAccess') && $user->hasAdminAccess()) {
            return true;
        }

        return false;
    }
}