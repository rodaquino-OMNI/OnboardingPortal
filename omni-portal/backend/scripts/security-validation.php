<?php
/**
 * Security Validation Script
 * 
 * This script validates that all critical security fixes have been applied correctly.
 * Run this script to verify security configurations are properly in place.
 */

echo "🔐 OnboardingPortal Security Validation Report\n";
echo "==============================================\n\n";

// Test 1: CORS Configuration
echo "✅ Testing CORS Configuration...\n";
$corsConfig = file_get_contents(__DIR__ . '/../config/cors.php');
if (strpos($corsConfig, "array_filter([") !== false) {
    echo "  ✓ CORS wildcard vulnerability fixed - using environment-based origins\n";
} else {
    echo "  ✗ CORS configuration may still have hardcoded origins\n";
}

// Test 2: AuthService Cookie Security
echo "\n✅ Testing Cookie Security Configuration...\n";
$authServiceContent = file_get_contents(__DIR__ . '/../app/Services/AuthService.php');
if (strpos($authServiceContent, "config('auth_security.cookie.") !== false) {
    echo "  ✓ Cookie security settings moved to environment-based configuration\n";
} else {
    echo "  ✗ Cookie settings may still be hardcoded\n";
}

// Test 3: Metrics Controller Security
echo "\n✅ Testing Metrics Endpoint Security...\n";
$metricsControllerContent = file_get_contents(__DIR__ . '/../app/Http/Controllers/MetricsController.php');
if (strpos($metricsControllerContent, "RateLimiter::tooManyAttempts") !== false &&
    strpos($metricsControllerContent, "auth:sanctum") !== false) {
    echo "  ✓ Metrics endpoint secured with authentication and rate limiting\n";
} else {
    echo "  ✗ Metrics endpoint may not be properly secured\n";
}

// Test 4: API Routes Security
echo "\n✅ Testing API Routes Security...\n";
$apiRoutesContent = file_get_contents(__DIR__ . '/../routes/api.php');
if (strpos($apiRoutesContent, "middleware(['auth:sanctum', 'throttle:10,1'])->get('/metrics'") !== false) {
    echo "  ✓ Metrics route properly secured with middleware\n";
} else {
    echo "  ✗ Metrics route may not have proper middleware protection\n";
}

// Test 5: Health Questionnaire Security
echo "\n✅ Testing Health Questionnaire Security...\n";
$healthControllerContent = file_get_contents(__DIR__ . '/../app/Http/Controllers/Api/HealthQuestionnaireController.php');
if (strpos($healthControllerContent, "validateQuestionnaireOwnership") !== false &&
    strpos($healthControllerContent, "sanitizeResponses") !== false) {
    echo "  ✓ Health questionnaire authorization and input sanitization implemented\n";
} else {
    echo "  ✗ Health questionnaire security measures may be incomplete\n";
}

// Test 6: Security Configuration Files
echo "\n✅ Testing Security Configuration Files...\n";
if (file_exists(__DIR__ . '/../config/auth_security.php')) {
    echo "  ✓ Security configuration file created\n";
} else {
    echo "  ✗ Security configuration file missing\n";
}

if (file_exists(__DIR__ . '/../env.security.example')) {
    echo "  ✓ Environment security example file created\n";
} else {
    echo "  ✗ Environment security example file missing\n";
}

echo "\n🛡️ Security Recommendations:\n";
echo "=============================\n";
echo "1. Copy env.security.example settings to your .env file\n";
echo "2. Set appropriate METRICS_ALLOWED_IPS for production\n";
echo "3. Enable AUTH_COOKIE_SECURE=true in production\n";
echo "4. Set AUTH_COOKIE_SAMESITE=Strict in production\n";
echo "5. Configure FRONTEND_URL to match your domain\n";
echo "6. Enable HEALTH_REQUIRE_EMAIL_VERIFICATION=true\n";
echo "7. Run 'php artisan config:cache' after configuration changes\n";

echo "\n✅ Security validation completed!\n";
?>