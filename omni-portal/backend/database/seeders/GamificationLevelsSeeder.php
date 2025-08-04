<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\GamificationLevel;

class GamificationLevelsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $levels = [
            [
                'level_number' => 1,
                'name' => 'Iniciante',
                'title' => 'Iniciante',
                'points_required' => 0,
                'points_to_next' => 100,
                'color_theme' => '#4CAF50',
                'icon' => '🌱',
                'description' => 'Bem-vindo! Sua jornada começa aqui.',
                'rewards' => json_encode(['access_basic_features']),
                'unlocked_features' => json_encode(['profile', 'documents']),
                'discount_percentage' => 0,
            ],
            [
                'level_number' => 2,
                'name' => 'Aprendiz',
                'title' => 'Aprendiz',
                'points_required' => 100,
                'points_to_next' => 150,
                'color_theme' => '#2196F3',
                'icon' => '📚',
                'description' => 'Você está aprendendo rápido!',
                'rewards' => json_encode(['badge_slot_1']),
                'unlocked_features' => json_encode(['health_assessment']),
                'discount_percentage' => 5,
            ],
            [
                'level_number' => 3,
                'name' => 'Explorador',
                'title' => 'Explorador',
                'points_required' => 250,
                'points_to_next' => 250,
                'color_theme' => '#FF9800',
                'icon' => '🧭',
                'description' => 'Explorando novas possibilidades.',
                'rewards' => json_encode(['custom_avatar']),
                'unlocked_features' => json_encode(['advanced_reports']),
                'discount_percentage' => 10,
            ],
            [
                'level_number' => 4,
                'name' => 'Veterano',
                'title' => 'Veterano',
                'points_required' => 500,
                'points_to_next' => 500,
                'color_theme' => '#9C27B0',
                'icon' => '⭐',
                'description' => 'Experiência e dedicação.',
                'rewards' => json_encode(['priority_support']),
                'unlocked_features' => json_encode(['video_consultation']),
                'discount_percentage' => 15,
            ],
            [
                'level_number' => 5,
                'name' => 'Especialista',
                'title' => 'Especialista',
                'points_required' => 1000,
                'points_to_next' => 1000,
                'color_theme' => '#F44336',
                'icon' => '🎯',
                'description' => 'Conhecimento especializado.',
                'rewards' => json_encode(['exclusive_content']),
                'unlocked_features' => json_encode(['ai_insights']),
                'discount_percentage' => 20,
            ],
            [
                'level_number' => 6,
                'name' => 'Mestre',
                'title' => 'Mestre',
                'points_required' => 2000,
                'points_to_next' => 1500,
                'color_theme' => '#3F51B5',
                'icon' => '🏆',
                'description' => 'Maestria alcançada.',
                'rewards' => json_encode(['mentor_access']),
                'unlocked_features' => json_encode(['beta_features']),
                'discount_percentage' => 25,
            ],
            [
                'level_number' => 7,
                'name' => 'Elite',
                'title' => 'Elite',
                'points_required' => 3500,
                'points_to_next' => 2000,
                'color_theme' => '#00BCD4',
                'icon' => '💎',
                'description' => 'Entre os melhores.',
                'rewards' => json_encode(['vip_events']),
                'unlocked_features' => json_encode(['white_label']),
                'discount_percentage' => 30,
            ],
            [
                'level_number' => 8,
                'name' => 'Campeão',
                'title' => 'Campeão',
                'points_required' => 5500,
                'points_to_next' => 2500,
                'color_theme' => '#FF5722',
                'icon' => '🥇',
                'description' => 'Campeão da saúde.',
                'rewards' => json_encode(['lifetime_benefits']),
                'unlocked_features' => json_encode(['api_access']),
                'discount_percentage' => 35,
            ],
            [
                'level_number' => 9,
                'name' => 'Guardião',
                'title' => 'Guardião',
                'points_required' => 8000,
                'points_to_next' => 4000,
                'color_theme' => '#795548',
                'icon' => '🛡️',
                'description' => 'Guardião do bem-estar.',
                'rewards' => json_encode(['guardian_badge']),
                'unlocked_features' => json_encode(['admin_tools']),
                'discount_percentage' => 40,
            ],
            [
                'level_number' => 10,
                'name' => 'Lenda',
                'title' => 'Lenda',
                'points_required' => 12000,
                'points_to_next' => 0,
                'color_theme' => '#FFD700',
                'icon' => '👑',
                'description' => 'Status lendário alcançado!',
                'rewards' => json_encode(['legendary_status', 'hall_of_fame']),
                'unlocked_features' => json_encode(['all_features']),
                'discount_percentage' => 50,
            ],
        ];

        foreach ($levels as $level) {
            GamificationLevel::firstOrCreate(
                ['level_number' => $level['level_number']],
                $level
            );
        }

        $this->command->info('Gamification levels created successfully!');
    }
}