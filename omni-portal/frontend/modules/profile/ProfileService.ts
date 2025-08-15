/**
 * ProfileService - Business logic for profile management
 * Extracted from ProfilePage component
 */

export interface Profile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  avatar?: string;
  role: 'patient' | 'admin' | 'doctor';
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ProfileMetrics {
  completionPercentage: number;
  missingFields: string[];
  lastActivityDays: number;
  riskScore: number;
}

export class ProfileService {
  /**
   * Validate profile data
   */
  validateProfile(profile: Partial<Profile>): ProfileValidationResult {
    const errors: Record<string, string> = {};

    // Email validation
    if (profile.email && !this.isValidEmail(profile.email)) {
      errors.email = 'Invalid email format';
    }

    // Name validation
    if (!profile.name || profile.name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Phone validation
    if (profile.phone && !this.isValidPhone(profile.phone)) {
      errors.phone = 'Invalid phone number';
    }

    // Birth date validation
    if (profile.birthDate && !this.isValidBirthDate(profile.birthDate)) {
      errors.birthDate = 'Invalid birth date';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Transform raw API data to profile
   */
  transformProfile(rawData: any): Profile {
    return {
      id: rawData.id || rawData.uuid,
      email: rawData.email,
      name: rawData.name || this.buildFullName(rawData),
      firstName: rawData.first_name || rawData.firstName,
      lastName: rawData.last_name || rawData.lastName,
      birthDate: rawData.birth_date || rawData.birthDate,
      phone: rawData.phone || rawData.phoneNumber,
      address: rawData.address || this.buildAddress(rawData),
      avatar: rawData.avatar || rawData.profile_image,
      role: this.normalizeRole(rawData.role || rawData.user_type),
      status: this.normalizeStatus(rawData.status),
      createdAt: rawData.created_at || rawData.createdAt,
      updatedAt: rawData.updated_at || rawData.updatedAt,
      metadata: rawData.metadata || {}
    };
  }

  /**
   * Calculate profile metrics
   */
  calculateMetrics(profile: Profile): ProfileMetrics {
    const requiredFields = ['name', 'email', 'phone', 'birthDate', 'address'];
    const missingFields = requiredFields.filter(field => !profile[field]);
    
    const completionPercentage = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100;
    
    const lastActivityDays = this.daysSince(new Date(profile.updatedAt));
    
    const riskScore = this.calculateRiskScore(profile, missingFields, lastActivityDays);

    return {
      completionPercentage,
      missingFields,
      lastActivityDays,
      riskScore
    };
  }

  /**
   * Check if profile needs completion
   */
  needsCompletion(profile: Profile): boolean {
    const metrics = this.calculateMetrics(profile);
    return metrics.completionPercentage < 80;
  }

  /**
   * Get profile completion suggestions
   */
  getCompletionSuggestions(profile: Profile): string[] {
    const suggestions: string[] = [];
    const metrics = this.calculateMetrics(profile);

    if (metrics.missingFields.length > 0) {
      suggestions.push(`Complete missing fields: ${metrics.missingFields.join(', ')}`);
    }

    if (!profile.avatar) {
      suggestions.push('Add a profile photo');
    }

    if (metrics.lastActivityDays > 30) {
      suggestions.push('Update your profile information');
    }

    return suggestions;
  }

  /**
   * Format profile for display
   */
  formatForDisplay(profile: Profile): any {
    return {
      ...profile,
      displayName: this.getDisplayName(profile),
      age: profile.birthDate ? this.calculateAge(profile.birthDate) : undefined,
      memberSince: this.formatDate(profile.createdAt),
      lastActive: this.getLastActiveText(profile.updatedAt)
    };
  }

  /**
   * Prepare profile for API submission
   */
  prepareForSubmission(profile: Partial<Profile>): any {
    // Remove display-only fields
    const { id, createdAt, updatedAt, ...data } = profile as any;

    // Convert to API format
    return {
      email: data.email,
      name: data.name,
      first_name: data.firstName,
      last_name: data.lastName,
      birth_date: data.birthDate,
      phone: data.phone,
      address: data.address,
      role: data.role,
      status: data.status,
      metadata: data.metadata
    };
  }

  // Private helper methods

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.length >= 10;
  }

  private isValidBirthDate(birthDate: string): boolean {
    const date = new Date(birthDate);
    const now = new Date();
    const minAge = 13;
    const maxAge = 120;
    
    const age = this.calculateAge(birthDate);
    return !isNaN(date.getTime()) && age >= minAge && age <= maxAge;
  }

  private buildFullName(data: any): string {
    if (data.first_name && data.last_name) {
      return `${data.first_name} ${data.last_name}`;
    }
    return data.first_name || data.last_name || 'Unknown User';
  }

  private buildAddress(data: any): string | undefined {
    if (data.address) return data.address;
    
    const parts = [
      data.street,
      data.city,
      data.state,
      data.zip_code || data.postal_code
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private normalizeRole(role: string): 'patient' | 'admin' | 'doctor' {
    const normalized = role?.toLowerCase();
    if (normalized === 'admin' || normalized === 'administrator') return 'admin';
    if (normalized === 'doctor' || normalized === 'physician') return 'doctor';
    return 'patient';
  }

  private normalizeStatus(status: string): 'active' | 'pending' | 'inactive' {
    const normalized = status?.toLowerCase();
    if (normalized === 'active') return 'active';
    if (normalized === 'pending') return 'pending';
    return 'inactive';
  }

  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  private daysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private calculateRiskScore(
    profile: Profile,
    missingFields: string[],
    lastActivityDays: number
  ): number {
    let score = 0;

    // Missing fields increase risk
    score += missingFields.length * 10;

    // Inactivity increases risk
    if (lastActivityDays > 90) score += 30;
    else if (lastActivityDays > 30) score += 15;
    else if (lastActivityDays > 7) score += 5;

    // Inactive status increases risk
    if (profile.status === 'inactive') score += 25;
    else if (profile.status === 'pending') score += 10;

    return Math.min(100, score);
  }

  private getDisplayName(profile: Profile): string {
    return profile.name || profile.email.split('@')[0] || 'User';
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  private getLastActiveText(dateString: string): string {
    const days = this.daysSince(new Date(dateString));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }
}