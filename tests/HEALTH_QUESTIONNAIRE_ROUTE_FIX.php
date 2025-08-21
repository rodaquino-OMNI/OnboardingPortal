<?php

/**
 * CRITICAL FIX: Health Questionnaire Routes Registration
 * 
 * This file contains the missing routes that need to be added to routes/api.php
 * to enable health questionnaire data saving functionality.
 * 
 * INSTRUCTIONS:
 * 1. Copy the routes below and add them to routes/api.php after line 113
 * 2. Test with: php artisan route:list | grep health-questionnaires  
 * 3. Verify endpoints are accessible with authentication
 */

/*
// ADD THESE ROUTES TO routes/api.php:

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
});
*/

/**
 * Test function to verify routes are working
 */
function testHealthQuestionnaireRoutes()
{
    echo "Testing Health Questionnaire Routes...\n";
    
    // Test if routes are registered
    $routes = [
        'health-questionnaires.templates',
        'health-questionnaires.start', 
        'health-questionnaires.submit-unified',
        'health-questionnaires.submit-progressive',
        'health-questionnaires.submit-dual-pathway'
    ];
    
    foreach ($routes as $routeName) {
        try {
            $url = route($routeName);
            echo "✅ Route '$routeName' registered: $url\n";
        } catch (Exception $e) {
            echo "❌ Route '$routeName' NOT registered\n";
        }
    }
}

/**
 * Test database connectivity and table structure
 */
function testDatabaseStructure()
{
    echo "\nTesting Database Structure...\n";
    
    try {
        // Test connection
        \DB::connection()->getPdo();
        echo "✅ Database connection successful\n";
        
        // Test table exists
        if (\Schema::hasTable('health_questionnaires')) {
            echo "✅ health_questionnaires table exists\n";
            
            // Test required columns
            $requiredColumns = [
                'beneficiary_id', 'questionnaire_type', 'status', 
                'responses', 'risk_scores', 'ai_insights', 'metadata'
            ];
            
            foreach ($requiredColumns as $column) {
                if (\Schema::hasColumn('health_questionnaires', $column)) {
                    echo "✅ Column '$column' exists\n";
                } else {
                    echo "❌ Column '$column' missing\n";
                }
            }
        } else {
            echo "❌ health_questionnaires table does not exist\n";
        }
        
    } catch (Exception $e) {
        echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    }
}

/**
 * Test data persistence (requires working database)
 */
function testDataPersistence()
{
    echo "\nTesting Data Persistence...\n";
    
    try {
        // Create test beneficiary if needed
        $beneficiary = \App\Models\Beneficiary::first();
        if (!$beneficiary) {
            echo "❌ No beneficiary found for testing\n";
            return;
        }
        
        // Test create health questionnaire
        $questionnaire = \App\Models\HealthQuestionnaire::create([
            'beneficiary_id' => $beneficiary->id,
            'questionnaire_type' => 'test',
            'status' => 'completed',
            'responses' => ['test_question' => 'test_answer'],
            'risk_scores' => ['overall' => 5],
            'ai_insights' => ['test' => true],
            'metadata' => ['test_run' => now()->toISOString()]
        ]);
        
        echo "✅ Health questionnaire created with ID: {$questionnaire->id}\n";
        
        // Test retrieve and verify data
        $retrieved = \App\Models\HealthQuestionnaire::find($questionnaire->id);
        if ($retrieved && $retrieved->responses['test_question'] === 'test_answer') {
            echo "✅ Data persistence verified - data saved and retrieved correctly\n";
        } else {
            echo "❌ Data persistence failed - data not saved correctly\n";
        }
        
        // Clean up test data
        $questionnaire->delete();
        echo "✅ Test data cleaned up\n";
        
    } catch (Exception $e) {
        echo "❌ Data persistence test failed: " . $e->getMessage() . "\n";
    }
}

// Uncomment to run tests when executing this file directly
// testHealthQuestionnaireRoutes();
// testDatabaseStructure(); 
// testDataPersistence();

echo "\n=== HEALTH QUESTIONNAIRE VALIDATION COMPLETE ===\n";
echo "Next steps:\n";
echo "1. Add missing routes to routes/api.php\n"; 
echo "2. Fix database connectivity issues\n";
echo "3. Run: php artisan route:clear && php artisan config:clear\n";
echo "4. Test endpoints with frontend integration\n";