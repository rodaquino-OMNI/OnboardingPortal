<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\GamificationController;
use App\Http\Controllers\Api\LGPDController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\UserController;
// use App\Http\Controllers\Api\VideoController;
// use App\Http\Controllers\Api\WebSocketController;
use App\Http\Controllers\TestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Test routes for request correlation (can be removed in production)
Route::prefix('test')->group(function () {
    Route::get('/endpoint', [TestController::class, 'testEndpoint']);
    Route::get('/error', [TestController::class, 'testError']);
    Route::post('/validation', [TestController::class, 'testValidation']);
    Route::get('/trace', [TestController::class, 'testTrace']);
});

// Health check endpoints
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
        'environment' => app()->environment(),
    ]);
});

Route::get('/health/database', function () {
    try {
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        return response()->json([
            'status' => 'ok',
            'database' => 'connected',
            'timestamp' => now()->toISOString(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'database' => 'disconnected',
            'error' => $e->getMessage(),
            'timestamp' => now()->toISOString(),
        ], 503);
    }
});

// Authentication routes (public)
Route::prefix('auth')->group(function () {
    // Public authentication endpoints
    Route::post('/login', [AuthController::class, 'login'])->name('api.auth.login');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    
    // Social authentication
    Route::get('/{provider}/redirect', [AuthController::class, 'redirectToProvider'])
        ->where('provider', 'google|facebook|instagram');
    Route::get('/{provider}/callback', [AuthController::class, 'handleProviderCallback'])
        ->where('provider', 'google|facebook|instagram');

    // Protected authentication endpoints (require authentication)
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/user', [AuthController::class, 'user'])->name('api.auth.user');
        Route::post('/logout', [AuthController::class, 'logout'])->name('api.auth.logout');
        Route::post('/refresh', [AuthController::class, 'refresh']);
    });
});

// Registration routes (public)
Route::prefix('register')->group(function () {
    Route::post('/step1', [RegistrationController::class, 'step1']);
    Route::post('/step2', [RegistrationController::class, 'step2']);
    Route::post('/step3', [RegistrationController::class, 'step3']);
    Route::get('/progress', [RegistrationController::class, 'getProgress']);
    Route::delete('/cancel', [RegistrationController::class, 'cancel']);
});

// Company management routes (for testing - should be protected in production)
Route::prefix('companies')->group(function () {
    Route::post('/', function (\Illuminate\Http\Request $request) {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'domain' => 'required|string|max:255|unique:companies,domain',
                'industry' => 'nullable|string|max:255',
                'size' => 'nullable|string|max:50',
                'address' => 'nullable|string|max:500',
                'city' => 'nullable|string|max:255',
                'country' => 'nullable|string|max:255',
                'phone' => 'nullable|string|max:20',
                'email' => 'nullable|email|max:255',
            ]);

            // Create company record in database
            $company = \Illuminate\Support\Facades\DB::table('companies')->insertGetId(array_merge($validated, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            return response()->json([
                'id' => $company,
                'status' => 'created',
                'message' => 'Company created successfully',
                'timestamp' => now()->toISOString(),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Company creation failed',
                'message' => $e->getMessage(),
                'timestamp' => now()->toISOString(),
            ], 422);
        }
    });
    
    Route::get('/', function () {
        try {
            $companies = \Illuminate\Support\Facades\DB::table('companies')->get();
            return response()->json($companies);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch companies',
                'message' => $e->getMessage(),
                'timestamp' => now()->toISOString(),
            ], 500);
        }
    });
});

