# Documento de Requisitos - Plataforma AUSTA de Onboarding de Beneficiários

## **Versão 1.0 | Janeiro 2025**

---

## **1. VISÃO GERAL DO PROJETO**

### **1.1 Objetivo**
Desenvolver uma plataforma digital gamificada para onboarding de beneficiários de planos de saúde, substituindo processos manuais por uma experiência digital envolvente, segura e eficiente.

### **1.2 Escopo do Produto**
- **Plataforma web responsiva** com foco mobile-first
- **Sistema de gamificação** para aumentar engajamento
- **Triagem de saúde inteligente** com IA conversacional
- **Processamento de documentos** com OCR automatizado
- **Agendamento de entrevistas** médicas por videochamada
- **Dashboard administrativo** para gestão corporativa

### **1.3 Objetivos de Negócio**
- **Reduzir tempo de onboarding** de 30 dias para 7 dias
- **Aumentar taxa de conclusão** para 95% (vs. 70% atual)
- **Melhorar qualidade dos dados** coletados em 3x
- **Reduzir custos operacionais** em 60%
- **Garantir compliance** LGPD e ANS desde o dia 1

### **1.4 Stakeholders**
- **Beneficiários individuais** - Usuários finais da plataforma
- **Brokers/Corretores** - Gestores de cadastros em massa
- **Equipe médica** - Condutores de entrevistas
- **Administradores RH** - Gestores corporativos
- **Equipe técnica AUSTA** - Desenvolvedores e suporte

---

## **2. REQUISITOS FUNCIONAIS**

### **2.1 Módulo de Autenticação e Perfil**

#### **RF001 - Registro de Usuário**
- **Descrição**: Permitir criação de conta com dados básicos
- **Dados obrigatórios**: Nome, e-mail, telefone, CPF, data de nascimento
- **Validações**: CPF válido, e-mail único, telefone brasileiro
- **Gamificação**: +100 pontos na criação da conta

#### **RF002 - Login e Autenticação**
- **Descrição**: Sistema de login seguro com JWT
- **Métodos**: E-mail/senha, link mágico via e-mail
- **Sessão**: Token válido por 24h com refresh automático
- **Segurança**: Rate limiting (5 tentativas/minuto)

#### **RF003 - Recuperação de Senha**
- **Descrição**: Reset de senha via e-mail
- **Fluxo**: E-mail → Link temporário (15min) → Nova senha
- **Validação**: Senha forte obrigatória (8+ caracteres, números, símbolos)

### **2.2 Módulo de Questionário de Saúde**

#### **RF004 - Triagem de Saúde Gamificada**
- **Descrição**: Questionário interativo sobre estado de saúde
- **Formato**: Multi-step form com 15-20 questões
- **Tipos de questão**: Escala Likert, múltipla escolha, checkbox
- **Gamificação**: +50 pontos por questão respondida
- **Validação**: Respostas obrigatórias com skip opcional

#### **RF005 - Conversação com IA**
- **Descrição**: Chat inteligente para esclarecimento de dúvidas
- **Integração**: OpenAI GPT-4 com contexto médico
- **Funcionalidades**: Explicação de termos, orientações gerais
- **Limitações**: Não diagnósticos, apenas informações educativas

#### **RF006 - Cálculo de Score de Risco**
- **Descrição**: Algoritmo para classificação automática de risco
- **Fatores**: Idade, condições preexistentes, estilo de vida
- **Saída**: Score 1-10 e categoria (Baixo/Médio/Alto risco)
- **Uso**: Direcionamento para diferentes fluxos de aprovação

### **2.3 Módulo de Documentos**

#### **RF007 - Upload de Documentos**
- **Descrição**: Interface para envio de documentos obrigatórios
- **Documentos**: RG/CNH, CPF, Comprovante residência, Foto 3x4
- **Formatos**: PDF, JPG, PNG (max 10MB cada)
- **Gamificação**: +100 pontos por documento válido

#### **RF008 - Processamento OCR**
- **Descrição**: Extração automática de dados dos documentos
- **Tecnologia**: AWS Textract para OCR
- **Validação**: Cruzamento de dados extraídos vs. cadastro
- **Fallback**: Revisão manual para documentos com baixa confiança

#### **RF009 - Validação de Documentos**
- **Descrição**: Sistema de verificação automática
- **Validações**: CPF válido, documento não expirado, foto clara
- **Status**: Pendente → Processando → Aprovado/Rejeitado
- **Notificação**: E-mail/SMS para cada mudança de status

