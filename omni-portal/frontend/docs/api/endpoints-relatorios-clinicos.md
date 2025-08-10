# API Endpoints - Sistema de Relatórios Clínicos
## Documentação Técnica v1.0

### 🔐 Autenticação e Autorização

Todos os endpoints requerem:
- **Bearer Token** via header `Authorization: Bearer {token}`
- **Role** adequada: `clinical_staff`, `admin`, ou `manager`
- **IP** dentro da rede autorizada (opcional)

```typescript
interface AuthUser {
  id: string;
  email: string;
  roles: ('clinical_staff' | 'admin' | 'manager')[];
  permissions: string[];
  lastLogin: string;
}
```

---

## 📊 API de Relatórios Administrativos

### 1. Listar Relatórios Disponíveis

**GET** `/api/admin/reports`

```typescript
interface ReportListParams {
  type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  status?: 'generating' | 'completed' | 'failed' | 'archived';
  period_start?: string; // YYYY-MM-DD
  period_end?: string;   // YYYY-MM-DD
  page?: number;
  per_page?: number; // max 100
  sort?: 'created_at' | 'period_start' | 'title';
  order?: 'asc' | 'desc';
}

interface ReportListResponse {
  data: {
    reports: AdminReport[];
    summary: {
      total: number;
      by_status: Record<string, number>;
      by_type: Record<string, number>;
    };
    pagination: PaginationMeta;
  };
  meta: {
    generated_at: string;
    cache_expires_at: string;
  };
}

interface AdminReport {
  id: string;
  type: ReportType;
  title: string;
  description?: string;
  
  period: {
    start: string;
    end: string;
    days_covered: number;
  };
  
  status: 'generating' | 'completed' | 'failed' | 'archived';
  
  metrics: {
    total_assessments: number;
    total_users: number;
    high_risk_count: number;
    critical_risk_count: number;
    alerts_generated: number;
    avg_response_time_minutes?: number;
  };
  
  file?: {
    path: string;
    format: 'pdf' | 'xlsx' | 'json' | 'csv';
    size_bytes: number;
    hash: string;
  };
  
  access: {
    download_count: number;
    last_downloaded_at?: string;
    expires_at?: string;
  };
  
  generated_by: {
    id: string;
    name: string;
  };
  
  timestamps: {
    created_at: string;
    generation_started_at?: string;
    generation_completed_at?: string;
    generation_duration_seconds?: number;
  };
}
```

### 2. Gerar Novo Relatório

**POST** `/api/admin/reports/generate`

```typescript
interface GenerateReportRequest {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  title?: string; // Auto-gerado se não fornecido
  description?: string;
  
  period: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  
  metrics: {
    include: (
      'depression' | 'anxiety' | 'substance_use' | 
      'cardiovascular' | 'safety' | 'demographics' |
      'trends' | 'alerts' | 'comparative_analysis'
    )[];
    exclude_populations?: string[]; // Critérios de exclusão
    demographic_breakdown?: boolean;
    trend_analysis?: boolean;
    comparative_period?: { start: string; end: string; }; // Para comparação
  };
  
  format: 'pdf' | 'xlsx' | 'json' | 'csv';
  
  delivery?: {
    email_recipients?: string[];
    auto_schedule?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      day_of_week?: number; // 1-7 para weekly
      day_of_month?: number; // 1-31 para monthly
    };
  };
  
  access: {
    expires_days?: number; // Default: 90 dias
    allowed_roles?: string[];
  };
}

interface GenerateReportResponse {
  data: {
    report_id: string;
    status: 'queued' | 'generating';
    estimated_completion_minutes: number;
    queue_position?: number;
  };
  meta: {
    request_id: string;
    queued_at: string;
  };
}
```

### 3. Status de Geração

**GET** `/api/admin/reports/{id}/status`

