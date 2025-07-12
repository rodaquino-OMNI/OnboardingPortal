/**
 * Brazilian CPF (Cadastro de Pessoas Físicas) validation utilities
 */

/**
 * Validates Brazilian CPF
 * @param cpf - CPF string with or without formatting
 * @returns boolean indicating if CPF is valid
 */
export function validateCPF(cpf: string): boolean {
  // Remove all non-digit characters
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Check if has 11 digits
  if (cleanCPF.length !== 11) {
    return false;
  }
  
  // Check for known invalid CPFs (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }
  
  // Validate check digits
  let sum = 0;
  let remainder;
  
  // First check digit
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return false;
  }
  
  // Second check digit
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return false;
  }
  
  return true;
}

/**
 * Formats CPF string with standard formatting
 * @param cpf - CPF string with or without formatting
 * @returns formatted CPF string (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) {
    return cpf; // Return original if not valid length
  }
  
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Validates Brazilian phone number
 * @param phone - Phone string with or without formatting
 * @returns boolean indicating if phone is valid
 */
export function validatePhone(phone: string): boolean {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Brazilian phone patterns:
  // Landline: 10 digits (DDD + 8 digits) - (11) 1234-5678
  // Mobile: 11 digits (DDD + 9 digits) - (11) 91234-5678
  // With country code: +55 + area code + number
  
  // Check length (10 or 11 digits for domestic, 13 digits with country code)
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    // Domestic format
    const areaCode = cleanPhone.substring(0, 2);
    const number = cleanPhone.substring(2);
    
    // Validate area code (11-99)
    const areaCodeNum = parseInt(areaCode);
    if (areaCodeNum < 11 || areaCodeNum > 99) {
      return false;
    }
    
    // For mobile numbers (11 digits), first digit after area code must be 9
    if (cleanPhone.length === 11 && number[0] !== '9') {
      return false;
    }
    
    // For landline (10 digits), first digit cannot be 0, 1, or 9
    if (cleanPhone.length === 10 && ['0', '1', '9'].includes(number[0])) {
      return false;
    }
    
    return true;
  } else if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    // International format (+55)
    const domesticPart = cleanPhone.substring(2);
    return validatePhone(domesticPart);
  }
  
  return false;
}

/**
 * Formats phone number with standard Brazilian formatting
 * @param phone - Phone string with or without formatting
 * @returns formatted phone string
 */
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length === 10) {
    // Landline: (11) 1234-5678
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 11) {
    // Mobile: (11) 91234-5678
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    // International: +55 (11) 91234-5678
    const areaCode = cleanPhone.substring(2, 4);
    const number = cleanPhone.substring(4);
    if (number.length === 9) {
      return `+55 (${areaCode}) ${number.substring(0, 5)}-${number.substring(5)}`;
    } else if (number.length === 8) {
      return `+55 (${areaCode}) ${number.substring(0, 4)}-${number.substring(4)}`;
    }
  }
  
  return phone; // Return original if can't format
}

/**
 * Validates email address
 * @param email - Email string
 * @returns boolean indicating if email is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is either a valid CPF or email
 * @param login - Login string (CPF or email)
 * @returns object with validation result and detected type
 */
export function validateLogin(login: string): { isValid: boolean; type: 'cpf' | 'email' | 'unknown' } {
  const cleanLogin = login.trim();
  
  // Check if it's a CPF format (has digits and possibly dots/dash)
  if (/[\d.-]/.test(cleanLogin) && cleanLogin.replace(/\D/g, '').length === 11) {
    return {
      isValid: validateCPF(cleanLogin),
      type: 'cpf'
    };
  }
  
  // Check if it's an email format
  if (cleanLogin.includes('@')) {
    return {
      isValid: validateEmail(cleanLogin),
      type: 'email'
    };
  }
  
  return {
    isValid: false,
    type: 'unknown'
  };
}