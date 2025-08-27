#!/bin/bash

# Test Database Reset Script
# Quickly resets the test database to a clean state

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="/Users/rodrigo/claude-projects/OnboardingPortal/omni-portal/backend"
TEST_DB_PATH="$BACKEND_DIR/database/testing.sqlite"

echo -e "${BLUE}🔄 Resetting test database...${NC}"

cd "$BACKEND_DIR"

# Remove existing test database
if [[ -f "$TEST_DB_PATH" ]]; then
    echo -e "${YELLOW}Removing existing test database...${NC}"
    rm -f "$TEST_DB_PATH"
fi

# Recreate the database file
echo -e "${BLUE}Creating fresh SQLite database...${NC}"
touch "$TEST_DB_PATH"

# Run migrations
echo -e "${BLUE}Running migrations...${NC}"
php artisan migrate --env=testing --force

# Optional: Run seeders
if [[ "$1" == "--seed" ]]; then
    echo -e "${BLUE}Running database seeders...${NC}"
    php artisan db:seed --env=testing --force
fi

echo -e "${GREEN}✅ Test database reset completed!${NC}"

# Show database info
DB_SIZE=$(du -h "$TEST_DB_PATH" | cut -f1)
TABLE_COUNT=$(sqlite3 "$TEST_DB_PATH" ".tables" | wc -w 2>/dev/null || echo "unknown")

echo -e "${BLUE}Database Info:${NC}"
echo "  • Location: $TEST_DB_PATH"
echo "  • Size: $DB_SIZE"
echo "  • Tables: $TABLE_COUNT"
echo
echo -e "${BLUE}Usage:${NC}"
echo "  • Reset with seeders: $0 --seed"
echo "  • Test database: ./tests/verify_test_database.sh"
echo "  • Run tests: ./tests/run_database_tests.sh"