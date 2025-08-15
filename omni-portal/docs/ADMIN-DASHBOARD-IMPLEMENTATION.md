# Implementação do Dashboard Administrativo de Riscos

## 🎯 Objetivo
Criar um dashboard administrativo para visualização e gestão dos riscos de saúde identificados nos questionários, permitindo que administradores e profissionais de saúde tomem ações proativas.

## 📊 Componentes Principais

### 1. Página Principal do Dashboard
```typescript
// app/(admin)/health-risks/page.tsx
interface HealthRisksDashboard {
  criticalAlerts: CriticalAlert[];
  riskDistribution: RiskDistribution;
  recentAssessments: RecentAssessment[];
  interventionQueue: InterventionQueue[];
}
```

### 2. Visualizações de Dados

#### 2.1 Cartões de Métricas Principais
```typescript
interface MetricCard {
  title: string;
  value: number;
  change: number; // percentual de mudança
  trend: 'up' | 'down' | 'stable';
  severity: 'success' | 'warning' | 'danger';
}

// Exemplos:
- Pacientes em Risco Crítico: 12 (+20%)
- Avaliações Completadas Hoje: 45 (-5%)
- Alertas Não Resolvidos: 8 (+60%)
- Taxa de Intervenção: 85% (estável)
```

#### 2.2 Gráfico de Distribuição de Riscos
```typescript
// Gráfico de rosca mostrando:
- Baixo Risco: 65% (verde)
- Risco Moderado: 25% (amarelo)
- Alto Risco: 8% (laranja)
- Risco Crítico: 2% (vermelho)
```

#### 2.3 Lista de Alertas Críticos
```typescript
interface CriticalAlertRow {
  patientId: string;
  patientName: string; // anonimizado se necessário
  alertType: 'suicide_risk' | 'violence' | 'severe_allergy' | 'substance_abuse';
  riskScore: number;
  timeElapsed: string; // "há 2 horas"
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved';
  assignedTo?: string;
  actions: AlertAction[];
}
```

### 3. Estrutura de Arquivos

```
omni-portal/frontend/
├── app/
│   └── (admin)/
│       └── health-risks/
│           ├── page.tsx                    # Página principal
│           ├── layout.tsx                  # Layout com navegação
│           └── [patientId]/
│               └── page.tsx                # Detalhes do paciente
├── components/
│   └── admin/
│       └── health-risks/
│           ├── CriticalAlertsTable.tsx     # Tabela de alertas
│           ├── RiskDistributionChart.tsx   # Gráfico de distribuição
│           ├── MetricsOverview.tsx         # Cards de métricas
│           ├── PatientRiskModal.tsx        # Modal de detalhes
│           ├── InterventionForm.tsx        # Formulário de intervenção
│           └── RiskTrendChart.tsx          # Gráfico de tendências
└── lib/
    └── api/
        └── admin/
            └── health-risks.ts             # Funções de API
```

## 🔧 Implementação Backend

### 1. Migration para Tabela de Alertas
```php
// database/migrations/2025_01_05_create_health_alerts_table.php
Schema::create('health_alerts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('beneficiary_id')->constrained();
    $table->foreignId('questionnaire_id')->constrained('health_questionnaires');
    $table->enum('alert_type', ['suicide_risk', 'violence_exposure', 'severe_allergy', 'substance_abuse', 'critical_mental_health']);
    $table->enum('severity', ['low', 'medium', 'high', 'critical']);
    $table->string('risk_category', 50);
    $table->integer('risk_score');
    $table->text('message');
    $table->text('recommended_actions')->nullable();
    $table->enum('status', ['pending', 'acknowledged', 'in_progress', 'resolved', 'escalated']);
    $table->timestamp('acknowledged_at')->nullable();
    $table->foreignId('acknowledged_by')->nullable()->constrained('users');
    $table->timestamp('resolved_at')->nullable();
    $table->foreignId('resolved_by')->nullable()->constrained('users');
    $table->json('metadata')->nullable();
    $table->timestamps();
    
    $table->index(['status', 'severity']);
    $table->index(['beneficiary_id', 'created_at']);
});
```

