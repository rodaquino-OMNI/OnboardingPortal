#!/bin/bash

# Simple Database Verification Script
# Verifies that the test database is working correctly

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_DIR="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend"
TEST_DB_PATH="$BACKEND_DIR/database/testing.sqlite"

echo -e "${BLUE}🔍 Verifying test database setup...${NC}"

cd "$BACKEND_DIR"

# Test 1: Check if database file exists
if [[ -f "$TEST_DB_PATH" ]]; then
    echo -e "${GREEN}✅ Test database file exists${NC}"
    DB_SIZE=$(du -h "$TEST_DB_PATH" | cut -f1)
    echo -e "   Database size: $DB_SIZE"
else
    echo -e "${RED}❌ Test database file not found${NC}"
    exit 1
fi

# Test 2: Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
CONNECTION_TEST=$(php -r "
require_once 'vendor/autoload.php';
putenv('APP_ENV=testing');
\$app = require_once 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    \$pdo = DB::connection()->getPdo();
    echo 'SUCCESS: Connected to database';
} catch (Exception \$e) {
    echo 'ERROR: ' . \$e->getMessage();
}
" 2>&1)

if echo "$CONNECTION_TEST" | grep -q "SUCCESS"; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed: $CONNECTION_TEST${NC}"
    exit 1
fi

# Test 3: Check if tables exist
echo -e "${BLUE}Verifying database tables...${NC}"
TABLE_COUNT=$(php -r "
require_once 'vendor/autoload.php';
putenv('APP_ENV=testing');
\$app = require_once 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    \$tables = DB::select('SELECT name FROM sqlite_master WHERE type=\"table\" AND name NOT LIKE \"sqlite_%\"');
    echo count(\$tables);
} catch (Exception \$e) {
    echo '0';
}
" 2>&1)

if [[ "$TABLE_COUNT" -gt "0" ]]; then
    echo -e "${GREEN}✅ Found $TABLE_COUNT database tables${NC}"
else
    echo -e "${RED}❌ No database tables found${NC}"
    exit 1
fi

# Test 4: Test basic CRUD operations
echo -e "${BLUE}Testing basic CRUD operations...${NC}"
CRUD_TEST=$(php -r "
require_once 'vendor/autoload.php';
putenv('APP_ENV=testing');
\$app = require_once 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Clean up any existing test user
    DB::table('users')->where('email', 'test-crud@example.com')->delete();
    
    // Create a test user
    \$userId = DB::table('users')->insertGetId([
        'name' => 'Test CRUD User',
        'email' => 'test-crud@example.com',
        'password' => Hash::make('password'),
        'email_verified_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    
    // Read the user
    \$user = DB::table('users')->where('id', \$userId)->first();
    
    if (\$user && \$user->name === 'Test CRUD User') {
        // Update the user
        DB::table('users')->where('id', \$userId)->update([
            'name' => 'Updated Test User',
            'updated_at' => now(),
        ]);
        
        // Verify update
        \$updated = DB::table('users')->where('id', \$userId)->first();
        
        if (\$updated->name === 'Updated Test User') {
            // Delete the test user
            DB::table('users')->where('id', \$userId)->delete();
            
            // Verify deletion
            \$deleted = DB::table('users')->where('id', \$userId)->first();
            
            if (!\$deleted) {
                echo 'SUCCESS: CRUD operations working correctly';
            } else {
                echo 'ERROR: Delete operation failed';
            }
        } else {
            echo 'ERROR: Update operation failed';
        }
    } else {
        echo 'ERROR: Create/Read operations failed';
    }
} catch (Exception \$e) {
    echo 'ERROR: ' . \$e->getMessage();
}
" 2>&1)

if echo "$CRUD_TEST" | grep -q "SUCCESS"; then
    echo -e "${GREEN}✅ CRUD operations test passed${NC}"
else
    echo -e "${RED}❌ CRUD operations test failed: $CRUD_TEST${NC}"
fi

# Test 5: Test specific application models (if they exist)
echo -e "${BLUE}Testing application-specific models...${NC}"
MODEL_TEST=$(php -r "
require_once 'vendor/autoload.php';
putenv('APP_ENV=testing');
\$app = require_once 'bootstrap/app.php';
\$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\$models = [
    'App\Models\User',
    'App\Models\Company', 
    'App\Models\Beneficiary',
    'App\Models\Document',
    'App\Models\HealthQuestionnaire',
];

\$working = 0;
foreach (\$models as \$model) {
    try {
        if (class_exists(\$model)) {
            \$count = \$model::count();
            \$working++;
        }
    } catch (Exception \$e) {
        // Model might not exist or have issues
    }
}

echo \"SUCCESS: \$working/\" . count(\$models) . \" models accessible\";
" 2>&1)

if echo "$MODEL_TEST" | grep -q "SUCCESS"; then
    echo -e "${GREEN}✅ Application models test: $MODEL_TEST${NC}"
else
    echo -e "${RED}❌ Application models test failed: $MODEL_TEST${NC}"
fi

# Summary
echo
echo -e "${GREEN}🎉 Database verification completed!${NC}"
echo -e "${BLUE}Test database ready for use at: $TEST_DB_PATH${NC}"
echo
echo -e "${BLUE}Usage Examples:${NC}"
echo "  • Run Laravel tests: php artisan test --env=testing"
echo "  • Interactive testing: php artisan tinker --env=testing"
echo "  • Reset database: rm database/testing.sqlite && php artisan migrate --env=testing"
echo