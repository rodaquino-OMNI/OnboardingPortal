/**
 * Centralized gamification point values
 * Single source of truth for all point calculations
 */

export const GAMIFICATION_POINTS = {
  // Profile & Account
  PROFILE_COMPLETE: 50,
  PROFILE_PHOTO: 25,
  EMAIL_VERIFY: 20,
  
  // Health Assessment
  HEALTH_QUESTIONNAIRE: 150,  // Consistent across all pages
  HEALTH_DOMAIN_COMPLETE: 25,
  HEALTH_HIGH_RISK_BONUS: 50,
  
  // Document Upload
  DOCUMENT_UPLOAD: 25,         // Per document: 25 points
  DOCUMENT_OCR_BONUS: 50,      // OCR validation bonus
  DOCUMENTS_COMPLETE: 100,     // All 4 documents = 100 points total
  
  // Interview & Scheduling
  INTERVIEW_SCHEDULE: 75,      // Consistent value
  INTERVIEW_COMPLETE: 150,
  TELEMEDICINE_SCHEDULE: 50,
  TELEMEDICINE_COMPLETE: 100,
  
  // Onboarding Completion
  ONBOARDING_COMPLETE: 500,
  ONBOARDING_MILESTONE_25: 50,
  ONBOARDING_MILESTONE_50: 100,
  ONBOARDING_MILESTONE_75: 150,
  
  // Daily Activities
  DAILY_LOGIN: 5,
  DAILY_LOGIN_STREAK_7: 35,
  DAILY_LOGIN_STREAK_30: 200,
  
  // Engagement
  FIRST_ACTION: 10,
  TUTORIAL_COMPLETE: 30,
  REFERRAL_BONUS: 100,
} as const;

export const POINT_DESCRIPTIONS = {
  PROFILE_COMPLETE: 'Completar perfil',
  HEALTH_QUESTIONNAIRE: 'Questionário de saúde',
  DOCUMENT_UPLOAD: 'Enviar documento',
  DOCUMENTS_COMPLETE: 'Enviar documentos obrigatórios',
  INTERVIEW_SCHEDULE: 'Agendar entrevista',
  ONBOARDING_COMPLETE: 'Completar onboarding',
  DAILY_LOGIN_STREAK_7: 'Login diário (7 dias)',
} as const;

export type PointCategory = keyof typeof GAMIFICATION_POINTS;
export type PointDescription = keyof typeof POINT_DESCRIPTIONS;