### **2.4 Módulo de Agendamento**

#### **RF010 - Calendário de Entrevistas**
- **Descrição**: Sistema para agendamento de videochamadas médicas
- **Disponibilidade**: Horários configuráveis por médico
- **Duração**: Slots de 30 minutos por entrevista
- **Fuso horário**: Automático baseado na localização

#### **RF011 - Videochamada Integrada**
- **Descrição**: Sistema de videoconferência embarcado
- **Tecnologia**: Vonage Video API ou similar
- **Funcionalidades**: Câmera, microfone, chat, gravação opcional
- **Compatibilidade**: Web browsers modernos, mobile

#### **RF012 - Reagendamento**
- **Descrição**: Permitir remarcação até 2h antes da entrevista
- **Limite**: Máximo 2 reagendamentos por usuário
- **Notificação**: Confirmação automática por e-mail/SMS

### **2.5 Módulo de Gamificação**

#### **RF013 - Sistema de Pontos**
- **Descrição**: Mecânica de recompensas por ações
- **Pontuação**: Cadastro (100), Questão (50), Documento (100), Entrevista (200)
- **Níveis**: Bronze (0-299), Prata (300-699), Ouro (700+)
- **Exibição**: Contador em tempo real no header

#### **RF014 - Badges e Conquistas**
- **Descrição**: Medalhas por marcos específicos
- **Tipos**: Primeiro cadastro, Perfeccionista (100% completo), Rápido (< 10min)
- **Exibição**: Modal de celebração + perfil do usuário
- **Gamificação**: Sistema de coleção e showcase

#### **RF015 - Barra de Progresso**
- **Descrição**: Indicador visual do andamento
- **Cálculo**: Porcentagem baseada em etapas obrigatórias
- **Exibição**: Header principal + mini-indicadores por seção
- **Persistência**: Salvar progresso entre sessões

### **2.6 Módulo Administrativo**

#### **RF016 - Dashboard de Administração**
- **Descrição**: Painel para gestão de cadastros e métricas
- **Usuários**: Administradores RH e equipe AUSTA
- **Métricas**: Taxa conclusão, tempo médio, documentos pendentes
- **Filtros**: Por empresa, período, status, score de risco

#### **RF017 - Gestão de Usuários**
- **Descrição**: CRUD completo de beneficiários
- **Funcionalidades**: Visualizar, editar, desativar, exportar
- **Busca**: Por nome, CPF, e-mail, empresa
- **Bulk actions**: Importação CSV, aprovação em lote

#### **RF018 - Relatórios e Analytics**
- **Descrição**: Insights para otimização do processo
- **Relatórios**: Funil de conversão, pontos de abandono, tempo por etapa
- **Exportação**: PDF, Excel, CSV
- **Agendamento**: Relatórios automáticos por e-mail

---

## **3. REQUISITOS NÃO FUNCIONAIS**

### **3.1 Performance**

#### **RNF001 - Tempo de Resposta**
- **API**: < 500ms para 95% das requisições
- **Carregamento inicial**: < 3 segundos (3G/4G)
- **Time to Interactive**: < 2 segundos
- **OCR processing**: < 30 segundos por documento

#### **RNF002 - Escalabilidade**
- **Usuários simultâneos**: Suporte para 10.000+ usuários
- **Throughput**: 1.000 cadastros simultâneos
- **Crescimento**: Arquitetura preparada para 100x atual
- **Auto-scaling**: Baseado em CPU/memória

### **3.2 Disponibilidade**

#### **RNF003 - Uptime**
- **SLA**: 99.9% de disponibilidade (8.76h downtime/ano)
- **Manutenção**: Janelas programadas fora do horário comercial
- **Monitoring**: Alertas automáticos para indisponibilidade
- **Recovery**: MTTR < 15 minutos para incidentes críticos

### **3.3 Segurança**

#### **RNF004 - Proteção de Dados**
- **Criptografia**: TLS 1.3 para dados em trânsito
- **Armazenamento**: AES-256 para dados sensíveis em repouso
- **Backup**: Criptografado, 30 dias de retenção
- **Access control**: Role-based com princípio do menor privilégio

#### **RNF005 - Compliance**
- **LGPD**: Consentimento explícito, portabilidade, esquecimento
- **ANS**: Conformidade com regulamentações de saúde suplementar
- **Auditoria**: Logs completos de acesso e modificação
- **Certificações**: ISO 27001, SOC 2 Type II

### **3.4 Usabilidade**

