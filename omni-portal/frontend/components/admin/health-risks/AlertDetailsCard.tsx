import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle,
  Info,
  TrendingUp,
  Activity,
  Heart,
  Brain,
  Pill,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertDetailsCardProps {
  alert: {
    id: string;
    alert_type: string;
    category: string;
    priority: string;
    risk_score: number;
    title: string;
    message: string;
    created_at: string;
    acknowledged_at?: string;
    resolved_at?: string;
    escalated_at?: string;
    dismissed_at?: string;
  };
}

export default function AlertDetailsCard({ alert }: AlertDetailsCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'cardiovascular': return <Heart className="w-6 h-6" />;
      case 'mental_health': return <Brain className="w-6 h-6" />;
      case 'substance_abuse': return <Pill className="w-6 h-6" />;
      case 'safety_risk': return <ShieldAlert className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'cardiovascular': return 'bg-red-100 text-red-600';
      case 'mental_health': return 'bg-purple-100 text-purple-600';
      case 'substance_abuse': return 'bg-orange-100 text-orange-600';
      case 'safety_risk': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header with Category Icon */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${getCategoryColor(alert.category)}`}>
            {getCategoryIcon(alert.category)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{alert.title}</h2>
            <p className="text-gray-600 mt-1">{alert.message}</p>
            
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Tipo: <span className="font-medium capitalize">{alert.alert_type.replace('_', ' ')}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Categoria: <span className="font-medium capitalize">{alert.category.replace('_', ' ')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Score */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-2">Score de Risco</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{alert.risk_score}</div>
                <div className="flex-1 max-w-xs">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        alert.risk_score >= 80 ? 'bg-red-500' :
                        alert.risk_score >= 60 ? 'bg-orange-500' :
                        alert.risk_score >= 40 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${alert.risk_score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
                <Badge className={getRiskColor(alert.risk_score)}>
                  {alert.risk_score >= 80 ? 'Crítico' :
                   alert.risk_score >= 60 ? 'Alto' :
                   alert.risk_score >= 40 ? 'Moderado' :
                   'Baixo'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3">Histórico de Datas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Criado em</p>
              <p className="font-medium">
                {format(new Date(alert.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {alert.acknowledged_at && (
              <div>
                <p className="text-sm text-gray-600">Reconhecido em</p>
                <p className="font-medium">
                  {format(new Date(alert.acknowledged_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            {alert.resolved_at && (
              <div>
                <p className="text-sm text-gray-600">Resolvido em</p>
                <p className="font-medium">
                  {format(new Date(alert.resolved_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            {alert.escalated_at && (
              <div>
                <p className="text-sm text-gray-600">Escalado em</p>
                <p className="font-medium">
                  {format(new Date(alert.escalated_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
            {alert.dismissed_at && (
              <div>
                <p className="text-sm text-gray-600">Dispensado em</p>
                <p className="font-medium">
                  {format(new Date(alert.dismissed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}