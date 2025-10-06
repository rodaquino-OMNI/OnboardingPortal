# UX Flow Maps - Onboarding Portal

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Design Specification

---

## Table of Contents

1. [Introduction](#introduction)
2. [Flow 1: Registration & Email Verification](#flow-1-registration--email-verification)
3. [Flow 2: Profile Completion](#flow-2-profile-completion)
4. [Flow 3: Health Questionnaire](#flow-3-health-questionnaire)
5. [Flow 4: Document Upload & OCR](#flow-4-document-upload--ocr)
6. [Flow 5: Interview Scheduling](#flow-5-interview-scheduling)
7. [Cross-Cutting Concerns](#cross-cutting-concerns)
8. [Gamification Integration](#gamification-integration)
9. [State Management Boundaries](#state-management-boundaries)
10. [Analytics Events](#analytics-events)

---

## Introduction

This document maps complete user journeys through the onboarding process with detailed integration points for:
- **Gamification triggers** (per GAMIFICATION_SPEC.md)
- **State management boundaries** (per ADR-003)
- **Authentication checkpoints** (per ADR-002)
- **Analytics events**

### Design Principles
- **Progressive Disclosure**: Show only relevant information at each step
- **Clear Progress**: Always visible progress indicator
- **Positive Reinforcement**: Celebrate achievements, never punish
- **Accessible**: WCAG 2.1 AA compliant at every touchpoint

---

## Flow 1: Registration & Email Verification

### 1.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Landing Page                                            │
│ [Começar Cadastro] CTA                                  │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: Registration Form                               │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Email:        [________________]                 │    │
│ │ Senha:        [________________]                 │    │
│ │ Confirmar:    [________________]                 │    │
│ │ CPF:          [___.___.___-__]                   │    │
│ │ Telefone:     [(__) ____-____]                   │    │
│ │                                                   │    │
│ │ ☑ Aceito termos de uso                           │    │
│ │ ☑ Aceito política de privacidade (LGPD)         │    │
│ │                                                   │    │
│ │ [Criar Conta] ←─ Auth API                        │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Progress: ━━░░░░░░░░ 10%                                │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Email Sent Confirmation                                 │
│ ✉️ Enviamos um email para [user@email.com]             │
│                                                          │
│ Por favor, clique no link para verificar sua conta.     │
│                                                          │
│ Não recebeu? [Reenviar Email]                          │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Email Verification Link Clicked                         │
│ POST /api/auth/verify-email?token=xyz                   │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 🎉 Success Modal                                        │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Parabéns! Email verificado com sucesso!         │    │
│ │                                                   │    │
│ │ [Confetti Animation]                             │    │
│ │                                                   │    │
│ │ +100 pontos 🎁 (Primeiros Passos badge)         │    │
│ │ Nível: Iniciante                                 │    │
│ │                                                   │    │
│ │ [Continuar para Perfil] →                        │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
                [Flow 2: Profile]
```

### 1.2 State Management (ADR-003)

**Client State (Zustand)**:
```typescript
// Store: authStore.ts
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  emailVerified: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  setUser: (user: User) => void;
  logout: () => void;
}
```

**Server State (SWR)**:
```typescript
// Hook: useEmailVerification
const { data, error, mutate } = useSWR(
  '/api/auth/verify-email',
  fetcher,
  { revalidateOnFocus: false }
);
```

### 1.3 Authentication Checkpoints (ADR-002)

| Step | Auth Required | Token Type | Redirect on Fail |
|------|---------------|------------|------------------|
| Landing | No | None | N/A |
| Registration Form | No | None | N/A |
| Email Sent | No | None | N/A |
| Email Link | Yes | Verification Token (1-time, 24h TTL) | /register |
| Success Modal | Yes | Access Token (15min) | /login |

**Token Flow**:
1. POST /api/auth/register → Returns `{ user, verification_email_sent: true }`
2. User clicks email link → GET /api/auth/verify-email?token=xyz
3. Backend validates token → Sets `email_verified_at` in DB
4. Returns `{ access_token, refresh_token }` → Client stores in httpOnly cookies
5. Redirect to /profile with authenticated session

### 1.4 Gamification Triggers

| Trigger | Points | Badge | Level Check | Event Name |
|---------|--------|-------|-------------|------------|
| Account created | 100 | 🚀 Primeiros Passos | Check if → Bronze (300pts) | `gamification.points_earned` |
| Email verified | 0 (included in 100) | - | - | `gamification.email_verified` |

**Celebration UI**:
```typescript
// Component: RegistrationSuccessModal.tsx
<Modal>
  <Confetti duration={3000} />
  <BadgeAnimation badge="first_steps" />
  <PointsAnimation points={100} />
  <LevelIndicator currentLevel="iniciante" progress={33.3} />
  <Button onClick={() => router.push('/profile')}>
    Continuar para Perfil →
  </Button>
</Modal>
```

### 1.5 Analytics Events

```json
{
  "event": "auth.registration_started",
  "timestamp": "2025-09-30T10:00:00Z",
  "properties": {
    "source": "landing_page_cta",
    "utm_source": "google",
    "utm_campaign": "onboarding_q4"
  }
}
```

```json
{
  "event": "auth.registration_completed",
  "timestamp": "2025-09-30T10:02:30Z",
  "properties": {
    "user_id": "hash_abc123",
    "time_to_complete_seconds": 150,
    "cpf_validation_passed": true,
    "email_domain": "gmail.com"
  }
}
```

```json
{
  "event": "gamification.points_earned",
  "timestamp": "2025-09-30T10:03:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "action_type": "registration_complete",
    "points_amount": 100,
    "points_total_after": 100,
    "badge_unlocked": "first_steps"
  }
}
```

---

## Flow 2: Profile Completion

### 2.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Profile Form (Step 2)                                   │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Nome Completo*:  [________________________]     │    │
│ │ Data Nascimento*:[__/__/____] ←─ DatePicker    │    │
│ │ Gênero*:         [▼ Selecione]                  │    │
│ │ Endereço*:       [________________________]     │    │
│ │                                                   │    │
│ │ ─── Campos Opcionais (+25 pts) ───              │    │
│ │ Telefone Fixo:   [(__) ____-____]               │    │
│ │ Estado Civil:    [▼ Selecione]                  │    │
│ │ Profissão:       [________________________]     │    │
│ │ Nome da Mãe:     [________________________]     │    │
│ │ Contato Emerg:   [________________________]     │    │
│ │                                                   │    │
│ │ 💡 Perfis completos recebem 3x mais suporte     │    │
│ │    personalizado! (+25 pontos extras)           │    │
│ │                                                   │    │
│ │ [Voltar]  [Salvar e Continuar →]                │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Progress: ━━━━░░░░░░ 30%                                │
│ Próxima recompensa: +50 pts (completar perfil)         │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Profile Saved (Auto-Save + Manual Submit)               │
│ POST /api/profile/update                                │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Points Notification (Toast)                             │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ✅ Perfil salvo com sucesso!                     │    │
│ │ +50 pontos (Perfil Básico)                       │    │
│ │ +25 pontos (Perfil Completo - todos os campos)  │    │
│ │                                                   │    │
│ │ Total: 175 pontos | Nível: Iniciante (58%)      │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
                [Flow 3: Health Questionnaire]
```

### 2.2 State Management

**Client State (React Hook Form)**:
```typescript
// Form State
const { register, handleSubmit, watch, formState: { errors } } = useForm({
  mode: 'onBlur',
  resolver: zodResolver(profileSchema)
});

// Auto-save (debounced)
const watchedValues = watch();
useEffect(() => {
  const timer = setTimeout(() => {
    mutate('/api/profile/autosave', { ...watchedValues });
  }, 2000);
  return () => clearTimeout(timer);
}, [watchedValues]);
```

**Server State (SWR)**:
```typescript
// Hook: useProfile
const { data: profile, mutate } = useSWR('/api/profile', fetcher);

// Optimistic update
const updateProfile = async (data) => {
  mutate({ ...profile, ...data }, false); // Optimistic
  await fetcher('/api/profile/update', { method: 'POST', body: data });
  mutate(); // Revalidate
};
```

### 2.3 Gamification Triggers

| Trigger | Points | Badge | Condition |
|---------|--------|-------|-----------|
| Basic profile complete (required fields) | 50 | - | All * fields filled |
| Optional fields complete | 25 | 📋 Perfil Completo | All 5 optional fields filled |
| Thoroughness bonus | 25 | - | 100% completion on first try (no validation errors) |

**Contextual Nudge**:
```typescript
// Component: ProfileOptionalFieldsNudge.tsx
{optionalFieldsCount < 5 && (
  <InfoBanner variant="helpful">
    💡 Perfis completos recebem 3x mais suporte personalizado!
    Ganhe +25 pontos extras ao preencher todos os campos.
    <Button variant="link" onClick={fillRemainingFields}>
      Preencher agora
    </Button>
  </InfoBanner>
)}
```

### 2.4 Analytics Events

```json
{
  "event": "profile.field_completed",
  "timestamp": "2025-09-30T10:05:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "field_name": "phone_secondary",
    "field_type": "optional",
    "completion_percentage": 80
  }
}
```

---

## Flow 3: Health Questionnaire

### 3.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Health Assessment Intro                                 │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 📋 Questionário de Saúde                         │    │
│ │                                                   │    │
│ │ Para oferecer o melhor atendimento, precisamos   │    │
│ │ entender sua saúde.                              │    │
│ │                                                   │    │
│ │ • 15 questões obrigatórias (~5 min)             │    │
│ │ • 10 questões opcionais (ganhe +200 pts!)       │    │
│ │                                                   │    │
│ │ 🔒 Seus dados são criptografados e protegidos    │    │
│ │    conforme LGPD e HIPAA.                        │    │
│ │                                                   │    │
│ │ [Começar Questionário →]                         │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Question 1 of 25                                        │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Você tem alguma condição crônica?                │    │
│ │ [ℹ️ Tooltip: Doenças de longa duração...]        │    │
│ │                                                   │    │
│ │ ○ Sim                                            │    │
│ │ ○ Não                                            │    │
│ │ ○ Prefiro não responder                         │    │
│ │                                                   │    │
│ │ +20 pontos por questão respondida                │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Progress: ━━━━━░░░░░ 50% (Question 13/25)              │
│ Pontos ganhos: 260 pts                                  │
│                                                          │
│ [← Anterior]  [Próxima →]  [Salvar e Sair]             │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Progressive Disclosure: Conditional Questions           │
│ If "Sim" to chronic condition:                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Qual condição? (pode selecionar múltiplas)      │    │
│ │ ☑ Diabetes                                       │    │
│ │ ☑ Hipertensão                                    │    │
│ │ ☐ Asma                                           │    │
│ │ ☐ Outro: [_____________]                        │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Question 25 of 25 (Last Question)                      │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Tem alguma observação adicional?                │    │
│ │ [Text Area - Optional]                           │    │
│ │                                                   │    │
│ │ [Finalizar Questionário →]                       │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Risk Scoring Processing (Backend)                      │
│ POST /api/health/submit                                 │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [Loading Spinner]                                │    │
│ │ Analisando suas respostas...                     │    │
│ │ Calculando perfil de saúde...                    │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Health Summary + Gamification Celebration               │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 🎉 Questionário Completo!                        │    │
│ │                                                   │    │
│ │ +500 pontos ganhos!                              │    │
│ │ 🏆 Badge desbloqueado: Campeão da Saúde         │    │
│ │                                                   │    │
│ │ Seu Perfil de Saúde:                             │    │
│ │ Risco: Baixo 🟢                                  │    │
│ │ Recomendação: Consulta de rotina                │    │
│ │                                                   │    │
│ │ Nível alcançado: Bronze (835 pts)               │    │
│ │ Novo benefício: Suporte prioritário 24h! ⭐      │    │
│ │                                                   │    │
│ │ [Ver Relatório Completo]  [Continuar →]         │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
                [Flow 4: Document Upload]
```

### 3.2 State Management

**Client State (Zustand + Persistence)**:
```typescript
// Store: healthQuestionnaireStore.ts
interface HealthQuestionnaireState {
  answers: Record<string, Answer>;
  currentQuestion: number;
  completedQuestions: Set<number>;
  riskScore: number | null;
  saveAnswer: (questionId: number, answer: Answer) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitQuestionnaire: () => Promise<void>;
}

// Persist to localStorage for resume capability
persist(
  (set, get) => ({ /* state */ }),
  { name: 'health-questionnaire' }
);
```

**Server State (SWR)**:
```typescript
// Hook: useHealthTemplate
const { data: template } = useSWR('/api/health/templates/default', fetcher);

// Hook: useHealthSubmission
const { data: submission, mutate } = useSWR(
  '/api/health/submission',
  fetcher,
  { revalidateOnFocus: false }
);
```

### 3.3 Risk Scoring (Clinical Decision Support)

**Backend Processing**:
1. User submits questionnaire → POST /api/health/submit
2. Backend validates answers → Run risk scoring algorithm
3. Calculate risk score (0-100) → Categorize: Low (0-30), Medium (31-70), High (71-100)
4. Generate clinical alerts if high risk → Notify healthcare team
5. Return summary + recommendations

**Risk Score Visualization**:
```typescript
// Component: HealthRiskIndicator.tsx
<RiskMeter>
  <Gauge value={riskScore} max={100}
         color={riskScore < 30 ? 'green' : riskScore < 70 ? 'yellow' : 'red'} />
  <Label>
    Risco: {riskCategory} {riskIcon}
    <Tooltip>
      Baseado em 25 questões analisadas por nossa equipe médica.
    </Tooltip>
  </Label>
</RiskMeter>
```

### 3.4 Gamification Triggers

| Trigger | Points | Badge | Condition |
|---------|--------|-------|-----------|
| Each required question | 20 | - | Per question (15 questions = 300 pts) |
| Each optional question | 20 | - | Per question (10 questions = 200 pts) |
| Questionnaire complete | 0 | 💪 Campeão da Saúde | All 25 questions answered |
| 100% completion | 150 | 📖 Livro Aberto | All questions + optional questions |
| Zero errors | 50 | 🔍 Detalhista | No validation errors on first submission |

**Total Possible**: 300 + 200 + 150 + 50 = 700 points

### 3.5 Analytics Events

```json
{
  "event": "health.questionnaire_started",
  "timestamp": "2025-09-30T10:10:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "template_id": "default_v2",
    "total_questions": 25
  }
}
```

```json
{
  "event": "health.question_answered",
  "timestamp": "2025-09-30T10:11:30Z",
  "properties": {
    "user_id": "hash_abc123",
    "question_id": 5,
    "question_type": "required",
    "answer_type": "multiple_choice",
    "time_to_answer_seconds": 15
  }
}
```

```json
{
  "event": "health.risk_score_calculated",
  "timestamp": "2025-09-30T10:20:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "risk_score": 25,
    "risk_category": "low",
    "clinical_alerts_generated": 0,
    "processing_time_ms": 1200
  }
}
```

---

## Flow 4: Document Upload & OCR

### 4.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Document Upload Hub                                     │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 📄 Envio de Documentos                           │    │
│ │                                                   │    │
│ │ Documentos Necessários:                          │    │
│ │                                                   │    │
│ │ ✅ RG (Frente e Verso)         +75 pts cada     │    │
│ │ ✅ CPF                          +75 pts          │    │
│ │ ✅ Comprovante de Residência   +75 pts          │    │
│ │ ☐ Carteirinha do Plano (se já possui) +75 pts  │    │
│ │                                                   │    │
│ │ 💡 Documentos claros são aprovados 90% mais     │    │
│ │    rápido! Use boa iluminação.                  │    │
│ │                                                   │    │
│ │ [Enviar RG →]                                    │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Progress: ━━━━━━░░░░ 60%                                │
│ Pontos ganhos até agora: 835 pts                        │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Document Upload Modal                                   │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Enviar RG (Frente)                               │    │
│ │                                                   │    │
│ │ [📷 Tirar Foto]  [📁 Escolher Arquivo]          │    │
│ │                                                   │    │
│ │ Requisitos:                                      │    │
│ │ • Formato: JPG, PNG, PDF                        │    │
│ │ • Tamanho máximo: 10 MB                         │    │
│ │ • Documento inteiro visível                     │    │
│ │ • Texto legível                                  │    │
│ │                                                   │    │
│ │ [Cancelar]  [Fazer Upload →]                     │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ File Upload + Client-Side Preprocessing                │
│ POST /api/documents/upload                              │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [Progress Bar] 65%                               │    │
│ │ Fazendo upload... (2.3 MB / 3.5 MB)             │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ OCR Processing (Backend - Hybrid Tesseract + Textract) │
│ Job Queue: ProcessDocumentOCR                           │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [Animated Spinner]                               │    │
│ │ Processando documento...                         │    │
│ │ Extraindo texto automaticamente                  │    │
│ │                                                   │    │
│ │ Estimativa: 10-30 segundos                       │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ OCR Results + Manual Review (if needed)                │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ✅ Texto extraído com sucesso!                   │    │
│ │                                                   │    │
│ │ Nome: JOÃO DA SILVA                              │    │
│ │ RG: 12.345.678-9                                 │    │
│ │ Emissão: 01/01/2020                              │    │
│ │                                                   │    │
│ │ Está correto?                                    │    │
│ │ [✏️ Editar]  [✅ Confirmar]                       │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Document Status: Pending Approval                      │
│ ┌─────────────────────────────────────────────────┐    │
│ │ RG (Frente): ⏳ Em análise                       │    │
│ │ Enviado em: 30/09/2025 10:25                     │    │
│ │                                                   │    │
│ │ +75 pontos ganhos pelo upload!                   │    │
│ │ +150 pontos ao ser aprovado                      │    │
│ │                                                   │    │
│ │ Tempo médio de aprovação: 24h                    │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ WebSocket Real-Time Update                             │
│ Event: document_approved                                │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 🎉 Document Approved Toast Notification                │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ✅ RG (Frente) aprovado!                         │    │
│ │ +150 pontos                                      │    │
│ │                                                   │    │
│ │ Total: 1,060 pontos | Nível: Prata 🥈           │    │
│ │ Novo benefício: Processamento expresso (<24h)!  │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
          [Repeat for other documents]
                    ↓
          [All Documents Approved]
                    ↓
                [Flow 5: Interview Scheduling]
```

### 4.2 State Management

**Client State (Zustand)**:
```typescript
// Store: documentStore.ts
interface DocumentState {
  documents: Document[];
  uploadProgress: Record<string, number>;
  uploadDocument: (file: File, type: DocumentType) => Promise<void>;
  updateDocumentStatus: (id: number, status: DocumentStatus) => void;
}
```

**Server State (SWR + WebSocket)**:
```typescript
// Hook: useDocuments
const { data: documents, mutate } = useSWR('/api/documents', fetcher, {
  revalidateOnFocus: true
});

// WebSocket subscription for real-time updates
useEffect(() => {
  const channel = pusher.subscribe(`private-user-${userId}`);
  channel.bind('document_approved', (data) => {
    mutate(); // Revalidate documents list
    toast.success(`${data.document_type} aprovado! +150 pontos`);
  });
  return () => pusher.unsubscribe(`private-user-${userId}`);
}, [userId]);
```

### 4.3 OCR Processing Flow

**Hybrid Strategy (per OCR Architecture)**:
1. **Client preprocessing**: Compress image, adjust brightness/contrast
2. **Upload to S3**: Store original file
3. **Tesseract OCR first**: Run free OCR (cost: $0)
4. **Confidence check**: If confidence > 90% → Accept results
5. **Textract fallback**: If confidence < 90% → Use AWS Textract (cost: $0.0015/page)
6. **Manual review**: If still uncertain → Queue for human review

**Cost Optimization**:
- 70% of documents processed by Tesseract (free)
- 25% require Textract ($0.0015 each)
- 5% need manual review (R$2 labor cost)
- **Average cost per document**: R$0.15 (down from R$50 manual)

### 4.4 Gamification Triggers

| Trigger | Points | Badge | Condition |
|---------|--------|-------|-----------|
| Document uploaded | 75 | - | Per document type (5 documents = 375 pts) |
| Document approved | 150 | - | Per document (5 documents = 750 pts) |
| All documents approved (first try) | 200 | ✅ Tudo Aprovado | No rejections |
| Document quality bonus | 25 | 🎖️ Profissional de Documentos | All docs 95%+ confidence score |

**Total Possible**: 375 + 750 + 200 + 25 = 1,350 points

### 4.5 Analytics Events

```json
{
  "event": "documents.upload_started",
  "timestamp": "2025-09-30T10:25:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "document_type": "rg_front",
    "file_size_bytes": 3670016,
    "upload_method": "camera"
  }
}
```

```json
{
  "event": "documents.ocr_completed",
  "timestamp": "2025-09-30T10:25:45Z",
  "properties": {
    "user_id": "hash_abc123",
    "document_id": 12345,
    "ocr_engine": "tesseract",
    "confidence_score": 0.95,
    "processing_time_ms": 8500,
    "text_extracted_length": 256
  }
}
```

---

## Flow 5: Interview Scheduling

### 5.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Interview Scheduling Hub                                │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 📅 Agendamento de Entrevista                     │    │
│ │                                                   │    │
│ │ Última etapa! Agende sua entrevista para        │    │
│ │ finalizar o cadastro.                            │    │
│ │                                                   │    │
│ │ Duração: 15-20 minutos                           │    │
│ │ Formato: Videochamada (via navegador)           │    │
│ │                                                   │    │
│ │ 💡 Horários da manhã (9-11h) têm 95% menos      │    │
│ │    cancelamentos! Ganhe +75 pts de pontualidade │    │
│ │                                                   │    │
│ │ [Ver Horários Disponíveis →]                     │    │
│ └─────────────────────────────────────────────────┘    │
│                                                          │
│ Progress: ━━━━━━━━░░ 80%                                │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Calendar View (Premium users see evening slots)        │
│ GET /api/interviews/slots?date=2025-10-01               │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Outubro 2025                    [◀ ▶]            │    │
│ │                                                   │    │
│ │ D  S  T  Q  Q  S  S                              │    │
│ │ 29 30  1  2  3  4  5                             │    │
│ │ 6  7  8  9 10 11 12                              │    │
│ │                                                   │    │
│ │ Horários para 01/10/2025:                        │    │
│ │ ○ 09:00 - 09:20 (Recomendado ⭐)                │    │
│ │ ○ 10:00 - 10:20                                  │    │
│ │ ○ 11:00 - 11:20                                  │    │
│ │ ○ 14:00 - 14:20                                  │    │
│ │ 🔒 18:00 - 18:20 (Desbloqueie no Nível Ouro)    │    │
│ │                                                   │    │
│ │ [Agendar Horário Selecionado →]                  │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Booking Confirmation                                    │
│ POST /api/interviews/book                               │
│ ┌─────────────────────────────────────────────────┐    │
│ │ ✅ Entrevista agendada!                          │    │
│ │                                                   │    │
│ │ Data: 01/10/2025 às 09:00                        │    │
│ │ Link da videochamada:                            │    │
│ │ https://meet.portal.com/abc123                   │    │
│ │                                                   │    │
│ │ +200 pontos ganhos!                              │    │
│ │                                                   │    │
│ │ Lembretes:                                       │    │
│ │ ✉️ Email enviado                                 │    │
│ │ 📲 SMS enviado                                   │    │
│ │ 🔔 Lembrete 1h antes                             │    │
│ │                                                   │    │
│ │ [Adicionar ao Calendário]  [Ver Detalhes]       │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Pre-Interview Reminders (Automated)                    │
│ T-24h: Email reminder                                   │
│ T-1h:  SMS + Push notification                          │
│ T-2min: Browser notification "Entrevista começando!"   │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Interview Day: Join Link                               │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Sua entrevista começa em 5 minutos!             │    │
│ │                                                   │    │
│ │ [Entrar na Videochamada →]                       │    │
│ │                                                   │    │
│ │ Dicas:                                           │    │
│ │ ✓ Verifique câmera e microfone                  │    │
│ │ ✓ Tenha seus documentos à mão                   │    │
│ │ ✓ Escolha local silencioso                      │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Video Interview (via Jitsi/Agora)                      │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [Video Feed - User]  [Video Feed - Agent]       │    │
│ │                                                   │    │
│ │ [🎤 Mute] [📷 Camera] [💬 Chat] [🔴 End]        │    │
│ │                                                   │    │
│ │ Duration: 15:30 elapsed                          │    │
│ └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Post-Interview: Agent Marks Complete                   │
│ PATCH /api/interviews/{id}/complete                     │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 🎉🎉🎉 ONBOARDING COMPLETE! 🎉🎉🎉                       │
│ ┌─────────────────────────────────────────────────┐    │
│ │ [Full-Screen Confetti + Celebration Music]      │    │
│ │                                                   │    │
│ │ PARABÉNS!                                        │    │
│ │ Você completou seu cadastro! 🚀                  │    │
│ │                                                   │    │
│ │ Total de pontos: 2,835                           │    │
│ │ Nível alcançado: Platina 💎                      │    │
│ │                                                   │    │
│ │ Seus benefícios VIP:                             │    │
│ │ ✓ Suporte prioritário (resposta em 4h)         │    │
│ │ ✓ Processamento expresso (<12h)                │    │
│ │ ✓ Agendamentos premium (noite/fim de semana)   │    │
│ │ ✓ Concierge dedicado (WhatsApp direto)         │    │
│ │                                                   │    │
│ │ Conquistas desbloqueadas: 12/25                  │    │
│ │                                                   │    │
│ │ [Baixar Certificado 📜]  [Compartilhar 🎊]      │    │
│ │ [Ir para o Painel →]                             │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 State Management

**Client State (Zustand)**:
```typescript
// Store: interviewStore.ts
interface InterviewState {
  selectedSlot: InterviewSlot | null;
  booking: Interview | null;
  setSelectedSlot: (slot: InterviewSlot) => void;
  bookInterview: (slotId: number) => Promise<void>;
  cancelInterview: (interviewId: number) => Promise<void>;
}
```

**Server State (SWR)**:
```typescript
// Hook: useInterviewSlots
const { data: slots } = useSWR(
  selectedDate ? `/api/interviews/slots?date=${selectedDate}` : null,
  fetcher
);

// Hook: useInterview
const { data: interview } = useSWR(
  interviewId ? `/api/interviews/${interviewId}` : null,
  fetcher,
  { refreshInterval: 5000 } // Poll every 5s for status updates
);
```

### 5.3 Gamification Triggers

| Trigger | Points | Badge | Condition |
|---------|--------|-------|-----------|
| Interview scheduled | 200 | - | Booking confirmed |
| Interview attended (on time) | 300 | 🎯 Missão Cumprida | Joined within 2 min of start |
| Punctuality bonus | 75 | - | Joined within 2 min |
| Onboarding complete | 500 | 🚀 Velocista (if <10 min total) | All steps finished |

**Total Possible**: 200 + 300 + 75 + 500 = 1,075 points

### 5.4 Analytics Events

```json
{
  "event": "interview.slot_booked",
  "timestamp": "2025-09-30T10:30:00Z",
  "properties": {
    "user_id": "hash_abc123",
    "interview_id": 456,
    "scheduled_date": "2025-10-01T09:00:00Z",
    "slot_type": "morning",
    "days_until_interview": 1
  }
}
```

```json
{
  "event": "interview.attended",
  "timestamp": "2025-10-01T09:01:30Z",
  "properties": {
    "user_id": "hash_abc123",
    "interview_id": 456,
    "joined_at": "2025-10-01T09:01:30Z",
    "punctuality_seconds": 90,
    "punctuality_bonus_earned": true
  }
}
```

---

## Cross-Cutting Concerns

### Authentication Boundaries (ADR-002)

**Token Refresh Strategy**:
```typescript
// Interceptor: axios-auth-interceptor.ts
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Attempt token refresh
      const { accessToken } = await refreshToken();

      if (accessToken) {
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } else {
        // Refresh failed → Redirect to login
        router.push('/login?session_expired=true');
      }
    }

    return Promise.reject(error);
  }
);
```

**Session Fingerprinting** (per ADR-002):
```typescript
// Generate fingerprint on mount
const fingerprint = await generateFingerprint();

// Send with every request
axios.defaults.headers.common['X-Session-Fingerprint'] = fingerprint;

// Backend validates fingerprint matches session
// If mismatch → Trigger MFA re-verification
```

### State Management Boundaries (ADR-003)

**Clear Separation**:
- **Client State (Zustand)**: Form values, UI state, draft data
- **Server State (SWR)**: API responses, cached data
- **URL State (Next.js router)**: Current step, selected tab

**Example Boundary**:
```typescript
// ❌ BAD: Mixing client and server state
const [profile, setProfile] = useState<Profile | null>(null);
const { data } = useSWR('/api/profile', fetcher);
// Now we have two sources of truth!

// ✅ GOOD: Clear boundaries
const { data: profile } = useSWR('/api/profile', fetcher); // Server state
const [draftChanges, setDraftChanges] = useState({}); // Client state (draft)

// Merge for display
const displayProfile = { ...profile, ...draftChanges };
```

### Accessibility (WCAG 2.1 AA)

**Checklist per Flow**:
- [ ] All images have descriptive alt text
- [ ] All form inputs have associated labels
- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Focus indicators visible (2px solid outline)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces state changes
- [ ] Error messages are programmatically associated with fields
- [ ] Time limits can be extended (for interviews)
- [ ] Animations respect `prefers-reduced-motion`

**Example**:
```tsx
// Component: PointsAnimation.tsx
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

return (
  <motion.div
    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
    role="status"
    aria-live="polite"
    aria-label={`Você ganhou ${points} pontos`}
  >
    +{points} pontos
  </motion.div>
);
```

---

## Gamification Integration

### Global Points Display

**Header Component** (visible on all pages):
```tsx
// Component: Header.tsx
<Header>
  <Logo />
  <ProgressBar value={completionPercentage} />
  <PointsIndicator points={totalPoints} level={currentLevel} />
  <UserMenu />
</Header>
```

**PointsIndicator Details**:
```tsx
<PointsIndicator>
  <LevelBadge level={currentLevel} />
  <PointsCounter>
    {totalPoints.toLocaleString('pt-BR')} pts
  </PointsCounter>
  <Tooltip>
    <LevelProgress
      current={totalPoints}
      next={nextLevelThreshold}
      nextLevel={nextLevel}
    />
    <Text>Faltam {pointsToNext} pontos para {nextLevel}</Text>
  </Tooltip>
</PointsIndicator>
```

### Real-Time Updates (WebSocket)

**Pusher Integration**:
```typescript
// Hook: useGamificationUpdates
const useGamificationUpdates = (userId: string) => {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const channel = pusher.subscribe(`private-user-${userId}`);

    // Listen for point events
    channel.bind('points_earned', (data) => {
      mutate('/api/gamification/progress');
      toast.success(`+${data.points} pontos!`, {
        icon: '🎉',
        duration: 3000
      });
    });

    // Listen for level-up events
    channel.bind('level_up', (data) => {
      mutate('/api/gamification/progress');
      openLevelUpModal(data.new_level, data.benefits);
    });

    // Listen for badge unlocks
    channel.bind('badge_unlocked', (data) => {
      mutate('/api/gamification/progress');
      openBadgeModal(data.badge);
    });

    return () => pusher.unsubscribe(`private-user-${userId}`);
  }, [userId]);
};
```

---

## State Management Boundaries

### Zustand Stores (Client State)

**authStore.ts**:
- User authentication status
- Access/refresh tokens
- User profile data

**onboardingStore.ts**:
- Current step
- Step completion status
- Draft form data (autosaved to localStorage)

**gamificationStore.ts**:
- Total points (synced from server)
- Current level (synced from server)
- Unlocked badges (synced from server)

### SWR Hooks (Server State)

**useProfile()**:
- Fetches `/api/profile`
- Revalidates on focus
- Cached for 5 minutes

**useDocuments()**:
- Fetches `/api/documents`
- Revalidates every 30 seconds (for status updates)
- Cached for 1 minute

**useGamificationProgress()**:
- Fetches `/api/gamification/progress`
- Revalidates on window focus
- Cached for 2 minutes

---

## Analytics Events

### Event Naming Convention

**Format**: `<namespace>.<action>_<object>`

**Examples**:
- `auth.registration_started`
- `gamification.points_earned`
- `health.questionnaire_completed`
- `documents.upload_failed`

### Event Properties Standard

**Required Properties** (all events):
- `event`: Event name
- `timestamp`: ISO8601 timestamp
- `user_id`: Hashed user ID (for privacy)
- `session_id`: Session identifier

**Optional Properties**:
- `platform`: "web" | "mobile"
- `user_agent`: Browser user agent
- `context`: Event-specific metadata object

### Funnel Metrics

**Onboarding Funnel**:
1. Landing Page Viewed → Registration Started (Target: >80% conversion)
2. Registration Started → Email Verified (Target: >90%)
3. Email Verified → Profile Complete (Target: >95%)
4. Profile Complete → Health Questionnaire Complete (Target: >90%)
5. Health Questionnaire → All Documents Uploaded (Target: >85%)
6. Documents Uploaded → Interview Scheduled (Target: >90%)
7. Interview Scheduled → Interview Attended (Target: >85%)
8. Interview Attended → Onboarding Complete (Target: >98%)

**Drop-Off Alerts**:
- If any step <5% below target → Alert product team
- If any step <10% below target → Escalate to engineering

---

## Appendix: Component Library

### Key Components

1. **ProgressBar**: Visual indicator of onboarding completion
2. **PointsAnimation**: Confetti + point counter animation
3. **LevelUpModal**: Full-screen celebration on level-up
4. **BadgeUnlockModal**: Badge showcase with description
5. **ContextualNudge**: Data-driven tips at decision points
6. **DocumentUploadZone**: Drag-drop + camera capture
7. **CalendarPicker**: Interview slot selection
8. **VideoCallInterface**: Jitsi/Agora integration
9. **HealthRiskMeter**: Visual risk score gauge
10. **GamificationDashboard**: Points, badges, challenges overview

---

**End of UX Flow Maps v1.0.0**
