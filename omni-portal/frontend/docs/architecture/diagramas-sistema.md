# Diagramas de Sistema - Relatórios Clínicos
## Representações Visuais da Arquitetura

### 🏗️ Diagrama C4 - Nível 1: Contexto do Sistema

```mermaid
C4Context
    title Sistema de Relatórios Administrativos e Alertas Clínicos

    Person(clinicalStaff, "Equipe Clínica", "Profissionais de saúde que monitoram pacientes")
    Person(adminStaff, "Administradores", "Gestores que analisam dados populacionais")
    Person(managers, "Gerência", "Tomadores de decisão estratégica")

    System(clinicalReports, "Sistema de Relatórios Clínicos", "Geração de relatórios administrativos e alertas para equipe clínica")

    System_Ext(onboardingPortal, "Portal de Onboarding", "Sistema que coleta dados dos questionários de saúde")
    System_Ext(hospitalSystems, "Sistemas Hospitalares", "EHR, PACS, LIS e outros sistemas de saúde")
    System_Ext(notificationServices, "Serviços de Notificação", "Email, SMS, webhooks para alertas")

    Rel(clinicalStaff, clinicalReports, "Monitora alertas e resolve casos clínicos")
    Rel(adminStaff, clinicalReports, "Gera relatórios e configura sistema")
    Rel(managers, clinicalReports, "Visualiza dashboards e métricas executivas")

    Rel(onboardingPortal, clinicalReports, "Envia dados de avaliações de saúde", "HTTPS/REST API")
    Rel(clinicalReports, hospitalSystems, "Integra dados clínicos", "HL7 FHIR/REST API")
    Rel(clinicalReports, notificationServices, "Envia alertas para equipe", "SMTP/HTTP webhooks")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

### 🏗️ Diagrama C4 - Nível 2: Containers

```mermaid
C4Container
    title Arquitetura de Containers - Sistema de Relatórios Clínicos

    Person(clinicalUser, "Usuário Clínico")
    Person(adminUser, "Administrador")

    Container_Boundary(c1, "Sistema de Relatórios Clínicos") {
        Container(webapp, "Dashboard Web", "Next.js 15, TypeScript", "Interface administrativa para relatórios e alertas")
        Container(api, "API Gateway", "Laravel 11, PHP 8.3", "API REST para todas as operações")
        Container(authService, "Serviço de Autenticação", "Laravel Sanctum + MFA", "Autenticação e autorização")
        Container(reportEngine, "Engine de Relatórios", "Laravel Jobs + Queue", "Processamento assíncrono de relatórios")
        Container(alertEngine, "Engine de Alertas", "Laravel Jobs + ML", "Detecção e geração de alertas clínicos")
        Container(riskCalculator, "Calculadora de Riscos", "PHP + Algoritmos", "Cálculo de scores de risco de saúde")
    }

    ContainerDb(primaryDb, "Banco Principal", "PostgreSQL 16", "Dados clínicos, relatórios, alertas")
    ContainerDb(cacheDb, "Cache e Filas", "Redis 7", "Cache de sessões, filas de jobs")
    ContainerDb(auditDb, "Log de Auditoria", "PostgreSQL 16", "Logs de auditoria e compliance")

    Container_Ext(fileStorage, "Armazenamento", "S3 Compatible", "Relatórios gerados e arquivos")
    Container_Ext(monitoring, "Monitoramento", "Grafana + Prometheus", "Métricas e observabilidade")

    Rel(clinicalUser, webapp, "Acessa dashboards e alertas", "HTTPS")
    Rel(adminUser, webapp, "Configura sistema e gera relatórios", "HTTPS")

    Rel(webapp, api, "Chamadas API", "HTTPS/REST")
    Rel(api, authService, "Autentica usuários", "Internal")
    Rel(api, reportEngine, "Solicita relatórios", "Queue")
    Rel(api, alertEngine, "Configura alertas", "Queue")
    Rel(api, riskCalculator, "Calcula riscos", "Internal")

    Rel(reportEngine, primaryDb, "Consulta dados", "SQL")
    Rel(alertEngine, primaryDb, "Analisa riscos", "SQL")
    Rel(riskCalculator, primaryDb, "Salva scores", "SQL")

    Rel(api, cacheDb, "Cache e sessões", "Redis Protocol")
    Rel(reportEngine, cacheDb, "Fila de jobs", "Redis Protocol")
    Rel(alertEngine, cacheDb, "Fila de alertas", "Redis Protocol")

    Rel(authService, auditDb, "Registra acessos", "SQL")
    Rel(api, auditDb, "Log de auditoria", "SQL")

    Rel(reportEngine, fileStorage, "Salva relatórios", "S3 API")
    Rel(monitoring, api, "Coleta métricas", "HTTP")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

