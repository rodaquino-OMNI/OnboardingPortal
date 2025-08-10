-- ============================================================================
-- SISTEMA DE RELATÓRIOS ADMINISTRATIVOS E ALERTAS CLÍNICOS
-- Schema de Banco de Dados PostgreSQL
-- Versão: 1.0
-- Data: 05/08/2025
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- ENUMS E TIPOS CUSTOMIZADOS
-- ============================================================================

-- Níveis de risco padronizados
CREATE TYPE risk_level_enum AS ENUM ('minimal', 'low', 'medium', 'high', 'severe', 'critical');

-- Tipos de alerta clínico
CREATE TYPE alert_type_enum AS ENUM (
    'risk_threshold',     -- Threshold de risco ultrapassado
    'trend_analysis',     -- Tendência preocupante detectada
    'population_alert',   -- Alerta populacional
    'combination_risk',   -- Combinação de riscos
    'follow_up_required'  -- Acompanhamento necessário
);

-- Prioridades de alerta
CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high', 'urgent', 'emergency');

-- Categorias de risco
CREATE TYPE risk_category_enum AS ENUM (
    'mental_health',      -- Saúde mental (PHQ-9, GAD-7)
    'substance_use',      -- Uso de substâncias (AUDIT-C, NIDA)
    'cardiovascular',     -- Riscos cardiovasculares
    'safety',            -- Riscos de segurança
    'combined'           -- Múltiplas categorias
);

-- Status de alertas
CREATE TYPE alert_status_enum AS ENUM (
    'pending',           -- Aguardando análise
    'acknowledged',      -- Reconhecido pela equipe
    'in_progress',       -- Em acompanhamento
    'resolved',          -- Resolvido
    'dismissed',         -- Descartado
    'escalated'          -- Escalado para nível superior
);

-- Tipos de relatório
CREATE TYPE report_type_enum AS ENUM (
    'daily',             -- Relatório diário
    'weekly',            -- Relatório semanal
    'monthly',           -- Relatório mensal
    'quarterly',         -- Relatório trimestral
    'annual',            -- Relatório anual
    'custom',            -- Período customizado
    'real_time'          -- Relatório em tempo real
);

-- Status de relatórios
CREATE TYPE report_status_enum AS ENUM (
    'queued',            -- Na fila de processamento
    'generating',        -- Sendo gerado
    'completed',         -- Concluído
    'failed',            -- Falhou na geração
    'expired',           -- Expirado
    'archived'           -- Arquivado
);

-- Categorias de auditoria
CREATE TYPE audit_category_enum AS ENUM (
    'authentication',     -- Autenticação
    'data_access',       -- Acesso a dados
    'data_modification', -- Modificação de dados
    'report_generation', -- Geração de relatórios
    'alert_management',  -- Gestão de alertas
    'configuration',     -- Mudanças de configuração
    'security_event'     -- Eventos de segurança
);

-- Severidade de auditoria
CREATE TYPE audit_severity_enum AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- ============================================================================
-- TABELA PRINCIPAL: AVALIAÇÕES DE RISCO DE SAÚDE
-- ============================================================================

