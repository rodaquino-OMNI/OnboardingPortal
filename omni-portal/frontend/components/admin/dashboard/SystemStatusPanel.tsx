import { SystemStatus } from '@/types/admin';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

interface SystemStatusPanelProps {
  status: SystemStatus;
}

export function SystemStatusPanel({ status }: SystemStatusPanelProps) {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'healthy':
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case 'degraded':
        return <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />;
      case 'down':
        return <XCircleIcon className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'healthy':
        return 'bg-green-50 text-green-800 ring-green-600/20';
      case 'degraded':
        return 'bg-yellow-50 text-yellow-800 ring-yellow-600/20';
      case 'down':
        return 'bg-red-50 text-red-800 ring-red-600/20';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const metrics = [
    {
      label: 'Uptime',
      value: formatUptime(status.uptime),
      trend: null,
    },
    {
      label: 'Response Time',
      value: `${status.response_time}ms`,
      trend: status.response_time < 200 ? 'good' : 'bad',
    },
    {
      label: 'Error Rate',
      value: `${(status.error_rate * 100).toFixed(2)}%`,
      trend: status.error_rate < 0.01 ? 'good' : 'bad',
    },
    {
      label: 'Active Sessions',
      value: status.active_sessions.toLocaleString(),
      trend: null,
    },
    {
      label: 'Queue Size',
      value: status.queue_size.toLocaleString(),
      trend: status.queue_size < 100 ? 'good' : 'bad',
    },
  ];

  return (
    <div className={`rounded-lg shadow-sm ring-1 p-6 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">System Status</h3>
        <a
          href="/admin/system"
          className="text-sm font-medium hover:underline"
        >
          Details
        </a>
      </div>

      <div className="flex items-center justify-center mb-6">
        {getStatusIcon()}
        <div className="ml-4">
          <p className="text-2xl font-bold capitalize">{status.status}</p>
          <p className="text-sm opacity-75">
            Last check: {new Date(status.last_check).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <span className="text-sm font-medium">{metric.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{metric.value}</span>
              {metric.trend && (
                <span className={metric.trend === 'good' ? 'text-green-600' : 'text-red-600'}>
                  {metric.trend === 'good' ? (
                    <ArrowDownIcon className="h-4 w-4" />
                  ) : (
                    <ArrowUpIcon className="h-4 w-4" />
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <a
            href="/admin/logs"
            className="text-sm font-medium hover:underline"
          >
            View Logs
          </a>
          <a
            href="/admin/monitoring"
            className="text-sm font-medium hover:underline"
          >
            Monitoring
          </a>
        </div>
      </div>
    </div>
  );
}