### 🔄 Fluxo de Dados - Processamento de Avaliações

```mermaid
sequenceDiagram
    participant U as Portal Onboarding
    participant AG as API Gateway  
    participant RC as Risk Calculator
    participant DB as Database
    participant Q as Queue System
    participant AE as Alert Engine
    participant NE as Notification Engine
    participant CT as Clinical Team

    Note over U,CT: Fluxo de Processamento de Avaliação de Saúde

    U->>AG: POST /api/assessments/submit
    Note right of U: Dados dos questionários<br/>PHQ-9, GAD-7, AUDIT-C, etc.

    AG->>AG: Validar autenticação
    AG->>AG: Validar dados entrada
    AG->>DB: INSERT assessment (raw data)
    AG->>Q: Enqueue RiskCalculationJob
    AG-->>U: 202 Accepted + assessment_id

    Q->>RC: Process assessment
    RC->>RC: Calculate PHQ-9 score
    RC->>RC: Calculate GAD-7 score  
    RC->>RC: Calculate AUDIT-C score
    RC->>RC: Calculate cardiovascular risk
    RC->>RC: Calculate safety risk
    RC->>RC: Calculate composite score

    RC->>DB: UPDATE assessment (scores + levels)
    RC->>Q: Enqueue AlertAnalysisJob (if high risk)

    alt High Risk Detected
        Q->>AE: Analyze risk levels
        AE->>AE: Check alert thresholds
        AE->>AE: Apply ML risk patterns
        AE->>DB: INSERT clinical_alert
        AE->>Q: Enqueue NotificationJob
        
        Q->>NE: Process notification
        NE->>NE: Determine recipients
        NE->>CT: Dashboard notification
        NE->>CT: Email alert (if configured)
        NE->>DB: LOG notification sent
    end

    Note over DB: Assessment processado<br/>Alertas gerados se necessário<br/>Equipe clínica notificada
```

### 📊 Fluxo de Geração de Relatórios

```mermaid
flowchart TD
    A[Solicitação de Relatório] --> B{Tipo de Relatório}
    
    B -->|Diário| C[Query últimas 24h]
    B -->|Semanal| D[Query últimos 7 dias]
    B -->|Mensal| E[Query último mês]
    B -->|Custom| F[Query período específico]
    
    C --> G[Coletar Dados Brutos]
    D --> G
    E --> G
    F --> G
    
    G --> H[Calcular Métricas Agregadas]
    H --> I[Aplicar Filtros Demográficos]
    I --> J[Análise de Tendências]
    J --> K[Geração de Gráficos]
    K --> L{Formato de Saída}
    
    L -->|PDF| M[Render Template PDF]
    L -->|Excel| N[Gerar Planilha XLSX]
    L -->|JSON| O[Serializar JSON]
    L -->|CSV| P[Export CSV]
    
    M --> Q[Armazenar Arquivo]
    N --> Q
    O --> Q
    P --> Q
    
    Q --> R[Gerar URL Segura]
    R --> S[Notificar Disponibilidade]
    S --> T[Registrar Auditoria]
    T --> U[Relatório Disponível]
    
    style A fill:#e1f5fe
    style U fill:#c8e6c9
    style G fill:#fff3e0
    style H fill:#fff3e0
    style Q fill:#f3e5f5
```

### 🚨 Arquitetura do Sistema de Alertas

```mermaid
graph TB
    subgraph "Data Sources"
        AS[Assessment Scores]
        HS[Historical Data]
        CS[Configuration Settings]
    end
    
    subgraph "Alert Processing Engine"
        TE[Threshold Evaluator]
        PA[Pattern Analyzer]
        ML[ML Risk Predictor]
        RG[Rule Generator]
    end
    
    subgraph "Alert Classification"
        PC[Priority Calculator]
        CC[Category Classifier]  
        AC[Assignment Controller]
    end
    
    subgraph "Notification System"
        DS[Dashboard System]
        ES[Email Service]
        WS[WebSocket Server]
        WH[Webhook Handler]
    end
    
    subgraph "Clinical Team"
        CT[Clinical Staff]
        CS[Clinical Supervisors]
        EM[Emergency Team]
    end
    
    AS --> TE
    AS --> PA
    HS --> PA
    HS --> ML
    CS --> TE
    CS --> RG
    
    TE --> PC
    PA --> CC
    ML --> PC
    RG --> AC
    
    PC --> DS
    CC --> DS
    AC --> ES
    AC --> WS
    
    DS --> CT
    ES --> CS
    WS --> CT
    WH --> EM
    
    style AS fill:#ffebee
    style HS fill:#ffebee
    style TE fill:#e3f2fd
    style PA fill:#e3f2fd
    style ML fill:#e8f5e8
    style DS fill:#fff3e0
    style ES fill:#fff3e0
    style CT fill:#f3e5f5
```

