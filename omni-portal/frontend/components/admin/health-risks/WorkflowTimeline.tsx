import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  FileText,
  User
} from 'lucide-react';

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

interface WorkflowTimelineProps {
  workflow: WorkflowEntry[];
}

export default function WorkflowTimeline({ workflow }: WorkflowTimelineProps) {
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'alert_created':
        return <AlertTriangle className="w-4 h-4" />;
      case 'acknowledged':
        return <CheckCircle className="w-4 h-4" />;
      case 'status_updated':
        return <Clock className="w-4 h-4" />;
      case 'intervention_added':
        return <MessageSquare className="w-4 h-4" />;
      case 'escalated':
        return <TrendingUp className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4" />;
      case 'report_generated':
        return <FileText className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'alert_created':
        return 'bg-blue-100 text-blue-600';
      case 'acknowledged':
        return 'bg-green-100 text-green-600';
      case 'escalated':
        return 'bg-red-100 text-red-600';
      case 'resolved':
        return 'bg-green-100 text-green-600';
      case 'dismissed':
        return 'bg-gray-100 text-gray-600';
      case 'intervention_added':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (workflow.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhuma ação registrada ainda
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-8 bottom-0 w-0.5 bg-gray-200"></div>
      
      {/* Timeline entries */}
      <div className="space-y-6">
        {workflow.map((entry, index) => (
          <div key={entry.id} className="relative flex items-start">
            {/* Icon */}
            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(entry.action_type)}`}>
              {getActionIcon(entry.action_type)}
            </div>
            
            {/* Content */}
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.action_description}
                  </p>
                  
                  {entry.performed_by && (
                    <div className="flex items-center gap-1 mt-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        {entry.performed_by.name}
                      </span>
                    </div>
                  )}
                  
                  {entry.notes && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                      {entry.notes}
                    </p>
                  )}
                </div>
                
                <span className="flex-shrink-0 ml-4 text-xs text-gray-500">
                  {formatDistanceToNow(new Date(entry.performed_at), { 
                    addSuffix: true,
                    locale: ptBR 
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}