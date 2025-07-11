<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class HealthCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        // First, insert parent categories
        $parentCategories = [
            [
                'id' => 1,
                'name' => 'Doenças Crônicas',
                'slug' => 'chronic-diseases',
                'description' => 'Condições de saúde de longa duração que requerem acompanhamento contínuo',
                'icon' => 'heart-pulse',
                'color' => '#DC2626',
                'parent_id' => null,
                'sort_order' => 1,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['diabetes', 'hypertension', 'heart_disease']),
                'risk_factors' => json_encode(['sedentary_lifestyle', 'poor_diet', 'smoking', 'obesity']),
                'prevention_tips' => json_encode([
                    'Mantenha uma dieta equilibrada',
                    'Pratique exercícios regularmente',
                    'Monitore sua pressão arterial',
                    'Faça check-ups regulares'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 2,
                'name' => 'Saúde Mental',
                'slug' => 'mental-health',
                'description' => 'Bem-estar psicológico e emocional',
                'icon' => 'brain',
                'color' => '#7C3AED',
                'parent_id' => null,
                'sort_order' => 2,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['depression', 'anxiety', 'stress']),
                'risk_factors' => json_encode(['chronic_stress', 'trauma', 'isolation', 'substance_abuse']),
                'prevention_tips' => json_encode([
                    'Pratique mindfulness e meditação',
                    'Mantenha conexões sociais',
                    'Durma adequadamente',
                    'Procure ajuda profissional quando necessário'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 3,
                'name' => 'Nutrição',
                'slug' => 'nutrition',
                'description' => 'Alimentação saudável e balanceada',
                'icon' => 'apple',
                'color' => '#10B981',
                'parent_id' => null,
                'sort_order' => 3,
                'is_active' => true,
                'requires_specialist' => false,
                'related_conditions' => json_encode(['obesity', 'malnutrition', 'eating_disorders']),
                'risk_factors' => json_encode(['poor_diet', 'irregular_meals', 'processed_foods']),
                'prevention_tips' => json_encode([
                    'Consuma frutas e vegetais diariamente',
                    'Beba bastante água',
                    'Evite alimentos ultraprocessados',
                    'Faça refeições regulares'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 4,
                'name' => 'Atividade Física',
                'slug' => 'physical-activity',
                'description' => 'Exercícios e movimento para uma vida saudável',
                'icon' => 'dumbbell',
                'color' => '#F59E0B',
                'parent_id' => null,
                'sort_order' => 4,
                'is_active' => true,
                'requires_specialist' => false,
                'related_conditions' => json_encode(['sedentary_lifestyle', 'muscle_weakness', 'poor_fitness']),
                'risk_factors' => json_encode(['inactivity', 'desk_job', 'lack_of_motivation']),
                'prevention_tips' => json_encode([
                    'Exercite-se pelo menos 150 minutos por semana',
                    'Inclua exercícios de força e flexibilidade',
                    'Faça pausas ativas durante o trabalho',
                    'Encontre atividades que você goste'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 5,
                'name' => 'Saúde Preventiva',
                'slug' => 'preventive-health',
                'description' => 'Prevenção de doenças e check-ups regulares',
                'icon' => 'shield-check',
                'color' => '#3B82F6',
                'parent_id' => null,
                'sort_order' => 5,
                'is_active' => true,
                'requires_specialist' => false,
                'related_conditions' => json_encode(['screening', 'vaccinations', 'check_ups']),
                'risk_factors' => json_encode(['missed_screenings', 'incomplete_vaccinations']),
                'prevention_tips' => json_encode([
                    'Mantenha suas vacinas em dia',
                    'Faça exames preventivos regularmente',
                    'Conheça seu histórico familiar',
                    'Adote hábitos saudáveis'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('health_categories')->insert($parentCategories);

        // Then, insert subcategories
        $subCategories = [
            // Chronic Diseases subcategories
            [
                'name' => 'Diabetes',
                'slug' => 'diabetes',
                'description' => 'Controle e manejo do diabetes',
                'icon' => 'droplet',
                'color' => '#DC2626',
                'parent_id' => 1,
                'sort_order' => 1,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['type1_diabetes', 'type2_diabetes', 'prediabetes']),
                'risk_factors' => json_encode(['obesity', 'family_history', 'sedentary_lifestyle']),
                'prevention_tips' => json_encode([
                    'Monitore seus níveis de glicose',
                    'Mantenha uma dieta adequada',
                    'Pratique exercícios regularmente',
                    'Tome medicamentos conforme prescrito'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Hipertensão',
                'slug' => 'hypertension',
                'description' => 'Controle da pressão arterial',
                'icon' => 'activity',
                'color' => '#DC2626',
                'parent_id' => 1,
                'sort_order' => 2,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['high_blood_pressure', 'cardiovascular_disease']),
                'risk_factors' => json_encode(['high_salt_intake', 'stress', 'obesity', 'smoking']),
                'prevention_tips' => json_encode([
                    'Reduza o consumo de sal',
                    'Mantenha um peso saudável',
                    'Evite o estresse excessivo',
                    'Monitore sua pressão regularmente'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // Mental Health subcategories
            [
                'name' => 'Ansiedade',
                'slug' => 'anxiety',
                'description' => 'Manejo de transtornos de ansiedade',
                'icon' => 'alert-circle',
                'color' => '#7C3AED',
                'parent_id' => 2,
                'sort_order' => 1,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['generalized_anxiety', 'panic_disorder', 'social_anxiety']),
                'risk_factors' => json_encode(['stress', 'trauma', 'genetics', 'substance_use']),
                'prevention_tips' => json_encode([
                    'Pratique técnicas de relaxamento',
                    'Mantenha uma rotina regular',
                    'Limite cafeína e álcool',
                    'Procure apoio profissional'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Depressão',
                'slug' => 'depression',
                'description' => 'Apoio e tratamento para depressão',
                'icon' => 'cloud-rain',
                'color' => '#7C3AED',
                'parent_id' => 2,
                'sort_order' => 2,
                'is_active' => true,
                'requires_specialist' => true,
                'related_conditions' => json_encode(['major_depression', 'seasonal_depression', 'postpartum_depression']),
                'risk_factors' => json_encode(['isolation', 'chronic_illness', 'trauma', 'family_history']),
                'prevention_tips' => json_encode([
                    'Mantenha conexões sociais',
                    'Pratique atividades prazerosas',
                    'Estabeleça uma rotina saudável',
                    'Não hesite em buscar ajuda'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // Nutrition subcategories
            [
                'name' => 'Controle de Peso',
                'slug' => 'weight-management',
                'description' => 'Manutenção de peso saudável',
                'icon' => 'scale',
                'color' => '#10B981',
                'parent_id' => 3,
                'sort_order' => 1,
                'is_active' => true,
                'requires_specialist' => false,
                'related_conditions' => json_encode(['obesity', 'overweight', 'underweight']),
                'risk_factors' => json_encode(['poor_diet', 'sedentary_lifestyle', 'hormonal_issues']),
                'prevention_tips' => json_encode([
                    'Mantenha um déficit calórico saudável',
                    'Combine dieta com exercícios',
                    'Evite dietas restritivas extremas',
                    'Monitore seu progresso regularmente'
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('health_categories')->insert($subCategories);
    }
}