CREATE TABLE health_risk_assessments (
    -- Identificação única
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Scores PHQ-9 (Patient Health Questionnaire-9) - Depressão
    phq9_total_score INTEGER CHECK (phq9_total_score BETWEEN 0 AND 27),
    phq9_risk_level risk_level_enum,
    phq9_responses JSONB, -- Respostas detalhadas criptografadas
    
    -- Scores GAD-7 (Generalized Anxiety Disorder 7-item) - Ansiedade
    gad7_total_score INTEGER CHECK (gad7_total_score BETWEEN 0 AND 21),
    gad7_risk_level risk_level_enum,
    gad7_responses JSONB, -- Respostas detalhadas criptografadas
    
    -- Scores AUDIT-C (Alcohol Use Disorders Identification Test) - Álcool
    audit_c_total_score INTEGER CHECK (audit_c_total_score BETWEEN 0 AND 12),
    audit_c_risk_level risk_level_enum,
    audit_c_responses JSONB, -- Respostas detalhadas criptografadas
    
    -- Scores NIDA (National Institute on Drug Abuse) - Drogas
    nida_total_score INTEGER CHECK (nida_total_score BETWEEN 0 AND 60),
    nida_risk_level risk_level_enum,
    nida_responses JSONB, -- Respostas detalhadas criptografadas
    
    -- Riscos Cardiovasculares (baseado em múltiplos fatores)
    cardiovascular_score INTEGER CHECK (cardiovascular_score BETWEEN 0 AND 108),
    cardiovascular_risk_level risk_level_enum,
    cardiovascular_factors JSONB, -- Fatores de risco detalhados
    
    -- Riscos de Segurança (autolesão, ideação suicida, etc.)
    safety_score INTEGER CHECK (safety_score BETWEEN 0 AND 60),
    safety_risk_level risk_level_enum,
    safety_indicators JSONB, -- Indicadores específicos
    
    -- Score Composto (algoritmo proprietário)
    composite_risk_score DECIMAL(5,2) CHECK (composite_risk_score BETWEEN 0 AND 100),
    composite_risk_level risk_level_enum,
    
    -- Metadados de processamento
    raw_responses JSONB, -- Todas as respostas brutas (criptografadas)
    processing_metadata JSONB, -- Informações do processamento
    quality_score DECIMAL(3,2) CHECK (quality_score BETWEEN 0 AND 1), -- Qualidade das respostas
    
    -- Timestamps de controle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Para limpeza automática
    
    -- Campos de auditoria
    created_by UUID,
    processed_by UUID, -- Sistema ou usuário que processou
    processing_version VARCHAR(50), -- Versão do algoritmo
    
    -- Constraints
    CONSTRAINT valid_processing_date CHECK (processed_at >= created_at),
    CONSTRAINT valid_expiry_date CHECK (expires_at > created_at)
);

-- ============================================================================
-- TABELA: ALERTAS CLÍNICOS
-- ============================================================================

CREATE TABLE clinical_alerts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES health_risk_assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Referência ao paciente
    
    -- Classificação do alerta
    alert_type alert_type_enum NOT NULL,
    priority priority_enum NOT NULL,
    risk_category risk_category_enum NOT NULL,
    
    -- Conteúdo do alerta
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    detailed_analysis JSONB, -- Análise detalhada dos fatores
    recommended_actions JSONB, -- Ações recomendadas estruturadas
    risk_factors JSONB, -- Fatores de risco identificados
    
    -- Dados contextuais
    triggered_by JSONB, -- O que disparou o alerta
    threshold_values JSONB, -- Valores de threshold utilizados
    trend_data JSONB, -- Dados de tendência se aplicável
    
    -- Workflow e atribuição
    status alert_status_enum DEFAULT 'pending',
    assigned_to UUID, -- ID do profissional responsável
    team_assignment VARCHAR(100), -- Equipe responsável
    escalation_level INTEGER DEFAULT 1 CHECK (escalation_level BETWEEN 1 AND 5),
    
    -- Timestamps de workflow
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID,
    started_at TIMESTAMP WITH TIME ZONE, -- Quando iniciou o atendimento
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    
    -- Resolução
    resolution_notes TEXT,
    resolution_actions JSONB, -- Ações tomadas
    outcome_category VARCHAR(100),
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    -- Métricas de performance
    response_time_minutes INTEGER, -- Tempo para primeira resposta
    resolution_time_minutes INTEGER, -- Tempo total de resolução
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Sistema ou usuário
    
    -- Constraints
    CONSTRAINT valid_workflow_dates CHECK (
        (acknowledged_at IS NULL OR acknowledged_at >= created_at) AND
        (started_at IS NULL OR started_at >= COALESCE(acknowledged_at, created_at)) AND
        (resolved_at IS NULL OR resolved_at >= COALESCE(started_at, acknowledged_at, created_at))
    )
);

-- ============================================================================
-- TABELA: RELATÓRIOS ADMINISTRATIVOS
-- ============================================================================

