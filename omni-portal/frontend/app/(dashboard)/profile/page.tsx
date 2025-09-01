'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit,
  Camera,
  Shield,
  Settings,
  Download
} from 'lucide-react';
import api from '@/services/api';
import type { ApiResponse, BeneficiaryInfo } from '@/types';
import { isApiSuccess } from '@/types';

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  cpf: string;
  birthDate: string;
  address?: string;
  profilePhoto?: string;
  registrationComplete: boolean;
  accountStatus: 'active' | 'inactive' | 'suspended';
  beneficiary?: BeneficiaryInfo;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response: ApiResponse<UserProfile> = await api.get('/profile');
      if (isApiSuccess(response)) {
        setProfile(response.data);
      } else {
        setError('Falha ao carregar perfil');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar perfil';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-red-600">{error || 'Perfil não encontrado'}</p>
          <Button onClick={fetchProfile} className="mt-4">
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="dashboard-title mb-3">Meu Perfil</h1>
          <p className="text-gray-600 text-lg">Gerencie suas informações pessoais e configurações</p>
        </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card-modern p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                  {profile.profilePhoto ? (
                    <Image 
                      src={profile.profilePhoto} 
                      alt="Foto do perfil"
                      width={96}
                      height={96}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <button 
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-1">
                {profile.name}
              </h2>
              <p className="text-gray-600 mb-4">{profile.email}</p>
              
              <div className="space-y-2 mb-4">
                <Badge 
                  variant={profile.registrationComplete ? "default" : "secondary"}
                  className="w-full justify-center"
                >
                  {profile.registrationComplete ? 'Cadastro Completo' : 'Cadastro Pendente'}
                </Badge>
                <Badge 
                  variant={profile.accountStatus === 'active' ? "default" : "secondary"}
                  className="w-full justify-center"
                >
                  {profile.accountStatus === 'active' ? 'Conta Ativa' : 
                   profile.accountStatus === 'inactive' ? 'Conta Inativa' : 'Conta Suspensa'}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Settings className="w-4 h-4 mr-2" />
                  Config
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Information Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="card-modern p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h3 className="section-title mb-4 flex items-center">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              Informações Pessoais
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                <p className="text-gray-900">{profile.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">CPF</label>
                <p className="text-gray-900">{formatCPF(profile.cpf)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Data de Nascimento</label>
                <p className="text-gray-900">{formatDate(profile.birthDate)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Telefone</label>
                <p className="text-gray-900">{profile.phone || 'Não informado'}</p>
              </div>
            </div>
            
            {profile.address && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-500">Endereço</label>
                <p className="text-gray-900">{profile.address}</p>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="card-modern p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 className="section-title mb-4 flex items-center">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mr-3">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              Informações de Contato
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{profile.email}</span>
                <Badge variant="outline" className="text-xs">Verificado</Badge>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{profile.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Work Information */}
          {profile.beneficiary && (
            <div className="card-modern p-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h3 className="section-title mb-4 flex items-center">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mr-3">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                Informações Profissionais
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Código do Funcionário</label>
                  <p className="text-gray-900">{profile.beneficiary.employee_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Data de Contratação</label>
                  <p className="text-gray-900">{profile.beneficiary.hiring_date ? formatDate(profile.beneficiary.hiring_date) : 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Departamento</label>
                  <p className="text-gray-900">{profile.beneficiary.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Cargo</label>
                  <p className="text-gray-900">{profile.beneficiary.role}</p>
                </div>
              </div>
            </div>
          )}

          {/* Account Security */}
          <div className="card-modern p-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <h3 className="section-title mb-4 flex items-center">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mr-3">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              Segurança da Conta
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Senha</p>
                  <p className="text-sm text-gray-500">Última alteração há 30 dias</p>
                </div>
                <Button variant="outline" size="sm">
                  Alterar
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Autenticação de Dois Fatores</p>
                  <p className="text-sm text-gray-500">Adicione uma camada extra de segurança</p>
                </div>
                <Button variant="outline" size="sm">
                  Configurar
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Exportar Dados</p>
                  <p className="text-sm text-gray-500">Baixe uma cópia dos seus dados (LGPD)</p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}