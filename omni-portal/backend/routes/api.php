<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MetricsController;
use App\Http\Requests\Auth\LoginRequest;

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

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Metrics endpoint for Prometheus
Route::get('/metrics', [MetricsController::class, 'index'])->name('metrics');


// Health check endpoints
Route::prefix('health')->middleware('throttle:30,1')->group(function () {
    // Comprehensive health check
    Route::get('/', [App\Http\Controllers\Api\HealthController::class, 'health'])->name('health');
    
    // Kubernetes-style liveness probe
    Route::get('/live', [App\Http\Controllers\Api\HealthController::class, 'live'])->name('health.live');
    
    // Kubernetes-style readiness probe
    Route::get('/ready', [App\Http\Controllers\Api\HealthController::class, 'ready'])->name('health.ready');
    
    // Legacy health endpoint for backwards compatibility
    Route::get('/status', function () {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'service' => 'omni-portal-backend',
            'version' => config('app.version', '1.0.0'),
        ]);
    })->name('health.status');
});

// Tracing test endpoint (temporarily disabled)
/*
Route::get('/trace-test', function () {
    $tracer = \OpenTelemetry\API\Globals::tracerProvider()->getTracer('laravel-test');
    
    $span = $tracer->spanBuilder('test-operation')
        ->setSpanKind(\OpenTelemetry\API\Trace\SpanKind::KIND_SERVER)
        ->setAttributes([
            'test.attribute' => 'test-value',
            'user.id' => auth()->id() ?? 'anonymous',
        ])
        ->startSpan();

    try {
        // Simulate some work
        sleep(rand(1, 3));
        
        $span->addEvent('work-completed', [
            'result' => 'success',
        ]);
        
        return response()->json([
            'message' => 'Tracing test completed',
            'trace_id' => $span->getContext()->getTraceId(),
            'span_id' => $span->getContext()->getSpanId(),
        ]);
    } finally {
        $span->end();
    }
})->name('trace-test');
*/

// Authentication Routes
Route::prefix('auth')->group(function () {
    // Public authentication endpoints
    Route::post('login', [App\Http\Controllers\Api\AuthController::class, 'login'])->name('auth.login');
    Route::post('check-email', [App\Http\Controllers\Api\AuthController::class, 'checkEmail'])->name('auth.check-email');
    Route::post('check-cpf', [App\Http\Controllers\Api\AuthController::class, 'checkCpf'])->name('auth.check-cpf');
    
    // Registration endpoints
    Route::post('register', [App\Http\Controllers\Api\RegisterController::class, 'register'])->name('auth.register');
    Route::post('register/step1', [App\Http\Controllers\Api\RegisterController::class, 'step1'])->name('auth.register.step1');
    
    // Protected registration endpoints (require auth token from step1)
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('register/step2', [App\Http\Controllers\Api\RegisterController::class, 'step2'])->name('auth.register.step2');
        Route::post('register/step3', [App\Http\Controllers\Api\RegisterController::class, 'step3'])->name('auth.register.step3');
        Route::get('register/progress', [App\Http\Controllers\Api\RegisterController::class, 'progress'])->name('auth.register.progress');
        Route::post('register/validate-profile', [App\Http\Controllers\Api\RegisterController::class, 'validateProfileCompletion'])->name('auth.register.validate-profile');
        Route::delete('register/cancel', [App\Http\Controllers\Api\RegisterController::class, 'cancel'])->name('auth.register.cancel');
    });
    
    // Social Authentication Routes
    Route::get('{provider}/redirect', [App\Http\Controllers\Api\SocialAuthController::class, 'redirect'])
        ->name('auth.social.redirect');
    Route::get('{provider}/callback', [App\Http\Controllers\Api\SocialAuthController::class, 'callback'])
        ->name('auth.social.callback');
    
    // Protected authentication endpoints
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [App\Http\Controllers\Api\AuthController::class, 'logout'])->name('auth.logout');
        Route::post('logout-all', [App\Http\Controllers\Api\AuthController::class, 'logoutAll'])->name('auth.logout-all');
        Route::post('refresh', [App\Http\Controllers\Api\AuthController::class, 'refresh'])->name('auth.refresh');
        Route::get('user', [App\Http\Controllers\Api\AuthController::class, 'user'])->name('auth.user');
    });
});

// API Information endpoint
Route::get('/info', [App\Http\Controllers\Api\ApiInfoController::class, 'index'])->name('api.info');

// Health Questionnaire Routes - CRITICAL for data saving
Route::middleware('auth:sanctum')->prefix('health-questionnaires')->group(function () {
    // Template and session management
    Route::get('/templates', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'getTemplates'])
        ->name('health-questionnaires.templates');
    
    Route::post('/start', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'start'])
        ->name('health-questionnaires.start');
    
    // Progress tracking and auto-save
    Route::get('/{id}/progress', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'getProgress'])
        ->name('health-questionnaires.progress');
    
    Route::put('/{id}/responses', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'saveResponses'])
        ->name('health-questionnaires.save-responses');
    
    // AI insights
    Route::post('/{id}/ai-insights', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'getAIInsights'])
        ->name('health-questionnaires.ai-insights');
    
    // Submission endpoints (CRITICAL for data saving)
    Route::post('/submit', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'submitQuestionnaire'])
        ->name('health-questionnaires.submit');
    
    Route::post('/submit-progressive', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'submitProgressive'])
        ->name('health-questionnaires.submit-progressive');
    
    Route::post('/submit-unified', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'submitUnified'])
        ->name('health-questionnaires.submit-unified');
    
    Route::post('/submit-dual-pathway', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'submitDualPathway'])
        ->name('health-questionnaires.submit-dual-pathway');
    
    // Test endpoint for scoring algorithms (development only)
    Route::get('/test-scoring', [App\Http\Controllers\Api\HealthQuestionnaireController::class, 'testScoring'])
        ->name('health-questionnaires.test-scoring');
});

// Gamification Routes
Route::prefix('gamification')->group(function () {
    // Public endpoints (for testing and frontend compatibility)
    Route::get('/progress', [App\Http\Controllers\Api\GamificationController::class, 'getProgress'])->name('gamification.progress');
    Route::get('/badges', [App\Http\Controllers\Api\GamificationController::class, 'getBadges'])->name('gamification.badges');
    Route::get('/leaderboard', [App\Http\Controllers\Api\GamificationController::class, 'getLeaderboard'])->name('gamification.leaderboard');
    Route::get('/levels', [App\Http\Controllers\Api\GamificationController::class, 'getLevels'])->name('gamification.levels');
    
    // Additional endpoints available with authentication
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/stats', [App\Http\Controllers\Api\GamificationController::class, 'getStats'])->name('gamification.stats');
        Route::get('/achievements', [App\Http\Controllers\Api\GamificationController::class, 'getAchievements'])->name('gamification.achievements');
        Route::get('/activity-feed', [App\Http\Controllers\Api\GamificationController::class, 'getActivityFeed'])->name('gamification.activity-feed');
        Route::get('/dashboard', [App\Http\Controllers\Api\GamificationController::class, 'getDashboard'])->name('gamification.dashboard');
    });
});