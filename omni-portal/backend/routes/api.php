<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\GamificationController;
use App\Http\Controllers\Api\GamificationPublicController;
use App\Http\Controllers\Api\LGPDController;
use App\Http\Controllers\Api\HealthQuestionnaireController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DocumentControllerV2;
use App\Http\Controllers\Api\SocialAuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\DocumentReviewController;
use App\Http\Controllers\Api\InterviewController;
use App\Http\Controllers\Api\InterviewSlotController;
use App\Http\Controllers\Api\TelemedicineSchedulingController;

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

// Base API route - returns API information
Route::get('/', [App\Http\Controllers\Api\ApiInfoController::class, 'index']);
Route::get('/test', function() { return ['test' => 'working']; });

// Health check and monitoring endpoints
Route::get('/health', [App\Http\Controllers\Api\ApiInfoController::class, 'health']);
Route::get('/status', [App\Http\Controllers\Api\MetricsController::class, 'status']);
Route::get('/metrics', [App\Http\Controllers\Api\MetricsController::class, 'metrics']);

// Public configuration endpoint (no auth required)
Route::get('/config/public', [App\Http\Controllers\Api\ConfigController::class, 'getPublicConfig']);

// Public Gamification Routes (for initial page load without auth)
Route::prefix('gamification/public')->group(function () {
    Route::get('/levels', [GamificationPublicController::class, 'getLevels']);
    Route::get('/progress', [GamificationPublicController::class, 'getDefaultProgress']);
    Route::get('/badges', [GamificationPublicController::class, 'getDefaultBadges']);
    Route::get('/leaderboard', [GamificationPublicController::class, 'getDefaultLeaderboard']);
    Route::get('/activity-feed', [GamificationPublicController::class, 'getDefaultActivityFeed']);
    Route::get('/dashboard', [GamificationPublicController::class, 'getDefaultDashboard']);
    Route::get('/achievements', [GamificationPublicController::class, 'getDefaultAchievements']);
    Route::get('/stats', [GamificationPublicController::class, 'getDefaultStats']);
});

// Public authentication routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [RegisterController::class, 'register']);
    Route::post('/check-email', [AuthController::class, 'checkEmail']);
    Route::post('/check-cpf', [AuthController::class, 'checkCpf']);
    
    
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

// Registration routes - Multi-step process with state validation
Route::prefix('register')->group(function () {
    Route::post('/step1', [RegisterController::class, 'step1'])
        ->middleware('registration.state:personal');
    
    // Protected registration routes (require partial authentication)
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/step2', [RegisterController::class, 'step2'])
            ->middleware('registration.state:contact');
        Route::post('/step3', [RegisterController::class, 'step3'])
            ->middleware('registration.state:security');
        Route::get('/progress', [RegisterController::class, 'progress']);
        Route::get('/validate-profile', [RegisterController::class, 'validateProfileCompletion']);
        Route::delete('/cancel', [RegisterController::class, 'cancel']);
    });
});

