<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RegistrationFlowController;
use App\Http\Controllers\Api\GamificationController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\DocumentsController;
use App\Http\Controllers\Api\Health\QuestionnaireController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public routes (no authentication required)
Route::prefix('v1')->group(function () {

    // Registration Flow (Sprint 2C)
    Route::post('/register', [RegistrationFlowController::class, 'register'])
        ->name('api.register');

    Route::get('/callback-verify', [RegistrationFlowController::class, 'verifyEmail'])
        ->name('api.verify-email');

    // Authentication (existing)
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->name('api.auth.login');

    Route::post('/auth/refresh', [AuthController::class, 'refresh'])
        ->name('api.auth.refresh');
});

// Protected routes (authentication required)
Route::prefix('v1')->middleware(['auth:sanctum'])->group(function () {

    // Registration Flow - Profile Completion (Sprint 2C)
    Route::post('/profile/minimal', [RegistrationFlowController::class, 'updateProfileMinimal'])
        ->name('api.profile.minimal');

    // Authentication (existing)
    Route::post('/auth/logout', [AuthController::class, 'logout'])
        ->name('api.auth.logout');

    Route::post('/auth/mfa/enable', [AuthController::class, 'enableMfa'])
        ->name('api.auth.mfa.enable');

    Route::post('/auth/mfa/verify', [AuthController::class, 'verifyMfa'])
        ->name('api.auth.mfa.verify');

    // Gamification (existing)
    Route::prefix('gamification')->group(function () {
        Route::post('/points/earn', [GamificationController::class, 'earnPoints'])
            ->name('api.gamification.earn-points');

        Route::get('/levels/current', [GamificationController::class, 'getCurrentLevel'])
            ->name('api.gamification.current-level');

        Route::get('/badges', [GamificationController::class, 'getBadges'])
            ->name('api.gamification.badges');

        Route::get('/progress', [GamificationController::class, 'getProgress'])
            ->name('api.gamification.progress');
    });

    // Onboarding (existing)
    Route::prefix('onboarding')->group(function () {
        Route::get('/status', [OnboardingController::class, 'getStatus'])
            ->name('api.onboarding.status');

        Route::get('/next-step', [OnboardingController::class, 'getNextStep'])
            ->name('api.onboarding.next-step');
    });

    // Documents (existing - legacy)
    Route::prefix('documents')->group(function () {
        Route::post('/upload', [DocumentsController::class, 'upload'])
            ->name('api.documents.upload');

        Route::get('/', [DocumentsController::class, 'list'])
            ->name('api.documents.list');

        Route::get('/{id}', [DocumentsController::class, 'show'])
            ->name('api.documents.show');

        // Slice B: Documents flow (feature-flagged)
        Route::post('/presign', [\App\Http\Controllers\Api\SliceBDocumentsController::class, 'presign'])
            ->name('api.documents.presign');

        Route::post('/submit', [\App\Http\Controllers\Api\SliceBDocumentsController::class, 'submit'])
            ->name('api.documents.submit');

        Route::get('/{documentId}/status', [\App\Http\Controllers\Api\SliceBDocumentsController::class, 'status'])
            ->name('api.documents.status');
    });

    // Slice C: Health Questionnaire Module (Feature Flag Protected)
    Route::prefix('health')->middleware(['feature.flag:sliceC_health'])->group(function () {
        // Get questionnaire schema (authenticated users)
        Route::get('/schema', [QuestionnaireController::class, 'getSchema'])
            ->name('api.health.schema');

        // Create/submit questionnaire response (verified users only)
        Route::post('/response', [QuestionnaireController::class, 'createResponse'])
            ->middleware('verified')
            ->name('api.health.response.create');

        // Get questionnaire response metadata
        Route::get('/response/{id}', [QuestionnaireController::class, 'getResponse'])
            ->name('api.health.response.show');

        // Update draft response (before submission)
        Route::patch('/response/{id}', [QuestionnaireController::class, 'updateResponse'])
            ->name('api.health.response.update');
    });
});

// CSRF Cookie Route (for SPA authentication)
Route::get('/sanctum/csrf-cookie', function () {
    return response()->json(['message' => 'CSRF cookie set']);
})->name('sanctum.csrf-cookie');
