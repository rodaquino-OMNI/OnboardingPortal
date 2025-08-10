<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GamificationPublicController extends Controller
{
    /**
     * Get public gamification levels without authentication
     */
    public function getLevels(Request $request): JsonResponse
    {
        $levels = [
            ['id' => 1, 'name' => 'Novato', 'min_points' => 0, 'max_points' => 100],
            ['id' => 2, 'name' => 'Iniciante', 'min_points' => 101, 'max_points' => 300],
            ['id' => 3, 'name' => 'Intermediário', 'min_points' => 301, 'max_points' => 600],
            ['id' => 4, 'name' => 'Avançado', 'min_points' => 601, 'max_points' => 1000],
            ['id' => 5, 'name' => 'Expert', 'min_points' => 1001, 'max_points' => 9999999],
        ];

        return response()->json([
            'success' => true,
            'data' => $levels
        ]);
    }

    /**
     * Get default progress for unauthenticated users
     */
    public function getDefaultProgress(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_points' => 0,
                'current_level' => 1,
                'next_level_points' => 100,
                'progress_percentage' => 0,
                'badges_earned' => 0,
                'achievements_unlocked' => 0,
                'tasks_completed' => 0,
                'streak_days' => 0
            ]
        ]);
    }
    
    /**
     * Get default badges for unauthenticated users
     */
    public function getDefaultBadges(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'earned' => [],
                'available' => [
                    [
                        'id' => 1,
                        'name' => 'Primeiro Passo',
                        'description' => 'Complete seu primeiro upload',
                        'icon' => '🎯',
                        'rarity' => 'common',
                        'points' => 10
                    ],
                    [
                        'id' => 2,
                        'name' => 'Documentação Completa',
                        'description' => 'Envie todos os documentos',
                        'icon' => '📄',
                        'rarity' => 'rare',
                        'points' => 50
                    ],
                    [
                        'id' => 3,
                        'name' => 'Saúde em Dia',
                        'description' => 'Complete o questionário de saúde',
                        'icon' => '💪',
                        'rarity' => 'common',
                        'points' => 25
                    ]
                ]
            ]
        ]);
    }
    
    /**
     * Get default leaderboard for unauthenticated users
     */
    public function getDefaultLeaderboard(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }
    
    /**
     * Get default activity feed for unauthenticated users
     */
    public function getDefaultActivityFeed(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }
    
    /**
     * Get default dashboard for unauthenticated users
     */
    public function getDefaultDashboard(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'quick_stats' => [
                    'total_points' => 0,
                    'current_level' => 1,
                    'total_badges' => 0,
                    'completion_rate' => 0
                ],
                'recent_badges' => [],
                'activity_feed' => [],
                'leaderboard_position' => null
            ]
        ]);
    }
    
    /**
     * Get default achievements for unauthenticated users
     */
    public function getDefaultAchievements(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_earned' => 0,
                'total_available' => 10,
                'categories' => [],
                'recent' => [],
                'upcoming' => []
            ]
        ]);
    }
    
    /**
     * Get default stats for unauthenticated users
     */
    public function getDefaultStats(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_points' => 0,
                'current_streak' => 0,
                'longest_streak' => 0,
                'total_badges' => 0,
                'achievements_unlocked' => 0,
                'tasks_completed' => 0,
                'completion_rate' => 0,
                'average_score' => 0
            ]
        ]);
    }
}