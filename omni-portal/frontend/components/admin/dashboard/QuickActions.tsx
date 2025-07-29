import Link from 'next/link';
import {
  UserPlusIcon,
  DocumentPlusIcon,
  ChartBarIcon,
  CogIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const actions = [
  {
    name: 'Add User',
    href: '/admin/users/new',
    icon: UserPlusIcon,
    color: 'bg-blue-500',
    description: 'Create a new user account',
  },
  {
    name: 'Review Documents',
    href: '/admin/documents?status=pending',
    icon: DocumentPlusIcon,
    color: 'bg-green-500',
    description: 'Review pending documents',
  },
  {
    name: 'Generate Report',
    href: '/admin/analytics/reports',
    icon: ChartBarIcon,
    color: 'bg-purple-500',
    description: 'Create custom reports',
  },
  {
    name: 'System Settings',
    href: '/admin/settings',
    icon: CogIcon,
    color: 'bg-gray-500',
    description: 'Configure system settings',
  },
  {
    name: 'Security Audit',
    href: '/admin/security',
    icon: ShieldCheckIcon,
    color: 'bg-red-500',
    description: 'View security logs',
  },
  {
    name: 'Export Data',
    href: '/admin/export',
    icon: ArrowDownTrayIcon,
    color: 'bg-indigo-500',
    description: 'Export system data',
  },
  {
    name: 'Send Notification',
    href: '/admin/notifications/new',
    icon: PaperAirplaneIcon,
    color: 'bg-yellow-500',
    description: 'Send bulk notifications',
  },
  {
    name: 'Search Users',
    href: '/admin/users',
    icon: MagnifyingGlassIcon,
    color: 'bg-pink-500',
    description: 'Find and manage users',
  },
];

export function QuickActions() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="group relative rounded-lg p-4 text-center hover:bg-gray-50 transition-colors"
          >
            <div>
              <span
                className={`${action.color} mx-auto flex h-12 w-12 items-center justify-center rounded-lg group-hover:scale-110 transition-transform`}
              >
                <action.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </span>
              <h3 className="mt-2 text-sm font-medium text-gray-900">{action.name}</h3>
              <p className="mt-1 text-xs text-gray-500 hidden lg:block">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}