```typescript
interface ReportStatusResponse {
  data: {
    id: string;
    status: 'queued' | 'generating' | 'completed' | 'failed';
    progress_percentage: number; // 0-100
    
    queue_info?: {
      position: number;
      estimated_wait_minutes: number;
    };
    
    generation_info?: {
      started_at: string;
      current_step: string;
      steps_completed: number;
      total_steps: number;
      estimated_completion: string;
    };
    
    completion_info?: {
      completed_at: string;
      file_ready: boolean;
      download_url?: string;
      file_size_bytes?: number;
    };
    
    error_info?: {
      error_code: string;
      error_message: string;
      retry_possible: boolean;
      failed_at: string;
    };
  };
}
```

### 4. Download de Relatório

**GET** `/api/admin/reports/{id}/download`

```typescript
// Headers de resposta:
Content-Type: application/pdf | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | application/json | text/csv
Content-Disposition: attachment; filename="clinical-report-{id}-{date}.{ext}"
Content-Length: {file_size}
X-File-Hash: {sha256_hash}
X-Generated-At: {iso_timestamp}
X-Expires-At: {iso_timestamp}

// Auditoria automática registrada:
interface DownloadAudit {
  user_id: string;
  report_id: string;
  downloaded_at: string;
  file_hash_verified: boolean;
  ip_address: string;
}
```

### 5. Métricas Resumidas

**GET** `/api/admin/reports/metrics/summary`

```typescript
interface MetricsSummaryParams {
  period_start: string;
  period_end: string;
  granularity?: 'day' | 'week' | 'month'; // Default: day
}

interface MetricsSummaryResponse {
  data: {
    period: { start: string; end: string; };
    
    overview: {
      total_assessments: number;
      unique_users: number;
      assessment_completion_rate: number; // %
      data_quality_score: number; // 0-1
    };
    
    risk_distribution: {
      minimal: { count: number; percentage: number; };
      low: { count: number; percentage: number; };
      medium: { count: number; percentage: number; };
      high: { count: number; percentage: number; };
      severe: { count: number; percentage: number; };
      critical: { count: number; percentage: number; };
    };
    
    category_averages: {
      depression: { avg_score: number; risk_level: string; };
      anxiety: { avg_score: number; risk_level: string; };
      alcohol: { avg_score: number; risk_level: string; };
      drugs: { avg_score: number; risk_level: string; };
      cardiovascular: { avg_score: number; risk_level: string; };
      safety: { avg_score: number; risk_level: string; };
    };
    
    demographics: {
      age_groups: Record<string, number>;
      gender_distribution: Record<string, number>;
      geographic_distribution?: Record<string, number>;
    };
    
    trends: {
      category: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      change_percentage: number;
      data_points: { date: string; value: number; }[];
    }[];
    
    alerts: {
      total_generated: number;
      by_priority: Record<string, number>;
      by_category: Record<string, number>;
      avg_response_time_minutes: number;
      resolution_rate_percentage: number;
    };
  };
  
  meta: {
    generated_at: string;
    cache_key: string;
    cache_expires_at: string;
    data_freshness_minutes: number;
  };
}
```

---

## 🚨 API de Alertas Clínicos

### 1. Listar Alertas Ativos

**GET** `/api/clinical/alerts`

