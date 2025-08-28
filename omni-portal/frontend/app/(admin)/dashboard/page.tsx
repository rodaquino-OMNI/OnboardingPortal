'use client';

import React, { Suspense } from 'react';
import { Card } from '@/components/ui/card';
import RoleBasedAccess, { usePermissions } from '@/components/admin/RoleBasedAccess';
import { RealTimeAlertsProvider, NotificationBadge, RealTimeStatus } from '@/components/admin/health-risks/RealTimeAlertsProvider';
import { EnhancedDashboardMetrics } from '@/components/admin/health-risks/EnhancedDashboardMetrics';
import { DataExportManager } from '@/components/admin/health-risks/DataExportManager';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  Shield,
  Settings,
  Download,
  Bell,
  BarChart3,
  Heart,
  FileText,
  Calendar
} from 'lucide-react';
import Link from 'next/link';

// Quick action cards
const QuickActionCard = ({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  color, 
  permission,
  badge 
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  permission?: string;
  badge?: React.ReactNode;
}) => {
  const { checkPermission } = usePermissions();
  
  if (permission && !checkPermission(permission)) {
    return null;
  }

  return (
    <Link href={href}>
      <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group relative">
        {badge && (
          <div className="absolute -top-2 -right-2">
            {badge}
          </div>
        )}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {description}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
};

// System status component
const SystemStatus = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Status do Sistema</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-green-600">Operacional</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">API de Alertas</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm">Online</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Base de Dados</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm">Conectado</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Notificações</span>
          <RealTimeStatus />
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Backups</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm">Atualizado</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Recent activity component
const RecentActivity = () => {
  const activities = [
    {
      id: 1,
      type: 'alert',
      description: 'Novo alerta de risco cardiovascular',
      user: 'Sistema',
      time: '2 minutos atrás',
      icon: Heart,
      color: 'text-red-600'
    },
    {
      id: 2,
      type: 'intervention',
      description: 'Intervenção registrada para paciente Maria Silva',
      user: 'Dr. João Santos',
      time: '15 minutos atrás',
      icon: Activity,
      color: 'text-blue-600'
    },
    {
      id: 3,
      type: 'export',
      description: 'Relatório de alertas exportado',
      user: 'Ana Costa',
      time: '1 hora atrás',
      icon: Download,
      color: 'text-green-600'
    },
    {
      id: 4,
      type: 'user',
      description: 'Novo usuário adicionado ao sistema',
      user: 'Admin',
      time: '2 horas atrás',
      icon: Users,
      color: 'text-purple-600'
    }
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`p-2 rounded-full bg-gray-100 ${activity.color}`}>
              <activity.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {activity.description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                por {activity.user} • {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

function AdminDashboardContent() {
  const { userRoles, hasPermission } = useRoleBasedAccess();
  const isHealthFocused = userRoles.some(role => 
    ['health-manager', 'medical-director', 'care-coordinator', 'nurse'].includes(role)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600 mt-2">
            Visão geral do sistema de monitoramento de saúde
          </p>
        </div>
        <div className="flex items-center gap-4">
          <RealTimeStatus />
          <RoleBasedAccess requiredPermissions={['send_notifications']}>
            <Button variant="outline" size="sm" className="relative">
              <Bell className="w-4 h-4 mr-2" />
              Notificações
              <NotificationBadge className="absolute" />
            </Button>
          </RoleBasedAccess>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickActionCard
          title="Central de Riscos"
          description="Monitor alertas de saúde em tempo real"
          icon={Heart}
          href="/admin/health-risks"
          color="bg-red-500"
          permission="view_health_risks"
          badge={<NotificationBadge />}
        />
        
        <RoleBasedAccess requiredPermissions={['manage_users']}>
          <QuickActionCard
            title="Gestão de Usuários"
            description="Administrar contas e permissões"
            icon={Users}
            href="/admin/users"
            color="bg-blue-500"
          />
        </RoleBasedAccess>

        <RoleBasedAccess requiredPermissions={['view_analytics']}>
          <QuickActionCard
            title="Analytics"
            description="Relatórios e insights detalhados"
            icon={BarChart3}
            href="/admin/analytics"
            color="bg-purple-500"
          />
        </RoleBasedAccess>

        <RoleBasedAccess requiredPermissions={['manage_system_settings']}>
          <QuickActionCard
            title="Configurações"
            description="Ajustar configurações do sistema"
            icon={Settings}
            href="/admin/settings"
            color="bg-gray-500"
          />
        </RoleBasedAccess>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue={isHealthFocused ? "health" : "overview"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="health">Saúde</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="exports">Exportações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Status */}
            <SystemStatus />
            
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <RecentActivity />
            </div>
          </div>

          {/* Quick Stats */}
          <RoleBasedAccess requiredPermissions={['view_analytics']}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total de Usuários</p>
                    <p className="text-2xl font-bold">1,247</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Alertas Ativos</p>
                    <p className="text-2xl font-bold">23</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Intervenções</p>
                    <p className="text-2xl font-bold">156</p>
                  </div>
                  <Activity className="w-8 h-8 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold">94%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </Card>
            </div>
          </RoleBasedAccess>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <RoleBasedAccess requiredPermissions={['view_health_risks']}>
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <EnhancedDashboardMetrics />
            </Suspense>
          </RoleBasedAccess>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <RoleBasedAccess requiredPermissions={['view_analytics']}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Analytics Avançado</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/admin/analytics/population">
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Saúde Populacional</h4>
                        <p className="text-sm text-gray-600">Insights demográficos</p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/admin/analytics/predictive">
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Análise Preditiva</h4>
                        <p className="text-sm text-gray-600">Previsão de riscos</p>
                      </div>
                    </div>
                  </Card>
                </Link>

                <Link href="/admin/analytics/financial">
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Impacto Financeiro</h4>
                        <p className="text-sm text-gray-600">ROI e custos</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            </Card>
          </RoleBasedAccess>
        </TabsContent>

        <TabsContent value="exports" className="space-y-6">
          <RoleBasedAccess requiredPermissions={['export_data']}>
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <DataExportManager />
            </Suspense>
          </RoleBasedAccess>
        </TabsContent>
      </Tabs>

      {/* Security and Compliance Notice */}
      <RoleBasedAccess requiredRoles={['super-admin', 'admin']}>
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Segurança e Conformidade</h4>
              <p className="text-sm text-blue-700">
                Sistema em conformidade com LGPD. Últimas auditorias de segurança: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </Card>
      </RoleBasedAccess>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RealTimeAlertsProvider>
      <AdminDashboardContent />
    </RealTimeAlertsProvider>
  );
}