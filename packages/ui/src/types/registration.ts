/**
 * Sprint 2C - Registration Type Definitions
 * Pure types only, no implementation
 */

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface ProfileData {
  name: string;
  cpf: string;
  birthdate: string;
  phone: string;
  address: string;
  email: string;
}

export interface ValidationErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  termsAccepted?: string;
  name?: string;
  cpf?: string;
  birthdate?: string;
  phone?: string;
  address?: string;
  _form?: string;
}
