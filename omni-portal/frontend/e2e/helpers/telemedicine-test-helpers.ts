/**
 * 🧠 ULTRA-THINK TEST HELPERS
 * Telemedicine E2E Test Utilities - Technical Excellence Implementation
 * 
 * This module provides reusable utilities for telemedicine E2E testing
 * with comprehensive error handling, performance monitoring, and data management.
 */

import { Page, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// ==========================================
// 🎯 TYPE DEFINITIONS - TECHNICAL EXCELLENCE
// ==========================================

export interface TestUser {
  id: number;
  email: string;
  password: string;
  fullName: string;
  isEligible: boolean;
  points: number;
  completionPercentage: number;
}

export interface AppointmentType {
  id: number;
  name: string;
  slug: string;
  description: string;
  duration_minutes: number;
  formatted_price: string;
  preparation_checklist: string[];
  gamification: {
    points_for_booking: number;
    points_for_completion: number;
    points_for_preparation: number;
    bonus_for_punctuality: number;
  };
}

export interface TimeSlot {
  id: number;
  date: string;
  start_time: string;
  display_time: string;
  display_date: string;
  display_datetime: string;
  professional: {
    id: number;
    name: string;
    specialization: string;
    rating: number;
  };
  gamification_preview: {
    points_for_booking: number;
    bonus_available?: string;
  };
}

export interface PerformanceMetrics {
  stepName: string;
  duration: number;
  timestamp: number;
}

// ==========================================
// 🏭 DATA FACTORIES - ULTRA-THINK PATTERN
// ==========================================

export class TestDataFactory {
  /**
   * Creates a test user with configurable eligibility status
   */
  static createUser(eligibilityStatus: 'eligible' | 'ineligible' = 'eligible'): TestUser {
    return {
      id: faker.number.int({ min: 1000, max: 9999 }),
      email: faker.internet.email(),
      password: 'SecureTestPass123!@#',
      fullName: faker.person.fullName(),
      isEligible: eligibilityStatus === 'eligible',
      points: eligibilityStatus === 'eligible' ? faker.number.int({ min: 500, max: 1000 }) : faker.number.int({ min: 100, max: 499 }),
      completionPercentage: eligibilityStatus === 'eligible' ? 100 : faker.number.int({ min: 50, max: 99 })
    };
  }

  /**
   * Creates realistic appointment types with proper gamification
   */
  static createAppointmentTypes(): AppointmentType[] {
    return [
      {
        id: 1,
        name: 'Consulta Inicial de Telemedicina',
        slug: 'initial-consultation',
        description: 'Primeira consulta com nosso concierge de saúde especializado',
        duration_minutes: 45,
        formatted_price: 'Gratuito',
        preparation_checklist: [
          'Tenha seus documentos de saúde em mãos',
          'Teste sua câmera e microfone',
          'Encontre um ambiente silencioso',
          'Prepare lista de medicamentos atuais'
        ],
        gamification: {
          points_for_booking: 300,
          points_for_completion: 500,
          points_for_preparation: 100,
          bonus_for_punctuality: 50
        }
      },
      {
        id: 2,
        name: 'Consulta de Acompanhamento',
        slug: 'follow-up',
        description: 'Consulta de acompanhamento para revisão de resultados',
        duration_minutes: 30,
        formatted_price: 'Gratuito',
        preparation_checklist: [
          'Tenha seus exames recentes disponíveis',
          'Anote suas dúvidas principais'
        ],
        gamification: {
          points_for_booking: 200,
          points_for_completion: 350,
          points_for_preparation: 75,
          bonus_for_punctuality: 30
        }
      }
    ];
  }

  /**
   * Creates realistic time slots for appointment booking
   */
  static createTimeSlots(): TimeSlot[] {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [
      {
        id: 1,
        date: tomorrow.toISOString().split('T')[0],
        start_time: '09:00',
        display_time: '09:00',
        display_date: tomorrow.toLocaleDateString('pt-BR'),
        display_datetime: `${tomorrow.toLocaleDateString('pt-BR')} às 09:00`,
        professional: {
          id: 101,
          name: 'Dr. Ana Silva',
          specialization: 'Concierge de Saúde',
          rating: 4.9
        },
        gamification_preview: {
          points_for_booking: 300,
          bonus_available: undefined
        }
      },
      {
        id: 2,
        date: dayAfter.toISOString().split('T')[0],
        start_time: '14:00',
        display_time: '14:00',
        display_date: dayAfter.toLocaleDateString('pt-BR'),
        display_datetime: `${dayAfter.toLocaleDateString('pt-BR')} às 14:00`,
        professional: {
          id: 102,
          name: 'Dr. Carlos Santos',
          specialization: 'Concierge de Saúde',
          rating: 4.8
        },
        gamification_preview: {
          points_for_booking: 300,
          bonus_available: 'early_booking'
        }
      }
    ];
  }
}

// ==========================================
// 🔐 AUTHENTICATION UTILITIES
// ==========================================

export class AuthHelper {
  /**
   * Sets up authenticated user state with proper token management
   */
  static async setupAuthenticatedUser(page: Page, user: TestUser): Promise<void> {
    // Set authentication tokens in localStorage
    await page.addInitScript((userData) => {
      localStorage.setItem('auth_token', `fake-jwt-token-${userData.id}`);
      localStorage.setItem('user_data', JSON.stringify({
        id: userData.id,
        email: userData.email,
        fullName: userData.fullName,
        isAuthenticated: true
      }));
    }, user);

    // Mock authentication API calls
    await page.route('**/api/auth/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            isAuthenticated: true
          }
        })
      });
    });
  }

  /**
   * Mocks the login process for E2E testing
   */
  static async mockLoginProcess(page: Page, user: TestUser): Promise<void> {
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: `fake-jwt-token-${user.id}`,
            user: {
              id: user.id,
              email: user.email,
              fullName: user.fullName
            }
          }
        })
      });
    });
  }

  /**
   * Simulates session expiry for testing authentication edge cases
   */
  static async mockSessionExpiry(page: Page): Promise<void> {
    await page.route('**/api/telemedicine/**', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Session expired. Please log in again.',
          error: 'Unauthorized'
        })
      });
    });
  }
}

