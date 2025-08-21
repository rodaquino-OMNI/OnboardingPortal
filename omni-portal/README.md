# Omni Portal - Comprehensive Enterprise Onboarding Platform

A modern, scalable onboarding platform built with Laravel backend, Next.js frontend, and comprehensive monitoring stack.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PHP 8.1+ (for local development)

### Start the Application

```bash
# Clone and navigate to project
git clone <repository-url>
cd omni-portal

# Start all services
docker-compose up -d

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Next.js application |
| **Backend API** | http://localhost:8000 | Laravel API |
| **Admin Panel** | http://localhost:8000/admin | Laravel admin |
| **Grafana** | http://localhost:3001 | Monitoring dashboards |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Jaeger** | http://localhost:16686 | Distributed tracing |
| **MySQL** | localhost:3306 | Database |
| **Redis** | localhost:6379 | Cache & sessions |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │     Backend     │    │   Monitoring    │
│   (Next.js)     │◄──►│   (Laravel)     │◄──►│  (Prometheus)   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ React Pages │ │    │ │ REST API    │ │    │ │   Grafana   │ │
│ │ TypeScript  │ │    │ │ Controllers │ │    │ │ Dashboards  │ │
│ │ Tailwind    │ │    │ │ Models      │ │    │ └─────────────┘ │
│ └─────────────┘ │    │ └─────────────┘ │    │                 │
│                 │    │                 │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ │    Loki     │ │
│ │ OpenTelemetry│ │    │ │ Sanctum Auth│ │    │ │    Logs     │ │
│ │   Tracing   │ │    │ │ Middleware  │ │    │ └─────────────┘ │
│ └─────────────┘ │    │ └─────────────┘ │    │                 │
└─────────────────┘    └─────────────────┘    │ ┌─────────────┐ │
                                              │ │   Jaeger    │ │
┌─────────────────┐    ┌─────────────────┐    │ │   Traces    │ │
│    Database     │    │     Cache       │    │ └─────────────┘ │
│    (MySQL)      │    │    (Redis)      │    └─────────────────┘
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Tables    │ │    │ │  Sessions   │ │
│ │ Migrations  │ │    │ │   Cache     │ │
│ │   Indexes   │ │    │ │   Queues    │ │
│ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘
```

## 📊 Monitoring Stack

The application includes a comprehensive monitoring solution:

### Metrics Collection (Prometheus)
- Application performance metrics
- Database query performance
- Cache hit rates
- System resource usage
- Custom business metrics

### Visualization (Grafana)
- **System Overview Dashboard** - CPU, memory, disk usage
- **Application Performance Dashboard** - Request rates, response times, errors
- **Database Performance Dashboard** - Query performance, connections
- **Custom Business Dashboards** - User onboarding metrics

### Log Aggregation (Loki)
- Centralized log collection from all services
- Structured logging with trace correlation
- Log retention and archival policies
- Real-time log streaming

### Distributed Tracing (Jaeger)
- Request flow tracking across services
- Performance bottleneck identification
- Error root cause analysis
- Service dependency mapping

### Alerting (AlertManager)
- Real-time alerts for critical issues
- Multiple notification channels (email, Slack, webhook)
- Alert escalation and grouping
- Maintenance mode support

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && composer install

# Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# Generate application key
cd backend && php artisan key:generate

# Run migrations
php artisan migrate

# Start development servers
cd frontend && npm run dev
cd backend && php artisan serve
```

### Code Quality

```bash
# Frontend
cd frontend
npm run lint          # ESLint
npm run type-check     # TypeScript