### 🔒 Arquitetura de Segurança Multi-Camadas

```mermaid
graph TD
    subgraph "Layer 7: User Authentication"
        MFA[Multi-Factor Auth]
        SSO[Single Sign-On]
        RBAC[Role-Based Access]
    end
    
    subgraph "Layer 6: Application Security"
        INPUT[Input Validation]
        AUTHZ[Authorization Checks]
        CSRF[CSRF Protection]
        XSS[XSS Prevention]
    end
    
    subgraph "Layer 5: API Security"
        JWT[JWT Tokens]
        RATE[Rate Limiting]
        AUDIT[Audit Logging]
        CORS[CORS Policy]
    end
    
    subgraph "Layer 4: Business Logic"
        ENCRYPT[Field Encryption]
        INTEGRITY[Data Integrity]
        VALIDATION[Business Rules]
        MASKING[Data Masking]
    end
    
    subgraph "Layer 3: Data Security"
        TDE[Transparent Data Encryption]
        BACKUP[Encrypted Backups]
        SEGMENT[Data Segmentation]
        RETENTION[Retention Policies]
    end
    
    subgraph "Layer 2: Network Security"
        TLS[TLS 1.3]
        VPN[VPN Access]
        WAF[Web Application Firewall]
        IDS[Intrusion Detection]
    end
    
    subgraph "Layer 1: Infrastructure"
        CONTAINER[Container Isolation]
        MONITOR[System Monitoring]
        PHYSICAL[Physical Security]
        COMPLIANCE[Compliance Controls]
    end
    
    MFA --> INPUT
    SSO --> AUTHZ
    RBAC --> CSRF
    
    INPUT --> JWT
    AUTHZ --> RATE
    CSRF --> AUDIT
    
    JWT --> ENCRYPT
    RATE --> INTEGRITY
    AUDIT --> VALIDATION
    
    ENCRYPT --> TDE
    INTEGRITY --> BACKUP
    VALIDATION --> SEGMENT
    
    TDE --> TLS
    BACKUP --> VPN
    SEGMENT --> WAF
    
    TLS --> CONTAINER
    VPN --> MONITOR
    WAF --> PHYSICAL
    
    style MFA fill:#ffcdd2
    style TLS fill:#c8e6c9
    style ENCRYPT fill:#fff3c4
    style AUDIT fill:#e1bee7
```

### 📈 Dashboard de Métricas em Tempo Real

```mermaid
graph LR
    subgraph "Data Collection"
        DB[(Database)]
        CACHE[(Redis Cache)]
        LOGS[(Audit Logs)]
    end
    
    subgraph "Metrics Processing"
        AGG[Aggregation Service]
        CALC[Metrics Calculator]
        TREND[Trend Analyzer]
    end
    
    subgraph "Real-time Updates"
        WS[WebSocket Server]
        SSE[Server-Sent Events]
        PUSH[Push Notifications]
    end
    
    subgraph "Dashboard Components"
        ALERTS[Active Alerts Panel]
        RISK[Risk Distribution Chart]
        PERF[Performance Metrics]
        TREND_CHART[Trend Analysis]
        MAP[Geographic Heatmap]
    end
    
    subgraph "User Interfaces"
        CLINICAL[Clinical Dashboard]
        ADMIN[Admin Dashboard]
        EXEC[Executive Dashboard]
    end
    
    DB --> AGG
    CACHE --> CALC
    LOGS --> TREND
    
    AGG --> WS
    CALC --> SSE
    TREND --> PUSH
    
    WS --> ALERTS
    SSE --> RISK
    PUSH --> PERF
    
    ALERTS --> CLINICAL
    RISK --> ADMIN
    PERF --> EXEC
    TREND_CHART --> ADMIN
    MAP --> EXEC
    
    style DB fill:#e3f2fd
    style CACHE fill:#e8f5e8
    style WS fill:#fff3e0
    style CLINICAL fill:#f3e5f5
```

