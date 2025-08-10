/**
 * Gamification Scoring Calculator
 * 
 * This module handles all point calculations and scoring formulas
 * to ensure consistency across the application
 */

export interface ActionPoints {
  action: string;
  basePoints: number;
  multipliers?: {
    firstTime?: number;
    streak?: number;
    perfect?: number;
    speed?: number;
  };
}

// Point values for each action in the system
export const POINT_VALUES = {
  // Profile Actions
  PROFILE_COMPLETE: 50,
  PROFILE_PHOTO_UPLOAD: 10,
  PROFILE_UPDATE: 5,
  
  // Document Actions
  DOCUMENT_UPLOAD: 20,
  DOCUMENT_VERIFIED: 30,
  ALL_DOCUMENTS_COMPLETE: 100,
  
  // Health Questionnaire
  HEALTH_QUESTION_ANSWERED: 2,
  HEALTH_SECTION_COMPLETE: 15,
  HEALTH_QUESTIONNAIRE_COMPLETE: 150,
  HEALTH_PERFECT_ACCURACY: 50, // Bonus for no corrections needed
  
  // Interview
  INTERVIEW_SCHEDULED: 75,
  INTERVIEW_COMPLETED: 200,
  INTERVIEW_RESCHEDULED: -10, // Penalty for rescheduling
  
  // Telemedicine
  TELEMEDICINE_SCHEDULED: 100,
  TELEMEDICINE_COMPLETED: 250,
  
  // Engagement Bonuses
  DAILY_LOGIN: 5,
  WEEKLY_STREAK: 25,
  MONTHLY_STREAK: 100,
  
  // Completion Bonuses
  ONBOARDING_COMPLETE: 500,
  SPEED_BONUS_24H: 100,
  SPEED_BONUS_48H: 50,
  SPEED_BONUS_72H: 25,
  
  // Penalties
  MISSED_APPOINTMENT: -50,
  INCOMPLETE_FORM: -5,
  DOCUMENT_REJECTED: -10,
} as const;

// Badge thresholds
export const BADGE_THRESHOLDS = {
  FIRST_TIMER: 10,
  NOVICE: 50,
  APPRENTICE: 100,
  PROFESSIONAL: 250,
  EXPERT: 500,
  MASTER: 1000,
  LEGEND: 2000,
  CHAMPION: 5000,
} as const;

// Level progression
export const LEVEL_PROGRESSION = {
  1: 0,
  2: 50,
  3: 120,
  4: 200,
  5: 300,
  6: 420,
  7: 560,
  8: 720,
  9: 900,
  10: 1100,
  11: 1350,
  12: 1650,
  13: 2000,
  14: 2400,
  15: 2850,
  16: 3350,
  17: 3900,
  18: 4500,
  19: 5150,
  20: 5850,
} as const;

export class GamificationCalculator {
  /**
   * Calculate points for a specific action
   */
  static calculateActionPoints(
    action: keyof typeof POINT_VALUES,
    modifiers?: {
      isFirstTime?: boolean;
      streakDays?: number;
      completionTime?: number; // in hours
      accuracy?: number; // percentage
    }
  ): number {
    let points = POINT_VALUES[action] || 0;
    
    // Apply first-time bonus (20% extra)
    if (modifiers?.isFirstTime) {
      points = Math.round(points * 1.2);
    }
    
    // Apply streak multiplier (up to 50% bonus)
    if (modifiers?.streakDays) {
      const streakBonus = Math.min(modifiers.streakDays * 0.02, 0.5);
      points = Math.round(points * (1 + streakBonus));
    }
    
    // Apply speed bonus for quick completion
    if (modifiers?.completionTime !== undefined && modifiers.completionTime > 0) {
      if (modifiers.completionTime <= 24) {
        points += POINT_VALUES.SPEED_BONUS_24H;
      } else if (modifiers.completionTime <= 48) {
        points += POINT_VALUES.SPEED_BONUS_48H;
      } else if (modifiers.completionTime <= 72) {
        points += POINT_VALUES.SPEED_BONUS_72H;
      }
    }
    
    // Apply accuracy bonus (for questionnaires)
    if (modifiers?.accuracy !== undefined) {
      if (modifiers.accuracy === 100) {
        points += POINT_VALUES.HEALTH_PERFECT_ACCURACY;
      }
    }
    
    return Math.max(0, points); // Never return negative points
  }
  