```typescript
interface AlertsListParams {
  status?: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  category?: 'mental_health' | 'substance_use' | 'cardiovascular' | 'safety' | 'combined';
  assigned_to?: string; // User ID
  created_since?: string; // ISO timestamp
  due_before?: string; // ISO timestamp
  page?: number;
  per_page?: number;
  sort?: 'created_at' | 'priority' | 'due_date' | 'response_time';
  order?: 'asc' | 'desc';
}

interface AlertsListResponse {
  data: {
    alerts: ClinicalAlert[];
    summary: {
      total: number;
      by_status: Record<string, number>;
      by_priority: Record<string, number>;
      by_category: Record<string, number>;
      overdue_count: number;
      avg_response_time_minutes: number;
    };
    pagination: PaginationMeta;
  };
}

interface ClinicalAlert {
  id: string;
  
  classification: {
    type: 'risk_threshold' | 'trend_analysis' | 'population_alert' | 'combination_risk';
    priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
    category: 'mental_health' | 'substance_use' | 'cardiovascular' | 'safety';
    escalation_level: number; // 1-5
  };
  
  content: {
    title: string;
    description: string;
    risk_factors: string[];
    recommended_actions: {
      immediate: string[];
      short_term: string[];
      long_term: string[];
    };
  };
  
  patient_context: {
    // Dados anonimizados/pseudonimizados
    patient_id: string; // Hash ou ID interno
    age_group: '18-25' | '26-35' | '36-45' | '46-55' | '56-65' | '65+';
    risk_profile: {
      depression_level: string;
      anxiety_level: string;
      substance_risk: string;
      cardiovascular_risk: string;
      safety_risk: string;
      composite_score: number;
    };
    previous_alerts: number;
    last_assessment_date: string;
  };
  
  triggered_by: {
    assessment_id: string;
    trigger_conditions: Record<string, any>;
    threshold_exceeded: {
      metric: string;
      value: number;
      threshold: number;
    }[];
  };
  
  workflow: {
    status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
    assigned_to?: {
      id: string;
      name: string;
      role: string;
    };
    team_assignment?: string;
    
    timeline: {
      created_at: string;
      acknowledged_at?: string;
      started_at?: string;
      resolved_at?: string;
    };
    
    performance: {
      response_time_minutes?: number;
      resolution_time_minutes?: number;
      sla_status: 'within_sla' | 'approaching_due' | 'overdue';
      due_date?: string;
    };
  };
  
  resolution?: {
    outcome: string;
    actions_taken: string[];
    notes: string;
    follow_up_required: boolean;
    follow_up_date?: string;
    resolved_by: {
      id: string;
      name: string;
    };
  };
}
```

### 2. Detalhes de Alerta Específico

**GET** `/api/clinical/alerts/{id}`

```typescript
interface AlertDetailResponse {
  data: {
    alert: ClinicalAlert;
    
    // Dados adicionais para visualização detalhada
    detailed_analysis: {
      score_breakdown: {
        category: string;
        current_score: number;
        previous_score?: number;
        trend: 'improving' | 'stable' | 'worsening';
        change_percentage?: number;
      }[];
      
      risk_factors_analysis: {
        factor: string;
        weight: number; // 0-1
        contribution: string;
        intervention_suggested: string;
      }[];
      
      historical_context: {
        similar_cases: number;
        typical_resolution_time: number;
        success_rate_percentage: number;
        common_interventions: string[];
      };
    };
    
    related_alerts: {
      id: string;
      title: string;
      status: string;
      created_at: string;
    }[];
    
    activity_log: {
      timestamp: string;
      action: string;
      user: { id: string; name: string; };
      details: string;
    }[];
  };
}
```

### 3. Reconhecer Alerta

**PUT** `/api/clinical/alerts/{id}/acknowledge`

```typescript
interface AcknowledgeAlertRequest {
  assigned_to?: string; // User ID para atribuição
  team_assignment?: string;
  priority_adjustment?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  estimated_resolution_hours?: number;
  action_plan?: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
}

interface AcknowledgeAlertResponse {
  data: {
    alert_id: string;
    acknowledged_at: string;
    acknowledged_by: {
      id: string;
      name: string;
    };
    updated_status: string;
    estimated_due_date?: string;
  };
}
```

### 4. Atualizar Status de Alerta

**PUT** `/api/clinical/alerts/{id}/status`

