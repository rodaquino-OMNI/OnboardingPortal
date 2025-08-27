#!/bin/bash

# Test Database Setup Script
# This script sets up a SQLite testing environment for the onboarding portal

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/omni-portal/backend"
TEST_DB_PATH="$BACKEND_DIR/database/testing.sqlite"
TEST_ENV_FILE="$BACKEND_DIR/.env.testing"

echo -e "${BLUE}🚀 Setting up test database environment...${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if we're in the right directory
if [[ ! -d "$BACKEND_DIR" ]]; then
    error "Backend directory not found at $BACKEND_DIR"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

log "Working in: $(pwd)"

# Check if Laravel is properly installed
if [[ ! -f "artisan" ]]; then
    error "Laravel artisan command not found. Are you in the correct directory?"
    exit 1
fi

# Create database directory if it doesn't exist
mkdir -p "$(dirname "$TEST_DB_PATH")"

# Remove existing test database if it exists
if [[ -f "$TEST_DB_PATH" ]]; then
    warning "Removing existing test database..."
    rm -f "$TEST_DB_PATH"
fi

# Create the testing environment file
log "Creating .env.testing file..."
cat > "$TEST_ENV_FILE" << 'EOF'
APP_NAME="Onboarding Portal Test"
APP_ENV=testing
APP_KEY=base64:TestKey123456789012345678901234567890
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

# SQLite Database Configuration
DB_CONNECTION=sqlite
DB_DATABASE=database/testing.sqlite
DB_FOREIGN_KEYS=true

# Cache and Session (file-based for testing)
BROADCAST_DRIVER=log
CACHE_DRIVER=array
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=array
SESSION_LIFETIME=120

# Mail (log for testing)
MAIL_MAILER=log
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="test@example.com"
MAIL_FROM_NAME="${APP_NAME}"

# JWT Configuration
JWT_SECRET=TestJWTSecretKey123456789012345678901234567890
JWT_ALGO=HS256
JWT_TTL=60

# API Configuration
API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW=1

# Test-specific configurations
TELESCOPE_ENABLED=false
DEBUGBAR_ENABLED=false

# Disable external services in testing
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1

VITE_PUSHER_APP_KEY="${PUSHER_APP_KEY}"
VITE_PUSHER_HOST="${PUSHER_HOST}"
VITE_PUSHER_PORT="${PUSHER_PORT}"
VITE_PUSHER_SCHEME="${PUSHER_SCHEME}"
VITE_PUSHER_APP_CLUSTER="${PUSHER_APP_CLUSTER}"
EOF

log "Testing environment file created at: $TEST_ENV_FILE"

# Check if composer dependencies are installed
if [[ ! -d "vendor" ]]; then
    warning "Composer dependencies not found. Installing..."
    if command -v composer > /dev/null; then
        composer install --no-interaction --prefer-dist --optimize-autoloader
    else
        error "Composer not found. Please install composer and run 'composer install' in $BACKEND_DIR"
        exit 1
    fi
fi

# Generate application key for testing
log "Generating application key for testing..."
php artisan key:generate --env=testing --force

# Create the SQLite database file
log "Creating SQLite database file..."
touch "$TEST_DB_PATH"

# Verify SQLite database was created
if [[ ! -f "$TEST_DB_PATH" ]]; then
    error "Failed to create SQLite database file at $TEST_DB_PATH"
    exit 1
fi

log "SQLite database created at: $TEST_DB_PATH"

# Run database migrations with testing environment
log "Running database migrations..."
if php artisan migrate --env=testing --force; then
    log "✅ Database migrations completed successfully"
else
    error "Database migrations failed"
    exit 1
fi

# Check if migrations were successful by listing tables
log "Verifying database tables..."
TABLES=$(php artisan tinker --env=testing << 'TINKER_EOF'
DB::connection()->getSchemaBuilder()->getTableListing();
exit
TINKER_EOF
)

if [[ $? -eq 0 ]]; then
    log "✅ Database tables created successfully"
else
    warning "Could not verify tables, but migrations completed"
fi

# Run database seeders if they exist
log "Running database seeders..."
if php artisan db:seed --env=testing --force 2>/dev/null; then
    log "✅ Database seeders completed successfully"