#### **RNF006 - Experiência do Usuário**
- **Responsividade**: Design funcional em mobile, tablet, desktop
- **Acessibilidade**: WCAG 2.1 AA compliance
- **Internacionalização**: Português brasileiro, inglês opcional
- **Browser support**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+

#### **RNF007 - Taxa de Conclusão**
- **Target**: 95% de usuários completam o onboarding
- **Abandono**: < 5% em qualquer etapa individual
- **Tempo médio**: 5-10 minutos para conclusão
- **Satisfaction**: NPS > 70 na pesquisa pós-cadastro

---

## **4. ARQUITETURA TÉCNICA SIMPLIFICADA**

### **4.1 Visão Geral da Arquitetura**

```
[Frontend Web]     [Admin Dashboard]     [Mobile PWA]
       |                   |                   |
       +-------------------+-------------------+
                           |
              [API Gateway / Load Balancer]
                           |
    +----------------------+----------------------+
    |                                             |
[Backend API]                           [Background Jobs]
    |                                             |
    +------------------+------------------+------+
                       |                  |
              [MySQL Database]    [Redis Cache]    [S3 Storage]
                       |                  |              |
              [Backups & DR]      [Session Store]  [Documents & Media]
```

### **4.2 Stack Tecnológica Recomendada**

#### **Frontend**
- **Framework**: React 18+ com Next.js 14
- **Styling**: Tailwind CSS 3.0
- **State Management**: Zustand (leve) ou Context API
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios com interceptors
- **Icons**: Lucide React
- **Build Tool**: Vite ou Next.js build

#### **Backend**
- **Framework**: Laravel 10+ (PHP 8.2+)
- **API**: RESTful com Laravel Sanctum auth
- **ORM**: Eloquent ORM
- **Queue**: Laravel Queue com Redis driver
- **Storage**: Laravel Storage com S3 adapter
- **Validation**: Laravel Form Requests
- **Testing**: PHPUnit + Pest

#### **Banco de Dados**
- **Primary**: MySQL 8.0+
- **Cache**: Redis 7.0+
- **Search**: MySQL Full-text (upgrade futuro: Elasticsearch)
- **Backup**: Automated daily backups
- **Migrations**: Laravel migrations

#### **Infraestrutura**
- **Cloud Provider**: AWS (primary) ou GCP
- **Containers**: Docker + Docker Compose
- **Web Server**: Nginx
- **Application Server**: PHP-FPM
- **Load Balancer**: AWS ALB ou Nginx
- **CDN**: CloudFront ou CloudFlare

#### **Serviços Terceiros**
- **OCR**: AWS Textract
- **Email**: AWS SES ou SendGrid
- **Video**: Vonage Video API
- **Monitoring**: AWS CloudWatch + Sentry
- **Analytics**: Google Analytics 4

### **4.3 Estrutura de Pastas**

#### **Backend (Laravel)**
```
austa-backend/
├── app/
│   ├── Http/Controllers/
│   │   ├── Auth/
│   │   ├── Beneficiary/
│   │   ├── Document/
│   │   ├── Health/
│   │   └── Admin/
│   ├── Models/
│   ├── Services/
│   ├── Jobs/
│   └── Policies/
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   ├── api.php
│   └── web.php
└── tests/
```

#### **Frontend (Next.js)**
```
austa-frontend/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── gamification/
│   │   └── layout/
│   ├── pages/
│   │   ├── onboarding/
│   │   ├── admin/
│   │   └── auth/
│   ├── hooks/
│   ├── services/
│   └── utils/
├── public/
└── tests/
```

### **4.4 Banco de Dados - Schema Principal**

#### **Tabelas Core**
```sql
-- Usuários e Autenticação
users (id, email, password, role, created_at, updated_at)
beneficiaries (id, user_id, full_name, cpf, phone, birth_date, address)

-- Onboarding e Progresso
onboarding_sessions (id, beneficiary_id, status, progress_data, completed_at)
gamification_progress (id, beneficiary_id, points, level, badges, streak)

-- Saúde e Triagem
health_questionnaires (id, beneficiary_id, answers, risk_score, submitted_at)
health_conversations (id, beneficiary_id, messages, ai_responses)

-- Documentos
documents (id, beneficiary_id, type, file_path, ocr_data, status, validated_at)
document_validations (id, document_id, validation_rules, results, approved)

-- Agendamento
interview_slots (id, doctor_id, date, start_time, end_time, available)
interviews (id, beneficiary_id, slot_id, status, video_url, notes, completed_at)

-- Administração
companies (id, name, settings, contact_info)
company_beneficiaries (company_id, beneficiary_id, employee_id, department)
admin_users (id, user_id, company_id, permissions)
```

