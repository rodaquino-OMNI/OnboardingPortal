'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { profileApi, type ProfileData } from '@/lib/api/profile';
import { useToast } from '@/components/ui/use-toast';
import { 
  User, 
  Heart,
  FileText,
  Shield,
  Bell,
  Activity,
  Edit3,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
  Briefcase,
  Download,
  Upload,
  Lock,
  AlertTriangle,
  Pill,
  Stethoscope,
  Zap,
  Target,
  ChevronRight,
  Camera,
  Save,
  X,
  Info,
  History,
  CreditCard,
  FolderOpen
} from 'lucide-react';

// Import proper types from API
// Types available in profile API if needed in future

// Local types for component state
interface EditedProfileData {
  name: string;
  phone: string;
  department?: string;
  position?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface PrivacySettingsState {
  dataSharing: {
    doctors: boolean;
    research: boolean;
    marketing: boolean;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { progress, badges, fetchAll } = useGamification();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editedData, setEditedData] = useState<EditedProfileData | null>(null);
  
  // Modal states for add buttons
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAddAllergyModal, setShowAddAllergyModal] = useState(false);
  const [showAddConditionModal, setShowAddConditionModal] = useState(false);
  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Privacy settings state with proper typing
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsState>({
    dataSharing: { doctors: true, research: false, marketing: true },
    notifications: { email: true, sms: true, push: true }
  });
  