### 2. Controller Administrativo
```php
// app/Http/Controllers/Api/Admin/HealthRiskController.php
class HealthRiskController extends Controller
{
    public function dashboard()
    {
        $criticalAlerts = HealthAlert::with(['beneficiary', 'questionnaire'])
            ->whereIn('status', ['pending', 'acknowledged'])
            ->where('severity', 'critical')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();
            
        $riskDistribution = DB::table('health_questionnaires')
            ->selectRaw("
                CASE 
                    WHEN risk_scores->>'overall' < 50 THEN 'low'
                    WHEN risk_scores->>'overall' < 100 THEN 'moderate'
                    WHEN risk_scores->>'overall' < 150 THEN 'high'
                    ELSE 'critical'
                END as risk_level,
                COUNT(*) as count
            ")
            ->where('status', 'completed')
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('risk_level')
            ->get();
            
        $metrics = [
            'critical_patients' => $this->getCriticalPatientsCount(),
            'assessments_today' => $this->getAssessmentsToday(),
            'pending_alerts' => $this->getPendingAlertsCount(),
            'intervention_rate' => $this->getInterventionRate()
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'critical_alerts' => $criticalAlerts,
                'risk_distribution' => $riskDistribution,
                'metrics' => $metrics,
                'last_updated' => now()
            ]
        ]);
    }
    
    public function acknowledgeAlert($alertId)
    {
        $alert = HealthAlert::findOrFail($alertId);
        
        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
            'acknowledged_by' => auth()->id()
        ]);
        
        // Log da ação
        activity()
            ->performedOn($alert)
            ->causedBy(auth()->user())
            ->withProperties(['previous_status' => 'pending'])
            ->log('Alert acknowledged');
            
        return response()->json([
            'success' => true,
            'message' => 'Alerta confirmado com sucesso'
        ]);
    }
    
    public function createIntervention(Request $request, $alertId)
    {
        $validated = $request->validate([
            'intervention_type' => 'required|string',
            'notes' => 'required|string',
            'follow_up_date' => 'nullable|date',
            'assigned_to' => 'nullable|exists:users,id'
        ]);
        
        $alert = HealthAlert::findOrFail($alertId);
        
        DB::transaction(function () use ($alert, $validated) {
            // Criar intervenção
            $intervention = HealthIntervention::create([
                'alert_id' => $alert->id,
                'beneficiary_id' => $alert->beneficiary_id,
                'type' => $validated['intervention_type'],
                'notes' => $validated['notes'],
                'follow_up_date' => $validated['follow_up_date'],
                'assigned_to' => $validated['assigned_to'] ?? auth()->id(),
                'created_by' => auth()->id(),
                'status' => 'active'
            ]);
            
            // Atualizar status do alerta
            $alert->update(['status' => 'in_progress']);
            
            // Notificar profissional responsável
            if ($validated['assigned_to']) {
                Notification::send(
                    User::find($validated['assigned_to']),
                    new InterventionAssignedNotification($intervention)
                );
            }
        });
        
        return response()->json([
            'success' => true,
            'message' => 'Intervenção criada com sucesso'
        ]);
    }
}
```

