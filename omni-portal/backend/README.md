# Omni Onboarding Portal - Backend API

## Overview
This is the Laravel 10 backend API for the Omni Onboarding Portal, a comprehensive healthcare employee onboarding platform.

## Requirements
- PHP >= 8.2
- Composer
- MySQL 8.0+
- Redis
- Node.js & NPM (for Horizon assets)

## Installation

1. Install PHP dependencies:
```bash
composer install
```

2. Copy the environment file:
```bash
cp .env.example .env
```

3. Generate application key:
```bash
php artisan key:generate
```

4. Configure your database in `.env`:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=omni_portal
DB_USERNAME=root
DB_PASSWORD=
```

5. Run database migrations:
```bash
php artisan migrate
```

6. Install and publish Sanctum:
```bash
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

7. Install and publish Horizon:
```bash
php artisan horizon:install
```

8. Install and publish Spatie Permissions:
```bash
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
php artisan migrate
```

## Running the Application

1. Start the development server:
```bash
php artisan serve
```

2. Start the queue worker (Horizon):
```bash
php artisan horizon
```

## API Documentation
The API endpoints will be documented as they are implemented. The base API URL is `http://localhost:8000/api`.

### Available Endpoints
- `GET /api/health` - Health check endpoint
- `GET /api/user` - Get authenticated user (requires authentication)

## Testing
Run the test suite:
```bash
php artisan test
```

## Security
- Authentication is handled via Laravel Sanctum
- CORS is configured for the frontend URL
- All API routes are protected by default

## License
Proprietary - All rights reserved