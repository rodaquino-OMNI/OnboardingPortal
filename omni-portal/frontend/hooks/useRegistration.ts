'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService, { 
  RegisterStep1Data, 
  RegisterStep2Data, 
  RegisterStep3Data,
  RegisterStep1Response,
  RegisterStep2Response,
  RegisterStep3Response,
  RegistrationProgressResponse
} from '@/services/api';

interface RegistrationState {
  // State
  currentStep: string;
  isLoading: boolean;
  error: string | null;
  registrationToken: string | null;
  userId: string | null;
  progress: RegistrationProgressResponse | null;
  
  // Step 1 data
  step1Data: Partial<RegisterStep1Data>;
  
  // Step 2 data
  step2Data: Partial<RegisterStep2Data>;
  
  // Step 3 data
  step3Data: Partial<RegisterStep3Data>;
  
  // Actions
  setStep1Data: (data: Partial<RegisterStep1Data>) => void;
  setStep2Data: (data: Partial<RegisterStep2Data>) => void;
  setStep3Data: (data: Partial<RegisterStep3Data>) => void;
  
  submitStep1: (data: RegisterStep1Data) => Promise<RegisterStep1Response>;
  submitStep2: (data: RegisterStep2Data) => Promise<RegisterStep2Response>;
  submitStep3: (data: RegisterStep3Data) => Promise<RegisterStep3Response>;
  
  getProgress: () => Promise<RegistrationProgressResponse>;
  cancelRegistration: () => Promise<void>;
  
  clearError: () => void;
  reset: () => void;
}

export const useRegistration = create<RegistrationState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 'personal',
      isLoading: false,
      error: null,
      registrationToken: null,
      userId: null,
      progress: null,
      
      step1Data: {},
      step2Data: {},
      step3Data: {},
      
      // Actions
      setStep1Data: (data) => {
        set(state => ({
          step1Data: { ...state.step1Data, ...data }
        }));
      },
      
      setStep2Data: (data) => {
        set(state => ({
          step2Data: { ...state.step2Data, ...data }
        }));
      },
      
      setStep3Data: (data) => {
        set(state => ({
          step3Data: { ...state.step3Data, ...data }
        }));
      },
      
      submitStep1: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.registerStep1(data);
          
          if (response.success && response.data) {
            // Store registration token for next steps
            apiService.setAuth(response.data.token);
            
            set({
              currentStep: response.data.registration_step,
              registrationToken: response.data.token,
              userId: response.data.user_id,
              step1Data: data,
              isLoading: false
            });
            
            return response.data;
          } else {
            throw new Error(response.error?.message || 'Erro ao processar registro');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 
                             error.message || 
                             'Erro ao processar registro';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      submitStep2: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.registerStep2(data);
          
          if (response.success && response.data) {
            set({
              currentStep: response.data.registration_step,
              step2Data: data,
              isLoading: false
            });
            
            return response.data;
          } else {
            throw new Error(response.error?.message || 'Erro ao atualizar informações');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 
                             error.message || 
                             'Erro ao atualizar informações';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      submitStep3: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.registerStep3(data);
          
          if (response.success && response.data) {
            // Registration completed, set new auth token
            apiService.setAuth(response.data.token);
            
            set({
              currentStep: 'completed',
              step3Data: data,
              isLoading: false
            });
            
            return response.data;
          } else {
            throw new Error(response.error?.message || 'Erro ao finalizar registro');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 
                             error.message || 
                             'Erro ao finalizar registro';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      getProgress: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.getRegistrationProgress();
          
          if (response.success && response.data) {
            set({
              progress: response.data,
              currentStep: response.data.current_step,
              isLoading: false
            });
            
            return response.data;
          } else {
            throw new Error(response.error?.message || 'Erro ao obter progresso');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 
                             error.message || 
                             'Erro ao obter progresso';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      cancelRegistration: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.cancelRegistration();
          
          if (response.success) {
            // Clear all data
            apiService.clearAuth();
            get().reset();
          } else {
            throw new Error(response.error?.message || 'Erro ao cancelar registro');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 
                             error.message || 
                             'Erro ao cancelar registro';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },
      
      clearError: () => set({ error: null }),
      
      reset: () => set({
        currentStep: 'personal',
        isLoading: false,
        error: null,
        registrationToken: null,
        userId: null,
        progress: null,
        step1Data: {},
        step2Data: {},
        step3Data: {}
      })
    }),
    {
      name: 'registration-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        registrationToken: state.registrationToken,
        userId: state.userId,
        step1Data: state.step1Data,
        step2Data: state.step2Data,
        step3Data: state.step3Data
      })
    }
  )
);

// Helper hooks for specific steps
export const useStep1 = () => {
  const { 
    step1Data, 
    setStep1Data, 
    submitStep1, 
    isLoading, 
    error, 
    clearError 
  } = useRegistration();
  
  return {
    data: step1Data,
    setData: setStep1Data,
    submit: submitStep1,
    isLoading,
    error,
    clearError
  };
};

export const useStep2 = () => {
  const { 
    step2Data, 
    setStep2Data, 
    submitStep2, 
    isLoading, 
    error, 
    clearError 
  } = useRegistration();
  
  return {
    data: step2Data,
    setData: setStep2Data,
    submit: submitStep2,
    isLoading,
    error,
    clearError
  };
};

export const useStep3 = () => {
  const { 
    step3Data, 
    setStep3Data, 
    submitStep3, 
    isLoading, 
    error, 
    clearError 
  } = useRegistration();
  
  return {
    data: step3Data,
    setData: setStep3Data,
    submit: submitStep3,
    isLoading,
    error,
    clearError
  };
};