'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  Calendar,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Heart,
  Brain,
  Pill,
  ShieldAlert,
  Activity,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { healthRisksApi } from '@/lib/api/admin/health-risks';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import InterventionForm from '@/components/admin/health-risks/InterventionForm';
import WorkflowTimeline from '@/components/admin/health-risks/WorkflowTimeline';
import AlertDetailsCard from '@/components/admin/health-risks/AlertDetailsCard';

interface AlertDetails {
  id: string;
  beneficiary_id: string;
  beneficiary: {
    id: string;
    full_name: string;
    cpf: string;
    birth_date: string;
    phone: string;
    email?: string;
  };
  questionnaire: {
    id: string;
    completed_at: string;
    questionnaire_type: string;
    risk_scores: any;
  };
  alert_type: string;
  category: string;
  priority: string;
  status: string;
  risk_score: number;
  risk_factors: any;
  risk_scores_detail: any;
  title: string;
  message: string;
  clinical_recommendations: string[];
  intervention_options: string[];
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  escalated_at?: string;
  dismissed_at?: string;
  sla_deadline: string;
  sla_status: string;
  assigned_to?: {
    id: string;
    name: string;
  };
  created_by?: {
    id: string;
    name: string;
  };
  metadata?: any;
}

interface WorkflowEntry {
  id: string;
  action_type: string;
  action_description: string;
  performed_at: string;
  performed_by?: {
    id: string;
    name: string;
  };
  notes?: string;
  metadata?: any;
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params?.id as string;

