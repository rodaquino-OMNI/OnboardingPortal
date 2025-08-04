<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\GamificationBadge;
use Illuminate\Support\Str;

class DefaultBadgesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $badges = [
            [
                'name' => 'Primeiro Acesso',
                'slug' => 'first_login',
                'description' => 'Bem-vindo! Você fez seu primeiro login.',
                'icon_name' => '👋',
                'icon_color' => '#4CAF50',
                'category' => 'onboarding',
                'rarity' => 'common',
                'points_value' => 10,
                'criteria' => json_encode(['action' => 'first_login']),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Madrugador',
                'slug' => 'early_bird',
                'description' => 'Acesse a plataforma antes das 6h da manhã.',
                'icon_name' => '🌅',
                'icon_color' => '#FF9800',
                'category' => 'engagement',
                'rarity' => 'rare',
                'points_value' => 25,
                'criteria' => json_encode(['time' => 'before_6am']),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Perfil Completo',
                'slug' => 'profile_complete',
                'description' => 'Complete 100% do seu perfil.',
                'icon_name' => '✅',
                'icon_color' => '#2196F3',
                'category' => 'onboarding',
                'rarity' => 'common',
                'points_value' => 50,
                'criteria' => json_encode(['profile_completion' => 100]),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Explorador',
                'slug' => 'explorer',
                'description' => 'Visite todas as seções principais da plataforma.',
                'icon_name' => '🧭',
                'icon_color' => '#9C27B0',
                'category' => 'engagement',
                'rarity' => 'common',
                'points_value' => 30,
                'criteria' => json_encode(['sections_visited' => 'all']),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Mestre da Saúde',
                'slug' => 'health_master',
                'description' => 'Complete 5 avaliações de saúde.',
                'icon_name' => '🏥',
                'icon_color' => '#F44336',
                'category' => 'health',
                'rarity' => 'epic',
                'points_value' => 100,
                'criteria' => json_encode(['health_assessments' => 5]),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Documentos em Dia',
                'slug' => 'documents_complete',
                'description' => 'Faça upload de todos os documentos obrigatórios.',
                'icon_name' => '📄',
                'icon_color' => '#607D8B',
                'category' => 'milestone',
                'rarity' => 'rare',
                'points_value' => 75,
                'criteria' => json_encode(['required_documents' => 'all']),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Sequência de 7 dias',
                'slug' => 'streak_7_days',
                'description' => 'Acesse a plataforma por 7 dias consecutivos.',
                'icon_name' => '🔥',
                'icon_color' => '#FF5722',
                'category' => 'engagement',
                'rarity' => 'rare',
                'points_value' => 50,
                'criteria' => json_encode(['streak_days' => 7]),
                'is_active' => true,
                'is_secret' => false,
            ],
            [
                'name' => 'Lenda Viva',
                'slug' => 'legend',
                'description' => 'Alcance o nível 10.',
                'icon_name' => '👑',
                'icon_color' => '#FFD700',
                'category' => 'special',
                'rarity' => 'legendary',
                'points_value' => 500,
                'criteria' => json_encode(['level' => 10]),
                'is_active' => true,
                'is_secret' => false,
            ],
        ];

        foreach ($badges as $badge) {
            GamificationBadge::firstOrCreate(
                ['slug' => $badge['slug']],
                $badge
            );
        }

        $this->command->info('Default badges created successfully!');
    }
}