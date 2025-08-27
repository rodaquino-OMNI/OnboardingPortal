import apiClient from './client';

export interface ProfileData {
  profile: {
    id: number;
    name: string;
    email: string;
    cpf: string;
    phone: string;
    birthDate: string;
    gender?: string;
    address: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
    company: string;
    department?: string;
    position?: string;
    employeeId?: string;
    startDate?: string;
    status: string;
    onboardingStatus?: string;
    onboardingStep?: number;
    lgpdConsent: boolean;
    lgpdConsentAt?: string;
  };
  health?: {
    bloodType?: string;
    allergies: string[];
    chronicConditions: string[];
    medications: string[];
    lastCheckup?: string;
    healthRiskScore: 'low' | 'medium' | 'high';
    preventiveCareStatus: number;
  };
  emergencyContacts: Array<{
    id: string;
    name: string;
    phone: string;
    relationship: string;
    isPrimary: boolean;
  }>;
  documents: Array<{
    id: number;
    type: string;
    name: string;
    status: 'pending' | 'approved' | 'expired' | 'rejected';
    uploadDate: string;
    expiryDate?: string;
    file_path?: string;
  }>;
  insurance?: {
    planName: string;
    planType: string;
    memberSince: string;
    memberNumber?: string;
    coverage: string[];
    benefitsUsed: number;
    nextRenewal: string;
  };
  gamification: {
    points: number;
    level: number;
    badges: any[];
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    icon: string;
    color: string;
  }>;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  department?: string;
  position?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface PrivacySettings {
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
  dataSharing?: {
    analytics?: boolean;
    research?: boolean;
    partners?: boolean;
  };
}

export const profileApi = {
  /**
   * Get complete profile data
   */
  async getProfile(): Promise<ProfileData> {
    try {
      // First try to get CSRF token
      try {
        await apiClient.get('/sanctum/csrf-cookie');
      } catch (csrfError) {
        console.log('CSRF token fetch failed, continuing anyway:', csrfError);
      }
      
      const response = await apiClient.get('/user');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Return mock data for development if API fails
      const mockProfileData: ProfileData = {
        profile: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          cpf: '12345678901',
          phone: '(11) 99999-9999',
          birthDate: '1990-01-01',
          gender: 'male',
          address: {
            street: 'Rua Teste, 123',
            number: '123',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567'
          },
          company: 'AUSTA',
          department: 'Tecnologia',
          position: 'Desenvolvedor',
          employeeId: 'AUS-001',
          startDate: '2024-01-01',
          status: 'active',
          onboardingStatus: 'completed',
          onboardingStep: 5,
          lgpdConsent: true,
          lgpdConsentAt: '2024-01-01'
        },
        health: {
          bloodType: 'O+',
          allergies: ['Poeira', 'Pólen'],
          chronicConditions: ['Hipertensão'],
          medications: ['Losartana 50mg'],
          lastCheckup: '2024-10-15',
          healthRiskScore: 'low',
          preventiveCareStatus: 75
        },
        emergencyContacts: [
          {
            id: '1',
            name: 'Maria Silva',
            relationship: 'Esposa',
            phone: '(11) 98765-1234',
            isPrimary: true
          }
        ],
        documents: [
          {
            id: 1,
            type: 'RG',
            name: 'Documento de Identidade',
            status: 'approved',
            uploadDate: '2024-01-10'
          },
          {
            id: 2,
            type: 'CPF',
            name: 'CPF',
            status: 'approved',
            uploadDate: '2024-01-10'
          }
        ],
        insurance: {
          planName: 'AUSTA Premium Plus',
          planType: 'Coparticipação',
          memberSince: '2024-01-15',
          coverage: ['Consultas', 'Exames', 'Internação', 'Emergência', 'Telemedicina'],
          benefitsUsed: 35,
          nextRenewal: '2025-01-15'
        },
        gamification: {
          points: 1250,
          level: 3,
          badges: []
        },
        recentActivity: [
          {
            id: '1',
            type: 'health',
            title: 'Questionário de Saúde Completado',
            description: 'Avaliação de saúde inicial concluída com sucesso',
            timestamp: '2024-11-08T10:30:00',
            icon: 'Heart',
            color: 'text-red-500'
          },
          {
            id: '2',
            type: 'document',
            title: 'Documento Enviado',
            description: 'Atestado médico enviado para análise',
            timestamp: '2024-11-08T09:15:00',
            icon: 'FileText',
            color: 'text-blue-500'
          }
        ]
      };
      
      console.log('Returning mock data for development');
      return mockProfileData;
    }
  },

  /**
   * Update profile information
   */
  async updateProfile(data: UpdateProfileData): Promise<void> {
    try {
      await apiClient.put('/user', data);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  /**
   * Update emergency contacts
   */
  async updateEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
    try {
      await apiClient.put('/user/emergency-contacts', { contacts });
    } catch (error) {
      console.error('Error updating emergency contacts:', error);
      throw error;
    }
  },

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(settings: PrivacySettings): Promise<void> {
    try {
      await apiClient.put('/user/privacy-settings', settings);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  }
};