### 🔄 Ciclo de Vida de Dados LGPD

```mermaid
stateDiagram-v2
    [*] --> DataCollection: Consentimento obtido
    
    DataCollection --> Processing: Dados coletados
    Processing --> Storage: Dados processados
    Storage --> Access: Solicitação de acesso
    Storage --> Retention: Período de retenção
    
    Access --> DataProvision: Dados fornecidos
    DataProvision --> Storage: Retorna ao armazenamento
    
    Storage --> Rectification: Solicitação de correção
    Rectification --> Updated: Dados corrigidos
    Updated --> Storage: Dados atualizados
    
    Retention --> LegalHold: Base legal existe?
    LegalHold --> Pseudonymization: Sim - Pseudonimizar
    LegalHold --> Deletion: Não - Deletar
    
    Pseudonymization --> ArchiveStorage: Dados pseudonimizados
    ArchiveStorage --> FinalDeletion: Fim do período legal
    
    Deletion --> [*]: Dados removidos
    FinalDeletion --> [*]: Dados finalmente removidos
    
    Processing --> ConsentWithdrawal: Revogação de consentimento
    ConsentWithdrawal --> ImmediateDeletion: Deletar imediatamente
    ImmediateDeletion --> [*]: Dados removidos
    
    note right of LegalHold
        Verificar bases legais:
        - Obrigação legal
        - Interesse legítimo
        - Pesquisa científica
    end note
    
    note right of Pseudonymization
        Dados mantidos para:
        - Análises populacionais
        - Pesquisa em saúde
        - Estatísticas epidemiológicas
    end note
```

### 🏥 Integração com Sistemas Hospitalares

```mermaid
graph TB
    subgraph "Hospital Systems"
        EHR[Electronic Health Records]
        LIS[Laboratory Information System]
        PACS[Picture Archiving System]
        HIS[Hospital Information System]
    end
    
    subgraph "Integration Layer"
        HL7[HL7 FHIR Gateway]
        API_ADAPTER[API Adapter]
        DATA_MAPPER[Data Mapper]
        SYNC[Sync Service]
    end
    
    subgraph "Clinical Reports System"
        INGEST[Data Ingestion]
        NORMALIZE[Data Normalization]
        CORRELATE[Risk Correlation]
        ALERT_SYS[Alert System]
    end
    
    subgraph "Clinical Workflows"
        PATIENT_CONTEXT[Patient Context]
        RISK_PROFILE[Risk Profile]
        CARE_PLANS[Care Plans]
        FOLLOW_UP[Follow-up Tracking]
    end
    
    EHR --> HL7
    LIS --> API_ADAPTER
    PACS --> DATA_MAPPER
    HIS --> SYNC
    
    HL7 --> INGEST
    API_ADAPTER --> NORMALIZE
    DATA_MAPPER --> CORRELATE
    SYNC --> ALERT_SYS
    
    INGEST --> PATIENT_CONTEXT
    NORMALIZE --> RISK_PROFILE
    CORRELATE --> CARE_PLANS
    ALERT_SYS --> FOLLOW_UP
    
    style EHR fill:#e1f5fe
    style LIS fill:#e8f5e8
    style HL7 fill:#fff3e0
    style ALERT_SYS fill:#ffebee
    style PATIENT_CONTEXT fill:#f3e5f5
```