CREATE TABLE administrative_reports (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuração do relatório
    report_type report_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Período de análise
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Parâmetros de geração
    parameters JSONB NOT NULL, -- Filtros, configurações, etc.
    included_metrics TEXT[] DEFAULT '{}', -- Métricas incluídas
    excluded_populations TEXT[] DEFAULT '{}', -- Populações excluídas
    
    -- Dados agregados principais
    total_assessments INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    
    -- Distribuição por níveis de risco
    minimal_risk_count INTEGER DEFAULT 0,
    low_risk_count INTEGER DEFAULT 0,
    medium_risk_count INTEGER DEFAULT 0,
    high_risk_count INTEGER DEFAULT 0,
    severe_risk_count INTEGER DEFAULT 0,
    critical_risk_count INTEGER DEFAULT 0,
    
    -- Métricas por categoria (estruturadas como JSONB)
    depression_metrics JSONB DEFAULT '{}',
    anxiety_metrics JSONB DEFAULT '{}',
    substance_metrics JSONB DEFAULT '{}',
    cardiovascular_metrics JSONB DEFAULT '{}',
    safety_metrics JSONB DEFAULT '{}',
    composite_metrics JSONB DEFAULT '{}',
    
    -- Análises populacionais
    demographic_breakdown JSONB DEFAULT '{}',
    trend_analysis JSONB DEFAULT '{}',
    comparative_analysis JSONB DEFAULT '{}', -- Comparação com períodos anteriores
    
    -- Alertas e intervenções
    alerts_generated INTEGER DEFAULT 0,
    alerts_resolved INTEGER DEFAULT 0,
    average_response_time_minutes DECIMAL(8,2),
    average_resolution_time_minutes DECIMAL(8,2),
    
    -- Arquivo e exportação
    status report_status_enum DEFAULT 'queued',
    file_path VARCHAR(500),
    file_format VARCHAR(10), -- pdf, xlsx, json, csv
    file_size BIGINT,
    file_hash VARCHAR(64), -- SHA-256 para integridade
    
    -- Controle de acesso
    access_level VARCHAR(50) DEFAULT 'clinical_team', -- clinical_team, management, admin
    allowed_roles TEXT[] DEFAULT '{}',
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados de geração
    generated_by UUID NOT NULL,
    generation_started_at TIMESTAMP WITH TIME ZONE,
    generation_completed_at TIMESTAMP WITH TIME ZONE,
    generation_duration_seconds INTEGER,
    
    -- Controle de lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-arquivamento
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_period CHECK (period_end >= period_start),
    CONSTRAINT valid_generation_times CHECK (
        (generation_started_at IS NULL OR generation_started_at >= created_at) AND
        (generation_completed_at IS NULL OR generation_completed_at >= generation_started_at)
    )
);

-- ============================================================================
-- TABELA: CONFIGURAÇÕES DE ALERTAS
-- ============================================================================

CREATE TABLE alert_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação da configuração
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category risk_category_enum NOT NULL,
    
    -- Thresholds por nível de risco
    thresholds JSONB NOT NULL, -- Estrutura: {"low": 10, "medium": 15, "high": 20}
    
    -- Condições de ativação
    activation_conditions JSONB NOT NULL,
    combination_rules JSONB DEFAULT '{}', -- Regras para combinação de riscos
    
    -- Configurações de notificação
    notification_settings JSONB DEFAULT '{}',
    escalation_rules JSONB DEFAULT '{}',
    
    -- Controle
    is_active BOOLEAN DEFAULT TRUE,
    priority priority_enum DEFAULT 'medium',
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID
);

-- ============================================================================
-- TABELA: LOGS DE AUDITORIA
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação do usuário e sessão
    user_id UUID,
    session_id VARCHAR(100),
    
    -- Ação realizada
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    resource_id UUID,
    
    -- Detalhes da requisição
    ip_address INET NOT NULL,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_url TEXT,
    request_body JSONB,
    
    -- Dados de contexto
    before_data JSONB, -- Estado anterior
    after_data JSONB,  -- Estado posterior
    metadata JSONB,    -- Metadados adicionais
    
    -- Categorização
    category audit_category_enum NOT NULL,
    severity audit_severity_enum NOT NULL,
    
    -- Resultado
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    response_code INTEGER,
    
    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_time_ms INTEGER,
    
    -- Geolocalização (opcional)
    location JSONB -- {"country": "BR", "city": "São Paulo", etc.}
);

