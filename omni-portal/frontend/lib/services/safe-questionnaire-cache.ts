/**
 * Safe Questionnaire Cache Implementation
 * 
 * CRITICAL: This cache implementation includes safety measures to prevent
 * caching of emergency/critical questions that could lead to missed interventions.
 * 
 * Safety Features:
 * - Never caches critical safety questions
 * - Memory limits to prevent crashes
 * - Version control for cache invalidation
 * - Automatic cleanup on memory pressure
 * - Kill switches for instant disable
 */

import { LRUCache } from 'lru-cache';

// Critical questions that must NEVER be cached
const CRITICAL_SAFETY_QUESTIONS = [
  'phq9_9',              // Suicide ideation
  'harmful_thoughts',     // Self-harm risk
  'emergency_symptoms',   // Medical emergencies
  'chest_pain',          // Cardiac symptoms
  'stroke_symptoms',     // Stroke indicators
  'severe_depression',   // Crisis mental health
  'substance_overdose',  // Overdose risk
  'domestic_violence',   // Safety concerns
  'child_safety',        // Child welfare
] as const;

// Kill switch configuration
export interface KillSwitches {
  enableCache: boolean;
  enableCriticalCache: boolean; // Should always be false in production
  enableMemoryLimit: boolean;
  enableAutoCleanup: boolean;
  maxMemoryMB: number;
  maxCacheItems: number;
}

// Default safe configuration
export const DEFAULT_KILL_SWITCHES: KillSwitches = {
  enableCache: true,
  enableCriticalCache: false, // NEVER enable in production
  enableMemoryLimit: true,
  enableAutoCleanup: true,
  maxMemoryMB: 10, // 10MB max
  maxCacheItems: 50, // 50 items max
};

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  version: string;
  size: number;
  questionId: string;
  isCritical: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  criticalBlocks: number;
  memoryUsed: number;
  itemCount: number;
  errorCount: number;
}

export class SafeQuestionnaireCache {
  private cache: LRUCache<string, CacheEntry>;
  private metrics: CacheMetrics;
  private killSwitches: KillSwitches;
  private currentMemoryUsage: number = 0;
  private version: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(killSwitches: Partial<KillSwitches> = {}) {
    this.killSwitches = { ...DEFAULT_KILL_SWITCHES, ...killSwitches };
    this.version = `v1.0.0-${Date.now()}`;
    
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      criticalBlocks: 0,
      memoryUsed: 0,
      itemCount: 0,
      errorCount: 0,
    };