// Protected API routes (require authentication)
Route::middleware(['auth:sanctum'])->group(function () {
    
    // User profile routes
    Route::prefix('profile')->group(function () {
        Route::get('/', [ProfileController::class, 'show']);
        Route::put('/', [ProfileController::class, 'update']);
        Route::post('/photo', [ProfileController::class, 'uploadPhoto']);
        Route::delete('/photo', [ProfileController::class, 'deletePhoto']);
    });

    // User management routes
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::get('/{user}', [UserController::class, 'show']);
        Route::put('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
    });

    // Gamification routes
    Route::prefix('gamification')->group(function () {
        Route::get('/progress', [GamificationController::class, 'getProgress']);
        Route::get('/stats', [GamificationController::class, 'getStats']);
        Route::get('/badges', [GamificationController::class, 'getBadges']);
        Route::get('/leaderboard', [GamificationController::class, 'getLeaderboard']);
        Route::get('/activity-feed', [GamificationController::class, 'getActivityFeed']);
        Route::get('/dashboard', [GamificationController::class, 'getDashboard']);
        Route::get('/levels', [GamificationController::class, 'getLevels']);
        Route::post('/claim-badge', [GamificationController::class, 'claimBadge']);
    });

    // LGPD routes
    Route::prefix('lgpd')->group(function () {
        Route::get('/privacy-settings', [LGPDController::class, 'getPrivacySettings']);
        Route::put('/privacy-settings', [LGPDController::class, 'updatePrivacySettings']);
        Route::get('/consent-history', [LGPDController::class, 'getConsentHistory']);
        Route::get('/data-processing-activities', [LGPDController::class, 'getDataProcessingActivities']);
        Route::get('/export-data', [LGPDController::class, 'exportUserData']);
        Route::get('/export-data-pdf', [LGPDController::class, 'exportUserDataPdf']);
        Route::post('/withdraw-consent', [LGPDController::class, 'withdrawConsent']);
        Route::delete('/delete-account', [LGPDController::class, 'deleteAccount']);
    });

    // Admin routes (require admin access)
    Route::middleware(['admin.access'])->prefix('admin')->group(function () {
        // Dashboard and overview
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');
        Route::get('/analytics', [AdminController::class, 'analytics'])->name('admin.analytics');
        Route::get('/system-status', [AdminController::class, 'systemStatus'])->name('admin.system-status');
        Route::get('/system-health', [AdminController::class, 'getSystemHealth']);
        Route::get('/audit-logs', [AdminController::class, 'getAuditLogs']);
        
        // User management - simplified existing routes
        Route::get('/users', [AdminController::class, 'getUsers']);
        Route::post('/users/{user}/suspend', [AdminController::class, 'suspendUser']);
        Route::post('/users/{user}/activate', [AdminController::class, 'activateUser']);
        Route::post('/users/{user}/reset-password', [AdminController::class, 'resetUserPassword']);
        
        // Role management
        Route::get('/roles', [AdminController::class, 'roles'])->name('admin.roles');
        Route::post('/roles', [AdminController::class, 'createRole'])->name('admin.roles.create');
        Route::put('/roles/{id}', [AdminController::class, 'updateRole'])->name('admin.roles.update');
        Route::delete('/roles/{id}', [AdminController::class, 'deleteRole'])->name('admin.roles.delete');
        Route::post('/roles/assign', [AdminController::class, 'assignRole'])->name('admin.roles.assign');
        Route::post('/roles/revoke', [AdminController::class, 'revokeRole'])->name('admin.roles.revoke');
        Route::get('/permissions', [AdminController::class, 'permissions'])->name('admin.permissions');
        
        // System settings
        Route::get('/system-settings', [AdminController::class, 'systemSettings'])->name('admin.system-settings');
        Route::put('/system-settings', [AdminController::class, 'updateSystemSetting'])->name('admin.system-settings.update');
        Route::get('/system/health', [AdminController::class, 'getSystemHealth'])->name('admin.system.health');
        Route::get('/system/metrics', [AdminController::class, 'getSystemMetrics'])->name('admin.system.metrics');
        
        // Security audit
        Route::get('/security-audit', [AdminController::class, 'securityAudit'])->name('admin.security-audit');
        Route::get('/security/threats', [AdminController::class, 'getThreatAlerts'])->name('admin.security.threats');
        Route::get('/security/compliance', [AdminController::class, 'getComplianceReport'])->name('admin.security.compliance');
        Route::get('/security-logs', [AdminController::class, 'securityLogs'])->name('admin.security-logs');
        
        // Feature flags
        Route::get('/feature-flags', [App\Http\Controllers\Api\FeatureFlagController::class, 'index'])->name('admin.feature-flags');
        Route::get('/feature-flags/{flag}', [App\Http\Controllers\Api\FeatureFlagController::class, 'show'])->name('admin.feature-flags.show');
        Route::post('/feature-flags/{flag}/enable', [App\Http\Controllers\Api\FeatureFlagController::class, 'enable'])->name('admin.feature-flags.enable');
        Route::post('/feature-flags/{flag}/disable', [App\Http\Controllers\Api\FeatureFlagController::class, 'disable'])->name('admin.feature-flags.disable');
        Route::post('/feature-flags/{flag}/rollout', [App\Http\Controllers\Api\FeatureFlagController::class, 'setRolloutPercentage'])->name('admin.feature-flags.rollout');
        Route::post('/feature-flags/{flag}/user', [App\Http\Controllers\Api\FeatureFlagController::class, 'enableForUser'])->name('admin.feature-flags.user');
        
        // System management
        Route::post('/clear-cache', [AdminController::class, 'clearCache']);
        Route::post('/maintenance-mode', [AdminController::class, 'toggleMaintenanceMode']);
        
        // SECURED Metrics endpoint - ADMIN ACCESS ONLY with rate limiting
        Route::middleware(['throttle:10,1'])->get('/metrics', [App\Http\Controllers\MetricsController::class, 'index'])
            ->name('admin.metrics');
    });

    // Video processing routes (Controller not implemented yet)
    // Route::prefix('videos')->group(function () {
    //     Route::post('/upload', [VideoController::class, 'upload']);
    //     Route::get('/{video}', [VideoController::class, 'show']);
    //     Route::post('/{video}/process', [VideoController::class, 'process']);
    //     Route::get('/{video}/status', [VideoController::class, 'getProcessingStatus']);
    //     Route::delete('/{video}', [VideoController::class, 'destroy']);
    // });

    // WebSocket authentication routes (Controller not implemented yet)
    // Route::prefix('websocket')->group(function () {
    //     Route::post('/auth', [WebSocketController::class, 'authenticate']);
    //     Route::get('/channels', [WebSocketController::class, 'getChannels']);
    // });
});

// Catch-all route for undefined API endpoints
Route::fallback(function () {
    return response()->json([
        'success' => false,
        'error' => [
            'code' => 'ENDPOINT_NOT_FOUND',
            'message' => 'The requested API endpoint was not found.',
            'request_id' => request()->header('X-Request-ID', 'unknown'),
            'timestamp' => now()->toISOString(),
        ]
    ], 404);
});