import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { jest } from '@jest/globals';

// Common mock implementations
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

export const mockUseAuth = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
  addPoints: jest.fn(),
  socialLogin: jest.fn(),
};

export const mockUseGamification = {
  points: 0,
  level: 1,
  badges: [],
  achievements: [],
  leaderboardPosition: null,
  notifications: [],
  addPoints: jest.fn(),
  unlockBadge: jest.fn(),
  unlockAchievement: jest.fn(),
  getLeaderboard: jest.fn(),
  getProgressToNextLevel: jest.fn(),
  getStreak: jest.fn(),
  dismissNotification: jest.fn(),
  getActiveChallenges: jest.fn(),
  completeChallenge: jest.fn(),
};

export const mockUseLGPD = {
  privacySettings: null,
  consentHistory: [],
  dataProcessingActivities: null,
  isLoading: false,
  error: null,
  fetchPrivacySettings: jest.fn(),
  updatePrivacySettings: jest.fn(),
  fetchConsentHistory: jest.fn(),
  fetchDataProcessingActivities: jest.fn(),
  exportUserData: jest.fn(),
  exportUserDataPdf: jest.fn(),
  withdrawConsent: jest.fn(),
  deleteAccount: jest.fn(),
  clearError: jest.fn(),
  getConsentTypesFromSettings: jest.fn(),
  getPrivacyCompliance: jest.fn(),
  getDataRetentionInfo: jest.fn(),
};

export const mockApiService = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};

// Mock implementations for lib functions
export const mockHealthQuestionnaireLib = {
  HEALTH_QUESTIONNAIRE_SECTIONS: [
    {
      id: 'basic_info',
      title: 'Informações Básicas',
      questions: [
        {
          id: 'age',
          text: 'Qual é sua idade?',
          type: 'number',
          required: true,
          validation: { min: 1, max: 120 }
        }
      ]
    }
  ],
  calculateRiskScore: jest.fn(() => ({
    overall: 0,
    categories: {},
    flags: [],
    recommendations: []
  })),
  detectFraudIndicators: jest.fn(() => ({
    inconsistencyScore: 0,
    flags: [],
    validationPairs: {},
    speedPatterns: { tooFast: false, tooSlow: false },
    responsePatterns: { allPositive: false, allNegative: false }
  })),
  calculateHealthScore: jest.fn(() => ({
    overall: 85,
    categories: {
      physical: 80,
      mental: 90,
      lifestyle: 85
    },
    riskFactors: [],
    strengths: ['Good mental health', 'Active lifestyle']
  }))
};

export const mockOcrService = {
  ocrService: {
    processDocument: jest.fn(() => Promise.resolve({
      text: 'Sample OCR text',
      confidence: 0.95,
      fields: {
        name: 'João Silva',
        document_number: '12.345.678-9'
      }
    }))
  }
};

export const mockImageOptimizer = {
  compressImage: jest.fn((file) => Promise.resolve(file)),
  validateImageQuality: jest.fn(() => ({
    isValid: true,
    issues: [],
    quality: 0.9
  }))
};

// Enhanced render function with common providers
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withAuth?: boolean;
  withRouter?: boolean;
  initialState?: any;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { withAuth, withRouter, initialState, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    // Add providers here as needed
    return <>{children}</>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Helper to create mock files for testing
export function createMockFile(name: string, size: number, type: string): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper to wait for async operations in tests
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Jest setup helpers
export function setupCommonMocks() {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Setup console spy to avoid noise in tests
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  
  return {
    consoleSpy,
    consoleWarnSpy,
    cleanup: () => {
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  };
}

// Error boundary mock for testing
export const MockErrorBoundary = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// Common test data
export const mockUserData = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export const mockDocumentTypes = [
  { id: 'rg', name: 'RG', required: true, type: 'identity' },
  { id: 'cpf', name: 'CPF', required: true, type: 'identity' },
  { id: 'proof_of_residence', name: 'Comprovante de Residência', required: true, type: 'address' }
];

// Export everything for easy access
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';