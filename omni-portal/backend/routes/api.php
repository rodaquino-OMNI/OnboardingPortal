<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\GamificationController;
use App\Http\Controllers\Api\LGPDController;
use App\Http\Controllers\Api\HealthQuestionnaireController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\SocialAuthController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'Omni Onboarding Portal API',
        'version' => '1.0.0',
        'timestamp' => now()
    ]);
});

// Public authentication routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/check-email', [AuthController::class, 'checkEmail']);
    Route::post('/check-cpf', [AuthController::class, 'checkCpf']);
    
    // Simple test login endpoint
    Route::post('/test-login', function (\Illuminate\Http\Request $request) {
        $email = $request->input('email');
        $password = $request->input('password');
        
        // Debug info
        return response()->json([
            'request_all' => $request->all(),
            'email' => $email,
            'password' => $password,
            'user_exists' => \App\Models\User::where('email', $email)->exists(),
        ]);
    });
    
    // Protected auth routes
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::get('/user', [AuthController::class, 'user']);
    });
    
    // Social authentication routes
    Route::get('/{provider}/redirect', [SocialAuthController::class, 'redirect'])
        ->where('provider', 'google|facebook|instagram');
    Route::get('/{provider}/callback', [SocialAuthController::class, 'callback'])
        ->where('provider', 'google|facebook|instagram');
});

// Registration routes - Multi-step process
Route::prefix('register')->group(function () {
    Route::post('/step1', [RegisterController::class, 'step1']);
    
    // Protected registration routes (require partial authentication)
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/step2', [RegisterController::class, 'step2']);
        Route::post('/step3', [RegisterController::class, 'step3']);
        Route::get('/progress', [RegisterController::class, 'progress']);
        Route::delete('/cancel', [RegisterController::class, 'cancel']);
    });
});

// Protected routes - Require authentication and completed registration
Route::middleware(['auth:sanctum', 'registration.completed', 'account.active'])->group(function () {
    
    // Legacy user endpoint for backward compatibility
    Route::get('/user', [AuthController::class, 'user']);
    
    // Profile management
    Route::prefix('profile')->group(function () {
        Route::get('/', [ProfileController::class, 'show']);
        Route::put('/', [ProfileController::class, 'update']);
        Route::post('/photo', [ProfileController::class, 'uploadPhoto']);
        Route::delete('/photo', [ProfileController::class, 'deletePhoto']);
        Route::get('/preferences', [ProfileController::class, 'preferences']);
        Route::put('/preferences', [ProfileController::class, 'updatePreferences']);
        Route::get('/security', [ProfileController::class, 'security']);
    });
    
    // LGPD Compliance routes
    Route::prefix('lgpd')->group(function () {
        Route::get('/export-data', [LGPDController::class, 'exportData']);
        Route::get('/export-data-pdf', [LGPDController::class, 'exportDataPdf']);
        Route::delete('/delete-account', [LGPDController::class, 'deleteAccount']);
        Route::get('/privacy-settings', [LGPDController::class, 'getPrivacySettings']);
        Route::put('/privacy-settings', [LGPDController::class, 'updatePrivacySettings']);
        Route::get('/consent-history', [LGPDController::class, 'getConsentHistory']);
        Route::post('/withdraw-consent', [LGPDController::class, 'withdrawConsent']);
        Route::get('/data-processing-activities', [LGPDController::class, 'getDataProcessingActivities']);
    });
    
    // Health Questionnaires
    Route::prefix('health-questionnaires')->group(function () {
        Route::get('/templates', [HealthQuestionnaireController::class, 'getTemplates']);
        Route::post('/start', [HealthQuestionnaireController::class, 'start']);
        Route::get('/{questionnaire}/progress', [HealthQuestionnaireController::class, 'getProgress']);
        Route::put('/{questionnaire}/responses', [HealthQuestionnaireController::class, 'saveResponses']);
        Route::post('/{questionnaire}/ai-insights', [HealthQuestionnaireController::class, 'getAIInsights']);
    });
    
    // Document Management
    Route::prefix('documents')->group(function () {
        Route::get('/', [DocumentController::class, 'index']);
        Route::post('/upload', [DocumentController::class, 'upload']);
        Route::get('/validation-progress', [DocumentController::class, 'getValidationProgress']);
        Route::get('/{document}', [DocumentController::class, 'show']);
        Route::get('/{document}/download', [DocumentController::class, 'download']);
        Route::post('/{document}/process-ocr', [DocumentController::class, 'processOCR']);
        Route::post('/{document}/validate-ocr', [DocumentController::class, 'validateOCR']);
        Route::delete('/{document}', [DocumentController::class, 'destroy']);
    });
    
    // Gamification
    Route::prefix('gamification')->group(function () {
        Route::get('/progress', [GamificationController::class, 'getProgress']);
        Route::get('/stats', [GamificationController::class, 'getStats']);
        Route::get('/leaderboard', [GamificationController::class, 'getLeaderboard']);
        Route::get('/badges', [GamificationController::class, 'getBadges']);
        Route::get('/achievements', [GamificationController::class, 'getAchievements']);
        Route::get('/activity-feed', [GamificationController::class, 'getActivityFeed']);
        Route::get('/dashboard', [GamificationController::class, 'getDashboard']);
    });
});