// ==========================================
// 🏥 TELEMEDICINE API MOCKS
// ==========================================

export class TelemedicineAPIMocks {
  /**
   * Mocks eligibility check API with realistic responses
   */
  static async mockEligibilityCheck(page: Page, user: TestUser): Promise<void> {
    await page.route('**/api/telemedicine/eligibility', async route => {
      const requirements = {
        registration: { 
          completed: true, 
          title: 'Registro Completo', 
          description: 'Informações básicas preenchidas' 
        },
        documents: { 
          completed: user.isEligible, 
          title: 'Documentos Aprovados', 
          description: `Documentos necessários aprovados (${user.isEligible ? '3/3' : '2/3'})` 
        },
        health_questionnaire: { 
          completed: true, 
          title: 'Questionário de Saúde', 
          description: 'Avaliação de saúde preenchida' 
        },
        profile: { 
          completed: true, 
          title: 'Perfil Completo', 
          description: 'Dados pessoais completos (6/6)' 
        }
      };

      const nextSteps = user.isEligible ? 
        ['You can now book your telemedicine consultation!'] :
        [
          'Complete seus documentos pendentes',
          'Continue participando para ganhar mais pontos (500 pontos necessários)',
          'Finalize todas as etapas do onboarding'
        ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          eligible: user.isEligible,
          data: {
            requirements,
            total_points: user.points,
            minimum_points_required: 500,
            points_sufficient: user.points >= 500,
            completion_percentage: user.completionPercentage,
            reward_type: 'telemedicine_consultation',
            reward_description: 'Your first appointment with health concierge',
            next_steps: nextSteps
          }
        })
      });
    });
  }

  /**
   * Mocks appointment types API with comprehensive data
   */
  static async mockAppointmentTypes(page: Page): Promise<void> {
    const appointmentTypes = TestDataFactory.createAppointmentTypes();

    await page.route('**/api/telemedicine/appointment-types', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            appointment_types: appointmentTypes,
            total_available: appointmentTypes.length,
            eligibility_status: 'eligible',
            reward_context: {
              is_completion_reward: true,
              reward_title: 'Parabéns! Consulta de Telemedicina Desbloqueada',
              reward_description: 'Como recompensa por completar todo o onboarding, você ganhou acesso à consulta com nosso concierge de saúde.',
              special_benefits: [
                'Consulta prioritária',
                'Pontos extras de gamificação',
                'Acesso a recursos exclusivos',
                'Acompanhamento personalizado'
              ]
            }
          }
        })
      });
    });
  }

  /**
   * Mocks available slots API with realistic time slots
   */
  static async mockAvailableSlots(page: Page): Promise<void> {
    const slots = TestDataFactory.createTimeSlots();

    await page.route('**/api/telemedicine/available-slots*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            slots,
            total_slots: slots.length,
            next_available: slots[0],
            stats: {
              today_slots: 0,
              tomorrow_slots: 1,
              this_week_slots: 2
            }
          }
        })
      });
    });
  }

  /**
   * Mocks successful booking API with comprehensive response
   */
  static async mockSuccessfulBooking(page: Page): Promise<void> {
    await page.route('**/api/telemedicine/book', async route => {
      const appointmentId = `apt-tm-${Date.now()}`;
      const reference = `TM-2024-${faker.number.int({ min: 100000, max: 999999 })}`;

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Parabéns! Sua consulta de telemedicina foi agendada com sucesso!',
          data: {
            appointment: {
              id: appointmentId,
              reference,
              scheduled_at: new Date(Date.now() + 86400000).toISOString(),
              display_datetime: new Date(Date.now() + 86400000).toLocaleDateString('pt-BR') + ' às 09:00',
              duration_minutes: 45,
              type: 'Consulta Inicial de Telemedicina',
              professional: {
                name: 'Dr. Ana Silva',
                specialization: 'Concierge de Saúde'
              },
              video_session: {
                session_id: `tm_${faker.string.alphanumeric(10)}`,
                platform: 'jitsi',
                join_url: `https://meet.jit.si/telemedicine-${faker.string.alphanumeric(8)}`
              }
            },
            gamification: {
              points_earned: 300,
              badge_unlocked: 'Pioneiro da Telemedicina',
              achievement: 'Primeira consulta de telemedicina agendada',
              completion_reward: true,
              special_benefits: [
                'Pontos extras por ser recompensa de conclusão',
                'Acesso prioritário a recursos exclusivos',
                'Emblema especial de pioneiro'
              ]
            },
            next_steps: [
              'Complete o checklist de preparação',
              'Teste sua câmera e microfone',
              'Tenha seus documentos em mãos',
              'Entre na sala virtual 10 minutos antes'
            ],
            completion_context: {
              reward_title: 'Recompensa de Conclusão Desbloqueada!',
              message: 'Como você completou todo o processo de onboarding, ganhou acesso exclusivo à consulta com nosso concierge de saúde.',
              special_status: 'priority_patient'
            }
          }
        })
      });
    });
  }

  /**
   * Mocks booking conflict scenario for testing error handling
   */
  static async mockBookingConflict(page: Page): Promise<void> {
    await page.route('**/api/telemedicine/book', async route => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Este horário acabou de ser reservado por outro usuário. Por favor, escolha outro horário.',
          error: 'Booking conflict',
          suggested_actions: [
            'Escolher outro horário disponível',
            'Verificar novos horários que podem ter sido abertos',
            'Contatar suporte para assistência'
          ]
        })
      });
    });
  }

  /**
   * Mocks network failure for testing error resilience
   */
  static async mockNetworkFailure(page: Page, endpoint: string = '**/api/telemedicine/**'): Promise<void> {
    await page.route(endpoint, async route => {
      await route.abort('failed');
    });
  }
}