### 🔧 Arquitetura de Deployment

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[HAProxy/NGINX]
    end
    
    subgraph "Application Tier"
        WEB1[Web Server 1<br/>Next.js + PHP-FPM]
        WEB2[Web Server 2<br/>Next.js + PHP-FPM]
        WEB3[Web Server 3<br/>Next.js + PHP-FPM]
    end
    
    subgraph "Queue Workers"
        QW1[Queue Worker 1<br/>Report Generation]
        QW2[Queue Worker 2<br/>Alert Processing]
        QW3[Queue Worker 3<br/>Risk Calculation]
    end
    
    subgraph "Database Cluster"
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_STANDBY1[(PostgreSQL Standby 1)]
        PG_STANDBY2[(PostgreSQL Standby 2)]
    end
    
    subgraph "Cache Cluster"
        REDIS_MASTER[(Redis Master)]
        REDIS_SLAVE1[(Redis Slave 1)]
        REDIS_SLAVE2[(Redis Slave 2)]
    end
    
    subgraph "Storage"
        S3[(Object Storage<br/>S3 Compatible)]
        NFS[(Shared Storage<br/>NFS)]
    end
    
    subgraph "Monitoring"
        PROMETHEUS[(Prometheus)]
        GRAFANA[Grafana]
        ALERTMANAGER[Alert Manager]
    end
    
    LB --> WEB1
    LB --> WEB2
    LB --> WEB3
    
    WEB1 --> PG_PRIMARY
    WEB2 --> PG_PRIMARY
    WEB3 --> PG_PRIMARY
    
    PG_PRIMARY --> PG_STANDBY1
    PG_PRIMARY --> PG_STANDBY2
    
    WEB1 --> REDIS_MASTER
    WEB2 --> REDIS_MASTER
    WEB3 --> REDIS_MASTER
    
    REDIS_MASTER --> REDIS_SLAVE1
    REDIS_MASTER --> REDIS_SLAVE2
    
    QW1 --> REDIS_MASTER
    QW2 --> REDIS_MASTER
    QW3 --> REDIS_MASTER
    
    QW1 --> PG_PRIMARY
    QW2 --> PG_PRIMARY
    QW3 --> PG_PRIMARY
    
    QW1 --> S3
    WEB1 --> NFS
    WEB2 --> NFS
    WEB3 --> NFS
    
    PROMETHEUS --> WEB1
    PROMETHEUS --> WEB2
    PROMETHEUS --> WEB3
    PROMETHEUS --> PG_PRIMARY
    PROMETHEUS --> REDIS_MASTER
    
    GRAFANA --> PROMETHEUS
    ALERTMANAGER --> PROMETHEUS
    
    style LB fill:#e3f2fd
    style PG_PRIMARY fill:#c8e6c9
    style REDIS_MASTER fill:#fff3c4
    style S3 fill:#f3e5f5
    style PROMETHEUS fill:#ffcdd2
```

---

## 📐 Especificações Técnicas dos Diagramas

### Convenções Utilizadas

#### Cores por Categoria
- **🔵 Azul**: Componentes de frontend/interface
- **🟢 Verde**: Serviços de backend/processamento  
- **🟡 Amarelo**: Cache e armazenamento temporário
- **🟣 Roxo**: Armazenamento persistente
- **🔴 Vermelho**: Segurança e monitoramento

#### Símbolos e Formas
- **Retângulos**: Serviços/componentes
- **Cilindros**: Bancos de dados
- **Losangos**: Pontos de decisão
- **Círculos**: Pontos de conexão
- **Hexágonos**: Sistemas externos

#### Relacionamentos
- **Linha sólida**: Comunicação síncrona
- **Linha tracejada**: Comunicação assíncrona
- **Seta simples**: Fluxo de dados
- **Seta dupla**: Comunicação bidirecional

### Métricas de Performance por Componente

| Componente | Latência Target | Throughput | Disponibilidade |
|------------|----------------|------------|-----------------|
| API Gateway | < 100ms | 1000 req/s | 99.9% |
| Dashboard Web | < 200ms | 500 req/s | 99.9% |
| Report Engine | < 30s | 10 reports/min | 99.5% |
| Alert Engine | < 5s | 100 alerts/min | 99.9% |
| Risk Calculator | < 2s | 200 calc/min | 99.8% |
| Database | < 50ms | 2000 queries/s | 99.9% |
| Cache System | < 10ms | 5000 ops/s | 99.5% |

### Dimensionamento de Infraestrutura

#### Ambiente de Produção
- **Web Servers**: 3x 4 vCPU, 8GB RAM
- **Queue Workers**: 3x 2 vCPU, 4GB RAM  
- **Database**: 1x Primary (8 vCPU, 32GB RAM) + 2x Standby (4 vCPU, 16GB RAM)
- **Cache**: 3x Redis (2 vCPU, 8GB RAM)
- **Storage**: 1TB SSD + Object Storage ilimitado
- **Network**: 10 Gbps bandwidth

#### Escalabilidade
- **Horizontal**: Web servers e workers podem escalar automaticamente
- **Vertical**: Database pode escalar até 32 vCPU, 128GB RAM
- **Cache**: Redis Cluster suporta até 100 nós
- **Storage**: Auto-scaling baseado em uso

---

**Documento preparado por**: Equipe de Arquitetura de Sistemas  
**Data**: 05 de agosto de 2025  
**Versão**: 1.0  
**Ferramenta**: Mermaid.js para diagramas  
**Status**: Aprovado para implementação