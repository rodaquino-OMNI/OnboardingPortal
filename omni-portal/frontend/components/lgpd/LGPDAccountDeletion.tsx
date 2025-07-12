'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useLGPD } from '@/hooks/useLGPD';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { 
  Trash2, 
  AlertTriangle, 
  Shield, 
  Info, 
  CheckCircle, 
  XCircle,
  Eye,
  EyeOff,
  Clock,
  Database,
  FileText,
  Users,
  Activity
} from 'lucide-react';

export function LGPDAccountDeletion() {
  const { deleteAccount, isLoading } = useLGPD();
  const { logout } = useAuth();
  const router = useRouter();
  
  const [step, setStep] = useState<'warning' | 'confirmation' | 'deletion'>('warning');
  const [formData, setFormData] = useState({
    password: '',
    confirmation: '',
    reason: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [deletionResult, setDeletionResult] = useState<{
    message: string;
    deleted_at: string;
    data_removed: Record<string, string>;
  } | null>(null);
  const [error, setError] = useState<string>('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleDeleteAccount = async () => {
    try {
      setError('');
      
      // Validation
      if (!formData.password) {
        setError('Senha é obrigatória');
        return;
      }
      
      if (formData.confirmation !== 'DELETE_MY_ACCOUNT') {
        setError('Confirmação incorreta. Digite exatamente "DELETE_MY_ACCOUNT"');
        return;
      }
      
      setStep('deletion');
      
      const result = await deleteAccount(
        formData.password,
        formData.confirmation,
        formData.reason
      );
      
      setDeletionResult(result);
      
      // Auto logout after 3 seconds
      setTimeout(() => {
        logout();
        router.push('/auth/login');
      }, 3000);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setStep('confirmation');
    }
  };

  const dataToBeDeleted = [
    {
      category: 'Perfil Pessoal',
      icon: Users,
      items: [
        'Informações básicas (nome, email, CPF)',
        'Dados de contato (telefone, endereço)',
        'Informações profissionais (cargo, departamento)',
        'Preferências do sistema'
      ]
    },
    {
      category: 'Documentos',
      icon: FileText,
      items: [
        'Documentos enviados',
        'Histórico de uploads',
        'Metadados de arquivos',
        'Assinaturas digitais'
      ]
    },
    {
      category: 'Dados de Saúde',
      icon: Shield,
      items: [
        'Questionários de saúde',
        'Respostas médicas',
        'Histórico de avaliações',
        'Dados sensíveis relacionados'
      ]
    },
    {
      category: 'Atividades',
      icon: Activity,
      items: [
        'Logs de acesso',
        'Histórico de navegação',
        'Interações no sistema',
        'Progresso de gamificação'
      ]
    }
  ];

  const consequences = [
    {
      icon: XCircle,
      title: 'Perda de Acesso',
      description: 'Você perderá acesso permanente à sua conta e não poderá fazer login',
      severity: 'high'
    },
    {
      icon: Database,
      title: 'Exclusão de Dados',
      description: 'Todos os seus dados pessoais serão permanentemente removidos',
      severity: 'high'
    },
    {
      icon: FileText,
      title: 'Documentos Perdidos',
      description: 'Todos os documentos enviados serão excluídos e não podem ser recuperados',
      severity: 'medium'
    },
    {
      icon: Users,
      title: 'Histórico Apagado',
      description: 'Seu histórico de atividades e progresso será completamente removido',
      severity: 'medium'
    },
    {
      icon: Clock,
      title: 'Processo Irreversível',
      description: 'Esta ação não pode ser desfeita e uma nova conta precisará ser criada',
      severity: 'high'
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  if (step === 'deletion') {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <div className="space-y-4">
            {deletionResult ? (
              <>
                <div className="p-4 bg-green-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-900">
                  Conta Excluída com Sucesso
                </h3>
                <p className="text-green-700">
                  Sua conta foi excluída permanentemente em {new Date(deletionResult.deleted_at).toLocaleString('pt-BR')}
                </p>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Dados Removidos:</h4>
                  <div className="text-sm space-y-1">
                    {Object.entries(deletionResult.data_removed).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace('_', ' ')}:</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Você será redirecionado para a página de login em alguns segundos...
                </p>
              </>
            ) : (
              <>
                <div className="p-4 bg-blue-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                  <Clock className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold">Processando Exclusão</h3>
                <p className="text-gray-600">
                  Estamos processando a exclusão da sua conta. Isso pode levar alguns momentos...
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Header */}
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-red-900">Exclusão de Conta</h3>
            <p className="text-red-700 mt-1">
              Esta ação é permanente e irreversível. Todos os seus dados serão 
              completamente removidos de nossos sistemas.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowInfoModal(true)}
            className="flex items-center space-x-2"
          >
            <Info className="w-4 h-4" />
            <span>Mais Informações</span>
          </Button>
        </div>
      </Card>

      {step === 'warning' && (
        <>
          {/* Consequences */}
          <Card className="p-6">
            <h4 className="font-semibold text-lg mb-4">Consequências da Exclusão</h4>
            <div className="space-y-4">
              {consequences.map((consequence, index) => {
                const Icon = consequence.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${getSeverityColor(consequence.severity)}`} />
                    <div>
                      <h5 className="font-medium">{consequence.title}</h5>
                      <p className="text-sm text-gray-600">{consequence.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Data to be Deleted */}
          <Card className="p-6">
            <h4 className="font-semibold text-lg mb-4">Dados que Serão Excluídos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataToBeDeleted.map((category, index) => {
                const Icon = category.icon;
                return (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      <Icon className="w-5 h-5 text-gray-600" />
                      <h5 className="font-medium">{category.category}</h5>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {category.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start space-x-2">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Alternatives */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-lg mb-4">Considere Outras Opções</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium">Desativar Conta Temporariamente</h5>
                  <p className="text-sm text-gray-600">
                    Você pode desativar sua conta e reativá-la posteriormente
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium">Ajustar Configurações de Privacidade</h5>
                  <p className="text-sm text-gray-600">
                    Modifique suas configurações para maior privacidade
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h5 className="font-medium">Exportar Dados Primeiro</h5>
                  <p className="text-sm text-gray-600">
                    Faça backup dos seus dados antes de excluir a conta
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Proceed Button */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Prosseguir com a Exclusão</h4>
                <p className="text-sm text-gray-600">
                  Apenas prossiga se você tem certeza absoluta desta decisão
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setStep('confirmation')}
                className="flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Prosseguir</span>
              </Button>
            </div>
          </Card>
        </>
      )}

      {step === 'confirmation' && (
        <>
          {/* Confirmation Form */}
          <Card className="p-6">
            <h4 className="font-semibold text-lg mb-4">Confirmação Final</h4>
            
            {error && (
              <Alert variant="error" className="mb-4">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </Alert>
            )}
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="password">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmation">
                  Confirmação
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="confirmation"
                  type="text"
                  value={formData.confirmation}
                  onChange={(e) => handleInputChange('confirmation', e.target.value)}
                  placeholder="Digite: DELETE_MY_ACCOUNT"
                  className="font-mono"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Digite exatamente: <code className="bg-gray-100 px-1 rounded">DELETE_MY_ACCOUNT</code>
                </p>
              </div>
              
              <div>
                <Label htmlFor="reason">Motivo da Exclusão (Opcional)</Label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Nos ajude a melhorar: por que você está excluindo sua conta?"
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setStep('warning')}
                disabled={isLoading}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isLoading || !formData.password || formData.confirmation !== 'DELETE_MY_ACCOUNT'}
                className="flex items-center space-x-2"
              >
                {isLoading ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Excluir Conta Permanentemente</span>
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* Information Modal */}
      <Modal
        open={showInfoModal}
        onOpenChange={(open) => setShowInfoModal(open)}
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Direito ao Esquecimento</h4>
            <p className="text-gray-600">
              De acordo com a LGPD, você tem o direito de solicitar a exclusão dos seus 
              dados pessoais quando não há mais necessidade para o tratamento.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Processo de Exclusão</h4>
            <ul className="text-gray-600 space-y-1">
              <li>• A exclusão é processada imediatamente</li>
              <li>• Dados são removidos de todos os sistemas</li>
              <li>• Backups são anonimizados ou excluídos</li>
              <li>• Logs de auditoria são mantidos conforme exigido por lei</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Dados Mantidos</h4>
            <p className="text-gray-600">
              Alguns dados podem ser mantidos por obrigação legal ou regulatória, 
              mas serão anonimizados quando possível.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Suporte</h4>
            <p className="text-gray-600">
              Se você tem dúvidas sobre a exclusão, entre em contato com nosso 
              Encarregado de Proteção de Dados antes de prosseguir.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}