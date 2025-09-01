import Link from 'next/link';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  href?: string;
  alert?: boolean;
  isText?: boolean;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  subtitle,
  href,
  alert,
  isText = false,
}: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500 text-blue-600 bg-blue-50 ring-blue-600/20',
    green: 'bg-green-500 text-green-600 bg-green-50 ring-green-600/20',
    yellow: 'bg-yellow-500 text-yellow-600 bg-yellow-50 ring-yellow-600/20',
    red: 'bg-red-500 text-red-600 bg-red-50 ring-red-600/20',
    purple: 'bg-purple-500 text-purple-600 bg-purple-50 ring-purple-600/20',
    indigo: 'bg-indigo-500 text-indigo-600 bg-indigo-50 ring-indigo-600/20',
  };

  const [bgColor, textColor, cardBg, ringColor] = colorClasses[color].split(' ');

  const content = (
    <div className={`relative overflow-hidden rounded-lg ${cardBg} p-6 shadow-sm ring-1 ${ringColor} transition-all hover:shadow-md ${href ? 'cursor-pointer' : ''}`}>
      {alert && (
        <div className="absolute top-2 right-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      )}
      
      <div className="flex items-center">
        <div className={`${bgColor} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline mt-1">
            <p className={`text-2xl font-semibold text-gray-900 ${isText ? 'text-lg' : ''}`}>
              {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {trend && (
              <div className={`ml-2 flex items-center text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                {trend.value}%
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}