  /**
   * Calculate level from total points
   */
  static calculateLevel(totalPoints: number): number {
    let level = 1;
    
    for (const [lvl, requiredPoints] of Object.entries(LEVEL_PROGRESSION)) {
      if (totalPoints >= requiredPoints) {
        level = parseInt(lvl);
      } else {
        break;
      }
    }
    
    return level;
  }
  
  /**
   * Calculate progress to next level
   */
  static calculateLevelProgress(totalPoints: number): {
    currentLevel: number;
    nextLevel: number;
    currentLevelPoints: number;
    nextLevelPoints: number;
    progress: number;
    pointsToNext: number;
  } {
    const currentLevel = this.calculateLevel(totalPoints);
    const nextLevel = Math.min(currentLevel + 1, 20);
    
    const currentLevelPoints = LEVEL_PROGRESSION[currentLevel as keyof typeof LEVEL_PROGRESSION] || 0;
    const nextLevelPoints = LEVEL_PROGRESSION[nextLevel as keyof typeof LEVEL_PROGRESSION] || 999999;
    
    const pointsInCurrentLevel = totalPoints - currentLevelPoints;
    const pointsNeededForNext = nextLevelPoints - currentLevelPoints;
    const progress = Math.round((pointsInCurrentLevel / pointsNeededForNext) * 100);
    const pointsToNext = nextLevelPoints - totalPoints;
    
    return {
      currentLevel,
      nextLevel,
      currentLevelPoints,
      nextLevelPoints,
      progress,
      pointsToNext
    };
  }
  
  /**
   * Calculate engagement score (0-100)
   */
  static calculateEngagementScore(metrics: {
    daysActive: number;
    tasksCompleted: number;
    streakDays: number;
    lastActivityDays: number; // Days since last activity
  }): number {
    let score = 0;
    
    // Activity recency (max 30 points)
    if (metrics.lastActivityDays === 0) {
      score += 30;
    } else if (metrics.lastActivityDays === 1) {
      score += 25;
    } else if (metrics.lastActivityDays <= 3) {
      score += 20;
    } else if (metrics.lastActivityDays <= 7) {
      score += 10;
    }
    
    // Streak bonus (max 30 points)
    score += Math.min(metrics.streakDays * 3, 30);
    
    // Tasks completed (max 20 points)
    score += Math.min(metrics.tasksCompleted * 2, 20);
    
    // Days active (max 20 points)
    score += Math.min(metrics.daysActive * 2, 20);
    
    return Math.min(100, score);
  }
  
  /**
   * Calculate completion percentage
   */
  static calculateCompletionPercentage(completed: {
    profile: boolean;
    documents: boolean;
    health: boolean;
    interview: boolean;
    telemedicine: boolean;
  }): number {
    const tasks = Object.values(completed);
    const completedCount = tasks.filter(t => t).length;
    return Math.round((completedCount / tasks.length) * 100);
  }
  
  /**
   * Get badge for point total
   */
  static getBadgeLevel(totalPoints: number): string {
    if (totalPoints >= BADGE_THRESHOLDS.CHAMPION) return 'Champion';
    if (totalPoints >= BADGE_THRESHOLDS.LEGEND) return 'Legend';
    if (totalPoints >= BADGE_THRESHOLDS.MASTER) return 'Master';
    if (totalPoints >= BADGE_THRESHOLDS.EXPERT) return 'Expert';
    if (totalPoints >= BADGE_THRESHOLDS.PROFESSIONAL) return 'Professional';
    if (totalPoints >= BADGE_THRESHOLDS.APPRENTICE) return 'Apprentice';
    if (totalPoints >= BADGE_THRESHOLDS.NOVICE) return 'Novice';
    if (totalPoints >= BADGE_THRESHOLDS.FIRST_TIMER) return 'First Timer';
    return 'Newcomer';
  }
  
  /**
   * Calculate rewards eligibility
   */
  static getEligibleRewards(totalPoints: number): string[] {
    const rewards: string[] = [];
    
    if (totalPoints >= 10) rewards.push('welcome-badge');
    if (totalPoints >= 50) rewards.push('early-bird-discount');
    if (totalPoints >= 100) rewards.push('priority-support');
    if (totalPoints >= 250) rewards.push('consultation-upgrade');
    if (totalPoints >= 500) rewards.push('wellness-package');
    if (totalPoints >= 1000) rewards.push('premium-features');
    if (totalPoints >= 2000) rewards.push('vip-status');
    
    return rewards;
  }
}

// Export singleton instance for consistent calculations
export const gamificationCalculator = new GamificationCalculator();