```typescript
interface UpdateAlertStatusRequest {
  status: 'in_progress' | 'resolved' | 'dismissed' | 'escalated';
  
  notes: string; // Obrigatório
  
  // Para status 'resolved'
  resolution?: {
    outcome_category: string;
    actions_taken: string[];
    effectiveness_rating: 1 | 2 | 3 | 4 | 5;
    follow_up_required: boolean;
    follow_up_date?: string; // Se follow_up_required = true
    recommendations: string[];
  };
  
  // Para status 'escalated'
  escalation?: {
    reason: string;
    escalated_to: string; // User ID ou team
    escalation_level: number; // 2-5
    additional_context: string;
  };
  
  // Para status 'dismissed'
  dismissal?: {
    reason: string;
    category: 'false_positive' | 'resolved_externally' | 'patient_declined' | 'other';
    additional_notes: string;
  };
}

interface UpdateAlertStatusResponse {
  data: {
    alert_id: string;
    previous_status: string;
    new_status: string;
    updated_at: string;
    updated_by: {
      id: string;
      name: string;
    };
    
    performance_metrics?: {
      response_time_minutes: number;
      resolution_time_minutes?: number;
      sla_compliance: boolean;
    };
    
    next_actions?: string[];
  };
}
```

### 5. Dashboard de Alertas

**GET** `/api/clinical/alerts/dashboard`

```typescript
interface AlertsDashboardResponse {
  data: {
    summary: {
      total_active: number;
      pending_count: number;
      overdue_count: number;
      critical_count: number;
      
      my_assignments: number; // Alertas atribuídos ao usuário atual
      team_assignments: number;
      
      avg_response_time_minutes: number;
      avg_resolution_time_minutes: number;
      resolution_rate_24h: number; // %
    };
    
    by_priority: {
      emergency: { count: number; overdue: number; };
      urgent: { count: number; overdue: number; };
      high: { count: number; overdue: number; };
      medium: { count: number; overdue: number; };
      low: { count: number; overdue: number; };
    };
    
    by_category: {
      mental_health: { active: number; resolved_today: number; };
      substance_use: { active: number; resolved_today: number; };
      cardiovascular: { active: number; resolved_today: number; };
      safety: { active: number; resolved_today: number; };
    };
    
    trending: {
      category: string;
      current_week: number;
      previous_week: number;
      change_percentage: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    }[];
    
    recent_critical: ClinicalAlert[]; // Últimos 5 alertas críticos
    
    performance_metrics: {
      sla_compliance_percentage: number;
      team_performance: {
        user_id: string;
        name: string;
        active_assignments: number;
        avg_resolution_time: number;
        resolution_rate: number;
      }[];
    };
    
    workload_distribution: {
      user_id: string;
      name: string;
      pending: number;
      in_progress: number;
      capacity_percentage: number; // Baseado em configuração de capacidade
    }[];
  };
  
  meta: {
    updated_at: string;
    refresh_interval_seconds: number;
  };
}
```

---

## 📈 API de Analytics Populacional

### 1. Visão Geral Populacional

**GET** `/api/admin/analytics/population`