### 3. Job de Processamento Assíncrono
```php
// app/Jobs/ProcessHealthRisksJob.php
class ProcessHealthRisksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public function handle()
    {
        // Processar questionários completados sem alertas
        $unprocessed = HealthQuestionnaire::where('status', 'completed')
            ->whereDoesntHave('alerts')
            ->where('completed_at', '>=', now()->subHours(24))
            ->get();
            
        foreach ($unprocessed as $questionnaire) {
            $this->processQuestionnaire($questionnaire);
        }
    }
    
    private function processQuestionnaire($questionnaire)
    {
        $riskScores = $questionnaire->risk_scores;
        $alerts = [];
        
        // Verificar risco de suicídio
        if (in_array('suicide_risk', $riskScores['flags'] ?? [])) {
            $alerts[] = [
                'alert_type' => 'suicide_risk',
                'severity' => 'critical',
                'risk_category' => 'mental_health',
                'risk_score' => $riskScores['categories']['safety_risk'] ?? 0,
                'message' => 'Risco de suicídio identificado - intervenção imediata necessária',
                'recommended_actions' => json_encode([
                    'Contatar profissional de saúde mental imediatamente',
                    'Ativar protocolo de crise',
                    'Agendar avaliação psiquiátrica urgente'
                ])
            ];
        }
        
        // Verificar exposição à violência
        if (in_array('current_violence_exposure', $riskScores['flags'] ?? [])) {
            $alerts[] = [
                'alert_type' => 'violence_exposure',
                'severity' => 'critical',
                'risk_category' => 'safety',
                'risk_score' => $riskScores['categories']['safety_risk'] ?? 0,
                'message' => 'Exposição atual à violência - protocolo de segurança necessário',
                'recommended_actions' => json_encode([
                    'Ativar protocolo de violência doméstica',
                    'Fornecer recursos de apoio',
                    'Considerar encaminhamento para abrigo'
                ])
            ];
        }
        
        // Criar alertas no banco
        foreach ($alerts as $alertData) {
            HealthAlert::create(array_merge($alertData, [
                'beneficiary_id' => $questionnaire->beneficiary_id,
                'questionnaire_id' => $questionnaire->id,
                'status' => 'pending'
            ]));
        }
        
        // Enviar notificações para administradores
        if (!empty($alerts)) {
            $admins = User::role('health_admin')->get();
            Notification::send($admins, new CriticalHealthAlertNotification($questionnaire, $alerts));
        }
    }
}
```

## 🎨 Componentes Frontend

### 1. Tabela de Alertas Críticos
```typescript
// components/admin/health-risks/CriticalAlertsTable.tsx
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye,
  MessageSquare,
  UserCheck
} from 'lucide-react';

interface CriticalAlert {
  id: string;
  patientName: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  createdAt: string;
  status: string;
  assignedTo?: string;
}

export function CriticalAlertsTable({ alerts }: { alerts: CriticalAlert[] }) {
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  
  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity] || colors.medium;
  };
  
  const getAlertIcon = (type: string) => {
    const icons = {
      suicide_risk: '🚨',
      violence_exposure: '⚠️',
      severe_allergy: '🏥',
      substance_abuse: '💊'
    };
    return icons[type] || '📋';
  };
  
  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Severidade</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id} className="hover:bg-gray-50">
              <TableCell>
                <span className="text-2xl" title={alert.alertType}>
                  {getAlertIcon(alert.alertType)}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {alert.patientName}
              </TableCell>
              <TableCell>
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-red-600">
                  {alert.riskScore}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-3 h-3" />
                  {getTimeElapsed(alert.createdAt)}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={alert.status} />
              </TableCell>
              <TableCell>
                {alert.assignedTo ? (
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm">{alert.assignedTo}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Não atribuído</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDetails(alert.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {alert.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCreateIntervention(alert.id)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 2. Gráfico de Distribuição de Riscos
```typescript
// components/admin/health-risks/RiskDistributionChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface RiskData {
  name: string;
  value: number;
  percentage: number;
}

export function RiskDistributionChart({ data }: { data: RiskData[] }) {
  const COLORS = {
    'Baixo': '#10B981',
    'Moderado': '#F59E0B',
    'Alto': '#F97316',
    'Crítico': '#EF4444'
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Distribuição de Riscos</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## 🚀 Próximos Passos

1. **Implementar autenticação e autorização**
   - Middleware para verificar role de admin
   - Políticas de acesso aos dados

2. **Criar sistema de notificações**
   - WebSockets para alertas em tempo real
   - Push notifications para mobile

3. **Implementar exportação de dados**
   - Relatórios em PDF
   - Export para Excel
   - APIs para BI tools

4. **Adicionar filtros avançados**
   - Por período
   - Por tipo de risco
   - Por status
   - Por profissional responsável

5. **Criar dashboard mobile**
   - App React Native
   - Notificações push
   - Acesso offline

## 📋 Checklist de Implementação

- [ ] Criar migrations e models
- [ ] Implementar controllers administrativos
- [ ] Criar job de processamento
- [ ] Desenvolver componentes frontend
- [ ] Implementar sistema de permissões
- [ ] Adicionar testes automatizados
- [ ] Documentar APIs
- [ ] Treinar equipe administrativa
- [ ] Deploy em staging
- [ ] Validação com stakeholders