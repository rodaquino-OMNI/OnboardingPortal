<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GamificationLevelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $levels = [
            [
                'level_number' => 1,
                'name' => 'Iniciante',
                'title' => 'Explorador da Saúde',
                'points_required' => 0,
                'points_to_next' => 100,
                'color_theme' => '#94A3B8', // Slate
                'icon' => 'seedling',
                'rewards' => json_encode([
                    'welcome_badge' => true,
                    'basic_features' => true
                ]),
                'unlocked_features' => json_encode([
                    'basic_profile',
                    'health_questionnaire',
                    'document_upload'
                ]),
                'description' => 'Bem-vindo à sua jornada de saúde! Comece explorando as funcionalidades básicas.',
                'discount_percentage' => 0,
                'priority_support_level' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'level_number' => 2,
                'name' => 'Aprendiz',
                'title' => 'Aprendiz do Bem-estar',
                'points_required' => 100,
                'points_to_next' => 150,
                'color_theme' => '#10B981', // Emerald
                'icon' => 'graduation-cap',
                'rewards' => json_encode([
                    'level_2_badge' => true,
                    'health_tips_access' => true
                ]),
                'unlocked_features' => json_encode([
                    'health_insights',
                    'appointment_scheduling',
                    'basic_analytics'
                ]),
                'description' => 'Você está aprendendo a cuidar melhor da sua saúde!',
                'discount_percentage' => 5,
                'priority_support_level' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'level_number' => 3,
                'name' => 'Praticante',
                'title' => 'Praticante Saudável',
                'points_required' => 250,
                'points_to_next' => 250,
                'color_theme' => '#3B82F6', // Blue
                'icon' => 'dumbbell',
                'rewards' => json_encode([
                    'level_3_badge' => true,
                    'premium_content' => true,
                    'monthly_health_report' => true
                ]),
                'unlocked_features' => json_encode([
                    'advanced_analytics',
                    'health_goals',
                    'reminders',
                    'export_data'
                ]),
                'description' => 'Parabéns! Você está praticando hábitos saudáveis consistentemente.',
                'discount_percentage' => 10,
                'priority_support_level' => 3,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'level_number' => 4,
                'name' => 'Especialista',
                'title' => 'Especialista em Vida Saudável',
                'points_required' => 500,
                'points_to_next' => 500,
                'color_theme' => '#8B5CF6', // Violet
                'icon' => 'award',
                'rewards' => json_encode([
                    'level_4_badge' => true,
                    'personal_health_coach' => true,
                    'priority_appointments' => true
                ]),
                'unlocked_features' => json_encode([
                    'ai_health_assistant',
                    'custom_health_plans',
                    'family_accounts',
                    'api_access'
                ]),
                'description' => 'Você é um especialista em manter sua saúde em dia!',
                'discount_percentage' => 15,
                'priority_support_level' => 4,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'level_number' => 5,
                'name' => 'Mestre',
                'title' => 'Mestre do Bem-estar',
                'points_required' => 1000,
                'points_to_next' => null,
                'color_theme' => '#F59E0B', // Amber
                'icon' => 'crown',
                'rewards' => json_encode([
                    'master_badge' => true,
                    'vip_status' => true,
                    'exclusive_events' => true,
                    'lifetime_benefits' => true
                ]),
                'unlocked_features' => json_encode([
                    'all_features',
                    'beta_access',
                    'community_moderator',
                    'guest_passes'
                ]),
                'description' => 'Você alcançou o nível máximo! Aproveite todos os benefícios exclusivos.',
                'discount_percentage' => 20,
                'priority_support_level' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('gamification_levels')->insert($levels);
    }
}