  // Initialize all hooks before early returns
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertDetails | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showInterventionForm, setShowInterventionForm] = useState(false);

  const loadAlertDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await healthRisksApi.alerts.get(alertId);
      setAlert((response.data as any).data || response.data);
    } catch (err) {
      console.error('Error loading alert details:', err);
      setError('Erro ao carregar detalhes do alerta');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  const loadWorkflow = useCallback(async () => {
    try {
      const response = await healthRisksApi.alerts.getWorkflow(alertId);
      setWorkflow(response.data.data);
    } catch (err) {
      console.error('Error loading workflow:', err);
    }
  }, [alertId]);

  const handleAcknowledge = async () => {
    try {
      setUpdating(true);
      await healthRisksApi.alerts.acknowledge(alertId);
      await loadAlertDetails();
      await loadWorkflow();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError('Erro ao reconhecer alerta');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string, notes?: string) => {
    try {
      setUpdating(true);
      await healthRisksApi.alerts.updateStatus(alertId, newStatus, notes);
      await loadAlertDetails();
      await loadWorkflow();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  };

  const handleEscalate = async () => {
    const notes = prompt('Motivo da escalação:');
    if (notes) {
      try {
        setUpdating(true);
        await healthRisksApi.alerts.escalate(alertId, notes);
        await loadAlertDetails();
        await loadWorkflow();
      } catch (err) {
        console.error('Error escalating alert:', err);
        setError('Erro ao escalar alerta');
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleDismiss = async () => {
    const reason = prompt('Motivo para dispensar o alerta:');
    if (reason) {
      try {
        setUpdating(true);
        await healthRisksApi.alerts.dismiss(alertId, reason);
        await loadAlertDetails();
        await loadWorkflow();
      } catch (err) {
        console.error('Error dismissing alert:', err);
        setError('Erro ao dispensar alerta');
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleInterventionSubmit = async () => {
    setShowInterventionForm(false);
    await loadWorkflow();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'bg-red-600';
      case 'urgent': return 'bg-orange-600';
      case 'high': return 'bg-yellow-600';
      case 'medium': return 'bg-blue-600';
      case 'low': return 'bg-gray-600';
      default: return 'bg-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'acknowledged': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'escalated': return 'bg-red-100 text-red-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cardiovascular': return <Heart className="w-5 h-5" />;
      case 'mental_health': return <Brain className="w-5 h-5" />;
      case 'substance_abuse': return <Pill className="w-5 h-5" />;
      case 'safety_risk': return <ShieldAlert className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="p-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error || 'Alerta não encontrado'}
          </AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Detalhes do Alerta #{alert.id.slice(0, 8)}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={getPriorityColor(alert.priority)}>
                {alert.priority}
              </Badge>
              <Badge className={getStatusColor(alert.status)}>
                {alert.status.replace('_', ' ')}
              </Badge>
              {alert.sla_status === 'overdue' && (
                <Badge variant="error">
                  <AlertOctagon className="w-3 h-3 mr-1" />
                  SLA Vencido
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {alert.status === 'pending' && (
            <Button onClick={handleAcknowledge} disabled={updating}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Reconhecer
            </Button>
          )}
          
          {['pending', 'acknowledged', 'in_progress'].includes(alert.status) && (
            <>
              <Button 
                variant="outline"
                onClick={() => setShowInterventionForm(true)}
                disabled={updating}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Adicionar Intervenção
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleEscalate}
                disabled={updating}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Escalar
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => handleStatusUpdate('resolved', 'Resolvido pela equipe clínica')}
                disabled={updating}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolver
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleDismiss}
                disabled={updating}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Dispensar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alert Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Alert Information */}
        <div className="lg:col-span-2 space-y-6">
          <AlertDetailsCard alert={alert} />
          
          {/* Tabs for Additional Information */}
          <Card className="p-6">
            <Tabs defaultValue="recommendations" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
                <TabsTrigger value="risk-factors">Fatores de Risco</TabsTrigger>
                <TabsTrigger value="questionnaire">Questionário</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommendations" className="mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold">Recomendações Clínicas</h3>
                  <ul className="space-y-2">
                    {alert.clinical_recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {alert.intervention_options.length > 0 && (
                    <>
                      <h3 className="font-semibold mt-6">Opções de Intervenção</h3>
                      <div className="flex flex-wrap gap-2">
                        {alert.intervention_options.map((option, idx) => (
                          <Badge key={idx} variant="outline">
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="risk-factors" className="mt-4">
                <div className="space-y-4">
                  <h3 className="font-semibold">Análise de Fatores de Risco</h3>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
                    {JSON.stringify(alert.risk_factors, null, 2)}
                  </pre>
                  
                  <h3 className="font-semibold mt-4">Scores Detalhados</h3>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
                    {JSON.stringify(alert.risk_scores_detail, null, 2)}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="questionnaire" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">ID do Questionário</p>
                      <p className="font-medium">{alert.questionnaire.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Tipo</p>
                      <p className="font-medium capitalize">
                        {alert.questionnaire.questionnaire_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completado em</p>
                      <p className="font-medium">
                        {format(new Date(alert.questionnaire.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Beneficiary Info */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações do Beneficiário
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-medium">{alert.beneficiary.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">CPF</p>
                <p className="font-medium">{alert.beneficiary.cpf}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Data de Nascimento</p>
                <p className="font-medium">
                  {format(new Date(alert.beneficiary.birth_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Telefone</p>
                <p className="font-medium">{alert.beneficiary.phone}</p>
              </div>
              {alert.beneficiary.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{alert.beneficiary.email}</p>
                </div>
              )}
            </div>
          </Card>

          {/* SLA Information */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Informações de SLA
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Status do SLA</p>
                <Badge 
                  variant={alert.sla_status === 'overdue' ? 'error' : 'outline'}
                  className="mt-1"
                >
                  {alert.sla_status === 'overdue' ? 'Vencido' : 'Dentro do Prazo'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prazo</p>
                <p className="font-medium">
                  {format(new Date(alert.sla_deadline), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(alert.sla_deadline), { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                </p>
              </div>
              {alert.assigned_to && (
                <div>
                  <p className="text-sm text-gray-600">Atribuído a</p>
                  <p className="font-medium">{alert.assigned_to.name}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Linha do Tempo
            </h3>
            <WorkflowTimeline workflow={workflow} />
          </Card>
        </div>
      </div>

      {/* Intervention Form Modal */}
      {showInterventionForm && (
        <InterventionForm
          alertId={alertId}
          onClose={() => setShowInterventionForm(false)}
          onSubmit={handleInterventionSubmit}
        />
      )}
    </div>
  );
}