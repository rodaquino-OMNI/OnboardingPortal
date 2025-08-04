'use client';

import { useState, useCallback, useMemo } from 'react';
import { useGamification } from './useGamification';
import { HealthAssessmentResults } from '@/lib/unified-health-flow';
import { UserProfile, Badge, Achievement } from '@/lib/pdf-generation';

interface PDFGenerationHookResult {
  userProfile: UserProfile | null;
  isReady: boolean;
  error: string | null;
  refreshData: () => void;
}

interface UsePDFGenerationOptions {
  healthResults: HealthAssessmentResults;
  userName: string;
  userAge: number;
  completionDate: Date;
  sessionDuration: number;
}

/**
 * Hook for integrating PDF generation with gamification system
 * Prepares user profile data by combining health results with gamification achievements
 */
export function usePDFGeneration(options: UsePDFGenerationOptions): PDFGenerationHookResult {
  const { 
    state: gamificationState, 
    getUserBadges,
    calculateLevel,
    getTotalPoints
  } = useGamification();

  const [error, setError] = useState<string | null>(null);

  // Convert gamification badges to PDF badge format
  const convertBadges = useCallback((gamificationBadges: any[]): Badge[] => {
    return gamificationBadges.map(badge => ({
      id: badge.id || `badge-${Date.now()}-${Math.random()}`,
      name: badge.name || badge.title || 'Badge Conquistada',
      description: badge.description || 'Conquista desbloqueada',
      icon: badge.icon || '🏆',
      earnedDate: badge.earnedDate ? new Date(badge.earnedDate) : new Date(),
      rarity: badge.rarity || 'common' as const
    }));
  }, []);

  // Convert gamification achievements to PDF achievement format
  const convertAchievements = useCallback((badges: any[]): Achievement[] => {
    return badges.map((badge, index) => ({
      id: badge.id || `achievement-${index}`,
      title: badge.name || badge.title || 'Conquista',
      description: badge.description || 'Objetivo alcançado',
      category: badge.category || 'Geral',
      points: badge.points || 10,
      completedAt: badge.earnedDate ? new Date(badge.earnedDate) : new Date()
    }));
  }, []);

  // Prepare user profile for PDF generation
  const userProfile = useMemo((): UserProfile | null => {
    try {
      if (!options.healthResults || !options.userName) {
        return null;
      }

      // Get user badges from gamification system
      const userBadges = getUserBadges();
      const currentLevel = calculateLevel();
      const totalPoints = getTotalPoints();

      const profile: UserProfile = {
        name: options.userName,
        age: options.userAge,
        completionDate: options.completionDate,
        sessionDuration: options.sessionDuration,
        badges: convertBadges(userBadges),
        achievements: convertAchievements(userBadges),
        level: currentLevel,
        totalPoints: totalPoints
      };

      setError(null);
      return profile;

    } catch (err) {
      setError(`Erro ao preparar dados do usuário: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      return null;
    }
  }, [
    options.healthResults,
    options.userName,
    options.userAge,
    options.completionDate,
    options.sessionDuration,
    getUserBadges,
    calculateLevel,
    getTotalPoints,
    convertBadges,
    convertAchievements
  ]);

  // Check if data is ready for PDF generation
  const isReady = useMemo(() => {
    return !!(
      userProfile &&
      options.healthResults &&
      options.healthResults.responses &&
      Object.keys(options.healthResults.responses).length > 0
    );
  }, [userProfile, options.healthResults]);

  // Refresh data from gamification system
  const refreshData = useCallback(() => {
    // This would trigger a re-fetch of gamification data
    // For now, we'll just clear any errors to trigger a re-computation
    setError(null);
  }, []);

  return {
    userProfile,
    isReady,
    error,
    refreshData
  };
}

/**
 * Helper hook for enhanced badge management
 * Provides additional utilities for badge display and PDF integration
 */
export function useBadgeEnhancement() {
  const { badgesData } = useGamification();

  // Enhanced badge mapping with PDF-friendly data
  const enhancedBadges = useMemo(() => {
    // CRITICAL FIX 3: Fix gamification state structure access
    const badges = (badgesData?.earned || []).map(badge => ({
      ...badge,
      // Enhance with PDF-specific properties
      displayName: badge.name || 'Conquista',
      displayIcon: badge.icon || '🏆',
      displayDescription: badge.description || 'Objetivo alcançado com sucesso',
      earnedTimestamp: Date.now(),
      
      // Add rarity based on badge type or difficulty
      rarity: determineBadgeRarity(badge),
      
      // Add category for better organization
      category: determineBadgeCategory(badge),
      
      // Calculate achievement value for PDF scoring
      achievementValue: calculateAchievementValue(badge)
    }));

    return badges;
  }, [badgesData.earned]);

  // Get badges by category for organized PDF display
  const getBadgesByCategory = useCallback(() => {
    const categories: Record<string, typeof enhancedBadges> = {};
    
    enhancedBadges.forEach(badge => {
      const category = badge.category || 'Geral';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(badge);
    });

    return categories;
  }, [enhancedBadges]);

  // Get recent badges for highlighted display
  const getRecentBadges = useCallback((limit: number = 5) => {
    return enhancedBadges
      .sort((a, b) => (b.earnedTimestamp || 0) - (a.earnedTimestamp || 0))
      .slice(0, limit);
  }, [enhancedBadges]);

  // Get rarest badges for special showcase
  const getRareBadges = useCallback(() => {
    const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
    
    return enhancedBadges
      .filter(badge => badge.rarity !== 'common')
      .sort((a, b) => {
        const aRarity = rarityOrder[a.rarity as keyof typeof rarityOrder] || 0;
        const bRarity = rarityOrder[b.rarity as keyof typeof rarityOrder] || 0;
        return bRarity - aRarity;
      });
  }, [enhancedBadges]);

  return {
    enhancedBadges,
    getBadgesByCategory,
    getRecentBadges,
    getRareBadges
  };
}

// Helper functions for badge enhancement
function determineBadgeRarity(badge: any): 'common' | 'rare' | 'epic' | 'legendary' {
  // Determine rarity based on badge characteristics
  if (badge.name?.includes('Primeira') || badge.name?.includes('Início')) {
    return 'common';
  }
  
  if (badge.name?.includes('Mestre') || badge.name?.includes('Expert')) {
    return 'epic';
  }
  
  if (badge.name?.includes('Lendário') || badge.name?.includes('Supremo')) {
    return 'legendary';
  }
  
  if (badge.points && badge.points > 50) {
    return 'rare';
  }
  
  return 'common';
}

function determineBadgeCategory(badge: any): string {
  // Categorize badges for better organization
  if (badge.name?.includes('Saúde') || badge.name?.includes('Bem-estar')) {
    return 'Saúde';
  }
  
  if (badge.name?.includes('Questionário') || badge.name?.includes('Avaliação')) {
    return 'Avaliação';
  }
  
  if (badge.name?.includes('Início') || badge.name?.includes('Primeira')) {
    return 'Primeiros Passos';
  }
  
  if (badge.name?.includes('Completude') || badge.name?.includes('Finalização')) {
    return 'Conclusão';
  }
  
  return 'Geral';
}

function calculateAchievementValue(badge: any): number {
  // Calculate achievement value for PDF scoring
  let value = badge.points || 10;
  
  // Bonus for different badge types
  if (badge.name?.includes('Mestre')) value += 20;
  if (badge.name?.includes('Expert')) value += 15;
  if (badge.name?.includes('Primeira')) value += 5;
  
  return value;
}

/**
 * Integration service for connecting PDF generation with existing systems
 */
export class PDFIntegrationService {
  /**
   * Prepare comprehensive data package for PDF generation
   */
  static async prepareDataPackage(
    healthResults: HealthAssessmentResults,
    userName: string,
    userAge: number,
    sessionDuration: number
  ): Promise<{
    userProfile: UserProfile;
    healthResults: HealthAssessmentResults;
    metadata: {
      generatedAt: Date;
      version: string;
      sessionId: string;
    };
  }> {
    try {
      // This would integrate with your auth system to get real user data
      const userProfile: UserProfile = {
        name: userName,
        age: userAge,
        completionDate: new Date(),
        sessionDuration: sessionDuration,
        badges: [], // Will be populated by usePDFGeneration hook
        achievements: [], // Will be populated by usePDFGeneration hook
        level: 1, // Will be calculated by gamification system
        totalPoints: 0 // Will be calculated by gamification system
      };

      return {
        userProfile,
        healthResults,
        metadata: {
          generatedAt: new Date(),
          version: '1.0.0',
          sessionId: crypto.randomUUID()
        }
      };

    } catch (error) {
      throw new Error(`Falha ao preparar dados para PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Validate data before PDF generation
   */
  static validateDataForPDF(userProfile: UserProfile, healthResults: HealthAssessmentResults): boolean {
    // Check required user profile fields
    if (!userProfile.name || !userProfile.age || !userProfile.completionDate) {
      return false;
    }

    // Check required health results
    if (!healthResults.responses || Object.keys(healthResults.responses).length === 0) {
      return false;
    }

    if (!healthResults.riskLevel || !healthResults.completedDomains) {
      return false;
    }

    return true;
  }

  /**
   * Enhance health results with additional context for PDF
   */
  static enhanceHealthResults(healthResults: HealthAssessmentResults): HealthAssessmentResults {
    return {
      ...healthResults,
      // Add enhanced recommendations if needed
      recommendations: healthResults.recommendations.length > 0 
        ? healthResults.recommendations 
        : ['Continue mantendo seus bons hábitos de saúde'],
      
      // Add enhanced next steps if needed
      nextSteps: healthResults.nextSteps.length > 0
        ? healthResults.nextSteps
        : ['Acompanhamento de rotina recomendado'],
      
      // Ensure risk scores exist
      riskScores: healthResults.riskScores || {},
      
      // Add metadata if missing
      timestamp: healthResults.timestamp || new Date().toISOString()
    };
  }
}