    // Initialize LRU cache with safety limits
    this.cache = new LRUCache<string, CacheEntry>({
      max: this.killSwitches.maxCacheItems,
      maxSize: this.killSwitches.maxMemoryMB * 1024 * 1024, // Convert to bytes
      sizeCalculation: (entry) => entry.size,
      dispose: (value, key) => {
        this.metrics.evictions++;
        this.currentMemoryUsage -= value.size;
      },
      ttl: 1000 * 60 * 30, // 30 minutes TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Start auto-cleanup if enabled
    if (this.killSwitches.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Check if a question is critical and should never be cached
   */
  private isCriticalQuestion(questionId: string): boolean {
    return CRITICAL_SAFETY_QUESTIONS.some(critical => 
      questionId.includes(critical) || 
      questionId.toLowerCase().includes('emergency') ||
      questionId.toLowerCase().includes('critical') ||
      questionId.toLowerCase().includes('suicide') ||
      questionId.toLowerCase().includes('harm')
    );
  }

  /**
   * Calculate approximate size of an object in bytes
   */
  private calculateSize(obj: any): number {
    try {
      const str = JSON.stringify(obj);
      // Rough estimate: 2 bytes per character for Unicode
      return str.length * 2;
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  /**
   * Safely set a value in cache with all protections
   */
  set(questionId: string, value: any): boolean {
    // Kill switch check
    if (!this.killSwitches.enableCache) {
      return false;
    }

    // CRITICAL SAFETY CHECK
    if (this.isCriticalQuestion(questionId)) {
      this.metrics.criticalBlocks++;
      console.warn(`[SafeCache] BLOCKED: Attempted to cache critical question: ${questionId}`);
      
      // Log to monitoring system
      this.logSafetyBlock(questionId);
      
      // Never cache critical questions unless explicitly overridden (dangerous!)
      if (!this.killSwitches.enableCriticalCache) {
        return false;
      }
    }

    try {
      const size = this.calculateSize(value);
      
      // Memory limit check
      if (this.killSwitches.enableMemoryLimit) {
        const maxBytes = this.killSwitches.maxMemoryMB * 1024 * 1024;
        if (this.currentMemoryUsage + size > maxBytes) {
          // Try cleanup first
          this.performCleanup();
          
          // Check again
          if (this.currentMemoryUsage + size > maxBytes) {
            console.warn('[SafeCache] Memory limit exceeded, rejecting cache entry');
            this.metrics.errorCount++;
            return false;
          }
        }
      }

      const entry: CacheEntry = {
        value,
        timestamp: Date.now(),
        version: this.version,
        size,
        questionId,
        isCritical: this.isCriticalQuestion(questionId),
      };

      this.cache.set(questionId, entry);
      this.currentMemoryUsage += size;
      this.metrics.itemCount = this.cache.size;
      this.metrics.memoryUsed = this.currentMemoryUsage;

      return true;
    } catch (error) {
      console.error('[SafeCache] Error setting cache:', error);
      this.metrics.errorCount++;
      return false;
    }
  }

  /**
   * Safely get a value from cache
   */
  get<T = any>(questionId: string): T | null {
    // Kill switch check
    if (!this.killSwitches.enableCache) {
      this.metrics.misses++;
      return null;
    }

    // NEVER return cached value for critical questions
    if (this.isCriticalQuestion(questionId) && !this.killSwitches.enableCriticalCache) {
      this.metrics.criticalBlocks++;
      return null;
    }

    try {
      const entry = this.cache.get(questionId);
      
      if (entry) {
        // Version check - invalidate if version mismatch
        if (entry.version !== this.version) {
          this.cache.delete(questionId);
          this.metrics.misses++;
          return null;
        }

        this.metrics.hits++;
        return entry.value as T;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error('[SafeCache] Error getting cache:', error);
      this.metrics.errorCount++;
      return null;
    }
  }

  /**
   * Perform memory cleanup
   */
  private performCleanup(): void {
    const targetSize = this.killSwitches.maxMemoryMB * 1024 * 1024 * 0.7; // Clean to 70%
    
    while (this.currentMemoryUsage > targetSize && this.cache.size > 0) {
      // LRU cache will automatically evict oldest
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    // Clean every 5 minutes
    this.cleanupInterval = setInterval(() => {
      if (this.currentMemoryUsage > this.killSwitches.maxMemoryMB * 1024 * 1024 * 0.8) {
        this.performCleanup();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Log safety block for monitoring
   */
  private logSafetyBlock(questionId: string): void {
    // In production, this would send to monitoring service
    const event = {
      type: 'CRITICAL_CACHE_BLOCK',
      questionId,
      timestamp: Date.now(),
      version: this.version,
    };

    // Send to monitoring (implement based on your monitoring solution)
    if (typeof window !== 'undefined' && (window as any).monitoring) {
      (window as any).monitoring.logEvent(event);
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
    this.metrics.itemCount = 0;
    this.metrics.memoryUsed = 0;
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Update kill switches dynamically
   */
  updateKillSwitches(switches: Partial<KillSwitches>): void {
    this.killSwitches = { ...this.killSwitches, ...switches };
    
    // If cache is disabled, clear it
    if (!this.killSwitches.enableCache) {
      this.clear();
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    return (
      this.metrics.errorCount < 10 &&
      this.currentMemoryUsage < this.killSwitches.maxMemoryMB * 1024 * 1024 &&
      this.cache.size < this.killSwitches.maxCacheItems
    );
  }

  /**
   * Persist to localStorage (with safety checks)
   */
  persist(): boolean {
    if (!this.killSwitches.enableCache) {
      return false;
    }

    try {
      const safeEntries: Record<string, any> = {};
      
      // Only persist non-critical entries
      for (const [key, entry] of this.cache.entries()) {
        if (!entry.isCritical) {
          safeEntries[key] = entry.value;
        }
      }

      const data = {
        entries: safeEntries,
        version: this.version,
        timestamp: Date.now(),
      };

      localStorage.setItem('safe_questionnaire_cache', JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[SafeCache] Persist failed:', error);
      return false;
    }
  }

  /**
   * Restore from localStorage
   */
  restore(): boolean {
    if (!this.killSwitches.enableCache) {
      return false;
    }

    try {
      const stored = localStorage.getItem('safe_questionnaire_cache');
      if (!stored) return false;

      const data = JSON.parse(stored);
      
      // Check version and age
      if (data.version !== this.version || Date.now() - data.timestamp > 30 * 60 * 1000) {
        localStorage.removeItem('safe_questionnaire_cache');
        return false;
      }

      // Restore non-critical entries only
      for (const [key, value] of Object.entries(data.entries)) {
        if (!this.isCriticalQuestion(key)) {
          this.set(key, value);
        }
      }

      return true;
    } catch (error) {
      console.error('[SafeCache] Restore failed:', error);
      localStorage.removeItem('safe_questionnaire_cache');
      return false;
    }
  }
}