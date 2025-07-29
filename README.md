# Onboarding Portal 🚀

[![Laravel](https://img.shields.io/badge/Laravel-10.0-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.30-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=for-the-badge)](LICENSE)

> Enterprise-grade gamified onboarding platform for healthcare beneficiaries, transforming bureaucratic processes into engaging digital experiences.

## 📊 Project Statistics

- **Total Lines of Code**: ~100,000
- **Total Files**: 539 code files
- **Backend (Laravel)**: 50,363 lines across 233 PHP files
- **Frontend (Next.js)**: 49,293 lines across 183 TypeScript/JavaScript files
- **Test Coverage**: 224 test files (26 backend, 198 frontend)
- **API Endpoints**: 100+ RESTful endpoints

## ✨ Key Features

### Core Functionality
- 🔐 **Advanced Authentication** - JWT-based auth with social login (Google, Facebook, Instagram)
- 👤 **Multi-step Registration** - Progressive onboarding with validation
- 📱 **Progressive Web App** - Installable mobile experience
- 🎮 **Gamification System** - Points, levels, badges, and achievements
- 📄 **Document Management** - OCR processing with multiple providers (AWS Textract, Tesseract)
- 🏥 **Health Questionnaires** - Adaptive health screening with AI integration
- 📅 **Interview Scheduling** - Complete scheduling system with notifications
- 🎥 **Video Conferencing** - HIPAA-compliant video consultations
- 👨‍💼 **Admin Dashboard** - User management with RBAC (Role-Based Access Control)
- 🔒 **LGPD Compliance** - Full data privacy compliance with consent management

### Technical Highlights
- ⚡ **Performance Optimized** - Sub-second response times
- 🔄 **Real-time Updates** - WebSocket integration for live notifications
- 📊 **Analytics & Monitoring** - Prometheus metrics and performance tracking
- 🌐 **Multi-language Support** - i18n ready architecture
- ♿ **Accessibility** - WCAG 2.1 AA compliant
- 🔍 **SEO Optimized** - Server-side rendering with Next.js

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js 14.2.30)       │
│    React 18 | TypeScript 5 | Tailwind    │
└────────────────────┬────────────────────┘
                     │ REST API
┌────────────────────┴────────────────────┐
│         Backend API (Laravel 10)         │
│   Sanctum Auth | Horizon | Events       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────┴────────────────────┐
│            Data Layer                    │
│    MySQL 8.0 | Redis 7.0 | S3           │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- PHP 8.2+
- Node.js 18+
- MySQL 8.0
- Redis 7.0
- Composer 2.0+
- Docker (optional)

### Project Structure

```
OnboardingPortal/
├── omni-portal/              # Main application
│   ├── backend/             # Laravel API (50k+ lines)
│   │   ├── app/            # Application logic
│   │   ├── config/         # Configuration files
│   │   ├── database/       # Migrations & seeders
│   │   ├── routes/         # API routes
│   │   └── tests/          # PHPUnit tests
│   ├── frontend/           # Next.js App (49k+ lines)
│   │   ├── app/           # Next.js 14 app directory
│   │   ├── components/    # React components
│   │   ├── lib/          # Utilities & services
│   │   └── __tests__/    # Jest & React Testing Library
│   └── docker/            # Docker configuration
├── Docs_For_development/  # Technical documentation
└── README.md
```

### Installation

```bash
# Clone the repository
git clone https://github.com/rodaquino-OMNI/OnboardingPortal.git
cd OnboardingPortal

# Backend setup
cd omni-portal/backend
composer install
cp .env.example .env
php artisan key:generate

# Configure database in .env
DB_DATABASE=omni_portal
DB_USERNAME=your_username
DB_PASSWORD=your_password

# Run migrations and seeders
php artisan migrate
php artisan db:seed

# Frontend setup
cd ../frontend
npm install
cp .env.example .env.local

# Start development servers
# Terminal 1 - Backend
cd omni-portal/backend
php artisan serve --port=8000

# Terminal 2 - Frontend
cd omni-portal/frontend
npm run dev
```

### Docker Setup

```bash
cd omni-portal
docker-compose up -d
```

## 📋 Implemented Modules

### 1. **Authentication & Authorization**
- Laravel Sanctum for API authentication
- Social login integration (Google, Facebook, Instagram)
- Multi-factor authentication support
- Session management with Redis

### 2. **User Management**
- Complete profile management
- Avatar upload with image optimization
- Privacy settings and preferences
- LGPD data export and deletion

### 3. **Health Assessment**
- Dynamic questionnaire engine
- AI-powered health risk scoring
- Clinical decision support
- Progressive screening with branching logic

### 4. **Document Processing**
- Multi-provider OCR support (AWS Textract, Tesseract)
- Document type detection
- Secure file storage (local/S3)
- Processing queue with Laravel Horizon

### 5. **Interview Scheduling**
- Calendar integration
- Time slot management
- Email/SMS/WhatsApp notifications
- Rescheduling and cancellation

### 6. **Video Conferencing**
- WebRTC-based video calls
- HIPAA-compliant encryption
- Recording capabilities
- Screen sharing support

### 7. **Gamification Engine**
- XP and leveling system
- Achievement tracking
- Leaderboards
- Progress visualization

### 8. **Admin Dashboard**
- User management with RBAC
- System metrics and analytics
- Content management
- Report generation

## 🛠️ Technology Stack

### Backend
- **Laravel 10.0** - PHP Framework
- **Laravel Sanctum** - API Authentication
- **Laravel Horizon** - Queue Management
- **MySQL 8.0** - Primary Database
- **Redis** - Cache & Queue Driver
- **AWS SDK** - S3 Storage & Textract OCR
- **Tesseract** - Fallback OCR
- **PHPUnit** - Testing Framework

### Frontend
- **Next.js 14.2.30** - React Framework
- **React 18** - UI Library
- **TypeScript 5** - Type Safety
- **Tailwind CSS 3.4** - Styling
- **React Hook Form** - Form Management
- **Zod** - Schema Validation
- **TanStack Query** - Data Fetching
- **Jest & RTL** - Testing

### Infrastructure
- **Docker** - Containerization
- **Nginx** - Web Server
- **GitHub Actions** - CI/CD
- **Prometheus** - Monitoring
- **CloudWatch** - Logging

## 🧪 Testing

```bash
# Backend tests
cd omni-portal/backend
php artisan test

# Frontend tests
cd omni-portal/frontend
npm run test:ci
npm run test:e2e
npm run test:performance
```

## 📈 Performance

- **API Response Time**: < 200ms average
- **Frontend Load Time**: < 2s (First Contentful Paint)
- **Test Coverage**: > 75% for critical paths
- **Uptime**: Designed for 99.9% availability

## 🔒 Security

- OWASP Top 10 compliance
- Input validation and sanitization
- SQL injection protection
- XSS prevention
- CSRF protection
- Rate limiting
- Security headers configured

## 🚦 Roadmap

### Completed ✅
- [x] Core onboarding flow
- [x] Gamification system
- [x] PWA implementation
- [x] OCR document processing
- [x] Video conferencing
- [x] Admin dashboard
- [x] Interview scheduling
- [x] LGPD compliance

### In Progress 🚧
- [ ] WhatsApp Business API integration
- [ ] Advanced ML risk scoring
- [ ] Multi-language support (EN/ES)
- [ ] Blockchain document verification
- [ ] Advanced analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 👥 Team

Developed with 💙 by the Healthcare Digital Innovation Team

---

<p align="center">
  <strong>Onboarding Portal</strong> - Transforming healthcare onboarding through technology
</p>