```typescript
interface PopulationAnalyticsParams {
  period_start: string;
  period_end: string;
  granularity?: 'day' | 'week' | 'month';
  include_demographics?: boolean;
  include_trends?: boolean;
  segment_by?: 'age_group' | 'gender' | 'risk_level' | 'geographic';
}

interface PopulationAnalyticsResponse {
  data: {
    period: { start: string; end: string; };
    
    overview: {
      total_population: number;
      active_users: number; // Usuários com assessment no período
      new_users: number;
      retention_rate: number; // %
      assessment_frequency: number; // Média de assessments por usuário
    };
    
    demographics: {
      age_distribution: {
        '18-25': number;
        '26-35': number;
        '36-45': number;
        '46-55': number;
        '56-65': number;
        '65+': number;
      };
      
      gender_distribution: {
        male: number;
        female: number;
        other: number;
        not_specified: number;
      };
      
      geographic_distribution?: Record<string, number>;
    };
    
    risk_analysis: {
      overall_distribution: {
        minimal: { count: number; percentage: number; };
        low: { count: number; percentage: number; };
        medium: { count: number; percentage: number; };
        high: { count: number; percentage: number; };
        severe: { count: number; percentage: number; };
        critical: { count: number; percentage: number; };
      };
      
      by_category: {
        depression: RiskCategoryAnalysis;
        anxiety: RiskCategoryAnalysis;
        alcohol: RiskCategoryAnalysis;
        drugs: RiskCategoryAnalysis;
        cardiovascular: RiskCategoryAnalysis;
        safety: RiskCategoryAnalysis;
      };
      
      correlations: {
        strong_correlations: {
          category_1: string;
          category_2: string;
          correlation_coefficient: number; // -1 to 1
          significance: 'low' | 'medium' | 'high';
        }[];
        
        risk_combinations: {
          combination: string[];
          frequency: number;
          average_composite_score: number;
          typical_interventions: string[];
        }[];
      };
    };
    
    trends: {
      category: string;
      time_series: {
        date: string;
        average_score: number;
        high_risk_count: number;
        assessment_count: number;
      }[];
      
      trend_analysis: {
        direction: 'improving' | 'stable' | 'worsening';
        change_rate: number; // % por período
        significance: 'low' | 'medium' | 'high';
        predicted_next_period?: number;
      };
    }[];
    
    interventions_effectiveness: {
      category: string;
      interventions: {
        type: string;
        cases_count: number;
        success_rate_percentage: number;
        average_improvement_score: number;
        time_to_improvement_days: number;
      }[];
    }[];
  };
}

interface RiskCategoryAnalysis {
  average_score: number;
  median_score: number;
  standard_deviation: number;
  distribution: Record<string, number>;
  high_risk_percentage: number;
  trend_direction: 'improving' | 'stable' | 'worsening';
  seasonal_patterns?: {
    month: number;
    average_score: number;
    pattern_strength: 'weak' | 'moderate' | 'strong';
  }[];
}
```

### 2. Análise de Tendências

**GET** `/api/admin/analytics/trends`

```typescript
interface TrendAnalysisParams {
  categories: ('depression' | 'anxiety' | 'alcohol' | 'drugs' | 'cardiovascular' | 'safety')[];
  period_start: string;
  period_end: string;
  granularity: 'day' | 'week' | 'month';
  comparison_period?: { start: string; end: string; };
  demographic_filters?: {
    age_groups?: string[];
    genders?: string[];
    geographic_regions?: string[];
  };
}

interface TrendAnalysisResponse {
  data: {
    categories: {
      name: string;
      
      trend_summary: {
        direction: 'improving' | 'stable' | 'worsening';
        magnitude: 'slight' | 'moderate' | 'significant';
        confidence_level: number; // 0-1
        change_percentage: number;
      };
      
      time_series: {
        date: string;
        metrics: {
          average_score: number;
          median_score: number;
          high_risk_count: number;
          assessment_count: number;
          quality_score: number; // Qualidade dos dados
        };
      }[];
      
      seasonal_analysis?: {
        has_seasonal_pattern: boolean;
        peak_months: number[];
        low_months: number[];
        seasonal_strength: number; // 0-1
      };
      
      anomalies: {
        date: string;
        type: 'spike' | 'drop' | 'unusual_pattern';
        severity: 'minor' | 'moderate' | 'major';
        description: string;
        potential_causes: string[];
      }[];
      
      forecasting: {
        next_30_days: {
          date: string;
          predicted_average: number;
          confidence_interval: {
            lower: number;
            upper: number;
          };
        }[];
        
        accuracy_metrics: {
          historical_accuracy: number; // % de previsões corretas
          mean_absolute_error: number;
          model_confidence: number;
        };
      };
    }[];
    
    cross_category_analysis: {
      correlation_matrix: Record<string, Record<string, number>>;
      
      leading_indicators: {
        leading_category: string;
        following_category: string;
        lag_days: number;
        correlation_strength: number;
        predictive_value: 'low' | 'medium' | 'high';
      }[];
    };
    
    population_segments: {
      segment_name: string;
      segment_criteria: Record<string, any>;
      population_size: number;
      
      risk_profile: {
        category: string;
        average_score: number;
        trend_direction: string;
        alert_frequency: number;
      }[];
      
      recommended_interventions: {
        intervention: string;
        priority: 'low' | 'medium' | 'high';
        expected_impact: string;
        implementation_complexity: 'low' | 'medium' | 'high';
      }[];
    }[];
  };
}
```