-- ============================================================================
-- TABELA: NOTIFICAÇÕES PARA EQUIPE CLÍNICA
-- ============================================================================

CREATE TABLE clinical_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamentos
    alert_id UUID REFERENCES clinical_alerts(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL, -- ID do profissional
    
    -- Conteúdo da notificação
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- email, sms, push, dashboard
    
    -- Metadados
    priority priority_enum NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Status de entrega
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, read
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT,
    
    -- Controle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- TABELA: CACHE DE MÉTRICAS (Para performance)
-- ============================================================================

CREATE TABLE metrics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Chave única do cache
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    
    -- Dados em cache
    data JSONB NOT NULL,
    
    -- Metadados
    category VARCHAR(100) NOT NULL,
    period_start DATE,
    period_end DATE,
    
    -- Controle de validade
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Performance
    generation_time_ms INTEGER,
    data_size_bytes INTEGER
);

-- ============================================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================================

-- Índices para health_risk_assessments
CREATE INDEX idx_assessments_user_date ON health_risk_assessments (user_id, assessment_date DESC);
CREATE INDEX idx_assessments_date ON health_risk_assessments (assessment_date DESC);
CREATE INDEX idx_assessments_risk_levels ON health_risk_assessments (phq9_risk_level, gad7_risk_level, audit_c_risk_level);
CREATE INDEX idx_assessments_composite_risk ON health_risk_assessments (composite_risk_level, composite_risk_score DESC);
CREATE INDEX idx_assessments_processing ON health_risk_assessments (processed_at) WHERE processed_at IS NOT NULL;

