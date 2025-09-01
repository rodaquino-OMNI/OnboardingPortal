import { AdminActionLog } from '@/types/admin';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

interface ActivityFeedProps {
  activities: AdminActionLog[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (actionType: string) => {
    if (actionType.includes('user')) return UserIcon;
    if (actionType.includes('document')) return DocumentTextIcon;
    if (actionType.includes('security')) return ShieldCheckIcon;
    if (actionType.includes('setting')) return CogIcon;
    return CheckCircleIcon;
  };

  const getActivityColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  const formatActionDescription = (log: AdminActionLog) => {
    const actionParts = log.action_type.split('_');
    const resourceParts = log.resource_type.split('_');
    
    let description = `${actionParts.join(' ')} ${resourceParts.join(' ')}`;
    
    if (log.action_data?.target_name) {
      description += `: ${log.action_data.target_name}`;
    }
    
    return description.charAt(0).toUpperCase() + description.slice(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <a
          href="/admin/audit"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          View all
        </a>
      </div>

      <div className="flow-root">
        <ul className="-mb-8">
          {activities.map((activity, activityIdx) => {
            const Icon = getActivityIcon(activity.action_type);
            const isSuccess = activity.response_status >= 200 && activity.response_status < 300;
            
            return (
              <li key={activity.id}>
                <div className="relative pb-8">
                  {activityIdx !== activities.length - 1 ? (
                    <span
                      className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  ) : null}
                  
                  <div className="relative flex items-start space-x-3">
                    <div className="relative">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white ${getActivityColor(activity.risk_level)}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      {isSuccess ? (
                        <CheckCircleIcon className="absolute -bottom-1 -right-1 h-5 w-5 text-green-500 bg-white rounded-full" />
                      ) : (
                        <XCircleIcon className="absolute -bottom-1 -right-1 h-5 w-5 text-red-500 bg-white rounded-full" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">
                          {activity.user?.name || 'System'}
                        </span>{' '}
                        <span className="text-gray-600">
                          {formatActionDescription(activity)}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        <span>{activity.ip_address}</span>
                        {activity.risk_level !== 'low' && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            activity.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                            activity.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {activity.risk_level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}