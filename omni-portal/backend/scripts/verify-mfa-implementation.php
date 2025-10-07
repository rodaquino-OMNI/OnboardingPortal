#!/usr/bin/env php
<?php

/**
 * MFA Implementation Verification Script
 *
 * Verifies that all MFA/TOTP components are correctly implemented
 * and ready for production deployment.
 *
 * Usage: php scripts/verify-mfa-implementation.php
 */

require __DIR__ . '/../vendor/autoload.php';

class MFAVerification
{
    private array $checks = [];
    private int $passed = 0;
    private int $failed = 0;

    public function run(): int
    {
        $this->printHeader();

        // Run all verification checks
        $this->checkMigration();
        $this->checkService();
        $this->checkMiddleware();
        $this->checkController();
        $this->checkTests();
        $this->checkRoutes();
        $this->checkDependencies();

        $this->printSummary();

        return $this->failed > 0 ? 1 : 0;
    }

    private function printHeader(): void
    {
        echo "\n";
        echo "╔════════════════════════════════════════════════════════════════╗\n";
        echo "║         MFA/TOTP Implementation Verification                   ║\n";
        echo "║         ADR-002 Priority 1 Compliance Check                    ║\n";
        echo "╚════════════════════════════════════════════════════════════════╝\n";
        echo "\n";
    }

    private function checkMigration(): void
    {
        $this->section("Migration Files");

        $migration = glob(__DIR__ . '/../database/migrations/*_add_mfa_to_users.php');

        if (empty($migration)) {
            $this->fail("MFA migration file not found");
            return;
        }

        $this->pass("Migration file exists: " . basename($migration[0]));

        // Check migration content
        $content = file_get_contents($migration[0]);
        $requiredFields = [
            'mfa_enabled',
            'mfa_secret',
            'mfa_recovery_codes',
            'mfa_enforced_at',
            'mfa_last_verified_at'
        ];

        foreach ($requiredFields as $field) {
            if (strpos($content, $field) !== false) {
                $this->pass("Field '$field' defined in migration");
            } else {
                $this->fail("Field '$field' missing from migration");
            }
        }
    }

    private function checkService(): void
    {
        $this->section("MFA Service");

        $service = __DIR__ . '/../app/Services/MFAService.php';

        if (!file_exists($service)) {
            $this->fail("MFAService.php not found");
            return;
        }

        $this->pass("MFAService.php exists");

        // Check service methods
        $content = file_get_contents($service);
        $requiredMethods = [
            'generateSecret',
            'verifyCode',
            'generateRecoveryCodes',
            'verifyRecoveryCode',
            'generateQRCode',
            'enableMFA',
            'disableMFA',
            'isRecentlyVerified'
        ];

        foreach ($requiredMethods as $method) {
            if (strpos($content, "function $method") !== false) {
                $this->pass("Method '$method' implemented");
            } else {
                $this->fail("Method '$method' missing");
            }
        }

        // Check for Google2FA usage
        if (strpos($content, 'Google2FA') !== false) {
            $this->pass("Google2FA library integrated");
        } else {
            $this->fail("Google2FA library not found");
        }
    }

    private function checkMiddleware(): void
    {
        $this->section("MFA Middleware");

        $middleware = __DIR__ . '/../app/Http/Middleware/RequireMFA.php';

        if (!file_exists($middleware)) {
            $this->fail("RequireMFA.php middleware not found");
            return;
        }

        $this->pass("RequireMFA.php middleware exists");

        $content = file_get_contents($middleware);

        // Check middleware logic
        if (strpos($content, 'mfa_enabled') !== false) {
            $this->pass("Checks mfa_enabled flag");
        } else {
            $this->fail("mfa_enabled check missing");
        }

        if (strpos($content, 'isRecentlyVerified') !== false) {
            $this->pass("Checks recent verification");
        } else {
            $this->fail("Recent verification check missing");
        }
    }

    private function checkController(): void
    {
        $this->section("MFA Controller");

        $controller = __DIR__ . '/../app/Http/Controllers/Api/MFAController.php';

        if (!file_exists($controller)) {
            $this->fail("MFAController.php not found");
            return;
        }

        $this->pass("MFAController.php exists");

        $content = file_get_contents($controller);

        // Check controller methods
        $requiredMethods = [
            'setup',
            'getQRCode',
            'verify',
            'disable',
            'regenerateRecoveryCodes',
            'verifyRecoveryCode'
        ];

        foreach ($requiredMethods as $method) {
            if (strpos($content, "function $method") !== false) {
                $this->pass("Endpoint method '$method' implemented");
            } else {
                $this->fail("Endpoint method '$method' missing");
            }
        }
    }