else
    warning "Database seeders not found or failed (this might be normal)"
fi

# Run a simple database connection test
log "Testing database connection..."
TEST_RESULT=$(php artisan tinker --env=testing << 'TINKER_EOF'
try {
    DB::connection()->getPdo();
    echo "SUCCESS: Database connection working";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
exit
TINKER_EOF
)

if echo "$TEST_RESULT" | grep -q "SUCCESS"; then
    log "✅ Database connection test passed"
else
    error "Database connection test failed: $TEST_RESULT"
    exit 1
fi

# Test basic CRUD operations
log "Testing basic database operations..."
CRUD_TEST=$(php artisan tinker --env=testing << 'TINKER_EOF'
try {
    // Test creating a record
    $user = new App\Models\User();
    $user->name = 'Test User';
    $user->email = 'test@example.com';
    $user->password = Hash::make('password');
    $user->save();
    
    // Test reading the record
    $found = App\Models\User::where('email', 'test@example.com')->first();
    if ($found && $found->name === 'Test User') {
        echo "SUCCESS: CRUD operations working";
    } else {
        echo "ERROR: Could not retrieve created user";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
exit
TINKER_EOF
)

if echo "$CRUD_TEST" | grep -q "SUCCESS"; then
    log "✅ Database CRUD operations test passed"
else
    warning "Database CRUD test failed: $CRUD_TEST"
    warning "This might be normal if User model doesn't exist yet"
fi

# Create a test runner script
log "Creating test runner helper..."
cat > "$BACKEND_DIR/run-tests.sh" << 'EOF'
#!/bin/bash
# Test runner script for the onboarding portal

export APP_ENV=testing

# Run PHPUnit tests if they exist
if [[ -f "vendor/bin/phpunit" ]]; then
    echo "Running PHPUnit tests..."
    ./vendor/bin/phpunit --env=testing
elif [[ -f "phpunit.xml" ]]; then
    echo "Running PHP unit tests..."
    php artisan test --env=testing
else
    echo "No test configuration found. You can now run manual tests with:"
    echo "php artisan tinker --env=testing"
fi
EOF

chmod +x "$BACKEND_DIR/run-tests.sh"

# Final verification and summary
log "Final verification..."

# Check file sizes and permissions
DB_SIZE=$(du -h "$TEST_DB_PATH" 2>/dev/null | cut -f1 || echo "unknown")
ENV_EXISTS=$([ -f "$TEST_ENV_FILE" ] && echo "✅" || echo "❌")
DB_EXISTS=$([ -f "$TEST_DB_PATH" ] && echo "✅" || echo "❌")
ARTISAN_EXISTS=$([ -f "$BACKEND_DIR/artisan" ] && echo "✅" || echo "❌")

echo
echo -e "${BLUE}📊 Test Database Setup Summary:${NC}"
echo -e "  Environment file: $ENV_EXISTS $TEST_ENV_FILE"
echo -e "  SQLite database: $DB_EXISTS $TEST_DB_PATH ($DB_SIZE)"
echo -e "  Laravel artisan: $ARTISAN_EXISTS $BACKEND_DIR/artisan"
echo -e "  Test runner: ✅ $BACKEND_DIR/run-tests.sh"
echo

echo -e "${GREEN}🎉 Test database setup completed successfully!${NC}"
echo
echo -e "${BLUE}Usage:${NC}"
echo "  • Run migrations: php artisan migrate --env=testing"
echo "  • Run seeders: php artisan db:seed --env=testing"
echo "  • Interactive shell: php artisan tinker --env=testing"
echo "  • Run tests: ./run-tests.sh"
echo "  • Reset database: rm database/testing.sqlite && php artisan migrate --env=testing"
echo
echo -e "${BLUE}Database location:${NC} $TEST_DB_PATH"
echo -e "${BLUE}Environment file:${NC} $TEST_ENV_FILE"
echo

# Optional: Show database schema
if command -v sqlite3 > /dev/null; then
    echo -e "${BLUE}Database tables:${NC}"
    sqlite3 "$TEST_DB_PATH" ".tables" 2>/dev/null || echo "  (Unable to list tables - sqlite3 command not found)"
fi

log "Setup script completed in $(pwd)"