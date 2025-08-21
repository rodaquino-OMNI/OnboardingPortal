export interface LoginResponse {
  success: boolean;
  token?: string;
  user: {
    id: string;
    name: string;
    email: string;
    cpf: string;
    phone?: string;
    age?: number;
    role?: string;
    roles?: { name: string }[];
    permissions?: { name: string }[];
    registration_step?: string;
    gamification_progress?: {
      points: number;
      level: number;
    };
    lgpd_consent?: boolean;
    lgpd_consent_at?: string;
    last_login_at?: string;
  };
  registration_step?: string;
  requires_2fa?: boolean;
  session_token?: string;
}

export interface RegisterResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    cpf: string;
  };
  token?: string;
  message?: string;
  registration_step?: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  age?: number;
  role?: string;
  roles?: { name: string }[];
  permissions?: { name: string }[];
  registration_step?: string;
  gamification_progress?: {
    points: number;
    level: number;
  };
  lgpd_consent?: boolean;
  lgpd_consent_at?: string;
  last_login_at?: string;
}

// Enhanced auth response interface
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    cpf: string;
    points: number;
    level: number;
    lgpd_consent: boolean;
    lgpd_consent_at?: string;
    last_login_at?: string;
  };
}

// Auth error types
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Auth result for hook responses
export interface AuthResult {
  success: boolean;
  error?: string;
  requires_2fa?: boolean;
  session_token?: string;
}

// Alias for compatibility
export type AuthUser = User;