// ==========================================
// ⚡ PERFORMANCE MONITORING UTILITIES
// ==========================================

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];

  /**
   * Measures execution time of a specific step
   */
  static async measureStep<T>(
    page: Page, 
    stepName: string, 
    action: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await action();
    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetrics = {
      stepName,
      duration,
      timestamp: Date.now()
    };

    this.metrics.push(metric);
    console.log(`⏱️  ${stepName}: ${duration.toFixed(0)}ms`);

    return { result, duration };
  }

  /**
   * Measures total flow execution time
   */
  static async measureFlow<T>(
    flowName: string,
    flowAction: () => Promise<T>
  ): Promise<{ result: T; totalDuration: number }> {
    const startTime = performance.now();
    const result = await flowAction();
    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    console.log(`🚀 ${flowName} Total Duration: ${totalDuration.toFixed(0)}ms`);
    
    return { result, totalDuration };
  }

  /**
   * Gets performance report for analysis
   */
  static getPerformanceReport(): {
    metrics: PerformanceMetrics[];
    summary: {
      totalSteps: number;
      averageDuration: number;
      slowestStep: PerformanceMetrics | null;
      fastestStep: PerformanceMetrics | null;
    };
  } {
    const totalSteps = this.metrics.length;
    const averageDuration = totalSteps > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalSteps 
      : 0;
    
    const slowestStep = this.metrics.length > 0 
      ? this.metrics.reduce((prev, current) => prev.duration > current.duration ? prev : current)
      : null;
    
    const fastestStep = this.metrics.length > 0
      ? this.metrics.reduce((prev, current) => prev.duration < current.duration ? prev : current)
      : null;

    return {
      metrics: [...this.metrics],
      summary: {
        totalSteps,
        averageDuration,
        slowestStep,
        fastestStep
      }
    };
  }

  /**
   * Resets performance metrics for new test run
   */
  static reset(): void {
    this.metrics = [];
  }

  /**
   * Validates performance against benchmarks
   */
  static validatePerformance(benchmarks: Record<string, number>): {
    passed: boolean;
    failures: string[];
  } {
    const failures: string[] = [];

    for (const metric of this.metrics) {
      const benchmark = benchmarks[metric.stepName];
      if (benchmark && metric.duration > benchmark) {
        failures.push(`${metric.stepName}: ${metric.duration.toFixed(0)}ms (expected < ${benchmark}ms)`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }
}

// ==========================================
// 🎯 PAGE OBJECT MODEL UTILITIES
// ==========================================

export class TelemedicinePageObjects {
  constructor(private page: Page) {}

  /**
   * Gets eligibility check page elements
   */
  get eligibilityPage() {
    return {
      loadingIndicator: this.page.locator('text=Verificando elegibilidade'),
      successTitle: this.page.locator('text=Parabéns! Recompensa Desbloqueada'),
      progressBar: this.page.locator('[role="progressbar"], .progress'),
      completionPercentage: this.page.locator('[data-testid="completion-percentage"]'),
      requirementsList: this.page.locator('[data-testid="requirements-list"]'),
      nextStepsList: this.page.locator('[data-testid="next-steps"]'),
      backButton: this.page.locator('button:has-text("Voltar")'),
      dashboardButton: this.page.locator('button:has-text("Ir para Dashboard")')
    };
  }

  /**
   * Gets appointment type selection page elements
   */
  get appointmentTypesPage() {
    return {
      title: this.page.locator('text=Escolha o tipo de consulta'),
      appointmentCards: this.page.locator('[data-testid="appointment-type"], .cursor-pointer:has-text("Consulta")'),
      gamificationInfo: this.page.locator('text=Agendamento: +'),
      priceInfo: this.page.locator('text=Gratuito'),
      preparationChecklist: this.page.locator('[data-testid="preparation-checklist"]'),
      backButton: this.page.locator('button:has-text("Voltar")')
    };
  }

  /**
   * Gets slot selection page elements
   */
  get slotsPage() {
    return {
      title: this.page.locator('text=Escolha o Horário'),
      appointmentTypeInfo: this.page.locator('text=45 minutos'),
      slotButtons: this.page.locator('button:has-text(":")'),
      professionalInfo: this.page.locator('text=Dr.'),
      noSlotsMessage: this.page.locator('text=Nenhum horário disponível'),
      backButton: this.page.locator('button:has-text("Voltar")')
    };
  }

  /**
   * Gets booking confirmation page elements
   */
  get confirmationPage() {
    return {
      title: this.page.locator('text=Confirmar Agendamento'),
      appointmentDetails: this.page.locator('[data-testid="appointment-details"]'),
      professionalInfo: this.page.locator('[data-testid="professional-info"]'),
      gamificationPreview: this.page.locator('text=+300 pontos, text=+500 pontos'),
      congratulationsMessage: this.page.locator('text=Parabéns pela Conclusão'),
      confirmButton: this.page.locator('button:has-text("Confirmar Agendamento")'),
      backButton: this.page.locator('button:has-text("Voltar")')
    };
  }

  /**
   * Gets success/completion page elements
   */
  get successPage() {
    return {
      title: this.page.locator('text=Consulta Agendada'),
      successMessage: this.page.locator('text=agendada com sucesso'),
      appointmentDetails: this.page.locator('text=Consulta com Concierge de Saúde'),
      telemedicineInfo: this.page.locator('text=Telemedicina (Vídeo)'),
      nextSteps: this.page.locator('text=Complete o checklist de preparação'),
      dashboardButton: this.page.locator('button:has-text("Ir para Dashboard")')
    };
  }

  /**
   * Waits for page to be ready for interaction
   */
  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500); // Small buffer for animations
  }

  /**
   * Checks if current step is visible and ready
   */
  async isStepReady(step: 'eligibility' | 'types' | 'slots' | 'confirmation' | 'success'): Promise<boolean> {
    const stepElements = {
      eligibility: this.eligibilityPage.successTitle,
      types: this.appointmentTypesPage.title,
      slots: this.slotsPage.title,
      confirmation: this.confirmationPage.title,
      success: this.successPage.title
    };

    try {
      await stepElements[step].waitFor({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// 🔧 UTILITY FUNCTIONS
// ==========================================

/**
 * Creates a complete test environment setup
 */
export async function setupTestEnvironment(
  page: Page, 
  userType: 'eligible' | 'ineligible' = 'eligible'
): Promise<{
  user: TestUser;
  pageObjects: TelemedicinePageObjects;
  performance: typeof PerformanceMonitor;
}> {
  const user = TestDataFactory.createUser(userType);
  const pageObjects = new TelemedicinePageObjects(page);
  
  // Reset performance metrics for new test
  PerformanceMonitor.reset();
  
  // Setup authentication
  await AuthHelper.setupAuthenticatedUser(page, user);
  
  return {
    user,
    pageObjects,
    performance: PerformanceMonitor
  };
}

/**
 * Completes the full booking flow with performance monitoring
 */
export async function completeBookingFlow(
  page: Page,
  user: TestUser,
  options: {
    measurePerformance?: boolean;
    skipSteps?: ('eligibility' | 'types' | 'slots')[];
  } = {}
): Promise<{ success: boolean; performanceReport?: any }> {
  const { measurePerformance = false, skipSteps = [] } = options;
  const pageObjects = new TelemedicinePageObjects(page);
  
  // TODO: Implement the booking flow logic
  return { success: true };
}