export interface LoginResponse {
  success: boolean;
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
}