---

## ⚙️ API de Configurações

### 1. Configurações de Alertas

**GET** `/api/admin/config/alert-thresholds`

```typescript
interface AlertThresholdsResponse {
  data: {
    configurations: {
      id: string;
      name: string;
      category: 'mental_health' | 'substance_use' | 'cardiovascular' | 'safety';
      description: string;
      is_active: boolean;
      
      thresholds: {
        minimal?: number;
        low: number;
        medium: number;
        high: number;
        severe?: number;
        critical?: number;
      };
      
      activation_conditions: {
        metric: string;
        trend_analysis: boolean;
        combination_factors?: string[];
        demographic_adjustments?: Record<string, number>;
        time_window_hours?: number;
      };
      
      notification_settings: {
        immediate_notification: boolean;
        escalation_minutes: number;
        notification_channels: ('email' | 'sms' | 'dashboard' | 'webhook')[];
        recipient_roles: string[];
      };
      
      last_modified: {
        at: string;
        by: { id: string; name: string; };
      };
    }[];
    
    global_settings: {
      alert_processing_enabled: boolean;
      batch_processing_interval_minutes: number;
      max_alerts_per_user_per_day: number;
      alert_retention_days: number;
      auto_dismiss_resolved_after_hours: number;
    };
  };
}
```

**PUT** `/api/admin/config/alert-thresholds/{id}`

```typescript
interface UpdateThresholdRequest {
  thresholds?: Record<string, number>;
  activation_conditions?: Record<string, any>;
  notification_settings?: Record<string, any>;
  is_active?: boolean;
  
  // Auditoria obrigatória
  change_reason: string;
  effective_date?: string; // Default: imediato
}

interface UpdateThresholdResponse {
  data: {
    configuration_id: string;
    updated_fields: string[];
    previous_values: Record<string, any>;
    new_values: Record<string, any>;
    effective_at: string;
    updated_by: {
      id: string;
      name: string;
    };
  };
}
```

### 2. Configurações de Sistema

**GET** `/api/admin/config/system`

```typescript
interface SystemConfigResponse {
  data: {
    processing: {
      risk_calculation_enabled: boolean;
      batch_processing_interval_minutes: number;
      max_concurrent_jobs: number;
      job_timeout_minutes: number;
      retry_failed_jobs: boolean;
      max_job_retries: number;
    };
    
    reports: {
      auto_generation_enabled: boolean;
      max_concurrent_reports: number;
      report_retention_days: number;
      auto_archive_after_days: number;
      allowed_formats: string[];
      max_file_size_mb: number;
    };
    
    security: {
      session_timeout_minutes: number;
      max_failed_login_attempts: number;
      password_expiry_days: number;
      require_mfa: boolean;
      allowed_ip_ranges: string[];
      audit_retention_years: number;
    };
    
    data_retention: {
      raw_assessments_years: number;
      processed_data_years: number;
      audit_logs_years: number;
      reports_months: number;
      anonymization_after_years: number;
    };
    
    notifications: {
      email_enabled: boolean;
      sms_enabled: boolean;
      webhook_enabled: boolean;
      rate_limits: {
        emails_per_hour: number;
        sms_per_day: number;
        webhooks_per_minute: number;
      };
    };
  };
}
```

---

## 🔍 API de Auditoria e Logs

### 1. Logs de Auditoria

**GET** `/api/admin/audit/logs`

