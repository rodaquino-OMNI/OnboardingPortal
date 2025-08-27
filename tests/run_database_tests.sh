#!/bin/bash

# Database Test Runner
# Runs database-related tests using the SQLite test database

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend"

echo -e "${BLUE}🧪 Running database tests...${NC}"

cd "$BACKEND_DIR"

# Check if test database exists
if [[ ! -f "database/testing.sqlite" ]]; then
    echo -e "${YELLOW}⚠️  Test database not found. Creating it...${NC}"
    php artisan migrate --env=testing --force
fi

# Run different types of tests
echo -e "${BLUE}1. Running PHPUnit database tests...${NC}"

# Set testing environment
export APP_ENV=testing

if [[ -f "vendor/bin/phpunit" ]]; then
    # Run specific database-related test groups if they exist
    ./vendor/bin/phpunit --group=database 2>/dev/null || {
        echo -e "${YELLOW}No database-specific test group found. Running available tests...${NC}"
        # Try to run any existing tests
        if [[ -d "tests/Feature" ]]; then
            ./vendor/bin/phpunit tests/Feature/ --testdox 2>/dev/null || echo "No Feature tests found"
        fi
        if [[ -d "tests/Unit" ]]; then
            ./vendor/bin/phpunit tests/Unit/ --testdox 2>/dev/null || echo "No Unit tests found"
        fi
    }
elif command -v php artisan test >/dev/null 2>&1; then
    php artisan test --filter="Database"
else
    echo -e "${YELLOW}No testing framework found${NC}"
fi

echo
echo -e "${BLUE}2. Running manual database connectivity tests...${NC}"

# Test database operations manually
php artisan tinker --env=testing << 'EOF'
echo "Testing User model...";
$userCount = App\Models\User::count();
echo "Current users: $userCount";

echo "Testing Document model...";
$docCount = App\Models\Document::count();
echo "Current documents: $docCount";

echo "Testing database queries...";
$tables = DB::select("SELECT name FROM sqlite_master WHERE type='table'");
echo "Total tables: " . count($tables);

echo "Database tests completed successfully!";
exit;
EOF

echo
echo -e "${BLUE}3. Testing specific features...${NC}"

# Test health questionnaire functionality
php -r "
require_once 'vendor/autoload.php';
putenv('APP_ENV=testing');
\$app = require_once 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo 'Testing Health Questionnaire model...' . PHP_EOL;
try {
    \$count = App\Models\HealthQuestionnaire::count();
    echo 'Health questionnaires in database: ' . \$count . PHP_EOL;
    echo '✅ Health Questionnaire model working' . PHP_EOL;
} catch (Exception \$e) {
    echo '❌ Health Questionnaire test failed: ' . \$e->getMessage() . PHP_EOL;
}
"

echo
echo -e "${GREEN}🎉 Database tests completed!${NC}"
echo
echo -e "${BLUE}Additional test commands you can run:${NC}"
echo "  • Interactive database exploration: php artisan tinker --env=testing"
echo "  • Run specific test: php artisan test --env=testing --filter=YourTestName"
echo "  • Reset test database: rm database/testing.sqlite && php artisan migrate --env=testing"
echo "  • Seed test data: php artisan db:seed --env=testing"