---

## **5. CRITÉRIOS DE ACEITE**

### **5.1 Funcionalidades Core**

#### **Cadastro e Autenticação**
- [ ] Usuário consegue criar conta em < 2 minutos
- [ ] Validação de CPF funciona corretamente
- [ ] E-mail de confirmação é enviado em < 30 segundos
- [ ] Login funciona com e-mail/senha
- [ ] Reset de senha funciona via e-mail

#### **Questionário de Saúde**
- [ ] Usuário consegue responder questionário em < 5 minutos
- [ ] Todas as questões têm validação adequada
- [ ] Progresso é salvo automaticamente a cada questão
- [ ] Score de risco é calculado corretamente
- [ ] IA responde dúvidas em português

#### **Upload de Documentos**
- [ ] Upload funciona para arquivos até 10MB
- [ ] OCR extrai dados corretamente (>90% precisão)
- [ ] Validação automática funciona
- [ ] Status de documento é atualizado em tempo real
- [ ] Usuário recebe notificação de aprovação/rejeição

#### **Agendamento**
- [ ] Calendário mostra horários disponíveis
- [ ] Agendamento confirma em < 5 segundos
- [ ] Videochamada funciona sem plugins
- [ ] Reagendamento é possível até 2h antes
- [ ] Notificações são enviadas corretamente

#### **Gamificação**
- [ ] Pontos são creditados imediatamente
- [ ] Barra de progresso atualiza em tempo real
- [ ] Badges são desbloqueadas corretamente
- [ ] Notificações de conquista aparecem
- [ ] Progresso persiste entre sessões

### **5.2 Performance e Qualidade**

#### **Tempo de Resposta**
- [ ] Página inicial carrega em < 3 segundos
- [ ] APIs respondem em < 500ms
- [ ] OCR processa documento em < 30 segundos
- [ ] Navegação entre páginas em < 1 segundo

#### **Compatibilidade**
- [ ] Funciona em Chrome, Safari, Firefox, Edge
- [ ] Responsivo em mobile, tablet, desktop
- [ ] PWA instalável em dispositivos móveis
- [ ] Acessível para usuários com deficiência

#### **Segurança**
- [ ] Dados sensíveis são criptografados
- [ ] Rate limiting previne ataques
- [ ] Logs de auditoria são gerados
- [ ] Backup automático funciona diariamente

---

## **6. PLANO DE DESENVOLVIMENTO**

### **6.1 Fases do Projeto**

#### **Fase 1 - MVP Core (8 semanas)**
**Semanas 1-2: Setup e Autenticação**
- Configuração do ambiente de desenvolvimento
- Setup Docker + CI/CD básico
- Backend: Modelos User, Beneficiary, autenticação JWT
- Frontend: Layout base, páginas de login/registro
- Testes: Cobertura básica de autenticação

**Semanas 3-4: Questionário de Saúde**
- Backend: Models e APIs para questionário
- Frontend: Multi-step form com validação
- Gamificação: Sistema básico de pontos
- Integração: IA conversacional (MVP)
- Testes: Fluxo completo de questionário

**Semanas 5-6: Upload de Documentos**
- Backend: Sistema de upload e OCR
- Frontend: Interface drag & drop
- Integração: AWS Textract
- Validação: Automática básica
- Testes: Upload e processamento

**Semanas 7-8: Agendamento e Deploy**
- Backend: Sistema de agendamento
- Frontend: Calendário e videochamada
- Deploy: Staging environment
- Testes: E2E completos
- Documentação: Guias de uso

#### **Fase 2 - Gamificação Avançada (4 semanas)**
**Semanas 9-10: Sistema de Badges**
- Backend: Sistema de conquistas
- Frontend: Modal de celebração
- Gamificação: Badges complexas
- Analytics: Tracking de engajamento

**Semanas 11-12: Dashboard Admin**
- Backend: APIs administrativas
- Frontend: Dashboard de gestão
- Relatórios: Métricas básicas
- Exportação: PDF/Excel

#### **Fase 3 - Otimização e Scale (4 semanas)**
**Semanas 13-14: Performance**
- Otimização de queries
- Cache implementation
- CDN setup
- Load testing

**Semanas 15-16: Produção**
- Deploy em produção
- Monitoring setup
- Treinamento de usuários
- Suporte go-live

### **6.2 Equipe Recomendada**

