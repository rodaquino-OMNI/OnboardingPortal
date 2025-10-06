# Resumo dos Cálculos de Risco - Sistema de Saúde OmniPortal

## 📊 Mapeamento Completo dos Cálculos de Risco

### 1. Instrumentos Clínicos e Pontuação

| Instrumento | Faixa | Categorias de Risco | Pontos Atribuídos |
|-------------|-------|---------------------|-------------------|
| **PHQ-9** | 0-27 | Mínimo (0-4): 0 pts<br>Leve (5-9): 10 pts<br>Moderado (10-14): 20 pts<br>Moderadamente Severo (15-19): 25 pts<br>Severo (20-27): 30 pts | Mental Health |
| **GAD-7** | 0-21 | Mínimo (0-4): 0 pts<br>Leve (5-9): 10 pts<br>Moderado (10-14): 20 pts<br>Severo (15-21): 25 pts | Mental Health |
| **AUDIT-C** | 0-12 | Baixo (0-2): 0 pts<br>Leve (3-4): 10 pts<br>Moderado (5-7): 20 pts<br>Alto (8-12): 30 pts | Substance Abuse |
| **NIDA** | Qualitativo | Uso base: 25 pts<br>Drogas ilegais: +15 pts<br>Alto risco: +20 pts | Substance Abuse |

### 2. Riscos Críticos de Segurança

| Tipo de Risco | Condição | Pontos | Categoria | Ação Necessária |
|---------------|----------|---------|-----------|-----------------|
| **Suicídio** | PHQ-9 Q9 > 0 | 50 | Safety | EMERGÊNCIA |
| **Tentativa Recente** | Histórico | 60 | Safety | Intervenção Imediata |
| **Ideação Ativa c/ Plano** | Avaliação | 50 | Safety | Crise |
| **Ideação Ativa s/ Plano** | Avaliação | 35 | Safety | Urgente |
| **Ideação Passiva** | Avaliação | 20 | Safety | Prioritário |
| **Violência Doméstica** | Exposição Atual | 30 | Safety | Protocolo Segurança |
| **Alergia Fatal s/ EpiPen** | Anafilaxia | 60 | Allergy | Prescrição Urgente |
| **Alergia Fatal c/ EpiPen** | Anafilaxia | 40 | Allergy | Monitoramento |

### 3. Fatores de Risco Cardiovascular

Cada fator presente = 12 pontos:
- ✓ Hipertensão
- ✓ Diabetes
- ✓ Doença Cardíaca
- ✓ Tabagismo Atual
- ✓ IMC > 30
- ✓ Exercício < 3x/semana
- ✓ História Familiar
- ✓ Álcool Pesado (AUDIT ≥ 3)
- ✓ Idade > 65 anos

**Máximo possível**: 108 pontos (9 fatores × 12)

### 4. Cálculo do Score Total

```typescript
score.overall = 
  cardiovascular +     // 0-108
  mental_health +      // 0-55 (PHQ-9: 30 + GAD-7: 25)
  substance_abuse +    // 0-90 (AUDIT: 30 + NIDA: 60)
  chronic_disease +    // 0-25
  allergy_risk +       // 0-60
  safety_risk          // 0-60

// Score máximo teórico: ~398 pontos
```

## 🔍 Onde os Riscos São Calculados e Consumidos

### Fluxo Atual do Sistema

```mermaid
graph LR
    A[Frontend] -->|calculateRiskScore()| B[Cálculo Local]
    B -->|UnifiedHealthQuestionnaire| C[Resultados]
    C -->|handleComplete()| D[HealthAssessmentComplete]
    D -->|API Call| E[Backend]
    E -->|saveResponses()| F[health_questionnaires]
    F -->|risk_scores JSON| G[Banco de Dados]
    
    style A fill:#e1f5e1
    style B fill:#fff3cd
    style C fill:#fff3cd
    style D fill:#e1f5e1
    style E fill:#d1ecf1
    style F fill:#d1ecf1
    style G fill:#f8d7da
```

### Locais de Cálculo

1. **Frontend (Principal)**
   - `/lib/health-questionnaire-v2.ts`: `calculateRiskScore()`
   - `/lib/unified-health-flow.ts`: Configuração de pesos
   - `/components/health/UnifiedHealthQuestionnaire.tsx`: Aplicação

2. **Backend (Secundário)**
   - `HealthAIService`: Re-análise com IA
   - `ClinicalDecisionService`: Validação clínica

### Onde São Armazenados