# Backend
cd backend
./vendor/bin/phpstan   # Static analysis
./vendor/bin/pint      # Code formatting
```

### Testing

```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd backend
php artisan test
```

## 📁 Project Structure

```
omni-portal/
├── frontend/                 # Next.js application
│   ├── components/          # React components
│   ├── pages/              # Next.js pages
│   ├── lib/                # Utilities and configurations
│   ├── styles/             # CSS and styling
│   └── public/             # Static assets
│
├── backend/                 # Laravel application
│   ├── app/                # Application logic
│   ├── config/             # Configuration files
│   ├── database/           # Migrations and seeders
│   ├── routes/             # API routes
│   └── storage/            # File storage and logs
│
├── monitoring/             # Monitoring configurations
│   ├── prometheus/         # Prometheus config and rules
│   ├── grafana/           # Grafana dashboards and provisioning
│   ├── loki/              # Loki configuration
│   └── alertmanager/      # AlertManager configuration
│
├── scripts/               # Automation scripts
│   └── monitoring-setup.sh # Monitoring stack setup
│
├── docs/                  # Documentation
│   └── MONITORING_GUIDE.md # Detailed monitoring guide
│
├── docker-compose.yml           # Main application services
├── docker-compose.monitoring.yml # Monitoring services
└── README.md                    # This file
```

## 🔒 Security Features

- **Authentication**: Laravel Sanctum for API authentication
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting and throttling
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: HTTP security headers
- **SQL Injection Protection**: Eloquent ORM with prepared statements
- **XSS Protection**: Input sanitization and output encoding

## 🚀 Performance Features

- **Caching**: Redis-based caching for database queries and sessions
- **Queue System**: Asynchronous job processing with Laravel Horizon
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic code splitting in Next.js
- **Database Optimization**: Indexed queries and connection pooling
- **CDN Ready**: Static asset optimization for CDN deployment

## 🔧 Configuration

### Environment Variables

**Backend (.env):**
```env
# Application
APP_NAME="Omni Portal"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Database
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=omni_portal
DB_USERNAME=your_user
DB_PASSWORD=your_password

# Cache & Sessions
REDIS_HOST=redis
REDIS_PORT=6379

# Monitoring
OTEL_ENABLED=true
OTEL_SERVICE_NAME=omni-portal-backend
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

**Frontend (.env.local):**
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Monitoring
NEXT_PUBLIC_OTEL_ENABLED=true
NEXT_PUBLIC_OTEL_SERVICE_NAME=omni-portal-frontend
NEXT_PUBLIC_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## 📈 Scaling

### Horizontal Scaling
- Load balancers for frontend and backend
- Database read replicas
- Redis cluster for caching
- Container orchestration with Kubernetes

### Performance Monitoring
- Real-time performance metrics
- Automated scaling based on metrics
- Resource usage optimization
- Database query optimization

## 🔄 CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd frontend && npm test
          cd backend && php artisan test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          docker-compose -f docker-compose.prod.yml up -d
          ./scripts/monitoring-setup.sh start
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get authenticated user

### Onboarding Endpoints
- `GET /api/onboarding/steps` - Get onboarding steps
- `POST /api/onboarding/complete` - Complete onboarding step
- `GET /api/onboarding/progress` - Get user progress

### Monitoring Endpoints
- `GET /api/health` - Health check
- `GET /api/metrics` - Prometheus metrics
- `GET /api/trace-test` - Tracing test endpoint

## 🆘 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check logs
docker-compose logs [service-name]

# Restart services
docker-compose restart

# Clean up and restart
docker-compose down -v && docker-compose up -d
```

**Database connection issues:**
```bash
# Check MySQL container
docker-compose exec mysql mysql -u root -p

# Reset database
docker-compose down
docker volume rm omni-portal_mysql_data
docker-compose up -d
```

**Monitoring issues:**
```bash
# Restart monitoring stack
./scripts/monitoring-setup.sh restart

# Check monitoring logs
./scripts/monitoring-setup.sh logs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Code Standards
- Follow PSR-12 for PHP code
- Use ESLint configuration for TypeScript/JavaScript
- Write comprehensive tests
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the monitoring dashboards for system health
- Review logs using the monitoring stack
- Consult the detailed monitoring guide in `/docs/MONITORING_GUIDE.md`

---

**Built with technical excellence in mind** 🚀