import { AdminAlert } from '@/types/admin';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AdminAPI from '@/lib/api/admin';

interface AlertsPanelProps {
  alerts: AdminAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const queryClient = useQueryClient();

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: number) => AdminAPI.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ alertId, resolution }: { alertId: number; resolution: string }) =>
      AdminAPI.resolveAlert(alertId, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const getAlertIcon = (type: AdminAlert['type']) => {
    switch (type) {
      case 'error':
        return XCircleIcon;
      case 'warning':
        return ExclamationTriangleIcon;
      case 'success':
        return CheckCircleIcon;
      default:
        return InformationCircleIcon;
    }
  };

  const getAlertStyles = (type: AdminAlert['type'], severity: AdminAlert['severity']) => {
    const baseStyles = {
      error: 'bg-red-50 border-red-200 text-red-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
    };

    const iconStyles = {
      error: 'text-red-400',
      warning: 'text-yellow-400',
      info: 'text-blue-400',
      success: 'text-green-400',
    };

    return {
      container: baseStyles[type],
      icon: iconStyles[type],
    };
  };

  const activeAlerts = alerts.filter(alert => alert.status === 'active');

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">System Alerts</h2>
        <a
          href="/admin/alerts"
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          View all alerts
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeAlerts.slice(0, 4).map((alert) => {
          const Icon = getAlertIcon(alert.type);
          const styles = getAlertStyles(alert.type, alert.severity);

          return (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${styles.container} relative`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icon className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium">{alert.title}</h3>
                  <div className="mt-1 text-sm">
                    <p>{alert.message}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {alert.status === 'active' && (
                      <>
                        <button
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          className="text-xs font-medium underline hover:no-underline"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => {
                            const resolution = prompt('Enter resolution:');
                            if (resolution) {
                              resolveMutation.mutate({ alertId: alert.id, resolution });
                            }
                          }}
                          className="text-xs font-medium underline hover:no-underline"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                    {alert.action && (
                      <a
                        href={`/admin/${alert.action}`}
                        className="text-xs font-medium underline hover:no-underline"
                      >
                        Take action
                      </a>
                    )}
                  </div>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      type="button"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        alert.type === 'error' ? 'text-red-500 hover:bg-red-100 focus:ring-red-600' :
                        alert.type === 'warning' ? 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600' :
                        alert.type === 'success' ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' :
                        'text-blue-500 hover:bg-blue-100 focus:ring-blue-600'
                      }`}
                    >
                      <span className="sr-only">Dismiss</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              
              {alert.severity === 'critical' && (
                <div className="absolute top-0 right-0 -mt-1 -mr-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}