# Gamification System Specification

**Version**: 1.0.0
**Last Updated**: 2025-09-30
**Status**: Production-Ready MVP Design

---

## Table of Contents

1. [Goals and Alignment](#1-goals-and-alignment)
2. [Point System](#2-point-system)
3. [Level System](#3-level-system)
4. [Achievement System](#4-achievement-system)
5. [Mechanics and Feedback Loops](#5-mechanics-and-feedback-loops)
6. [Ethical Constraints and Anti-Dark Patterns](#6-ethical-constraints-and-anti-dark-patterns)
7. [Instrumentation and Analytics](#7-instrumentation-and-analytics)
8. [Database Schema](#8-database-schema)
9. [Analytics Event Taxonomy](#9-analytics-event-taxonomy)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Goals and Alignment

### 1.1 Product Goals

| Goal | Current Performance | Target | Measurement |
|------|-------------------|--------|-------------|
| **Onboarding Completion Rate** | >95% | >95% (maintain) | % users completing all steps |
| **Average Completion Time** | <10 min | <10 min (maintain) | Median time from start to finish |
| **User Satisfaction Score** | 4.8/5.0 | ≥4.8/5.0 (maintain/improve) | Post-onboarding NPS survey |
| **Engagement Rate** | >85% | >85% (maintain) | % users returning after initial session |

### 1.2 User Goals

| User Need | How Gamification Helps | Success Indicator |
|-----------|----------------------|-------------------|
| **Quick Enrollment** | Progress visualization shows time remaining | <10 min average completion |
| **Understand Health Benefits** | Points reward thorough health assessment | >90% complete optional questions |
| **Feel Accomplished** | Level-ups and badges celebrate milestones | 4.8/5.0 satisfaction score |
| **Stay Motivated** | Streaks and bonuses encourage consistency | >70% return rate within 7 days |

### 1.3 Business Goals

| Goal | Impact | ROI |
|------|--------|-----|
| **Reduce Operational Costs** | Automation via gamification | R$50 → R$5 per onboarding (90% reduction) |
| **Prevent Fraud** | Rapid progression flags detect bots | >90% fraud reduction |
| **Improve Data Quality** | Points reward accuracy and completeness | >98% data accuracy |
| **Increase Conversion** | Engagement mechanics reduce abandonment | >95% completion rate |

### 1.4 Alignment Matrix

| Mechanic | Product Goal | User Goal | Business Goal |
|----------|-------------|-----------|---------------|
| **Points System** | Track progress | Feel accomplished | Measure quality |
| **Level Progression** | Incentivize completion | Unlock benefits | Improve retention |
| **Achievement Badges** | Celebrate milestones | Build mastery | Increase engagement |
| **Streak Tracking** | Encourage return visits | Build habits | Reduce abandonment |
| **Bonus Points** | Reward thoroughness | Autonomy in choices | Improve data quality |
| **Progress Visualization** | Reduce perceived time | Clear expectations | Lower support costs |

---

## 2. Point System

### 2.1 Core Actions with Point Values

| Action | Points | Rationale | Frequency |
|--------|--------|-----------|-----------|
| **Registration Complete** | 100 | Major milestone, account created | Once per user |
| **Profile - Basic Info** | 50 | Required fields completed | Once per user |
| **Profile - Optional Fields** | +25 | Encourages thoroughness | Once per user |
| **Health Question - Required** | 20 | Each required question answered | ~15 questions |
| **Health Question - Optional** | 20 | Same value = no pressure to skip | ~10 questions |
| **Document Upload** | 75 | Per document type (RG, CPF, etc.) | 3-5 documents |
| **Document Approved** | 150 | Quality validation passed | 3-5 approvals |
| **Interview Scheduled** | 200 | Commitment to next step | Once per user |
| **Interview Attended (On Time)** | 300 | Major milestone + punctuality | Once per user |
| **Onboarding Complete** | 500 | Celebration bonus | Once per user |

**Total Possible Points (Perfect Run)**: ~2,500-3,000 points

### 2.2 Behavioral Bonuses

| Bonus Type | Points | Trigger Condition | Cap |
|------------|--------|-------------------|-----|
| **Early Completion** | 100 | Complete onboarding in <10 minutes | Once per user |
| **Consistency** | 50 | Return on different day to continue (if abandoned) | Once per user |
| **Thoroughness** | 25 | Complete 100% of optional fields | Once per user |
| **Punctuality** | 75 | Join interview within 2 min of scheduled time | Once per user |
| **Zero Errors** | 50 | No validation errors on first submission | Once per form |
| **Document Quality** | 25 | All documents approved on first try | Once per user |

### 2.3 Point Mechanics

- **Transparency**: Points always visible in UI header, explained on earn
- **Real-Time Updates**: Points update immediately on action completion
- **Point History**: Users can view point log in profile (what/when/why)
- **No Decay**: Points are permanent achievements (no expiration)
- **No Deduction**: Points never removed (positive reinforcement only)

### 2.4 Point Display UX

```
┌─────────────────────────────────────┐
│  Seu Progresso                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  1,250 pontos  |  Nível: Prata      │
│                                     │
│  Próximo nível: Ouro (1,200 pts)   │
│  Faltam apenas 50 pontos! 🎯       │
│                                     │
│  [Ver histórico de pontos]          │
└─────────────────────────────────────┘
```

---

## 3. Level System

### 3.1 Level Tiers

| Level | Points Range | Visual Badge | Tangible Benefits | Value Proposition |
|-------|-------------|--------------|-------------------|-------------------|
| **Iniciante** | 0-299 | 🆕 Gray badge | None (starting point) | Welcome to the journey |
| **Bronze** | 300-699 | 🥉 Bronze badge | Priority support (24h response) | Get help faster |
| **Prata (Silver)** | 700-1,199 | 🥈 Silver badge | Express processing (<24h document review) | Save time |
| **Ouro (Gold)** | 1,200-1,999 | 🥇 Gold badge | Premium appointment slots (evening/weekend) | Convenience |
| **Platina (Platinum)** | 2,000+ | 💎 Platinum badge | VIP concierge service (dedicated support) | White-glove treatment |

### 3.2 Level Progression UX

**On Level-Up Trigger**:
1. **Visual Celebration**: Confetti animation (CSS-based, no external libs)
2. **Sound Effect**: Subtle chime (mutable, defaults to on)
3. **Modal Overlay**:
   ```
   ┌──────────────────────────────────────┐
   │  🎉 Parabéns! Você subiu de nível!   │
   │                                      │
   │  [Old Badge] → [New Badge Animation] │
   │                                      │
   │  Nível Bronze Desbloqueado!          │
   │                                      │
   │  Novos Benefícios:                   │
   │  ✓ Suporte prioritário (resposta     │
   │    em até 24 horas)                  │
   │                                      │
   │  [Continuar] [Ver Benefícios]        │
   └──────────────────────────────────────┘
   ```
4. **Notification**: Push notification (if permission granted)
5. **Email**: Congratulatory email with benefits summary

**Progress Bar to Next Level**:
```
Bronze  ━━━━━━━━━━━━━━━━━━━━━━━━ 75%  →  Prata
        350/700 pontos          Faltam 350 pts
```

### 3.3 Level Benefits Details

#### Bronze (300-699 pts)
- **Priority Support**: Tickets escalated to senior agents
- **Response Time**: 24h maximum (vs 48h standard)
- **Access**: Dedicated support channel in app

#### Prata (Silver, 700-1,199 pts)
- **Express Processing**: Documents reviewed within 24h
- **Notification**: Real-time updates on document status
- **Access**: Skip standard processing queue

#### Ouro (Gold, 1,200-1,999 pts)
- **Premium Appointments**: Evening (6-8pm) and weekend slots
- **Flexibility**: Reschedule up to 2 hours before appointment
- **Access**: Exclusive booking portal

#### Platina (Platinum, 2,000+ pts)
- **VIP Concierge**: Dedicated account manager (WhatsApp direct line)
- **Personalization**: Custom onboarding flow for dependents
- **Access**: Priority for new feature betas

### 3.4 Ethical Safeguards

- **No Gatekeeping**: Core onboarding functions work at all levels
- **Clear Value**: Benefits have tangible utility (time/convenience)
- **Achievable**: 80% of users reach Bronze, 50% reach Silver in normal flow
- **No Pay-to-Win**: Cannot purchase points or levels

---

## 4. Achievement System

### 4.1 Achievement Categories

#### 4.1.1 Onboarding Achievements

| Badge | Name | Unlock Criteria | Rarity | Points |
|-------|------|----------------|--------|--------|
| 🚀 | **Primeiros Passos** | Complete registration | Common | 100 |
| 📋 | **Perfil Completo** | Fill all profile fields (incl. optional) | Common | 75 |
| 💪 | **Campeão da Saúde** | Complete health assessment (100% questions) | Uncommon | 150 |
| 📄 | **Documentos Prontos** | Upload all required documents | Common | 100 |
| ✅ | **Tudo Aprovado** | All documents approved (first try) | Rare | 200 |
| 🎯 | **Missão Cumprida** | Complete entire onboarding | Common | 500 |

#### 4.1.2 Health & Thoroughness

| Badge | Name | Unlock Criteria | Rarity | Points |
|-------|------|----------------|--------|--------|
| 📖 | **Livro Aberto** | Answer all optional health questions | Uncommon | 100 |
| ⏱️ | **Madrugador** | Complete onboarding in <7 minutes | Rare | 150 |
| 🎓 | **Estudante Dedicado** | Read all health education tooltips | Uncommon | 75 |
| 🔍 | **Detalhista** | Zero validation errors on submissions | Rare | 100 |

#### 4.1.3 Consistency & Engagement

| Badge | Name | Unlock Criteria | Rarity | Points |
|-------|------|----------------|--------|--------|
| 🔥 | **Sequência de 3 Dias** | Active for 3 consecutive days | Common | 50 |
| 🔥🔥 | **Sequência de 7 Dias** | Active for 7 consecutive days | Uncommon | 150 |
| 🔥🔥🔥 | **Sequência de 30 Dias** | Active for 30 consecutive days | Legendary | 500 |
| 🔄 | **Segunda Chance** | Return after 24h to complete abandoned flow | Common | 50 |

#### 4.1.4 Social & Community

| Badge | Name | Unlock Criteria | Rarity | Points |
|-------|------|----------------|--------|--------|
| 🤝 | **Embaixador** | Refer 3 friends who complete onboarding | Uncommon | 200 |
| ⭐ | **Estrela do Feedback** | Submit detailed feedback (>100 chars) | Common | 50 |
| 🏆 | **Top Colaborador** | Feedback marked as "helpful" by 5+ users | Rare | 300 |

#### 4.1.5 Excellence & Mastery

| Badge | Name | Unlock Criteria | Rarity | Points |
|-------|------|----------------|--------|--------|
| 💯 | **Perfeição** | 100% completion rate (no skipped fields) | Rare | 250 |
| 🚀 | **Velocista** | Complete in <5 minutes with 100% accuracy | Legendary | 500 |
| 🎖️ | **Profissional de Documentos** | All docs approved within 1 hour | Rare | 300 |

### 4.2 Badge Design Specifications

#### Visual Identity
- **Style**: Flat design with subtle gradients
- **Colors**:
  - Common: Blue (#3498db)
  - Uncommon: Purple (#9b59b6)
  - Rare: Gold (#f39c12)
  - Legendary: Diamond gradient (#e74c3c → #3498db)
- **Size**: 64x64px PNG, SVG for scalability
- **Animation**: Subtle shine effect on hover

#### Unlock Notification
```
┌──────────────────────────────┐
│  🎊 Conquista Desbloqueada!  │
│                              │
│  [Badge Icon with shine]     │
│                              │
│  💪 Campeão da Saúde         │
│                              │
│  Você completou 100% das     │
│  questões de saúde!          │
│                              │
│  +150 pontos                 │
│                              │
│  [Compartilhar] [Fechar]     │
└──────────────────────────────┘
```

### 4.3 Achievement Display

#### Profile Showcase
- **Featured Badges**: Display 3 rarest badges prominently
- **Badge Collection**: Grid view of all unlocked badges
- **Progress Tracker**: Show locked badges with unlock criteria
- **Shareable**: Generate image for social media (opt-in)

#### Badge Showcase UI
```
┌──────────────────────────────────────┐
│  Suas Conquistas (12/25 desbloqueadas)│
│                                      │
│  [Featured Section]                  │
│  🚀 Velocista  💯 Perfeição  🎖️ Pro │
│                                      │
│  [All Badges Grid - 5 columns]       │
│  🚀 📋 💪 📄 ✅ 🎯 📖 ⏱️ 🎓 🔍      │
│  🔥 🔄 🤝 ⭐ ... [+11 locked]       │
│                                      │
│  [Ver Progresso] [Compartilhar]      │
└──────────────────────────────────────┘
```

---

## 5. Mechanics and Feedback Loops

### 5.1 Onboarding Streaks

#### Streak Definition
- **Active Day**: User completes at least one onboarding action
- **Consecutive**: Days counted even if actions span multiple sessions
- **Grace Period**: 24h grace period before streak resets

#### Streak Display
```
┌────────────────────────────┐
│  🔥 Sua Sequência          │
│                            │
│  3 dias consecutivos       │
│  Recorde pessoal: 7 dias   │
│                            │
│  Continue amanhã para      │
│  manter sua sequência! 💪  │
└────────────────────────────┘
```

#### Streak Reminders
- **Timing**: Sent at 6pm if user hasn't been active that day
- **Tone**: Encouraging, not guilt-tripping
- **Opt-Out**: User can disable streak reminders in settings

**Example Reminder**:
> "Olá! Você tem uma sequência de 5 dias. Continue seu progresso hoje para não perder! 🔥"

### 5.2 Progressive Disclosure

#### Information Unlocking Strategy
- **Registration**: Show only essential fields
- **After Registration**: Unlock health assessment section
- **After Health Questions**: Unlock document upload
- **After Documents**: Unlock interview scheduling

#### Feature Unlocking
- **Level 1 (Iniciante)**: Basic onboarding features
- **Level 2 (Bronze)**: Access to health education library
- **Level 3 (Prata)**: Access to appointment history
- **Level 4 (Ouro)**: Access to health goal tracking
- **Level 5 (Platina)**: Access to personalized health insights

### 5.3 Contextual Nudges

#### Helpful Tips at Decision Points

| Decision Point | Nudge Message | Data Supporting |
|----------------|---------------|-----------------|
| **Optional Health Questions** | "Usuários que respondem todas as questões conseguem consultas 50% mais rápidas 📊" | Based on appointment prioritization logic |
| **Document Upload** | "Envie documentos claros e legíveis - 90% são aprovados na primeira tentativa! ✅" | From document review analytics |
| **Interview Scheduling** | "Horários da manhã (9-11h) têm 95% menos cancelamentos 🌅" | From scheduling analytics |
| **Profile Completion** | "Perfis completos recebem 3x mais suporte personalizado 🎯" | From support ticket analysis |

#### Nudge Design Principles
- **Data-Driven**: Every nudge backed by real analytics
- **Helpful, Not Pushy**: Focus on benefits, not FOMO
- **Optional**: User can dismiss and won't see again
- **Accessible**: Screen reader compatible

### 5.4 Opt-In Challenges

#### Weekly Challenge Examples

| Challenge | Description | Bonus Points | Duration |
|-----------|-------------|--------------|----------|
| **Semana do Perfil Perfeito** | Complete all profile fields (including 5 optional) | +100 pts | 7 days |
| **Maratona de Documentos** | Upload all required documents in one session | +150 pts | 7 days |
| **Preparação para Entrevista** | Watch interview prep video and schedule | +75 pts | 7 days |

#### Challenge Mechanics
- **Opt-In**: User chooses to participate (banner notification)
- **Progress Tracking**: Real-time progress bar in dashboard
- **Celebration**: Confetti + badge on completion
- **No Penalty**: Declining or failing challenge has no negative effect

#### Challenge UI
```
┌──────────────────────────────────────┐
│  💪 Desafio da Semana                │
│                                      │
│  Maratona de Documentos              │
│  Envie todos os documentos em        │
│  uma única sessão                    │
│                                      │
│  Recompensa: +150 pontos 🎁          │
│                                      │
│  Progresso: ━━━━━━░░░░ 60%          │
│  3/5 documentos enviados             │
│                                      │
│  [Participar] [Agora Não]            │
└──────────────────────────────────────┘
```

### 5.5 Milestone Celebrations

#### Celebration Triggers
1. **Registration Complete**: Confetti + 100 pts notification
2. **First Level-Up**: Modal with benefits explanation
3. **First Badge**: Tutorial on badge system
4. **50% Onboarding Complete**: "Você está na metade! 🎉"
5. **Onboarding Complete**: Full-screen celebration + certificate

#### Celebration Elements
- **Visual**: CSS confetti animation (no external libs)
- **Audio**: Subtle chime (mutable, off by default)
- **Haptic**: Vibration on mobile (if supported)
- **Message**: Personalized congratulations
- **Share**: Option to share achievement (opt-in)

#### Full-Screen Celebration (Onboarding Complete)
```
╔══════════════════════════════════════╗
║                                      ║
║         🎉 PARABÉNS! 🎉             ║
║                                      ║
║  Você completou seu cadastro!        ║
║                                      ║
║  [Confetti Animation Background]     ║
║                                      ║
║  Total de pontos ganhos: 2,500       ║
║  Nível alcançado: Prata              ║
║  Conquistas desbloqueadas: 8         ║
║                                      ║
║  [Baixar Certificado] [Compartilhar] ║
║  [Ir para o Painel]                  ║
║                                      ║
╚══════════════════════════════════════╝
```

### 5.6 Progress Visualization

#### Progress Bar Components
1. **Percentage Complete**: Visual bar (0-100%)
2. **Steps Remaining**: "3 de 5 etapas completas"
3. **Estimated Time**: "~5 minutos restantes"
4. **Next Reward**: "Próxima recompensa: +200 pts (agendar entrevista)"

#### Progress Bar UI
```
┌──────────────────────────────────────┐
│  Progresso do Cadastro               │
│                                      │
│  ━━━━━━━━━━━━━━━━░░░░░░░ 75%        │
│                                      │
│  ✅ Registro                         │
│  ✅ Perfil                           │
│  ✅ Questionário de Saúde            │
│  🔄 Envio de Documentos (3/5)        │
│  ⏸️ Agendamento de Entrevista        │
│                                      │
│  Tempo estimado: 5 minutos           │
│                                      │
│  Próxima recompensa: +75 pts         │
│  (enviar próximo documento)          │
└──────────────────────────────────────┘
```

---

## 6. Ethical Constraints and Anti-Dark Patterns

### 6.1 No Addiction Mechanics

#### ❌ Prohibited Patterns
- **Infinite Scrolls**: All lists have pagination
- **Random Loot Boxes**: No randomized rewards
- **Time Pressure**: No "limited time offer" countdowns
- **Variable Intermittent Rewards**: All rewards are deterministic
- **Social Pressure**: No "X friends are ahead of you"
- **Loss Aversion Manipulation**: No "You'll lose X if you leave"

#### ✅ Allowed Patterns
- **Predictable Rewards**: Users know exactly what they'll earn
- **Gentle Reminders**: Non-manipulative notifications
- **Progress Tracking**: Clear visualization of completion
- **Celebration**: Positive reinforcement without pressure

### 6.2 No Manipulation

#### ❌ Prohibited Techniques
- **Guilt-Tripping**: "Disappointing" messages
- **Shame**: Public display of incomplete profiles
- **Fear**: "Others completed in X time, you're behind"
- **Comparison**: Forced leaderboards showing user rank
- **Peer Pressure**: "All your friends have done this"

#### ✅ Allowed Techniques
- **Encouragement**: "Great job! Keep going!"
- **Education**: "Here's why this matters for your health"
- **Celebration**: "You've achieved something meaningful"
- **Autonomy**: "Choose what works best for you"

### 6.3 No Exploitative Practices

#### ❌ Prohibited Practices
- **Pay-to-Win**: Cannot purchase points or levels
- **Hidden Costs**: No surprise charges for features
- **Misleading Rewards**: Benefits match descriptions exactly
- **Artificial Scarcity**: No fake "only 3 spots left!"
- **Bait-and-Switch**: Advertised benefits are always available

#### ✅ Allowed Practices
- **Earned Progression**: All advancement through effort
- **Transparent Benefits**: Clear explanation of what levels unlock
- **Genuine Value**: All benefits have real utility
- **Honest Communication**: No deceptive marketing

### 6.4 Transparency

#### Point Transparency
- **Always Visible**: Points shown in header of every page
- **Explained on Earn**: Modal explains why points were awarded
- **History Available**: Full point log in user profile
- **Clear Calculation**: "You earned 20 pts for answering this question"

#### Level Transparency
- **Benefits Upfront**: All level benefits visible at registration
- **Progress Clear**: Always show progress to next level
- **No Surprises**: No hidden requirements for level-up

#### Reward Transparency
- **What You See = What You Get**: No bait-and-switch
- **Delivery Timing**: "Document approved = instant points"
- **Terms Clear**: No fine print for rewards

### 6.5 User Control

#### Opt-Out Options
- **Notifications**: Granular control (points, badges, streaks, challenges)
- **Leaderboards**: Opt-in only (default: private profile)
- **Challenges**: User chooses to participate
- **Emails**: Unsubscribe from gamification emails
- **Data Deletion**: Delete all gamification data (keep core account)

#### Control Panel UI
```
┌──────────────────────────────────────┐
│  Configurações de Gamificação        │
│                                      │
│  Notificações:                       │
│  ☑️ Pontos ganhos                    │
│  ☑️ Novas conquistas                 │
│  ☐ Lembretes de sequência            │
│  ☑️ Novos desafios disponíveis       │
│                                      │
│  Privacidade:                        │
│  ☐ Mostrar meu perfil em rankings    │
│  ☑️ Permitir compartilhamento        │
│                                      │
│  Dados:                              │
│  [Exportar dados de gamificação]     │
│  [Excluir dados de gamificação]      │
│                                      │
│  [Salvar Alterações]                 │
└──────────────────────────────────────┘
```

### 6.6 Accessibility

#### Gamification Enhancement, Not Blocker
- **Core Functionality**: All onboarding works without gamification
- **Screen Reader**: All gamification elements have ARIA labels
- **Keyboard Navigation**: All modals/animations skippable
- **Reduced Motion**: Respect `prefers-reduced-motion` CSS
- **Color Blindness**: Badges use icons + text, not just color

#### Accessibility Checklist
- [ ] All badges have alt text
- [ ] Progress bars have aria-valuenow/max
- [ ] Animations can be disabled
- [ ] Color contrast ratio ≥4.5:1
- [ ] Focus indicators visible
- [ ] Screen reader announces point changes
- [ ] Keyboard shortcuts for common actions

### 6.7 Privacy

#### LGPD/HIPAA Compliance
- **No PII in Events**: User IDs hashed in analytics
- **No Health Data Display**: Leaderboards show generic metrics only
- **Pseudonymous Leaderboards**: Display name or "User #12345"
- **Opt-In Real Names**: User chooses to display real name
- **Data Minimization**: Only store necessary gamification data

#### Privacy Safeguards
- **Anonymized Analytics**: Events use hashed user IDs
- **No Cross-User Health Comparison**: Never show "User A answered more health questions than you"
- **Encrypted Storage**: All gamification data encrypted at rest
- **Access Logs**: Audit trail of who accessed gamification data
- **Consent Management**: User consents to gamification data processing

---

## 7. Instrumentation and Analytics

### 7.1 Events to Track

#### 7.1.1 Point Events

**Event**: `gamification.points_earned`

**Properties**:
```json
{
  "event": "gamification.points_earned",
  "user_id": "hash_abc123",
  "action_type": "document_upload",
  "points_amount": 75,
  "points_total_after": 825,
  "bonus_type": null,
  "timestamp": "2025-09-30T17:30:00Z",
  "session_id": "sess_xyz789"
}
```

**Validation Rules**:
- `user_id`: Required, string, 8-64 chars (hashed)
- `action_type`: Required, enum (see point system table)
- `points_amount`: Required, integer, 1-500
- `points_total_after`: Required, integer, 0-10000
- `bonus_type`: Optional, enum (early_completion, thoroughness, etc.)

#### 7.1.2 Level Events

**Event**: `gamification.level_up`

**Properties**:
```json
{
  "event": "gamification.level_up",
  "user_id": "hash_abc123",
  "old_level": "bronze",
  "new_level": "prata",
  "points_at_levelup": 700,
  "time_to_levelup_seconds": 450,
  "timestamp": "2025-09-30T17:35:00Z",
  "session_id": "sess_xyz789"
}
```

**Validation Rules**:
- `old_level`: Required, enum (iniciante, bronze, prata, ouro, platina)
- `new_level`: Required, enum (must be sequential)
- `time_to_levelup_seconds`: Required, integer, >0

#### 7.1.3 Badge Events

**Event**: `gamification.badge_unlocked`

**Properties**:
```json
{
  "event": "gamification.badge_unlocked",
  "user_id": "hash_abc123",
  "badge_id": "health_champion",
  "badge_name": "Campeão da Saúde",
  "badge_category": "health_thoroughness",
  "badge_rarity": "uncommon",
  "points_awarded": 150,
  "unlock_timestamp": "2025-09-30T17:28:00Z",
  "session_id": "sess_xyz789"
}
```

**Validation Rules**:
- `badge_id`: Required, string, snake_case
- `badge_category`: Required, enum (onboarding, health, consistency, social, excellence)
- `badge_rarity`: Required, enum (common, uncommon, rare, legendary)

#### 7.1.4 Streak Events

**Event**: `gamification.streak_updated`

**Properties**:
```json
{
  "event": "gamification.streak_updated",
  "user_id": "hash_abc123",
  "streak_days": 5,
  "longest_streak": 7,
  "streak_status": "active",
  "last_activity_date": "2025-09-30",
  "timestamp": "2025-09-30T17:40:00Z"
}
```

**Validation Rules**:
- `streak_days`: Required, integer, ≥0
- `streak_status`: Required, enum (active, broken, reset)

#### 7.1.5 Challenge Events

**Event**: `gamification.challenge_started`

**Properties**:
```json
{
  "event": "gamification.challenge_started",
  "user_id": "hash_abc123",
  "challenge_id": "document_marathon_week12",
  "challenge_name": "Maratona de Documentos",
  "challenge_duration_days": 7,
  "expected_completion_date": "2025-10-07",
  "timestamp": "2025-09-30T18:00:00Z"
}
```

**Event**: `gamification.challenge_completed`

**Properties**:
```json
{
  "event": "gamification.challenge_completed",
  "user_id": "hash_abc123",
  "challenge_id": "document_marathon_week12",
  "completion_time_seconds": 1200,
  "points_awarded": 150,
  "success": true,
  "timestamp": "2025-09-30T18:20:00Z"
}
```

#### 7.1.6 Engagement Events

**Event**: `gamification.dashboard_viewed`

**Properties**:
```json
{
  "event": "gamification.dashboard_viewed",
  "user_id": "hash_abc123",
  "current_level": "prata",
  "total_points": 825,
  "badges_unlocked": 5,
  "badges_total": 25,
  "timestamp": "2025-09-30T17:25:00Z"
}
```

### 7.2 KPIs and Success Metrics

#### 7.2.1 Engagement KPIs

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Daily Active Users (DAU)** | >85% | % users active daily during onboarding | <80% |
| **Session Duration** | 10-15 min | Median time in-app per session | <8 min or >20 min |
| **Return Rate (7-day)** | >70% | % users who return within 7 days | <65% |
| **Feature Adoption** | >60% | % users who interact with gamification | <50% |

#### 7.2.2 Completion KPIs

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Onboarding Completion** | >95% | % users completing all steps | <90% |
| **Average Completion Time** | <10 min | Median time from start to finish | >12 min |
| **Step Abandonment Rate** | <5% | % users abandoning per step | >10% |
| **Same-Session Completion** | >75% | % users completing in one session | <70% |

#### 7.2.3 Quality KPIs

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Data Accuracy** | >98% | % submissions with no validation errors | <95% |
| **Document Approval Rate** | >90% | % documents approved on first try | <85% |
| **Optional Field Completion** | >70% | % users completing optional fields | <60% |
| **Health Question Thoroughness** | >80% | % users answering all health questions | <70% |

#### 7.2.4 Satisfaction KPIs

| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Net Promoter Score (NPS)** | >50 | Post-onboarding survey | <40 |
| **User Satisfaction** | 4.8/5.0 | Post-onboarding rating | <4.5/5.0 |
| **Gamification Satisfaction** | 4.5/5.0 | "Did gamification enhance your experience?" | <4.0/5.0 |
| **Perceived Fairness** | >90% | "Rewards feel fair" survey question | <85% |

### 7.3 Guardrails and Alerts

#### 7.3.1 Automated Alerts

| Alert | Condition | Action | Escalation |
|-------|-----------|--------|------------|
| **Completion Drop** | Completion rate <90% for 24h | Notify product team | Escalate to CTO if persists 48h |
| **Time Spike** | Avg completion time >12 min | Analyze funnel bottlenecks | Escalate if >15 min |
| **Satisfaction Drop** | Rating <4.5/5.0 for 7 days | Review recent changes | Escalate if <4.0/5.0 |
| **Fraud Spike** | >5% users flagged for rapid progression | Enable manual review queue | Escalate to security team |

#### 7.3.2 Fraud Detection Guardrails

**Rapid Progression Flags**:
- **Trigger**: User earns >1,500 points in <3 minutes
- **Action**: Flag for manual review, delay level-up benefits
- **False Positive Mitigation**: Review 10 random "legitimate" fast users weekly

**Bot Detection**:
- **Trigger**: Mouse movement patterns match known bot signatures
- **Action**: Require CAPTCHA for next action
- **Storage**: Log pattern for ML model training

### 7.4 A/B Testing Framework

#### 7.4.1 Testing Methodology

**Minimum Requirements**:
- **Sample Size**: 1,000 users per variant (2,000 total)
- **Duration**: 2 weeks minimum
- **Statistical Significance**: p < 0.05
- **Control**: Always run 50/50 split (no multi-variant until validated)

#### 7.4.2 Feature Flag Structure

```json
{
  "feature_flag_id": "gamification_v2_points_doubled",
  "variants": {
    "control": {
      "enabled": true,
      "traffic_allocation": 0.5,
      "config": {
        "document_upload_points": 75
      }
    },
    "treatment": {
      "enabled": true,
      "traffic_allocation": 0.5,
      "config": {
        "document_upload_points": 150
      }
    }
  },
  "success_metrics": [
    "completion_rate",
    "document_upload_rate",
    "user_satisfaction"
  ],
  "guardrail_metrics": [
    "time_to_complete",
    "fraud_flags"
  ]
}
```

#### 7.4.3 Test Ideas Backlog

| Test Name | Hypothesis | Variants | Success Metric |
|-----------|-----------|----------|----------------|
| **Double Document Points** | Higher points → higher upload rate | 75 pts vs 150 pts | Document upload rate |
| **Early Celebration** | Celebrate at 50% → higher completion | None vs confetti at 50% | Completion rate |
| **Badge Showcase** | Prominent badge display → higher engagement | Small vs large badge icons | Feature adoption |
| **Challenge Opt-In** | Auto-enroll vs manual opt-in | Auto vs manual | Challenge participation |

---

## 8. Database Schema

### 8.1 Primary Table: `gamification_progress`

```sql
CREATE TABLE gamification_progress (
  -- Primary Key
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

  -- User Reference
  beneficiary_id BIGINT UNSIGNED NOT NULL,

  -- Point System
  total_points INT UNSIGNED DEFAULT 0 COMMENT 'Lifetime points earned',
  points_this_month INT UNSIGNED DEFAULT 0 COMMENT 'Points earned in current month',

  -- Level System
  current_level VARCHAR(20) DEFAULT 'iniciante' COMMENT 'iniciante|bronze|prata|ouro|platina',
  level_progress DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Progress to next level (0-100%)',
  level_up_count INT UNSIGNED DEFAULT 0 COMMENT 'Total level-ups achieved',

  -- Achievement System
  earned_badges JSON DEFAULT '[]' COMMENT 'Array of badge IDs: ["health_champion", "first_steps"]',
  achievement_timestamps JSON DEFAULT '{}' COMMENT 'Map of badge_id: ISO timestamp',
  badges_count INT UNSIGNED GENERATED ALWAYS AS (JSON_LENGTH(earned_badges)) STORED,

  -- Streak System
  streak_days INT UNSIGNED DEFAULT 0 COMMENT 'Current consecutive days active',
  longest_streak INT UNSIGNED DEFAULT 0 COMMENT 'Personal record',
  last_active_date DATE DEFAULT NULL COMMENT 'Date of last activity',
  streak_broken_count INT UNSIGNED DEFAULT 0 COMMENT 'Times streak was broken',

  -- Engagement Metrics
  sessions_count INT UNSIGNED DEFAULT 0 COMMENT 'Total sessions',
  total_time_seconds INT UNSIGNED DEFAULT 0 COMMENT 'Total time in-app',
  average_session_duration INT UNSIGNED GENERATED ALWAYS AS (
    CASE WHEN sessions_count > 0 THEN total_time_seconds / sessions_count ELSE 0 END
  ) STORED,
  actions_count INT UNSIGNED DEFAULT 0 COMMENT 'Total actions performed',

  -- Completion Tracking
  completion_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Overall onboarding completion %',
  completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When onboarding completed',

  -- Challenge System
  active_challenges JSON DEFAULT '[]' COMMENT 'Array of active challenge IDs',
  completed_challenges JSON DEFAULT '[]' COMMENT 'Array of completed challenge IDs',
  challenge_success_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Completion rate for challenges',

  -- Fraud Detection
  rapid_progression_flags JSON DEFAULT '[]' COMMENT 'Array of timestamps when flagged',
  fraud_score DECIMAL(5,2) DEFAULT 0.00 COMMENT '0-100 score, >80 = suspicious',
  manual_review_required BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_points_earned_at TIMESTAMP NULL DEFAULT NULL,

  -- Indexes
  INDEX idx_beneficiary (beneficiary_id),
  INDEX idx_level_points (current_level, total_points),
  INDEX idx_streak (streak_days DESC),
  INDEX idx_completion (completion_rate, completed_at),
  INDEX idx_fraud (fraud_score, manual_review_required),
  INDEX idx_active_date (last_active_date),

  -- Foreign Key
  CONSTRAINT fk_gamification_beneficiary
    FOREIGN KEY (beneficiary_id)
    REFERENCES beneficiaries(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Constraints
  CONSTRAINT chk_level_valid CHECK (
    current_level IN ('iniciante', 'bronze', 'prata', 'ouro', 'platina')
  ),
  CONSTRAINT chk_progress_range CHECK (
    level_progress BETWEEN 0.00 AND 100.00
  ),
  CONSTRAINT chk_completion_range CHECK (
    completion_rate BETWEEN 0.00 AND 100.00
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.2 Supporting Table: `gamification_point_history`

```sql
CREATE TABLE gamification_point_history (
  -- Primary Key
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

  -- User Reference
  beneficiary_id BIGINT UNSIGNED NOT NULL,

  -- Point Transaction
  action_type VARCHAR(50) NOT NULL COMMENT 'e.g., document_upload, interview_scheduled',
  points_earned INT NOT NULL COMMENT 'Can be negative for corrections',
  points_balance_after INT UNSIGNED NOT NULL,

  -- Context
  bonus_type VARCHAR(50) NULL COMMENT 'e.g., early_completion, thoroughness',
  related_entity_type VARCHAR(50) NULL COMMENT 'e.g., document, interview, badge',
  related_entity_id BIGINT UNSIGNED NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(64) NULL,

  -- Indexes
  INDEX idx_beneficiary_date (beneficiary_id, created_at DESC),
  INDEX idx_action_type (action_type),
  INDEX idx_related_entity (related_entity_type, related_entity_id),

  -- Foreign Key
  CONSTRAINT fk_point_history_beneficiary
    FOREIGN KEY (beneficiary_id)
    REFERENCES beneficiaries(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.3 Supporting Table: `gamification_badges`

```sql
CREATE TABLE gamification_badges (
  -- Primary Key
  id VARCHAR(50) PRIMARY KEY COMMENT 'Badge ID: health_champion, first_steps, etc.',

  -- Badge Info
  name VARCHAR(100) NOT NULL COMMENT 'Display name: Campeão da Saúde',
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL COMMENT 'onboarding|health|consistency|social|excellence',
  rarity VARCHAR(20) NOT NULL COMMENT 'common|uncommon|rare|legendary',

  -- Points
  points_awarded INT UNSIGNED NOT NULL,

  -- Unlock Criteria
  unlock_criteria JSON NOT NULL COMMENT 'Structured criteria for unlocking',
  unlock_sql_check TEXT NULL COMMENT 'Optional SQL query to check eligibility',

  -- Display
  icon_url VARCHAR(255) NOT NULL,
  color_hex VARCHAR(7) NOT NULL COMMENT '#3498db',

  -- Stats
  total_unlocks INT UNSIGNED DEFAULT 0 COMMENT 'Total times unlocked across all users',
  unlock_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '% of users who unlocked',

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_category_rarity (category, rarity),
  INDEX idx_active (is_active),

  -- Constraints
  CONSTRAINT chk_category_valid CHECK (
    category IN ('onboarding', 'health', 'consistency', 'social', 'excellence')
  ),
  CONSTRAINT chk_rarity_valid CHECK (
    rarity IN ('common', 'uncommon', 'rare', 'legendary')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.4 Supporting Table: `gamification_challenges`

```sql
CREATE TABLE gamification_challenges (
  -- Primary Key
  id VARCHAR(100) PRIMARY KEY,

  -- Challenge Info
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  challenge_type VARCHAR(50) NOT NULL COMMENT 'weekly|monthly|special',

  -- Duration
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INT UNSIGNED GENERATED ALWAYS AS (DATEDIFF(end_date, start_date)) STORED,

  -- Requirements
  requirements JSON NOT NULL COMMENT 'Structured requirements',
  bonus_points INT UNSIGNED NOT NULL,

  -- Stats
  participants_count INT UNSIGNED DEFAULT 0,
  completions_count INT UNSIGNED DEFAULT 0,
  completion_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN participants_count > 0
    THEN (completions_count * 100.0 / participants_count)
    ELSE 0 END
  ) STORED,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_active_dates (is_active, start_date, end_date),
  INDEX idx_type (challenge_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.5 Supporting Table: `gamification_user_challenges`

```sql
CREATE TABLE gamification_user_challenges (
  -- Primary Key
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

  -- References
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  challenge_id VARCHAR(100) NOT NULL,

  -- Progress
  status VARCHAR(20) DEFAULT 'active' COMMENT 'active|completed|abandoned',
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  progress_data JSON DEFAULT '{}' COMMENT 'Challenge-specific progress tracking',

  -- Timestamps
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  completion_time_seconds INT UNSIGNED NULL,

  -- Reward
  points_awarded INT UNSIGNED DEFAULT 0,

  -- Indexes
  INDEX idx_user_status (beneficiary_id, status),
  INDEX idx_challenge (challenge_id),

  -- Foreign Keys
  CONSTRAINT fk_user_challenge_beneficiary
    FOREIGN KEY (beneficiary_id)
    REFERENCES beneficiaries(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_challenge_challenge
    FOREIGN KEY (challenge_id)
    REFERENCES gamification_challenges(id)
    ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT chk_status_valid CHECK (
    status IN ('active', 'completed', 'abandoned')
  ),
  CONSTRAINT chk_progress_range CHECK (
    progress_percentage BETWEEN 0.00 AND 100.00
  ),

  -- Unique Constraint
  UNIQUE KEY uk_user_challenge (beneficiary_id, challenge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 9. Analytics Event Taxonomy

### 9.1 Event Schema Template

```json
{
  "schema_version": "1.0.0",
  "event_namespace": "gamification",
  "event_name": "points_earned",
  "required_properties": [
    "event",
    "user_id",
    "action_type",
    "points_amount",
    "points_total_after",
    "timestamp",
    "session_id"
  ],
  "optional_properties": [
    "bonus_type",
    "related_entity_type",
    "related_entity_id",
    "client_timestamp"
  ],
  "validation_rules": {
    "user_id": {
      "type": "string",
      "min_length": 8,
      "max_length": 64,
      "pattern": "^hash_[a-z0-9]+$",
      "description": "Hashed user ID for privacy"
    },
    "action_type": {
      "type": "enum",
      "values": [
        "registration_complete",
        "profile_basic_complete",
        "profile_optional_complete",
        "health_question_answered",
        "document_uploaded",
        "document_approved",
        "interview_scheduled",
        "interview_attended",
        "onboarding_complete"
      ]
    },
    "points_amount": {
      "type": "integer",
      "min": 1,
      "max": 500
    },
    "points_total_after": {
      "type": "integer",
      "min": 0,
      "max": 10000
    },
    "timestamp": {
      "type": "string",
      "format": "ISO8601",
      "example": "2025-09-30T17:30:00Z"
    }
  }
}
```

### 9.2 Example Event Payloads

#### Example 1: Points Earned (Document Upload)

```json
{
  "event": "gamification.points_earned",
  "schema_version": "1.0.0",
  "user_id": "hash_a1b2c3d4",
  "action_type": "document_uploaded",
  "points_amount": 75,
  "points_total_after": 825,
  "bonus_type": null,
  "related_entity_type": "document",
  "related_entity_id": 12345,
  "timestamp": "2025-09-30T17:30:00Z",
  "client_timestamp": "2025-09-30T17:29:58Z",
  "session_id": "sess_xyz789",
  "platform": "web",
  "user_agent": "Mozilla/5.0...",
  "context": {
    "document_type": "RG",
    "upload_method": "camera",
    "file_size_bytes": 2048576
  }
}
```

#### Example 2: Level Up

```json
{
  "event": "gamification.level_up",
  "schema_version": "1.0.0",
  "user_id": "hash_a1b2c3d4",
  "old_level": "bronze",
  "new_level": "prata",
  "points_at_levelup": 700,
  "time_to_levelup_seconds": 450,
  "timestamp": "2025-09-30T17:35:00Z",
  "session_id": "sess_xyz789",
  "platform": "web",
  "context": {
    "celebration_shown": true,
    "benefits_viewed": false
  }
}
```

#### Example 3: Badge Unlocked

```json
{
  "event": "gamification.badge_unlocked",
  "schema_version": "1.0.0",
  "user_id": "hash_a1b2c3d4",
  "badge_id": "health_champion",
  "badge_name": "Campeão da Saúde",
  "badge_category": "health_thoroughness",
  "badge_rarity": "uncommon",
  "points_awarded": 150,
  "unlock_timestamp": "2025-09-30T17:28:00Z",
  "session_id": "sess_xyz789",
  "platform": "web",
  "context": {
    "unlock_criteria_met": "answered_all_health_questions",
    "questions_answered": 25,
    "optional_questions_answered": 10
  }
}
```

#### Example 4: Challenge Completed

```json
{
  "event": "gamification.challenge_completed",
  "schema_version": "1.0.0",
  "user_id": "hash_a1b2c3d4",
  "challenge_id": "document_marathon_week12",
  "challenge_name": "Maratona de Documentos",
  "challenge_type": "weekly",
  "completion_time_seconds": 1200,
  "points_awarded": 150,
  "success": true,
  "timestamp": "2025-09-30T18:20:00Z",
  "session_id": "sess_xyz789",
  "context": {
    "documents_uploaded": 5,
    "single_session": true,
    "average_document_quality_score": 0.95
  }
}
```

### 9.3 Data Quality Validation

#### Client-Side Validation (JavaScript)

```javascript
function validateGamificationEvent(event) {
  const schema = GAMIFICATION_SCHEMAS[event.event];

  // Check required properties
  for (const prop of schema.required_properties) {
    if (!(prop in event)) {
      throw new Error(`Missing required property: ${prop}`);
    }
  }

  // Validate property types and ranges
  for (const [key, value] of Object.entries(event)) {
    const rule = schema.validation_rules[key];
    if (!rule) continue;

    if (rule.type === 'integer' && !Number.isInteger(value)) {
      throw new Error(`${key} must be an integer`);
    }

    if (rule.min !== undefined && value < rule.min) {
      throw new Error(`${key} must be >= ${rule.min}`);
    }

    if (rule.max !== undefined && value > rule.max) {
      throw new Error(`${key} must be <= ${rule.max}`);
    }

    if (rule.type === 'enum' && !rule.values.includes(value)) {
      throw new Error(`${key} must be one of: ${rule.values.join(', ')}`);
    }
  }

  return true;
}
```

#### Server-Side Validation (PHP)

```php
function validateGamificationEvent(array $event): bool {
    $schema = GAMIFICATION_SCHEMAS[$event['event']];

    // Check required properties
    foreach ($schema['required_properties'] as $prop) {
        if (!isset($event[$prop])) {
            throw new InvalidArgumentException("Missing required property: $prop");
        }
    }

    // Validate against rules
    foreach ($event as $key => $value) {
        if (!isset($schema['validation_rules'][$key])) continue;

        $rule = $schema['validation_rules'][$key];

        // Type validation
        if ($rule['type'] === 'integer' && !is_int($value)) {
            throw new InvalidArgumentException("$key must be an integer");
        }

        // Range validation
        if (isset($rule['min']) && $value < $rule['min']) {
            throw new InvalidArgumentException("$key must be >= {$rule['min']}");
        }

        if (isset($rule['max']) && $value > $rule['max']) {
            throw new InvalidArgumentException("$key must be <= {$rule['max']}");
        }

        // Enum validation
        if ($rule['type'] === 'enum' && !in_array($value, $rule['values'])) {
            throw new InvalidArgumentException("$key must be one of: " . implode(', ', $rule['values']));
        }
    }

    return true;
}
```

---

## 10. Implementation Roadmap

### 10.1 MVP (Weeks 1-2) - Core Foundation

#### Sprint 1 Goals
- **Goal**: Launch basic gamification system with points, levels, and core achievements
- **Success Criteria**: 90% of users see gamification elements, 80% earn at least one badge

#### Features
1. **Point System** (Week 1, Day 1-3)
   - Database schema for `gamification_progress` and `gamification_point_history`
   - Backend API endpoints: `POST /api/gamification/points/earn`, `GET /api/gamification/points/history`
   - Frontend: Point display in header, point history modal
   - Analytics: `gamification.points_earned` events

2. **Level Progression** (Week 1, Day 4-5)
   - Level calculation logic (based on total points)
   - Level-up detection and benefits assignment
   - Frontend: Level badge in profile, progress bar to next level
   - Analytics: `gamification.level_up` events

3. **Core Achievements** (Week 2, Day 1-3)
   - 8 core badges (see section 4.1.1 - Onboarding Achievements)
   - Badge unlock detection (cron job + real-time triggers)
   - Frontend: Badge showcase in profile, unlock notification modal
   - Analytics: `gamification.badge_unlocked` events

4. **Progress Visualization** (Week 2, Day 4-5)
   - Onboarding progress bar component
   - Step completion checklist
   - Estimated time remaining calculation
   - Next reward preview

#### Technical Tasks
- [ ] Migrate database schema (5 tables)
- [ ] Create `GamificationService` class (PHP)
- [ ] Create `GamificationController` (Laravel API)
- [ ] Create `useGamification` React hook (Frontend)
- [ ] Design and export badge SVG assets (8 badges)
- [ ] Implement confetti animation (CSS only)
- [ ] Set up analytics event tracking (Google Analytics + Mixpanel)
- [ ] Write unit tests (80% coverage)
- [ ] QA testing (10 test cases)

#### Rollout Plan
- **Week 1**: Deploy to staging, internal testing
- **Week 2 (Day 1-3)**: Deploy to 10% of production users (A/B test)
- **Week 2 (Day 4-5)**: Analyze metrics, roll out to 100% if KPIs met

---

### 10.2 V2 (Weeks 3-4) - Engagement Mechanics

#### Sprint 2 Goals
- **Goal**: Increase return rate to >70% with streaks and celebrations
- **Success Criteria**: 60% of users return next day, 40% establish 3-day streak

#### Features
1. **Streak Tracking** (Week 3, Day 1-2)
   - Daily streak calculation (cron job at midnight)
   - Grace period logic (24h)
   - Frontend: Streak widget in dashboard
   - Analytics: `gamification.streak_updated` events

2. **Badge Showcase** (Week 3, Day 3-4)
   - Featured badges section (top 3 rarest)
   - Badge collection grid (locked + unlocked)
   - Social sharing (generate shareable image)
   - Analytics: `gamification.badge_shared` events

3. **Milestone Celebrations** (Week 3, Day 5, Week 4, Day 1)
   - Full-screen celebration on onboarding complete
   - Downloadable completion certificate (PDF)
   - Email congratulations with benefits summary
   - Analytics: `gamification.milestone_celebrated` events

4. **Contextual Nudges** (Week 4, Day 2-3)
   - Data-driven tips at decision points (see section 5.3)
   - Dismissible nudge banners
   - A/B test nudge messaging
   - Analytics: `gamification.nudge_shown`, `gamification.nudge_clicked`

#### Technical Tasks
- [ ] Implement streak calculation cron job
- [ ] Create certificate PDF generator (Laravel DomPDF)
- [ ] Design celebration animations (Lottie files)
- [ ] Implement nudge banner component (React)
- [ ] Set up email templates (SendGrid)
- [ ] Write 15 additional unit tests
- [ ] QA testing (15 test cases)

#### Rollout Plan
- **Week 3 (Day 5)**: Deploy to staging
- **Week 4 (Day 1-2)**: Deploy to 25% of production (A/B test)
- **Week 4 (Day 3-4)**: Roll out to 100% if return rate increases

---

### 10.3 V3 (Weeks 5-6) - Social & Challenges

#### Sprint 3 Goals
- **Goal**: Increase engagement rate to >90% with opt-in challenges
- **Success Criteria**: 40% of users participate in at least one challenge

#### Features
1. **Opt-In Challenges** (Week 5, Day 1-3)
   - 3 weekly challenges (see section 5.4)
   - Challenge progress tracking
   - Challenge completion celebration
   - Analytics: `gamification.challenge_started`, `gamification.challenge_completed`

2. **Leaderboards (Conditional)** (Week 5, Day 4-5)
   - **Pre-Requisite**: User research validates demand (survey >60% interested)
   - Opt-in leaderboard (pseudonymous by default)
   - Weekly/monthly/all-time leaderboards
   - Analytics: `gamification.leaderboard_viewed`, `gamification.leaderboard_opt_in`

3. **Referral Program** (Week 6, Day 1-3)
   - Referral link generation
   - Track referrals (cookie + URL param)
   - Reward referee and referrer (100 pts each on completion)
   - Analytics: `gamification.referral_sent`, `gamification.referral_completed`

4. **Personalized Challenges** (Week 6, Day 4-5)
   - ML-based challenge recommendations (based on user behavior)
   - Custom challenge difficulty scaling
   - Analytics: `gamification.personalized_challenge_shown`

#### Technical Tasks
- [ ] Implement challenge system (database + API)
- [ ] Create leaderboard component (React)
- [ ] Implement referral tracking (cookies + database)
- [ ] Train ML model for challenge recommendations (Python + TensorFlow)
- [ ] Write 20 additional unit tests
- [ ] QA testing (20 test cases)

#### Rollout Plan
- **Week 5 (Day 5)**: Deploy to staging
- **Week 6 (Day 1-2)**: Deploy to 50% of production (A/B test)
- **Week 6 (Day 3-5)**: Roll out to 100% if engagement increases

---

### 10.4 Future Enhancements (Post-Launch)

#### Quarter 2 (Months 3-4)
1. **Team Challenges** (for company onboarding)
   - Companies compete to get all employees onboarded fastest
   - Team leaderboards, collective goals
   - **Use Case**: B2B customers

2. **Seasonal Events** (special badges for holidays)
   - Christmas challenge: "Complete onboarding and earn festive badge"
   - New Year challenge: "Start healthy habits in January"
   - **Use Case**: Re-engagement campaigns

#### Quarter 3 (Months 5-6)
3. **Advanced Analytics Dashboard** (for admins)
   - Real-time KPI monitoring
   - Cohort analysis (retention by gamification engagement)
   - Fraud detection dashboard

4. **Dynamic Point Values** (ML-based optimization)
   - Adjust point values based on user behavior
   - A/B test point inflation/deflation
   - **Goal**: Maximize completion rate while maintaining fairness

#### Quarter 4 (Months 7-9)
5. **Gamification API** (for partners)
   - White-label gamification for health plans
   - Webhook integrations
   - **Use Case**: B2B2C expansion

---

## Appendix A: Ethical Gamification Checklist

Before launching any gamification feature, verify:

- [ ] **No Addiction Mechanics**: No infinite scrolls, no random rewards, no time pressure
- [ ] **No Manipulation**: No guilt-tripping, no shame, no fear
- [ ] **No Exploitation**: No pay-to-win, no hidden costs, no bait-and-switch
- [ ] **Transparency**: All points/benefits clearly explained
- [ ] **User Control**: Opt-out of all notifications/leaderboards/challenges
- [ ] **Accessibility**: Works without gamification, screen reader compatible
- [ ] **Privacy**: No PII in events, pseudonymous leaderboards, LGPD compliant
- [ ] **Fairness**: Benefits have real utility, not just cosmetic
- [ ] **Testability**: All KPIs measurable, A/B testable
- [ ] **Reversibility**: Users can delete all gamification data

---

## Appendix B: Glossary

- **DAU**: Daily Active Users
- **NPS**: Net Promoter Score
- **KPI**: Key Performance Indicator
- **LGPD**: Lei Geral de Proteção de Dados (Brazilian GDPR)
- **HIPAA**: Health Insurance Portability and Accountability Act
- **Fraud Score**: 0-100 score indicating likelihood of bot/fraud
- **Rapid Progression**: Earning >1,500 points in <3 minutes
- **Grace Period**: 24h window before streak resets
- **Variable Rewards**: Unpredictable bonuses (ethical implementation: not random, but earned)

---

**End of Gamification System Specification v1.0.0**

---

**Approval Signatures**:
- Product Manager: ___________________ Date: ___________
- Engineering Lead: ___________________ Date: ___________
- UX Designer: ___________________ Date: ___________
- Legal/Compliance: ___________________ Date: ___________
