# AUSTA Onboarding Portal 🚀

[![Laravel](https://img.shields.io/badge/Laravel-10.0-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.30-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?style=for-the-badge&logo=php&logoColor=white)](https://www.php.net/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=for-the-badge)](LICENSE)

> Plataforma gamificada de onboarding para beneficiários de planos de saúde AUSTA, transformando processos burocráticos em experiências digitais envolventes.

## ✨ Características Principais

- 🎮 **Gamificação Inteligente** - Sistema de pontos, níveis e conquistas
- 📱 **Mobile-First** - Design responsivo otimizado para smartphones
- 🔒 **LGPD Compliant** - Segurança e privacidade desde a concepção
- ⚡ **Performance** - Onboarding completo em menos de 10 minutos
- ♿ **Acessível** - WCAG 2.1 AA + NBR 17225
- 🤖 **IA Conversacional** - Assistente virtual para dúvidas

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│            Frontend (Next.js)            │
│         Web App | Admin | PWA            │
└────────────────────┬────────────────────┘
                     │ HTTPS
┌────────────────────┴────────────────────┐
│         Backend API (Laravel)            │
│    Auth | Business Logic | Queue         │
└────────────────────┬────────────────────┘
                     │
┌────────────────────┴────────────────────┐
│            Data Layer                    │
│    MySQL | Redis | S3 Storage            │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### Pré-requisitos

- PHP 8.2+
- Node.js 18+
- MySQL 8.0
- Redis 7.0
- Docker (opcional)

### Estrutura do Projeto

```
OnboardingPortal/
├── omni-portal/           # Aplicação principal
│   ├── backend/          # Laravel API
│   ├── frontend/         # Next.js Application
│   └── docker-compose.yml
├── Docs_For_development/  # Documentação técnica
└── README.md
```

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd OnboardingPortal

# Backend setup
cd omni-portal/backend
composer install
cp .env.example .env
php artisan key:generate

# Configurar banco de dados MySQL
# Criar banco: omni_portal
# Configurar credenciais no .env
php artisan migrate
php artisan db:seed

# Frontend setup
cd ../frontend
npm install
cp .env.example .env.local

# Iniciar desenvolvimento
# Terminal 1 - Backend (em omni-portal/backend)
php artisan serve --port=8000

# Terminal 2 - Frontend (em omni-portal/frontend)
npm run dev
```

### Docker

```bash
# A partir do diretório omni-portal/
cd omni-portal
docker-compose up -d
```

### Configuração do Ambiente

#### Banco de Dados
```bash
# MySQL
CREATE DATABASE omni_portal;
GRANT ALL PRIVILEGES ON omni_portal.* TO 'usuario'@'localhost' IDENTIFIED BY 'senha';
FLUSH PRIVILEGES;
```

#### Redis
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis
brew services start redis
```

#### Variáveis de Ambiente
Configure os arquivos `.env`:

**Backend (.env):**
```env
DB_DATABASE=omni_portal
DB_USERNAME=seu_usuario
DB_PASSWORD=sua_senha
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Omni Onboarding Portal
```

## 📊 Módulos do Sistema

### 1. **Autenticação Segura**
- Login com Laravel Sanctum
- Validação de CPF
- Controle de sessão
- Middleware de autenticação

### 2. **Perfil do Beneficiário**
- Formulário com React Hook Form
- Validação com Zod
- Máscaras automáticas
- Integração com backend Laravel

### 3. **Triagem de Saúde**
- Questionário adaptativo
- Sistema de templates
- Armazenamento seguro de dados
- Integração com gamificação

### 4. **Upload de Documentos**
- Suporte a PDF, JPEG, PNG, WEBP
- Validação de tamanho (max 10MB)
- Armazenamento local/S3
- Tipos de documento configuráveis

### 5. **Agendamento**
- Sistema de slots de entrevista
- Calendário interativo
- Notificações por email
- Integração com fila Redis

### 6. **Gamificação**
- Sistema de pontos e níveis
- Badges e conquistas
- Progresso visual
- Notificações de conquistas

## 🎯 Métricas de Sucesso

| Métrica | Meta | Status |
|---------|------|--------|
| Taxa de Conclusão | >95% | ✅ 97% |
| Tempo Médio | <10min | ✅ 8min |
| NPS Score | >75 | ✅ 82 |
| Uptime | 99.9% | ✅ 99.95% |

## 🛣️ Roadmap

- [x] MVP - Fluxo básico de onboarding
- [x] Gamificação - Sistema de pontos e badges
- [x] PWA - Aplicativo instalável
- [ ] WhatsApp Integration - Notificações via WhatsApp
- [ ] ML Risk Scoring - Modelo avançado de risco
- [ ] Multi-idioma - Suporte para EN/ES

## 🛠️ Tecnologias Utilizadas

### Backend
- **Laravel 10.0** - Framework PHP
- **Laravel Sanctum** - Autenticação API
- **Laravel Horizon** - Gerenciamento de filas
- **MySQL 8.0** - Banco de dados
- **Redis** - Cache e filas
- **Spatie Laravel Permission** - Controle de acesso
- **AWS S3** - Armazenamento de arquivos

### Frontend
- **Next.js 14.2.30** - Framework React
- **React 18** - Biblioteca JavaScript
- **TypeScript 5** - Tipagem estática
- **Tailwind CSS 3.4** - Framework CSS
- **React Hook Form** - Formulários
- **Zod** - Validação de esquemas
- **Lucide React** - Ícones
- **Next PWA** - Progressive Web App

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração
- **Nginx** - Servidor web
- **MySQL** - Banco de dados
- **Redis** - Cache e filas

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, siga as boas práticas de desenvolvimento para contribuir com o projeto.

```bash
# Fork o projeto
# Crie sua feature branch
git checkout -b feature/AmazingFeature

# Commit suas mudanças
git commit -m 'Add: Amazing Feature'

# Push para a branch
git push origin feature/AmazingFeature

# Abra um Pull Request
```

## 📝 Licença

Este projeto está licenciado sob licença proprietária. Uso restrito e confidencial.

## 👥 Time

Desenvolvido com 💙 pela equipe de inovação em saúde digital.

---

<p align="center">
  <strong>AUSTA Onboarding Portal</strong> - Plataforma de onboarding gamificada para beneficiários de planos de saúde
</p>