-- Índices para clinical_alerts
CREATE INDEX idx_alerts_status_priority ON clinical_alerts (status, priority, created_at DESC);
CREATE INDEX idx_alerts_assigned ON clinical_alerts (assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_alerts_category_date ON clinical_alerts (risk_category, created_at DESC);
CREATE INDEX idx_alerts_user ON clinical_alerts (user_id, created_at DESC);
CREATE INDEX idx_alerts_assessment ON clinical_alerts (assessment_id);
CREATE INDEX idx_alerts_workflow ON clinical_alerts (created_at, acknowledged_at, resolved_at);

-- Índices para administrative_reports
CREATE INDEX idx_reports_type_period ON administrative_reports (report_type, period_start, period_end);
CREATE INDEX idx_reports_status ON administrative_reports (status, created_at DESC);
CREATE INDEX idx_reports_generated_by ON administrative_reports (generated_by, created_at DESC);
CREATE INDEX idx_reports_expiry ON administrative_reports (expires_at) WHERE expires_at IS NOT NULL;

-- Índices para audit_logs
CREATE INDEX idx_audit_user_date ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_action_date ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_category_severity ON audit_logs (category, severity, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs (resource, resource_id);
CREATE INDEX idx_audit_ip ON audit_logs (ip_address, created_at DESC);

-- Índices GIN para JSONB
CREATE INDEX idx_assessments_responses_gin ON health_risk_assessments USING GIN (raw_responses);
CREATE INDEX idx_alerts_analysis_gin ON clinical_alerts USING GIN (detailed_analysis);
CREATE INDEX idx_reports_metrics_gin ON administrative_reports USING GIN (depression_metrics, anxiety_metrics, substance_metrics);
CREATE INDEX idx_audit_metadata_gin ON audit_logs USING GIN (metadata);

-- Índices para cache
CREATE INDEX idx_cache_key ON metrics_cache (cache_key);
CREATE INDEX idx_cache_expiry ON metrics_cache (expires_at);
CREATE INDEX idx_cache_category ON metrics_cache (category, period_start, period_end);

-- ============================================================================
-- TRIGGERS E FUNÇÕES
-- ============================================================================

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON health_risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON clinical_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON administrative_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_configs_updated_at BEFORE UPDATE ON alert_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular tempo de resposta em alertas
CREATE OR REPLACE FUNCTION calculate_alert_response_times()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular tempo de resposta (primeira ação)
    IF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN
        NEW.response_time_minutes = EXTRACT(EPOCH FROM NEW.acknowledged_at - NEW.created_at) / 60;
    END IF;
    
    -- Calcular tempo de resolução
    IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
        NEW.resolution_time_minutes = EXTRACT(EPOCH FROM NEW.resolved_at - NEW.created_at) / 60;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_alert_times BEFORE UPDATE ON clinical_alerts FOR EACH ROW EXECUTE FUNCTION calculate_alert_response_times();

-- Função para limpeza automática de dados expirados
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Limpar cache expirado
    DELETE FROM metrics_cache WHERE expires_at < NOW();
    
    -- Arquivar relatórios expirados
    UPDATE administrative_reports 
    SET status = 'archived', archived_at = NOW()
    WHERE expires_at < NOW() AND status NOT IN ('archived', 'failed');
    
    -- Limpar notificações expiradas
    DELETE FROM clinical_notifications WHERE expires_at < NOW();
    
    -- Log da limpeza
    INSERT INTO audit_logs (action, resource, category, severity, metadata)
    VALUES ('cleanup_expired_data', 'system', 'data_modification', 'info', 
            jsonb_build_object('executed_at', NOW()));
END;
$$ language 'plpgsql';

-- ============================================================================
-- VIEWS PARA RELATÓRIOS
-- ============================================================================

-- View para dashboard de riscos em tempo real
CREATE VIEW real_time_risk_dashboard AS
SELECT 
    DATE_TRUNC('day', assessment_date) as assessment_day,
    COUNT(*) as total_assessments,
    COUNT(*) FILTER (WHERE composite_risk_level IN ('high', 'severe', 'critical')) as high_risk_count,
    COUNT(*) FILTER (WHERE composite_risk_level = 'critical') as critical_risk_count,
    
    -- Médias por categoria
    ROUND(AVG(phq9_total_score), 2) as avg_depression_score,
    ROUND(AVG(gad7_total_score), 2) as avg_anxiety_score,
    ROUND(AVG(audit_c_total_score), 2) as avg_alcohol_score,
    ROUND(AVG(cardiovascular_score), 2) as avg_cardiovascular_score,
    ROUND(AVG(safety_score), 2) as avg_safety_score,
    ROUND(AVG(composite_risk_score), 2) as avg_composite_score,
    
    -- Distribuição de riscos
    COUNT(*) FILTER (WHERE composite_risk_level = 'minimal') as minimal_risk,
    COUNT(*) FILTER (WHERE composite_risk_level = 'low') as low_risk,
    COUNT(*) FILTER (WHERE composite_risk_level = 'medium') as medium_risk,
    COUNT(*) FILTER (WHERE composite_risk_level = 'high') as high_risk,
    COUNT(*) FILTER (WHERE composite_risk_level = 'severe') as severe_risk,
    COUNT(*) FILTER (WHERE composite_risk_level = 'critical') as critical_risk
    
FROM health_risk_assessments 
WHERE processed_at IS NOT NULL 
  AND assessment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', assessment_date)
ORDER BY assessment_day DESC;

-- View para performance de alertas
CREATE VIEW alert_performance_metrics AS
SELECT 
    DATE_TRUNC('day', created_at) as alert_day,
    risk_category,
    priority,
    
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_alerts,
    
    ROUND(AVG(response_time_minutes), 2) as avg_response_time_minutes,
    ROUND(AVG(resolution_time_minutes), 2) as avg_resolution_time_minutes,
    
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_minutes) as median_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_minutes) as p95_response_time,
    
    ROUND(
        COUNT(*) FILTER (WHERE status = 'resolved')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as resolution_rate_percent
    
FROM clinical_alerts 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), risk_category, priority
ORDER BY alert_day DESC, priority DESC;

-- ============================================================================
-- DADOS DE CONFIGURAÇÃO INICIAL
-- ============================================================================

-- Configurações padrão de alertas
INSERT INTO alert_configurations (name, description, category, thresholds, activation_conditions, is_active, priority, created_by) VALUES
('PHQ-9 Depression Thresholds', 'Thresholds padrão para detecção de depressão baseado em PHQ-9', 'mental_health', 
 '{"low": 5, "medium": 10, "high": 15, "severe": 20}', 
 '{"metric": "phq9_total_score", "trend_analysis": true, "combination_factors": ["gad7_total_score"]}', 
 true, 'high', '00000000-0000-0000-0000-000000000001'),

