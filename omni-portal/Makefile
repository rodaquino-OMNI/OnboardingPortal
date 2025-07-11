# Makefile for Omni Onboarding Portal Docker Management

.PHONY: help start stop restart build clean logs shell test

# Default target
help:
	@echo "Omni Portal Docker Commands:"
	@echo "  make start      - Start all containers"
	@echo "  make stop       - Stop all containers"
	@echo "  make restart    - Restart all containers"
	@echo "  make build      - Build/rebuild containers"
	@echo "  make clean      - Stop and remove all containers/volumes"
	@echo "  make logs       - Show container logs"
	@echo "  make shell-php  - Access PHP container shell"
	@echo "  make shell-node - Access Node container shell"
	@echo "  make test       - Run tests"
	@echo "  make migrate    - Run database migrations"
	@echo "  make seed       - Seed the database"
	@echo "  make fresh      - Fresh migration with seeding"

# Start containers
start:
	@./docker/scripts/start.sh

# Stop containers
stop:
	@./docker/scripts/stop.sh

# Restart containers
restart: stop start

# Build containers
build:
	@echo "🐳 Building containers..."
	@docker-compose build --no-cache

# Clean everything
clean:
	@./docker/scripts/reset.sh

# View logs
logs:
	@docker-compose logs -f

# Shell access
shell-php:
	@docker-compose exec php sh

shell-node:
	@docker-compose exec frontend sh

shell-mysql:
	@docker-compose exec mysql mysql -u root -p

# Laravel commands
migrate:
	@docker-compose exec php php artisan migrate

seed:
	@docker-compose exec php php artisan db:seed

fresh:
	@docker-compose exec php php artisan migrate:fresh --seed

# Testing
test:
	@echo "🧪 Running backend tests..."
	@docker-compose exec php php artisan test
	@echo "🧪 Running frontend tests..."
	@docker-compose exec frontend npm test

# Production commands
prod-build:
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up:
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