#### **Roles Essenciais**
- **1 Tech Lead/Fullstack Senior** - Arquitetura e código crítico
- **1 Backend Developer** - APIs Laravel e integrações
- **1 Frontend Developer** - React/Next.js e UX
- **1 DevOps Engineer** (part-time) - Deploy e infraestrutura
- **1 QA Engineer** - Testes e qualidade
- **1 Product Manager** - Requisitos e coordenação

#### **Skills Obrigatórios**
- **Backend**: PHP/Laravel, MySQL, APIs REST, AWS
- **Frontend**: React/Next.js, TypeScript, Tailwind CSS
- **DevOps**: Docker, AWS/GCP, CI/CD
- **QA**: Automated testing, E2E testing
- **Compliance**: LGPD, segurança de dados de saúde

### **6.3 Estimativas de Esforço**

| Módulo | Backend | Frontend | QA | Total |
|--------|---------|----------|----|----- |
| Autenticação | 20h | 16h | 8h | 44h |
| Questionário Saúde | 32h | 24h | 12h | 68h |
| Upload Documentos | 40h | 20h | 16h | 76h |
| Agendamento | 28h | 20h | 12h | 60h |
| Gamificação | 24h | 32h | 8h | 64h |
| Admin Dashboard | 36h | 28h | 12h | 76h |
| DevOps & Deploy | 32h | 8h | 16h | 56h |
| **TOTAL** | **212h** | **148h** | **84h** | **444h** |

---

## **7. RISCOS E MITIGAÇÕES**

### **7.1 Riscos Técnicos**

#### **Alto - Integração OCR**
- **Risco**: AWS Textract pode ter baixa precisão
- **Mitigação**: Fallback para revisão manual + treinamento custom
- **Contingência**: Serviço OCR alternativo (Google Vision)

#### **Médio - Performance de Upload**
- **Risco**: Upload de documentos lento
- **Mitigação**: Compression automática + upload progressivo
- **Contingência**: CDN especializado para uploads

#### **Médio - Compliance LGPD**
- **Risco**: Auditoria identificar não conformidade
- **Mitigação**: Review legal antes do go-live
- **Contingência**: Consultoria especializada em compliance

### **7.2 Riscos de Negócio**

#### **Alto - Adoção de Usuários**
- **Risco**: Baixa taxa de conclusão (<70%)
- **Mitigação**: Testes de usabilidade + iteração rápida
- **Contingência**: Incentivos adicionais de gamificação

#### **Médio - Concorrência**
- **Risco**: Competitor lançar solução similar
- **Mitigação**: Time-to-market rápido + diferenciação
- **Contingência**: Features exclusivas e parcerias

### **7.3 Riscos Operacionais**

#### **Alto - Disponibilidade**
- **Risco**: Downtime durante pico de cadastros
- **Mitigação**: Load testing + auto-scaling
- **Contingência**: Infraestrutura multi-region

#### **Médio - Suporte**
- **Risco**: Volume alto de dúvidas de usuários
- **Mitigação**: FAQ completo + chatbot
- **Contingência**: Equipe de suporte dedicada

---

## **8. CONSIDERAÇÕES FINAIS**

### **8.1 Fatores Críticos de Sucesso**
1. **UX excepcional** - Interface intuitiva e engajante
2. **Performance** - Tempos de resposta sub-segundo
3. **Gamificação efetiva** - Motivação sem trivializar saúde
4. **Compliance rigoroso** - LGPD e ANS desde o início
5. **Qualidade de dados** - Precisão alta no OCR e validações

### **8.2 Métricas de Sucesso**
- **Taxa de conclusão**: 95%+ (vs. 70% atual)
- **Tempo médio de onboarding**: 5-10 minutos
- **NPS**: 70+ pontos
- **Precisão de dados**: 99%+ após validação
- **Disponibilidade**: 99.9%+ uptime

### **8.3 Próximos Passos**
1. **Aprovação stakeholders** - Review e sign-off do documento
2. **Setup do projeto** - Repositórios, CI/CD, ambientes
3. **Kick-off técnico** - Alinhamento da equipe
4. **Sprint 0** - Arquitetura detalhada e setup
5. **Desenvolvimento iterativo** - Sprints semanais com demos

### **8.4 Documentação Adicional Necessária**
- **Manual de API** - Swagger/OpenAPI documentation
- **Guia de Deploy** - Procedimentos de infraestrutura
- **Manual de Usuário** - Para administradores
- **Plano de Testes** - Casos de teste detalhados
- **Runbook Operacional** - Procedimentos de suporte