('GAD-7 Anxiety Thresholds', 'Thresholds padrão para detecção de ansiedade baseado em GAD-7', 'mental_health', 
 '{"low": 5, "medium": 10, "high": 15}', 
 '{"metric": "gad7_total_score", "trend_analysis": true, "combination_factors": ["phq9_total_score"]}', 
 true, 'high', '00000000-0000-0000-0000-000000000001'),

('AUDIT-C Alcohol Risk', 'Thresholds para risco de uso problemático de álcool', 'substance_use', 
 '{"low": 3, "medium": 4, "high": 8}', 
 '{"metric": "audit_c_total_score", "gender_specific": true}', 
 true, 'medium', '00000000-0000-0000-0000-000000000001'),

('Safety Risk Critical', 'Alertas críticos para riscos de segurança', 'safety', 
 '{"medium": 20, "high": 35, "critical": 50}', 
 '{"metric": "safety_score", "immediate_alert": true, "escalation_required": true}', 
 true, 'urgent', '00000000-0000-0000-0000-000000000001'),

('Cardiovascular Combined Risk', 'Risco cardiovascular combinado', 'cardiovascular', 
 '{"low": 25, "medium": 50, "high": 75, "severe": 90}', 
 '{"metric": "cardiovascular_score", "age_adjusted": true, "trend_analysis": false}', 
 true, 'medium', '00000000-0000-0000-0000-000000000001');

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON DATABASE current_database() IS 'Sistema de Relatórios Administrativos e Alertas Clínicos - Versão 1.0';

COMMENT ON TABLE health_risk_assessments IS 'Armazena todas as avaliações de risco de saúde com scores calculados';
COMMENT ON TABLE clinical_alerts IS 'Alertas gerados para equipe clínica baseados em riscos identificados';
COMMENT ON TABLE administrative_reports IS 'Relatórios administrativos gerados para análise populacional';
COMMENT ON TABLE alert_configurations IS 'Configurações de thresholds e regras para geração de alertas';
COMMENT ON TABLE audit_logs IS 'Log completo de auditoria para compliance e segurança';
COMMENT ON TABLE clinical_notifications IS 'Notificações enviadas para equipe clínica';
COMMENT ON TABLE metrics_cache IS 'Cache de métricas calculadas para otimização de performance';

-- Comentários em colunas críticas
COMMENT ON COLUMN health_risk_assessments.composite_risk_score IS 'Score composto calculado por algoritmo proprietário (0-100)';
COMMENT ON COLUMN clinical_alerts.escalation_level IS 'Nível de escalação do alerta (1=básico, 5=crítico)';
COMMENT ON COLUMN administrative_reports.file_hash IS 'Hash SHA-256 do arquivo para verificação de integridade';
COMMENT ON COLUMN audit_logs.processing_time_ms IS 'Tempo de processamento da operação em milissegundos';

-- ============================================================================
-- GRANTS E PERMISSÕES (Exemplo)
-- ============================================================================

-- Role para aplicação principal
-- CREATE ROLE clinical_app_role;
-- GRANT SELECT, INSERT, UPDATE ON health_risk_assessments TO clinical_app_role;
-- GRANT SELECT, INSERT, UPDATE ON clinical_alerts TO clinical_app_role;
-- GRANT SELECT, INSERT, UPDATE ON administrative_reports TO clinical_app_role;
-- GRANT INSERT ON audit_logs TO clinical_app_role;

-- Role para relatórios (somente leitura)
-- CREATE ROLE reports_readonly_role;
-- GRANT SELECT ON health_risk_assessments TO reports_readonly_role;
-- GRANT SELECT ON clinical_alerts TO reports_readonly_role;
-- GRANT SELECT ON administrative_reports TO reports_readonly_role;
-- GRANT SELECT ON real_time_risk_dashboard TO reports_readonly_role;
-- GRANT SELECT ON alert_performance_metrics TO reports_readonly_role;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
-- Total de tabelas: 7
-- Total de índices: 25+
-- Total de triggers: 4
-- Total de views: 2
-- Total de enums: 7
-- Estimativa de storage inicial: ~50MB (vazio)
-- Estimativa de storage com 1M assessments: ~2-3GB
-- ============================================================================