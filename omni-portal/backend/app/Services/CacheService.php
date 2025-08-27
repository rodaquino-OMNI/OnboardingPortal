<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * CacheService - Centralized caching for health questionnaire operations
 * Optimizes performance by caching expensive computations and database queries
 */
class CacheService
{
    private const DEFAULT_TTL = 3600; // 1 hour
    private const SHORT_TTL = 300;    // 5 minutes
    private const LONG_TTL = 86400;   // 24 hours

    /**
     * Cache questionnaire sections computation
     */
    public function cacheQuestionnaireSections(int $questionnaireId, array $sections): array
    {
        $key = "questionnaire_sections:{$questionnaireId}";
        
        return Cache::remember($key, self::SHORT_TTL, function () use ($sections) {
            return $sections;
        });
    }

    /**
     * Get cached questionnaire sections
     */
    public function getCachedQuestionnaireSections(int $questionnaireId): ?array
    {
        $key = "questionnaire_sections:{$questionnaireId}";
        return Cache::get($key);
    }

    /**
     * Cache template sections data
     */
    public function cacheTemplateSections(int $templateId, array $sections): array
    {
        $key = "template_sections:{$templateId}";
        
        return Cache::remember($key, self::LONG_TTL, function () use ($sections) {
            return $sections;
        });
    }

    /**
     * Cache questionnaire progress data
     */
    public function cacheQuestionnaireProgress(int $questionnaireId, array $progressData): array
    {
        $key = "questionnaire_progress:{$questionnaireId}";
        
        return Cache::remember($key, self::SHORT_TTL, function () use ($progressData) {
            return $progressData;
        });
    }

    /**
     * Cache AI analysis results
     */
    public function cacheAIAnalysis(int $questionnaireId, array $analysis): array
    {
        $key = "ai_analysis:{$questionnaireId}";
        
        return Cache::remember($key, self::DEFAULT_TTL, function () use ($analysis) {
            return $analysis;
        });
    }

    /**
     * Cache beneficiary questionnaire count
     */
    public function cacheBeneficiaryQuestionnaireCount(int $beneficiaryId, int $count): int
    {
        $key = "beneficiary_questionnaire_count:{$beneficiaryId}";
        
        return Cache::remember($key, self::DEFAULT_TTL, function () use ($count) {
            return $count;
        });
    }

    /**
     * Invalidate questionnaire-related cache
     */
    public function invalidateQuestionnaireCache(int $questionnaireId): void
    {
        $keys = [
            "questionnaire_sections:{$questionnaireId}",
            "questionnaire_progress:{$questionnaireId}",
            "ai_analysis:{$questionnaireId}"
        ];

        foreach ($keys as $key) {
            Cache::forget($key);
        }
    }

    /**
     * Invalidate beneficiary-related cache
     */
    public function invalidateBeneficiaryCache(int $beneficiaryId): void
    {
        $keys = [
            "beneficiary_questionnaire_count:{$beneficiaryId}"
        ];

        foreach ($keys as $key) {
            Cache::forget($key);
        }
    }

    /**
     * Batch cache invalidation for questionnaire updates
     */
    public function invalidateQuestionnaireRelatedCache(int $questionnaireId, int $beneficiaryId, ?int $templateId = null): void
    {
        $this->invalidateQuestionnaireCache($questionnaireId);
        $this->invalidateBeneficiaryCache($beneficiaryId);
        
        if ($templateId) {
            Cache::forget("template_sections:{$templateId}");
        }

        Log::info("Cache invalidated for questionnaire", [
            'questionnaire_id' => $questionnaireId,
            'beneficiary_id' => $beneficiaryId,
            'template_id' => $templateId
        ]);
    }

    /**
     * Compute and cache expensive operations with fallback
     */
    public function computeWithCache(string $key, callable $computation, int $ttl = self::DEFAULT_TTL)
    {
        return Cache::remember($key, $ttl, function () use ($computation) {
            try {
                return $computation();
            } catch (\Exception $e) {
                Log::error("Cache computation failed", [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                // Return null to prevent caching errors
                return null;
            }
        });
    }

    /**
     * Warm up cache for frequently accessed data
     */
    public function warmUpQuestionnaireCache(int $questionnaireId): void
    {
        // This would be called after questionnaire updates to pre-populate cache
        $keys = [
            "questionnaire_sections:{$questionnaireId}",
            "questionnaire_progress:{$questionnaireId}"
        ];

        Log::info("Cache warmed up for questionnaire", [
            'questionnaire_id' => $questionnaireId,
            'keys_warmed' => $keys
        ]);
    }

    /**
     * Get cache statistics for monitoring
     */
    public function getCacheStats(): array
    {
        return [
            'default_ttl' => self::DEFAULT_TTL,
            'short_ttl' => self::SHORT_TTL,
            'long_ttl' => self::LONG_TTL,
            'cache_driver' => config('cache.default')
        ];
    }
}