```typescript
interface AuditLogsParams {
  user_id?: string;
  action?: string;
  resource?: string;
  category?: 'authentication' | 'data_access' | 'data_modification' | 'report_generation' | 'alert_management';
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  date_from?: string;
  date_to?: string;
  ip_address?: string;
  success?: boolean;
  page?: number;
  per_page?: number;
}

interface AuditLogsResponse {
  data: {
    logs: {
      id: string;
      timestamp: string;
      
      user: {
        id: string;
        email: string;
        name?: string;
      } | null;
      
      action: string;
      resource: string;
      resource_id?: string;
      
      request: {
        method: string;
        url: string;
        ip_address: string;
        user_agent: string;
      };
      
      context: {
        category: string;
        severity: string;
        success: boolean;
        error_message?: string;
        processing_time_ms: number;
      };
      
      data_changes?: {
        before: Record<string, any>;
        after: Record<string, any>;
        fields_changed: string[];
      };
      
      metadata: Record<string, any>;
    }[];
    
    summary: {
      total_entries: number;
      success_rate: number;
      most_common_actions: { action: string; count: number; }[];
      security_events: number;
      data_modifications: number;
    };
    
    pagination: PaginationMeta;
  };
}
```

### 2. Relatório de Compliance

**GET** `/api/admin/audit/compliance-report`

```typescript
interface ComplianceReportParams {
  period_start: string;
  period_end: string;
  include_details?: boolean;
}

interface ComplianceReportResponse {
  data: {
    period: { start: string; end: string; };
    
    data_protection: {
      gdpr_compliance: {
        data_requests_received: number;
        data_requests_fulfilled: number;
        fulfillment_rate: number;
        average_response_time_days: number;
        
        requests_by_type: {
          access: number;
          rectification: number;
          erasure: number;
          portability: number;
          restriction: number;
        };
      };
      
      data_retention: {
        policies_compliant: boolean;
        records_due_for_deletion: number;
        automated_deletion_executed: number;
        manual_review_required: number;
      };
      
      encryption_status: {
        data_at_rest_encrypted: boolean;
        data_in_transit_encrypted: boolean;
        key_rotation_current: boolean;
        last_security_audit: string;
      };
    };
    
    access_control: {
      authentication_events: {
        successful_logins: number;
        failed_login_attempts: number;
        mfa_usage_rate: number;
        password_policy_violations: number;
      };
      
      authorization_events: {
        access_granted: number;
        access_denied: number;
        privilege_escalations: number;
        unauthorized_attempts: number;
      };
      
      session_management: {
        average_session_duration_minutes: number;
        sessions_timed_out: number;
        concurrent_sessions_peak: number;
        suspicious_session_activity: number;
      };
    };
    
    data_integrity: {
      data_quality_score: number; // 0-1
      validation_failures: number;
      data_corruption_incidents: number;
      backup_verification_success_rate: number;
      recovery_tests_performed: number;
    };
    
    operational_metrics: {
      system_availability: number; // %
      average_response_time_ms: number;
      security_incidents: number;
      incident_resolution_time_avg_hours: number;
      
      compliance_violations: {
        total: number;
        by_category: Record<string, number>;
        resolved: number;
        pending: number;
      };
    };
    
    recommendations: {
      priority: 'low' | 'medium' | 'high' | 'critical';
      category: string;
      description: string;
      implementation_effort: 'low' | 'medium' | 'high';
      compliance_impact: 'low' | 'medium' | 'high';
    }[];
  };
}
```

---

## 📡 WebSocket API para Tempo Real

### 1. Conectar ao Canal de Alertas

```typescript
// Conexão WebSocket
const ws = new WebSocket('wss://api.omni-portal.com/ws/clinical-alerts');

// Autenticação via token
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'bearer_token_here'
}));

// Subscrever a canais específicos
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    'alerts.new',           // Novos alertas
    'alerts.high_priority', // Apenas alta prioridade
    'alerts.assigned_to_me', // Alertas atribuídos ao usuário
    'system.status'         // Status do sistema
  ]
}));
```

