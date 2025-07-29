// Authentication Types with Strict TypeScript
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  points: number;
  level: number;
  lgpd_consent?: boolean;
  lgpd_consent_at?: string;
  last_login_at?: string;
  registration_step?: 'step1' | 'step2' | 'step3' | 'completed';
  beneficiary?: BeneficiaryInfo;
}

export interface BeneficiaryInfo {
  employee_code: string;
  hiring_date: string;
  department: string;
  role: string;
  phone?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';
  preferred_language?: string;
  job_title?: string;
  start_date?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginData {
  login: string; // Can be email or CPF
  password: string;
  remember_me?: boolean;
}

export interface RegisterData {
  fullName: string;
  email: string;
  cpf: string;
  lgpd_consent: boolean;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface SocialLoginProvider {
  provider: 'google' | 'facebook' | 'instagram';
  redirect_url?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// Type guards for auth
export function isAuthUser(user: unknown): user is AuthUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    typeof (user as AuthUser).id === 'string' &&
    typeof (user as AuthUser).email === 'string'
  );
}

export function hasRegistrationStep(user: AuthUser): user is AuthUser & { registration_step: NonNullable<AuthUser['registration_step']> } {
  return user.registration_step !== undefined;
}

export function isRegistrationComplete(user: AuthUser): boolean {
  return user.registration_step === 'completed';
}