```sql
-- Tabela: health_questionnaires
{
  "risk_scores": {
    "overall": 125,
    "categories": {
      "cardiovascular": 48,
      "mental_health": 35,
      "substance_abuse": 20,
      "chronic_disease": 15,
      "allergy_risk": 0,
      "safety_risk": 7
    },
    "flags": ["moderate_depression", "high_cardiovascular_risk"],
    "recommendations": [...]
  }
}
```

## ❌ Onde NÃO Estão Sendo Mostrados (Por Design)

### Interface do Usuário
- ✅ **Correto**: Scores numéricos não aparecem para o usuário
- ✅ **Correto**: Apenas feedback positivo e gamificação
- ✅ **Correto**: Foco em conquistas, não em riscos

### Locais Onde Deveriam Aparecer (Mas Não Aparecem)

1. **Dashboard Administrativo** ❌ Não existe
2. **Relatórios para Plano de Saúde** ❌ Não implementado
3. **Sistema de Alertas** ❌ Não configurado
4. **API de Integração** ❌ Sem endpoints
5. **Notificações para Profissionais** ❌ Não ativo

## 🎯 Estratégia de Uso Inteligente

### Fase 1: Visibilidade Imediata (Semana 1)
```typescript
// Novo endpoint administrativo
GET /api/admin/health-risks/critical
{
  "critical_patients": [
    {
      "id": "123",
      "risk_level": "critical",
      "primary_concern": "suicide_risk",
      "score": 180,
      "last_assessment": "2025-01-05",
      "assigned_professional": null,
      "intervention_status": "pending"
    }
  ]
}
```

### Fase 2: Alertas Automatizados (Semana 2)
```typescript
// Sistema de notificações
interface HealthAlert {
  trigger: RiskTrigger;
  recipients: string[]; // profissionais de saúde
  escalation: EscalationRule;
  actions: AutomatedAction[];
}

// Exemplo: Risco de suicídio
if (riskScores.flags.includes('suicide_risk')) {
  createAlert({
    type: 'CRITICAL_MENTAL_HEALTH',
    urgency: 'immediate',
    notify: ['psychiatrist', 'crisis_team', 'admin'],
    actions: ['schedule_emergency_eval', 'activate_protocol']
  });
}
```

### Fase 3: Dashboard Analytics (Semana 3-4)
```typescript
// Visualizações necessárias
1. Mapa de Calor de Riscos por Região
2. Tendências Temporais de Saúde Mental
3. Correlação entre Fatores de Risco
4. Eficácia de Intervenções
5. ROI de Prevenção
```

### Fase 4: Integração com Plano de Saúde (Semana 5-6)
```typescript
// API segura para parceiros
POST /api/v1/health-plan/risk-reports
{
  "report_type": "monthly_summary",
  "include": ["aggregated_risks", "intervention_outcomes"],
  "exclude": ["personal_identifiers"],
  "format": "encrypted_json"
}
```

## 📈 Métricas de Sucesso Propostas

| Métrica | Baseline | Meta 3M | Meta 6M | Meta 12M |
|---------|----------|---------|---------|----------|
| Detecção de Riscos Críticos | 0% | 80% | 90% | 95% |
| Tempo para Intervenção | N/A | < 24h | < 12h | < 6h |
| Redução de Internações | 0% | 5% | 10% | 20% |
| Satisfação Profissionais | N/A | 7/10 | 8/10 | 9/10 |
| ROI em Prevenção | 0:1 | 1.5:1 | 2:1 | 3:1 |

## 🚨 Ações Imediatas Necessárias

1. **Criar Job Cron para Processar Riscos**
   ```bash
   * * * * * php artisan health:process-risks
   ```

2. **Implementar Webhook para Alertas**
   ```php
   Route::post('/webhooks/critical-alerts', 'WebhookController@handleCriticalAlert');
   ```

3. **Dashboard Mínimo Viável**
   - Lista de pacientes críticos
   - Botão de acknowledgment
   - Campo de notas
   - Status de intervenção

4. **Documentação para Equipe de Saúde**
   - Como interpretar scores
   - Protocolos por tipo de risco
   - Fluxo de escalação
   - Responsabilidades

## 🔐 Considerações de Segurança

- **Encriptação**: Todos os scores em repouso e trânsito
- **Auditoria**: Log de todos os acessos aos dados
- **Anonimização**: Relatórios agregados sem PII
- **Consentimento**: Opt-in explícito para compartilhamento
- **Retenção**: Política clara de 2 anos + arquivo

---

**Conclusão**: O sistema já calcula riscos com precisão clínica, mas falta toda a infraestrutura para tornar esses dados acionáveis. A implementação proposta transformará dados passivos em inteligência ativa de saúde.