### 2. Eventos de Alerta em Tempo Real

```typescript
interface AlertWebSocketEvent {
  type: 'alert.created' | 'alert.updated' | 'alert.resolved' | 'alert.escalated';
  timestamp: string;
  
  data: {
    alert_id: string;
    patient_id: string;
    priority: string;
    category: string;
    title: string;
    
    // Para alert.created
    created_by?: 'system' | 'manual';
    trigger_conditions?: Record<string, any>;
    
    // Para alert.updated
    previous_status?: string;
    new_status?: string;
    updated_by?: { id: string; name: string; };
    
    // Para alert.resolved
    resolution_time_minutes?: number;
    outcome?: string;
    
    // Para alert.escalated
    escalation_level?: number;
    escalated_to?: string;
    escalation_reason?: string;
  };
  
  metadata: {
    channel: string;
    sequence_id: number;
    user_should_acknowledge: boolean;
    requires_immediate_attention: boolean;
  };
}
```

### 3. Status do Sistema em Tempo Real

```typescript
interface SystemStatusEvent {
  type: 'system.status';
  timestamp: string;
  
  data: {
    health: 'healthy' | 'degraded' | 'critical' | 'maintenance';
    
    services: {
      api: { status: string; response_time_ms: number; };
      database: { status: string; connections: number; };
      queue: { status: string; pending_jobs: number; };
      cache: { status: string; hit_rate: number; };
    };
    
    current_load: {
      active_users: number;
      processing_jobs: number;
      pending_alerts: number;
      system_cpu_usage: number;
      memory_usage_mb: number;
    };
    
    alerts_summary: {
      total_active: number;
      critical_count: number;
      overdue_count: number;
      avg_response_time_minutes: number;
    };
  };
}
```

---

## 🔧 Códigos de Erro e Status

### HTTP Status Codes

- **200** - Sucesso
- **201** - Criado com sucesso
- **202** - Aceito (processamento assíncrono)
- **400** - Requisição inválida
- **401** - Não autenticado
- **403** - Não autorizado/permissão negada
- **404** - Recurso não encontrado
- **409** - Conflito (ex: relatório já existe)
- **422** - Dados inválidos
- **429** - Rate limit excedido
- **500** - Erro interno do servidor
- **503** - Serviço indisponível

### Códigos de Erro Específicos

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    trace_id: string;
    timestamp: string;
  };
}

// Códigos de erro por categoria:
// AUTH_* - Autenticação/Autorização
// VALIDATION_* - Validação de dados
// PROCESSING_* - Processamento de dados
// SYSTEM_* - Sistema/Infraestrutura
// COMPLIANCE_* - Conformidade/Auditoria
```

### Rate Limiting

```typescript
// Headers de resposta para rate limiting:
'X-RateLimit-Limit': '100',
'X-RateLimit-Remaining': '95',
'X-RateLimit-Reset': '1640995200',
'X-RateLimit-Window': '3600'

// Rate limits por endpoint:
// /api/admin/reports/generate: 10/hour
// /api/clinical/alerts: 1000/hour
// /api/admin/analytics/*: 100/hour
// /api/*/download: 50/hour
```

---

## 🎯 Considerações de Performance

### Cache Strategy
- **Reports**: Cache por 15 minutos
- **Analytics**: Cache por 5 minutos
- **Alerts**: Sem cache (tempo real)
- **Configurations**: Cache por 1 hora

### Paginação Padrão
- **Default**: 20 itens por página
- **Máximo**: 100 itens por página
- **Formato**: Cursor-based para listas grandes

### Timeouts
- **API Calls**: 30 segundos
- **Report Generation**: 30 minutos
- **File Downloads**: 10 minutos
- **WebSocket**: 5 minutos de inatividade

---

**Documento preparado por**: Sistema de Arquitetura de APIs  
**Data**: 05 de agosto de 2025  
**Versão**: 1.0  
**Status**: Aprovado para implementação