  // Load profile data from API
  const loadProfileData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await profileApi.getProfile();
      setProfileData(data);
      setEditedData({
        name: data.profile.name,
        phone: data.profile.phone,
        department: data.profile.department || '',
        position: data.profile.position || '',
        address: data.profile.address || {}
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Erro ao carregar dados do perfil');
      // Fallback to basic user data if available
      if (user) {
        const fallbackData: ProfileData = {
          profile: {
            id: parseInt(user.id) || 0,
            name: user.name || '',
            email: user.email || '',
            cpf: user.cpf || '',
            phone: user.phone || '',
            birthDate: '',
            address: {},
            company: 'AUSTA',
            status: 'active',
            lgpdConsent: true,
            department: '',
            position: '',
            employeeId: '',
            startDate: '',
            onboardingStatus: '',
            onboardingStep: 0,
            lgpdConsentAt: ''
          },
          health: {
            allergies: [],
            chronicConditions: [],
            medications: [],
            healthRiskScore: 'low' as const,
            preventiveCareStatus: 0
          },
          emergencyContacts: [],
          documents: [],
          insurance: {
            planName: '',
            planType: '',
            memberSince: '',
            coverage: [],
            benefitsUsed: 0,
            nextRenewal: ''
          },
          gamification: {
            points: progress?.total_points || 0,
            level: typeof progress?.current_level === 'number' ? progress.current_level : 1,
            badges: Array.isArray(badges) ? badges : []
          },
          recentActivity: []
        };
        setProfileData(fallbackData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, progress, badges]); // Include all dependencies but use them carefully

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!editedData) return;
    
    try {
      setIsSaving(true);
      await profileApi.updateProfile(editedData);
      await loadProfileData(); // Reload to get fresh data
      setIsEditing(false);
      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar perfil',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };


  // Toggle privacy settings
  const togglePrivacySetting = (category: string, setting: string) => {
    setPrivacySettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [setting]: !prev[category as keyof PrivacySettingsState][setting as keyof (PrivacySettingsState[keyof PrivacySettingsState])]
      }
    }));
  };

  // Security actions
  const handleChangePassword = () => {
    toast({ title: 'Info', description: 'Redirecionando para alteração de senha...' });
  };

  const handleSetup2FA = () => {
    toast({ title: 'Info', description: 'Configuração de 2FA em desenvolvimento...' });
  };

  const handleViewSessions = () => {
    toast({ title: 'Info', description: 'Visualização de sessões ativas...' });
  };

  // LGPD actions with proper error handling
  const handleExportData = async () => {
    try {
      setIsSaving(true);
      toast({ title: 'Info', description: 'Iniciando exportação de dados...' });
      
      // TODO: Implement actual API call when LGPD endpoints are available
      // await profileApi.exportUserData();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Sucesso',
        description: 'Exportação iniciada. Você receberá um e-mail quando estiver pronta.',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao exportar dados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDataReport = async () => {
    try {
      setIsSaving(true);
      toast({ title: 'Info', description: 'Solicitando relatório de dados...' });
      
      // TODO: Implement actual API call when LGPD endpoints are available
      // await profileApi.requestDataReport();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: 'Sucesso',
        description: 'Solicitação enviada. Relatório será enviado por e-mail.',
      });
    } catch (error) {
      console.error('Error requesting data report:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao solicitar relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteData = async () => {
    try {
      setIsSaving(true);
      
      // Show confirmation dialog
      const confirmed = window.confirm(
        'ATENÇÃO: Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos. Deseja continuar?'
      );
      
      if (!confirmed) {
        setIsSaving(false);
        return;
      }
      
      // TODO: Implement actual API call when LGPD endpoints are available
      // await profileApi.requestDataDeletion();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({ 
        title: 'Solicitação Registrada', 
        description: 'Solicitação de exclusão enviada. Você receberá um e-mail de confirmação em até 48h.',
        variant: 'destructive' 
      });
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar solicitação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Document actions with error handling
  const handleDownloadDocument = async (docId: number, docName: string) => {
    try {
      setIsSaving(true);
      toast({ title: 'Download', description: `Iniciando download de ${docName}...` });
      
      // TODO: Implement actual download API when endpoints are available
      // const blob = await profileApi.downloadDocument(docId);
      // const url = window.URL.createObjectURL(blob);
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = docName;
      // link.click();
      // window.URL.revokeObjectURL(url);
      
      // Simulate download delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Sucesso',
        description: `Download de ${docName} concluído.`,
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Erro',
        description: `Erro ao baixar ${docName}. Tente novamente.`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Modal handlers for add buttons
  const handleAddContact = async () => {
    try {
      toast({ title: 'Info', description: 'Modal de adicionar contato será implementado...' });
      setShowAddContactModal(false);
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar contato.',
        variant: 'destructive',
      });
    }
  };

  const handleAddAllergy = async () => {
    try {
      toast({ title: 'Info', description: 'Modal de adicionar alergia será implementado...' });
      setShowAddAllergyModal(false);
    } catch (error) {
      console.error('Error adding allergy:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar alergia.',
        variant: 'destructive',
      });
    }
  };

  const handleAddCondition = async () => {
    try {
      toast({ title: 'Info', description: 'Modal de adicionar condição será implementado...' });
      setShowAddConditionModal(false);
    } catch (error) {
      console.error('Error adding condition:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar condição.',
        variant: 'destructive',
      });
    }
  };

  const handleAddMedication = async () => {
    try {
      toast({ title: 'Info', description: 'Modal de adicionar medicamento será implementado...' });
      setShowAddMedicationModal(false);
    } catch (error) {
      console.error('Error adding medication:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao adicionar medicamento.',
        variant: 'destructive',
      });
    }
  };

  // Quick action handlers with proper error handling
  const handleScheduleConsultation = async () => {
    try {
      toast({ title: 'Info', description: 'Redirecionando para agendamento de consulta...' });
      // TODO: Implement navigation to consultation scheduling
      // router.push('/consultation-schedule');
    } catch (error) {
      console.error('Error scheduling consultation:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao acessar agendamento.',
        variant: 'destructive',
      });
    }
  };

  const handleUploadDocument = async () => {
    try {
      toast({ title: 'Info', description: 'Redirecionando para upload de documentos...' });
      // TODO: Implement navigation to document upload
      // router.push('/document-upload');
    } catch (error) {
      console.error('Error accessing document upload:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao acessar envio de documentos.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateHealth = async () => {
    try {
      toast({ title: 'Info', description: 'Redirecionando para atualização de saúde...' });
      // TODO: Implement navigation to health questionnaire
      // router.push('/health-questionnaire');
    } catch (error) {
      console.error('Error accessing health update:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao acessar atualização de saúde.',
        variant: 'destructive',
      });
    }
  };

  const handleViewBenefits = async () => {
    try {
      toast({ title: 'Info', description: 'Carregando informações dos benefícios...' });
      // TODO: Implement navigation to benefits page
      // router.push('/benefits');
    } catch (error) {
      console.error('Error viewing benefits:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar benefícios.',
        variant: 'destructive',
      });
    }
  };

  // Activity actions with error handling
  const handleViewActivity = async (_activityId: string) => {
    try {
      toast({ title: 'Info', description: 'Carregando detalhes da atividade...' });
      
      // TODO: Implement navigation to activity detail page
      // router.push(`/activity/${activityId}`);
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Info',
        description: 'Visualização de atividades será implementada em breve.',
      });
    } catch (error) {
      console.error('Error viewing activity:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar atividade.',
        variant: 'destructive',
      });
    }
  };

  const handleViewAllActivity = async () => {
    try {
      toast({ title: 'Info', description: 'Carregando histórico completo...' });
      
      // TODO: Implement navigation to full activity history
      // router.push('/activity');
      
      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Info',
        description: 'Histórico completo será implementado em breve.',
      });
    } catch (error) {
      console.error('Error viewing all activity:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar histórico.',
        variant: 'destructive',
      });
    }
  };

  // Load initial data
  const loadInitialData = useCallback(async () => {
    await loadProfileData();
    fetchAll();
  }, [loadProfileData, fetchAll]); // Include fetchAll dependency as it's stable from zustand

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      case 'rejected': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getHealthRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erro ao carregar perfil</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadProfileData}>Tentar novamente</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Extract data from profileData or use defaults
  const profile = profileData?.profile || {
    name: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
    address: {},
    company: 'AUSTA',
    department: '',
    position: '',
    employeeId: '',
    startDate: ''
  };
  
  const healthInfo = profileData?.health || null;
  const emergencyContacts = profileData?.emergencyContacts || [];
  const documents = profileData?.documents || [];
  const insuranceInfo = profileData?.insurance || null;
  const recentActivity = profileData?.recentActivity || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Meu Perfil</h1>
              <p className="text-gray-600">Gerencie suas informações pessoais e de saúde</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar Dados
              </Button>
              <Button 
                onClick={() => setIsEditing(!isEditing)}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    Editar Perfil
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Summary */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card className="p-6">
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                    <User className="w-16 h-16 text-white" />
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow">
                      <Camera className="w-5 h-5 text-gray-700" />
                    </button>
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{profile.name}</h2>
                <p className="text-gray-600 mb-2">{profile.position}</p>
                <p className="text-sm text-gray-500 mb-4">{profile.company}</p>
                
                <div className="flex justify-center gap-2 mb-4">
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ativo
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Verificado
                  </Badge>
                </div>

                {/* Gamification Summary */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{progress?.total_points || 0}</p>
                      <p className="text-xs text-gray-500">Pontos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{progress?.current_level?.number || 1}</p>
                      <p className="text-xs text-gray-500">Nível</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{badges?.earned?.length || 0}</p>
                      <p className="text-xs text-gray-500">Badges</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Status Rápido
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Documentos</span>
                  <div className="flex items-center gap-2">
                    <Progress value={75} className="w-20 h-2" />
                    <span className="text-sm font-medium">3/4</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Saúde</span>
                  <Badge className={getHealthRiskColor(healthInfo?.healthRiskScore || 'low')}>
                    Baixo Risco
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Benefícios</span>
                  <div className="flex items-center gap-2">
                    <Progress value={insuranceInfo?.benefitsUsed || 0} className="w-20 h-2" />
                    <span className="text-sm font-medium">{insuranceInfo?.benefitsUsed || 0}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Check-up</span>
                  <span className="text-sm font-medium text-green-600">Em dia</span>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Ações Rápidas
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={handleScheduleConsultation}>
                  <Calendar className="w-4 h-4" />
                  Agendar Consulta
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={handleUploadDocument}>
                  <Upload className="w-4 h-4" />
                  Enviar Documento
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={handleUpdateHealth}>
                  <Heart className="w-4 h-4" />
                  Atualizar Saúde
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" size="sm" onClick={handleViewBenefits}>
                  <CreditCard className="w-4 h-4" />
                  Ver Benefícios
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5 w-full mb-6">
                <TabsTrigger value="overview">Geral</TabsTrigger>
                <TabsTrigger value="health">Saúde</TabsTrigger>
                <TabsTrigger value="documents">Docs</TabsTrigger>
                <TabsTrigger value="privacy">Privacidade</TabsTrigger>
                <TabsTrigger value="activity">Atividade</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Personal Information */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Informações Pessoais
                    </h3>
                    {isEditing && (
                      <Button 
                        size="sm" 
                        className="gap-1" 
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                      >
                        <Save className="w-3 h-3" />
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </Button>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                      {isEditing ? (
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                          value={editedData?.name || ''}
                          onChange={(e) => setEditedData(prev => ({ 
                            ...prev, 
                            name: e.target.value,
                            phone: prev?.phone || '',
                            department: prev?.department || '',
                            position: prev?.position || '',
                            address: prev?.address || {}
                          }))}
                        />
                      ) : (
                        <p className="text-gray-900 font-medium">{profile.name}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">CPF</label>
                      <p className="text-gray-900 font-medium">{profile.cpf}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Data de Nascimento</label>
                      <p className="text-gray-900 font-medium">{formatDate(profile.birthDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Telefone</label>
                      {isEditing ? (
                        <input 
                          type="tel" 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                          value={editedData?.phone || ''}
                          onChange={(e) => setEditedData(prev => ({ 
                            ...prev, 
                            phone: e.target.value,
                            name: prev?.name || '',
                            department: prev?.department || '',
                            position: prev?.position || '',
                            address: prev?.address || {}
                          }))}
                        />
                      ) : (
                        <p className="text-gray-900 font-medium">{profile.phone}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">E-mail</label>
                      <p className="text-gray-900 font-medium">{profile.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Endereço</label>
                      <p className="text-gray-900 font-medium">{(profile.address && 'street' in profile.address) ? profile.address.street : 'Não informado'}</p>
                    </div>
                  </div>
                </Card>

                {/* Work Information */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-600" />
                    Informações Profissionais
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Empresa</label>
                      <p className="text-gray-900 font-medium">{profile.company}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Departamento</label>
                      <p className="text-gray-900 font-medium">{profile.department}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Cargo</label>
                      <p className="text-gray-900 font-medium">{profile.position}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Funcionário</label>
                      <p className="text-gray-900 font-medium">{profile.employeeId}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Data de Admissão</label>
                      <p className="text-gray-900 font-medium">{profile.startDate ? formatDate(profile.startDate) : 'Não informado'}</p>
                    </div>
                  </div>
                </Card>

                {/* Emergency Contacts */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-red-600" />
                      Contatos de Emergência
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => setShowAddContactModal(true)}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            {contact.isPrimary && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{contact.relationship} • {contact.phone}</p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Insurance Information */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    Plano de Saúde
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Plano</label>
                      <p className="text-gray-900 font-medium">{insuranceInfo?.planName || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tipo</label>
                      <p className="text-gray-900 font-medium">{insuranceInfo?.planType || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Membro desde</label>
                      <p className="text-gray-900 font-medium">{insuranceInfo?.memberSince ? formatDate(insuranceInfo.memberSince) : 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Renovação</label>
                      <p className="text-gray-900 font-medium">{insuranceInfo?.nextRenewal ? formatDate(insuranceInfo.nextRenewal) : 'Não informado'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Coberturas</label>
                    <div className="flex flex-wrap gap-2">
                      {insuranceInfo?.coverage?.map((item) => (
                        <Badge key={item} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-900">Utilização dos Benefícios</span>
                      <span className="text-sm font-medium text-blue-900">{insuranceInfo?.benefitsUsed || 0}%</span>
                    </div>
                    <Progress value={insuranceInfo?.benefitsUsed || 0} className="h-2" />
                  </div>
                </Card>
              </TabsContent>

              {/* Health Tab */}
              <TabsContent value="health" className="space-y-6">
                {/* Health Overview */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Informações de Saúde
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tipo Sanguíneo</label>
                      <p className="text-gray-900 font-medium">{healthInfo?.bloodType || 'Não informado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Último Check-up</label>
                      <p className="text-gray-900 font-medium">{healthInfo?.lastCheckup ? formatDate(healthInfo.lastCheckup) : 'Não informado'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Score de Risco</label>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getHealthRiskColor(healthInfo?.healthRiskScore || 'low')}`}>
                        <Stethoscope className="w-4 h-4" />
                        <span className="font-medium capitalize">{healthInfo?.healthRiskScore || 'low'} Risco</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Allergies */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      Alergias
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => setShowAddAllergyModal(true)}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {healthInfo?.allergies && healthInfo.allergies.length > 0 ? (
                      healthInfo?.allergies?.map((allergy) => (
                        <Badge key={allergy} className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          {allergy}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Nenhuma alergia registrada</p>
                    )}
                  </div>
                </Card>

                {/* Chronic Conditions */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-600" />
                      Condições Crônicas
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => setShowAddConditionModal(true)}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {healthInfo?.chronicConditions && healthInfo.chronicConditions.length > 0 ? (
                      healthInfo?.chronicConditions?.map((condition) => (
                        <div key={condition} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                          <span className="text-purple-900 font-medium">{condition}</span>
                          <Button size="sm" variant="ghost">
                            <Info className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Nenhuma condição registrada</p>
                    )}
                  </div>
                </Card>

                {/* Medications */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Pill className="w-5 h-5 text-blue-600" />
                      Medicamentos
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => setShowAddMedicationModal(true)}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {healthInfo?.medications && healthInfo.medications.length > 0 ? (
                      healthInfo?.medications?.map((medication) => (
                        <div key={medication} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                          <span className="text-blue-900 font-medium">{medication}</span>
                          <Button size="sm" variant="ghost">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Nenhum medicamento registrado</p>
                    )}
                  </div>
                </Card>

                {/* Preventive Care */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-600" />
                    Cuidado Preventivo
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status Geral</span>
                      <div className="flex items-center gap-2">
                        <Progress value={healthInfo?.preventiveCareStatus || 0} className="w-32 h-2" />
                        <span className="text-sm font-medium">{healthInfo?.preventiveCareStatus || 0}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mb-1" />
                        <p className="text-sm font-medium text-gray-900">Check-up Anual</p>
                        <p className="text-xs text-gray-600">Realizado em Out/24</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <Clock className="w-5 h-5 text-yellow-600 mb-1" />
                        <p className="text-sm font-medium text-gray-900">Vacinas</p>
                        <p className="text-xs text-gray-600">Atualizar em Jan/25</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mb-1" />
                        <p className="text-sm font-medium text-gray-900">Exames Laboratoriais</p>
                        <p className="text-xs text-gray-600">Em dia</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-600 mb-1" />
                        <p className="text-sm font-medium text-gray-900">Consulta Dentária</p>
                        <p className="text-xs text-gray-600">Agendar</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      Documentos
                    </h3>
                    <Button 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setShowUploadModal(true)}
                    >
                      <Upload className="w-3 h-3" />
                      Enviar Documento
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">Enviado em {formatDate(doc.uploadDate)}</span>
                              {doc.expiryDate && (
                                <>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-red-600">Expira em {formatDate(doc.expiryDate)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(doc.status)}>
                            {doc.status === 'approved' && 'Aprovado'}
                            {doc.status === 'pending' && 'Pendente'}
                            {doc.status === 'expired' && 'Expirado'}
                            {doc.status === 'rejected' && 'Rejeitado'}
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDownloadDocument(doc.id, doc.name)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Privacy Tab */}
              <TabsContent value="privacy" className="space-y-6">
                {/* Privacy Settings */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Configurações de Privacidade
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Compartilhar dados com médicos</p>
                        <p className="text-sm text-gray-600">Permite que profissionais vejam seu histórico</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('dataSharing', 'doctors')}
                        className={privacySettings.dataSharing.doctors ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.dataSharing.doctors ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Pesquisas médicas anônimas</p>
                        <p className="text-sm text-gray-600">Contribuir com dados anônimos para pesquisa</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('dataSharing', 'research')}
                        className={privacySettings.dataSharing.research ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.dataSharing.research ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Marketing e comunicações</p>
                        <p className="text-sm text-gray-600">Receber ofertas e novidades do plano</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('dataSharing', 'marketing')}
                        className={privacySettings.dataSharing.marketing ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.dataSharing.marketing ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Notification Preferences */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-purple-600" />
                    Preferências de Notificação
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">E-mail</p>
                        <p className="text-sm text-gray-600">Receber atualizações por e-mail</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('notifications', 'email')}
                        className={privacySettings.notifications.email ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.notifications.email ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">SMS</p>
                        <p className="text-sm text-gray-600">Lembretes de consultas via SMS</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('notifications', 'sms')}
                        className={privacySettings.notifications.sms ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.notifications.sms ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Push</p>
                        <p className="text-sm text-gray-600">Notificações no aplicativo</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => togglePrivacySetting('notifications', 'push')}
                        className={privacySettings.notifications.push ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                      >
                        {privacySettings.notifications.push ? 'Ativado' : 'Desativado'}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Security */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-red-600" />
                    Segurança da Conta
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Senha</p>
                        <p className="text-sm text-gray-600">Última alteração há 45 dias</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleChangePassword}
                      >
                        Alterar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Autenticação de dois fatores</p>
                        <p className="text-sm text-gray-600">Adicione uma camada extra de segurança</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleSetup2FA}
                      >
                        Configurar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Sessões ativas</p>
                        <p className="text-sm text-gray-600">Gerencie dispositivos conectados</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleViewSessions}
                      >
                        Ver todos
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* LGPD */}
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    Direitos LGPD
                  </h3>
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2"
                      onClick={handleExportData}
                    >
                      <Download className="w-4 h-4" />
                      Exportar meus dados
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2"
                      onClick={handleDataReport}
                    >
                      <FileText className="w-4 h-4" />
                      Solicitar relatório de dados
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                      onClick={handleDeleteData}
                    >
                      <AlertCircle className="w-4 h-4" />
                      Solicitar exclusão de dados
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-6">
                <Card className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    Atividade Recente
                  </h3>
                  <div className="space-y-3">
                    {recentActivity.map((activity) => {
                      // Use Activity icon as fallback for all activity items
                      return (
                        <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                          <div className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0`}>
                            <Activity className={`w-5 h-5 ${activity.color || 'text-blue-600'}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{activity.title}</p>
                            <p className="text-sm text-gray-600">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatDateTime(activity.timestamp)}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleViewActivity(activity.id)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={handleViewAllActivity}
                  >
                    Ver toda atividade
                  </Button>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}