// Protected routes - Require authentication and completed registration
Route::middleware(['auth:sanctum', 'registration.completed', 'account.active'])->group(function () {
    
    // Legacy user endpoint for backward compatibility
    Route::get('/user', [AuthController::class, 'user']);
    
    // User-specific configuration
    Route::get('/config/user', [App\Http\Controllers\Api\ConfigController::class, 'getUserConfig']);
    
    // Profile management - Consolidated routes
    Route::prefix('profile')->group(function () {
        Route::get('/', [ProfileController::class, 'show']);
        Route::put('/', [ProfileController::class, 'update']);
        Route::post('/photo', [ProfileController::class, 'uploadPhoto']);
        Route::delete('/photo', [ProfileController::class, 'deletePhoto']);
        Route::get('/preferences', [ProfileController::class, 'preferences']);
        Route::put('/preferences', [ProfileController::class, 'updatePreferences']);
        Route::get('/security', [ProfileController::class, 'security']);
        Route::put('/emergency-contacts', [ProfileController::class, 'updateEmergencyContacts']);
        Route::put('/privacy-settings', [ProfileController::class, 'updatePrivacySettings']);
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
        Route::post('/submit', [HealthQuestionnaireController::class, 'submitQuestionnaire']);
        Route::post('/submit-progressive', [HealthQuestionnaireController::class, 'submitProgressive']);
        Route::post('/submit-unified', [HealthQuestionnaireController::class, 'submitUnified']);
        Route::post('/submit-dual-pathway', [HealthQuestionnaireController::class, 'submitDualPathway']);
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
        Route::get('/levels', [GamificationController::class, 'getLevels']);
        Route::get('/achievements', [GamificationController::class, 'getAchievements']);
        Route::get('/activity-feed', [GamificationController::class, 'getActivityFeed']);
        Route::get('/dashboard', [GamificationController::class, 'getDashboard']);
    });
    
    // Rewards System
    Route::prefix('rewards')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\RewardController::class, 'index']);
        Route::get('/history', [App\Http\Controllers\Api\RewardController::class, 'history']);
        Route::get('/{id}', [App\Http\Controllers\Api\RewardController::class, 'show']);
        Route::post('/{id}/claim', [App\Http\Controllers\Api\RewardController::class, 'claim']);
        Route::post('/{id}/redeem', [App\Http\Controllers\Api\RewardController::class, 'redeem']);
    });
    
    // Enhanced document upload routes (V2)
    Route::prefix('v2/documents')->group(function () {
        Route::post('/upload', [DocumentControllerV2::class, 'upload']);
        Route::get('/{id}/ocr-status', [DocumentControllerV2::class, 'getOCRStatus']);
        Route::post('/{id}/process-ocr', [DocumentControllerV2::class, 'processOCRFallback']);
    });

    // Image Processing API routes - NEW
    Route::prefix('image-processing')->group(function () {
        Route::post('/process', [App\Http\Controllers\Api\ImageProcessingController::class, 'processImage']);
        Route::get('/status/{processingId}', [App\Http\Controllers\Api\ImageProcessingController::class, 'getProcessingStatus']);
    });

    // Optimized document processing routes (V3)
    Route::prefix('v3/documents')->group(function () {
        Route::post('/upload', [App\Http\Controllers\Api\DocumentControllerV3::class, 'upload']);
        Route::get('/{id}/status', [App\Http\Controllers\Api\DocumentControllerV3::class, 'status']);
        Route::get('/{id}/ocr-results', [App\Http\Controllers\Api\DocumentControllerV3::class, 'getOcrResults']);
        Route::post('/{id}/reprocess', [App\Http\Controllers\Api\DocumentControllerV3::class, 'reprocess']);
        Route::get('/performance-report', [App\Http\Controllers\Api\DocumentControllerV3::class, 'performanceReport']);
    });
    
    // Interview Scheduling System
    Route::prefix('interviews')->group(function () {
        // Interview management for beneficiaries and interviewers
        Route::get('/', [App\Http\Controllers\Api\InterviewController::class, 'index']);
        Route::post('/', [App\Http\Controllers\Api\InterviewController::class, 'store']); // Book interview
        Route::get('/upcoming', [App\Http\Controllers\Api\InterviewController::class, 'upcoming']);
        Route::get('/available-slots', [App\Http\Controllers\Api\InterviewController::class, 'getAvailableSlots']); // Get available slots with timezone support
        Route::get('/recommended-slots', [App\Http\Controllers\Api\InterviewController::class, 'getRecommendedSlots']); // Get AI-recommended slots
        Route::post('/check-availability', [App\Http\Controllers\Api\InterviewController::class, 'checkSlotAvailability']); // Check slot availability with conflicts
        Route::get('/history', [App\Http\Controllers\Api\InterviewController::class, 'getHistory']); // Get interview history with filters
        Route::put('/notification-preferences', [App\Http\Controllers\Api\InterviewController::class, 'updateNotificationPreferences']); // Update notification preferences
        Route::get('/{interview}', [App\Http\Controllers\Api\InterviewController::class, 'show']);
        Route::put('/{interview}/reschedule', [App\Http\Controllers\Api\InterviewController::class, 'reschedule']);
        Route::post('/{interview}/cancel', [App\Http\Controllers\Api\InterviewController::class, 'cancel']);
        Route::post('/{interview}/start', [App\Http\Controllers\Api\InterviewController::class, 'start']); // Healthcare professionals only
        Route::post('/{interview}/complete', [App\Http\Controllers\Api\InterviewController::class, 'complete']); // Healthcare professionals only
        Route::post('/{interview}/rate', [App\Http\Controllers\Api\InterviewController::class, 'rateInterview']); // Rate completed interview
    });

    // Telemedicine Scheduling System (Completion Reward)
    Route::prefix('telemedicine')->group(function () {
        Route::get('/eligibility', [TelemedicineSchedulingController::class, 'checkEligibility']); // Check if user is eligible for telemedicine
        Route::get('/appointment-types', [TelemedicineSchedulingController::class, 'getAppointmentTypes']); // Get available telemedicine appointment types
        Route::get('/available-slots', [TelemedicineSchedulingController::class, 'getAvailableSlots']); // Get available telemedicine slots
        Route::post('/book', [TelemedicineSchedulingController::class, 'bookAppointment']); // Book telemedicine appointment
    });

    // Interview Slots management (Healthcare professionals and admins only)
    Route::prefix('interview-slots')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\InterviewSlotController::class, 'index']);
        Route::post('/', [App\Http\Controllers\Api\InterviewSlotController::class, 'store']);
        Route::post('/bulk-create', [App\Http\Controllers\Api\InterviewSlotController::class, 'bulkCreate']);
        Route::get('/calendar', [App\Http\Controllers\Api\InterviewSlotController::class, 'calendar']);
        Route::post('/check-availability', [App\Http\Controllers\Api\InterviewSlotController::class, 'checkAvailability']);
        Route::get('/{slot}', [App\Http\Controllers\Api\InterviewSlotController::class, 'show']);
        Route::put('/{slot}', [App\Http\Controllers\Api\InterviewSlotController::class, 'update']);
        Route::delete('/{slot}', [App\Http\Controllers\Api\InterviewSlotController::class, 'destroy']);
    });

    // Video Conferencing routes
    Route::middleware(['video.security'])->prefix('video')->group(function () {
        // Session management
        Route::post('/sessions', [App\Http\Controllers\Api\VideoConferencingController::class, 'createSession']);
        Route::post('/sessions/{sessionId}/join', [App\Http\Controllers\Api\VideoConferencingController::class, 'joinSession']);
        Route::get('/sessions/{sessionId}/status', [App\Http\Controllers\Api\VideoConferencingController::class, 'getSessionStatus']);
        Route::post('/sessions/{sessionId}/end', [App\Http\Controllers\Api\VideoConferencingController::class, 'endSession']);
        
        // Recording management
        Route::post('/sessions/{sessionId}/recording/start', [App\Http\Controllers\Api\VideoConferencingController::class, 'startRecording']);
        Route::post('/sessions/{sessionId}/recording/stop', [App\Http\Controllers\Api\VideoConferencingController::class, 'stopRecording']);
        Route::get('/recordings/{archiveId}/url', [App\Http\Controllers\Api\VideoConferencingController::class, 'getRecordingUrl']);
        
        // Screen sharing
        Route::post('/sessions/{sessionId}/screen-share', [App\Http\Controllers\Api\VideoConferencingController::class, 'enableScreenSharing']);
        
        // Chat (for future implementation)
        Route::get('/sessions/{sessionId}/chat', function () {
            return response()->json(['messages' => []]);
        });
        Route::post('/sessions/{sessionId}/chat', function () {
            return response()->json(['success' => true, 'message' => ['id' => uniqid()]]);
        });
        Route::get('/sessions/{sessionId}/chat/latest', function () {
            return response()->json(['success' => true, 'messages' => []]);
        });
        Route::post('/sessions/{sessionId}/typing', function () {
            return response()->json(['success' => true]);
        });
    });
});