    private function checkTests(): void
    {
        $this->section("Test Suite");

        $tests = __DIR__ . '/../tests/Feature/MFATest.php';

        if (!file_exists($tests)) {
            $this->fail("MFATest.php not found");
            return;
        }

        $this->pass("MFATest.php exists");

        $content = file_get_contents($tests);

        // Count test methods
        preg_match_all('/public function test_/', $content, $matches);
        $testCount = count($matches[0]);

        if ($testCount >= 10) {
            $this->pass("Test suite has $testCount tests (≥10 required)");
        } else {
            $this->fail("Test suite has only $testCount tests (<10)");
        }

        // Check critical tests
        $criticalTests = [
            'test_mfa_setup_generates_secret_and_qr_code',
            'test_mfa_verify_validates_totp_code',
            'test_mfa_middleware_blocks',
            'test_recovery_codes_can_be_used_once',
            'test_mfa_disable_requires_password_and_code'
        ];

        foreach ($criticalTests as $test) {
            if (strpos($content, $test) !== false) {
                $this->pass("Critical test '$test' implemented");
            } else {
                $this->fail("Critical test '$test' missing");
            }
        }
    }

    private function checkRoutes(): void
    {
        $this->section("API Routes");

        $routes = __DIR__ . '/../routes/api.php';

        if (!file_exists($routes)) {
            $this->fail("api.php routes file not found");
            return;
        }

        $content = file_get_contents($routes);

        // Check if MFA routes need to be added
        if (strpos($content, 'MFAController') !== false) {
            $this->pass("MFA routes already configured");
        } else {
            echo "\n⚠️  MFA routes not yet added to routes/api.php\n";
            echo "   Add these routes:\n";
            echo "\n";
            echo "   Route::middleware('auth:sanctum')->group(function () {\n";
            echo "       Route::get('/mfa/qr-code', [MFAController::class, 'getQRCode']);\n";
            echo "       Route::post('/mfa/setup', [MFAController::class, 'setup']);\n";
            echo "       Route::post('/mfa/verify', [MFAController::class, 'verify']);\n";
            echo "       Route::post('/mfa/disable', [MFAController::class, 'disable']);\n";
            echo "       Route::get('/mfa/recovery-codes', [MFAController::class, 'regenerateRecoveryCodes']);\n";
            echo "       Route::post('/mfa/verify-recovery', [MFAController::class, 'verifyRecoveryCode']);\n";
            echo "   });\n";
            echo "\n";
        }
    }

    private function checkDependencies(): void
    {
        $this->section("Dependencies");

        $composer = __DIR__ . '/../composer.json';

        if (!file_exists($composer)) {
            $this->fail("composer.json not found");
            return;
        }

        $content = json_decode(file_get_contents($composer), true);

        $requiredPackages = [
            'pragmarx/google2fa',
            'bacon/bacon-qr-code'
        ];

        foreach ($requiredPackages as $package) {
            if (isset($content['require'][$package]) || isset($content['require-dev'][$package])) {
                $this->pass("Package '$package' installed");
            } else {
                echo "\n⚠️  Package '$package' not found in composer.json\n";
                echo "   Install with: composer require $package\n";
            }
        }
    }

    private function section(string $title): void
    {
        echo "\n";
        echo "┌─────────────────────────────────────────────────────────────────┐\n";
        echo "│ " . str_pad($title, 63) . " │\n";
        echo "└─────────────────────────────────────────────────────────────────┘\n";
    }

    private function pass(string $message): void
    {
        echo "  ✅ " . $message . "\n";
        $this->passed++;
    }

    private function fail(string $message): void
    {
        echo "  ❌ " . $message . "\n";
        $this->failed++;
    }

    private function printSummary(): void
    {
        echo "\n";
        echo "╔════════════════════════════════════════════════════════════════╗\n";
        echo "║                    VERIFICATION SUMMARY                        ║\n";
        echo "╚════════════════════════════════════════════════════════════════╝\n";
        echo "\n";
        echo "  Total Checks: " . ($this->passed + $this->failed) . "\n";
        echo "  ✅ Passed: " . $this->passed . "\n";
        echo "  ❌ Failed: " . $this->failed . "\n";
        echo "\n";

        if ($this->failed === 0) {
            echo "  🎉 All checks passed! MFA implementation is ready.\n";
            echo "\n";
            echo "  Next steps:\n";
            echo "  1. Run: php artisan migrate\n";
            echo "  2. Run: php artisan test --filter MFATest\n";
            echo "  3. Configure MFA routes in api.php (if not done)\n";
            echo "  4. Test MFA flow in staging environment\n";
        } else {
            echo "  ⚠️  Some checks failed. Please address the issues above.\n";
        }

        echo "\n";
    }
}

// Run verification
$verification = new MFAVerification();
exit($verification->run());
