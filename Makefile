.PHONY: help up down restart logs build clean test migrate seed shell-backend shell-frontend status health

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

##@ General Commands

help: ## Display this help message
	@echo "$(BLUE)OnboardingPortal - Docker Management$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make $(GREEN)<target>$(NC)\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Deployment

deploy: ## Full deployment (build + start all services)
	@./deploy.sh

up: ## Start all services
	@echo "$(BLUE)Starting all services...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"

down: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting all services...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

build: ## Build/rebuild Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker-compose build --parallel
	@echo "$(GREEN)✓ Images built$(NC)"

clean: ## Stop and remove all containers, volumes, and images
	@echo "$(YELLOW)⚠ This will remove all data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --rmi all; \
		echo "$(GREEN)✓ Cleaned$(NC)"; \
	else \
		echo "Cancelled"; \
	fi

##@ Service Management

backend-up: ## Start backend service only
	@docker-compose up -d mysql redis backend

frontend-up: ## Start frontend service only
	@docker-compose up -d frontend

logs: ## View logs (all services). Usage: make logs SERVICE=backend
	@docker-compose logs -f $(SERVICE)

status: ## Show status of all services
	@docker-compose ps

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@docker-compose ps
	@echo ""
	@echo "Backend API:"
	@curl -s http://localhost:8000/api/health || echo "Backend not responding"
	@echo ""
	@echo "Frontend:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000/_sandbox
	@echo ""
	@echo "Nginx:"
	@curl -s http://localhost/health || echo "Nginx not responding"

##@ Database

migrate: ## Run database migrations
	@echo "$(BLUE)Running migrations...$(NC)"
	@docker-compose exec backend php artisan migrate --force
	@echo "$(GREEN)✓ Migrations completed$(NC)"

migrate-fresh: ## Drop all tables and re-run migrations
	@echo "$(YELLOW)⚠ This will drop all tables!$(NC)"
	@docker-compose exec backend php artisan migrate:fresh --force

migrate-rollback: ## Rollback the last migration
	@docker-compose exec backend php artisan migrate:rollback

seed: ## Seed the database
	@echo "$(BLUE)Seeding database...$(NC)"
	@docker-compose exec backend php artisan db:seed --class=TestUserSeeder
	@docker-compose exec backend php artisan db:seed --class=QuestionnaireSeeder
	@docker-compose exec backend php artisan db:seed --class=FeatureFlagSeeder
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: migrate-fresh seed ## Reset database (fresh migration + seed)

##@ Laravel Commands

artisan: ## Run artisan command. Usage: make artisan CMD="route:list"
	@docker-compose exec backend php artisan $(CMD)

key-generate: ## Generate Laravel application key
	@docker-compose exec backend php artisan key:generate --force

cache-clear: ## Clear all Laravel caches
	@docker-compose exec backend php artisan config:clear
	@docker-compose exec backend php artisan cache:clear
	@docker-compose exec backend php artisan route:clear
	@docker-compose exec backend php artisan view:clear

optimize: ## Optimize Laravel application
	@docker-compose exec backend php artisan config:cache
	@docker-compose exec backend php artisan route:cache
	@docker-compose exec backend php artisan view:cache

##@ Testing

test: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@docker-compose exec backend php artisan test

test-frontend: ## Run frontend tests
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@docker-compose exec frontend pnpm test

test-all: test test-frontend ## Run all tests

test-coverage: ## Run tests with coverage
	@docker-compose exec backend php artisan test --coverage

##@ Development

shell-backend: ## Open shell in backend container
	@docker-compose exec backend sh

shell-frontend: ## Open shell in frontend container
	@docker-compose exec frontend sh

shell-mysql: ## Open MySQL shell
	@docker-compose exec mysql mysql -uroot -p$(DB_ROOT_PASSWORD)

shell-redis: ## Open Redis CLI
	@docker-compose exec redis redis-cli

composer-install: ## Install backend dependencies
	@docker-compose exec backend composer install

npm-install: ## Install frontend dependencies
	@docker-compose exec frontend pnpm install

watch-logs: ## Watch logs (all services). Usage: make watch-logs SERVICE=backend
	@docker-compose logs -f --tail=100 $(SERVICE)

##@ Backup & Restore

backup-db: ## Backup database
	@echo "$(BLUE)Creating database backup...$(NC)"
	@mkdir -p backups
	@docker-compose exec -T mysql mysqldump -uroot -p$(DB_ROOT_PASSWORD) onboarding_portal > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup created in backups/$(NC)"

restore-db: ## Restore database. Usage: make restore-db FILE=backup_20230101_120000.sql
	@echo "$(BLUE)Restoring database from $(FILE)...$(NC)"
	@docker-compose exec -T mysql mysql -uroot -p$(DB_ROOT_PASSWORD) onboarding_portal < backups/$(FILE)
	@echo "$(GREEN)✓ Database restored$(NC)"

##@ Production

prod-deploy: ## Deploy to production (with optimizations)
	@echo "$(BLUE)Deploying to production...$(NC)"
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@$(MAKE) key-generate
	@$(MAKE) migrate
	@$(MAKE) seed
	@$(MAKE) optimize
	@echo "$(GREEN)✓ Production deployment complete$(NC)"

prod-logs: ## View production logs
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

##@ Quick Actions

quick-start: deploy migrate seed ## Quick start (deploy + migrate + seed)
	@echo "$(GREEN)✓ Platform ready at http://localhost$(NC)"

quick-test: test test-frontend health ## Run all tests and health checks