// Admin Dashboard Routes - Comprehensive admin management system
Route::middleware(['auth:sanctum', 'admin.access'])->prefix('admin')->group(function () {
    
    // Dashboard Overview
    Route::get('/dashboard', [App\Http\Controllers\Api\AdminController::class, 'dashboard']);
    
    // Analytics and Reporting
    Route::prefix('analytics')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'analytics']);
        Route::get('/real-time', [App\Http\Controllers\Api\AdminController::class, 'realTimeAnalytics']);
        Route::get('/custom-reports', [App\Http\Controllers\Api\AdminController::class, 'customReports']);
        Route::post('/custom-reports', [App\Http\Controllers\Api\AdminController::class, 'createCustomReport']);
        Route::get('/export', [App\Http\Controllers\Api\AdminController::class, 'exportData']);
    });
    
    // User Management
    Route::prefix('users')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'users']);
        Route::get('/{user}', [App\Http\Controllers\Api\AdminController::class, 'userDetails']);
        Route::put('/{user}', [App\Http\Controllers\Api\AdminController::class, 'updateUser']);
        Route::post('/{user}/lock', [App\Http\Controllers\Api\AdminController::class, 'lockUser']);
        Route::post('/{user}/unlock', [App\Http\Controllers\Api\AdminController::class, 'unlockUser']);
        Route::post('/{user}/reset-password', [App\Http\Controllers\Api\AdminController::class, 'resetUserPassword']);
        Route::get('/{user}/activity', [App\Http\Controllers\Api\AdminController::class, 'userActivity']);
        Route::get('/{user}/audit-trail', [App\Http\Controllers\Api\AdminController::class, 'userAuditTrail']);
    });
    
    // Role and Permission Management
    Route::prefix('roles')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'roles']);
        Route::post('/', [App\Http\Controllers\Api\AdminController::class, 'createRole']);
        Route::get('/{role}', [App\Http\Controllers\Api\AdminController::class, 'roleDetails']);
        Route::put('/{role}', [App\Http\Controllers\Api\AdminController::class, 'updateRole']);
        Route::delete('/{role}', [App\Http\Controllers\Api\AdminController::class, 'deleteRole']);
        Route::post('/assign', [App\Http\Controllers\Api\AdminController::class, 'assignRole']);
        Route::post('/revoke', [App\Http\Controllers\Api\AdminController::class, 'revokeRole']);
    });
    
    Route::prefix('permissions')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'permissions']);
        Route::post('/', [App\Http\Controllers\Api\AdminController::class, 'createPermission']);
        Route::get('/categories', [App\Http\Controllers\Api\AdminController::class, 'permissionCategories']);
    });
    
    // Document Management
    Route::prefix('documents')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'documents']);
        Route::get('/{document}', [App\Http\Controllers\Api\AdminController::class, 'documentDetails']);
        Route::post('/{document}/approve', [App\Http\Controllers\Api\AdminController::class, 'approveDocument']);
        Route::post('/{document}/reject', [App\Http\Controllers\Api\AdminController::class, 'rejectDocument']);
        Route::get('/pending', [App\Http\Controllers\Api\AdminController::class, 'pendingDocuments']);
        Route::get('/statistics', [App\Http\Controllers\Api\AdminController::class, 'documentStatistics']);
    });
    
    // Health Questionnaire Management
    Route::prefix('health-questionnaires')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'healthQuestionnaires']);
        Route::get('/{questionnaire}', [App\Http\Controllers\Api\AdminController::class, 'questionnaireDetails']);
        Route::get('/templates/manage', [App\Http\Controllers\Api\AdminController::class, 'manageTemplates']);
        Route::post('/templates', [App\Http\Controllers\Api\AdminController::class, 'createTemplate']);
        Route::get('/analytics', [App\Http\Controllers\Api\AdminController::class, 'questionnaireAnalytics']);
    });
    
    // Security and Audit
    Route::prefix('security')->group(function () {
        Route::get('/audit', [App\Http\Controllers\Api\AdminController::class, 'securityAudit']);
        Route::get('/sessions', [App\Http\Controllers\Api\AdminController::class, 'adminSessions']);
        Route::post('/sessions/{sessionId}/terminate', [App\Http\Controllers\Api\AdminController::class, 'terminateSession']);
        Route::get('/alerts', [App\Http\Controllers\Api\AdminController::class, 'securityAlerts']);
        Route::post('/alerts/{alertId}/acknowledge', [App\Http\Controllers\Api\AdminController::class, 'acknowledgeAlert']);
        Route::get('/metrics', [App\Http\Controllers\Api\AdminController::class, 'securityMetrics']);
    });
    
    // System Management
    Route::prefix('system')->group(function () {
        Route::get('/settings', [App\Http\Controllers\Api\AdminController::class, 'systemSettings']);
        Route::post('/settings', [App\Http\Controllers\Api\AdminController::class, 'updateSystemSetting']);
        Route::get('/status', [App\Http\Controllers\Api\AdminController::class, 'systemStatus']);
        Route::get('/logs', [App\Http\Controllers\Api\AdminController::class, 'systemLogs']);
        Route::post('/maintenance', [App\Http\Controllers\Api\AdminController::class, 'toggleMaintenanceMode']);
        Route::get('/performance', [App\Http\Controllers\Api\AdminController::class, 'performanceMetrics']);
    });
    
    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'notifications']);
        Route::post('/{notificationId}/read', [App\Http\Controllers\Api\AdminController::class, 'markNotificationRead']);
        Route::post('/mark-all-read', [App\Http\Controllers\Api\AdminController::class, 'markAllNotificationsRead']);
        Route::post('/send', [App\Http\Controllers\Api\AdminController::class, 'sendNotification']);
    });
    
    // Dashboard Widgets
    Route::prefix('widgets')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'dashboardWidgets']);
        Route::post('/', [App\Http\Controllers\Api\AdminController::class, 'createWidget']);
        Route::put('/{widgetId}', [App\Http\Controllers\Api\AdminController::class, 'updateWidget']);
        Route::delete('/{widgetId}', [App\Http\Controllers\Api\AdminController::class, 'deleteWidget']);
        Route::post('/layout', [App\Http\Controllers\Api\AdminController::class, 'updateWidgetLayout']);
    });
    
    // Gamification Management
    Route::prefix('gamification')->group(function () {
        Route::get('/overview', [App\Http\Controllers\Api\AdminController::class, 'gamificationOverview']);
        Route::get('/badges', [App\Http\Controllers\Api\AdminController::class, 'manageBadges']);
        Route::post('/badges', [App\Http\Controllers\Api\AdminController::class, 'createBadge']);
        Route::get('/levels', [App\Http\Controllers\Api\AdminController::class, 'manageLevels']);
        Route::get('/leaderboards', [App\Http\Controllers\Api\AdminController::class, 'leaderboardManagement']);
    });
    
    // Clinical Health Risk Management
    Route::prefix('health-risks')->group(function () {
        // ML Predictions endpoints
        Route::get('/predictions/{beneficiaryId}', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getPredictions']);
        Route::get('/similar-patients/{beneficiaryId}', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getSimilarPatients']);
        Route::post('/generate-interventions', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'generateInterventions']);
        Route::post('/train-models', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'trainModels']);
        
        Route::get('/dashboard', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'dashboard']);
        Route::get('/alerts', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getAlerts']);
        Route::get('/alerts/{id}', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getAlert']);
        Route::post('/alerts/{id}/acknowledge', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'acknowledgeAlert']);
        Route::post('/alerts/{id}/intervention', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'createIntervention']);
        Route::post('/alerts/{id}/resolve', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'resolveAlert']);
        Route::get('/alerts/{id}/workflow', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getAlertWorkflow']);
        Route::get('/reports', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getReports']);
        Route::post('/reports/generate', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'generateReport']);
        Route::get('/reports/{id}/download', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'downloadReport']);
        Route::get('/population-analytics', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'getPopulationAnalytics']);
        Route::post('/process', [App\Http\Controllers\Api\Admin\AdminHealthRiskController::class, 'processRisks']);
    });
    
    // Company Management
    Route::prefix('companies')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\AdminController::class, 'companies']);
        Route::get('/{company}', [App\Http\Controllers\Api\AdminController::class, 'companyDetails']);
        Route::post('/', [App\Http\Controllers\Api\AdminController::class, 'createCompany']);
        Route::put('/{company}', [App\Http\Controllers\Api\AdminController::class, 'updateCompany']);
        Route::get('/{company}/users', [App\Http\Controllers\Api\AdminController::class, 'companyUsers']);
        Route::get('/{company}/analytics', [App\Http\Controllers\Api\AdminController::class, 'companyAnalytics']);
    });
});

// External Health Intelligence API (v1) - OAuth2 Protected
// These endpoints are for external health plan integrations
Route::prefix('v1/health-intelligence')->middleware(['auth:api', 'throttle:100,1'])->group(function () {
    // Population health metrics
    Route::get('/population-metrics', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'getPopulationMetrics']);
    
    // Risk profiles with filtering
    Route::get('/risk-profiles', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'getRiskProfiles']);
    
    // Predictive analytics
    Route::get('/predictive-analytics', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'getPredictiveAnalytics']);
    
    // Intervention effectiveness
    Route::get('/intervention-effectiveness', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'getInterventionEffectiveness']);
    
    // Executive summary reports
    Route::get('/executive-summary', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'getExecutiveSummary']);
    
    // Webhook management
    Route::post('/webhooks/critical-alerts', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'registerCriticalAlertWebhook']);
    Route::post('/alerts/notify', [App\Http\Controllers\Api\V1\HealthIntelligenceController::class, 'notifyAlert']);
});