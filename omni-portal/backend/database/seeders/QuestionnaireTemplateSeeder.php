<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class QuestionnaireTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $templates = [
            [
                'name' => 'Questionário de Saúde Inicial',
                'code' => 'initial_health_assessment',
                'description' => 'Avaliação completa de saúde para novos beneficiários',
                'type' => 'initial',
                'health_category_id' => 5, // Preventive Health
                'sections' => json_encode([
                    [
                        'title' => 'Informações Básicas de Saúde',
                        'description' => 'Dados gerais sobre sua saúde',
                        'questions' => [
                            [
                                'id' => 'height',
                                'text' => 'Qual é sua altura? (em cm)',
                                'type' => 'number',
                                'required' => true,
                                'validation' => ['min' => 50, 'max' => 250]
                            ],
                            [
                                'id' => 'weight',
                                'text' => 'Qual é seu peso? (em kg)',
                                'type' => 'number',
                                'required' => true,
                                'validation' => ['min' => 20, 'max' => 300]
                            ],
                            [
                                'id' => 'blood_type',
                                'text' => 'Qual é seu tipo sanguíneo?',
                                'type' => 'select',
                                'required' => false,
                                'options' => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Não sei']
                            ],
                            [
                                'id' => 'chronic_conditions',
                                'text' => 'Você possui alguma condição crônica de saúde?',
                                'type' => 'multiselect',
                                'required' => true,
                                'options' => [
                                    'Diabetes',
                                    'Hipertensão',
                                    'Doença cardíaca',
                                    'Asma',
                                    'Artrite',
                                    'Doença renal',
                                    'Câncer',
                                    'Outra',
                                    'Nenhuma'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Estilo de Vida',
                        'description' => 'Hábitos que impactam sua saúde',
                        'questions' => [
                            [
                                'id' => 'smoking',
                                'text' => 'Você fuma?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca fumei', 'Ex-fumante', 'Fumo ocasionalmente', 'Fumo diariamente']
                            ],
                            [
                                'id' => 'alcohol',
                                'text' => 'Com que frequência você consome bebidas alcoólicas?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', 'Raramente', 'Socialmente', '1-2 vezes por semana', 'Diariamente']
                            ],
                            [
                                'id' => 'exercise_frequency',
                                'text' => 'Quantas vezes por semana você pratica exercícios físicos?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', '1-2 vezes', '3-4 vezes', '5-6 vezes', 'Todos os dias']
                            ],
                            [
                                'id' => 'sleep_hours',
                                'text' => 'Quantas horas você dorme em média por noite?',
                                'type' => 'number',
                                'required' => true,
                                'validation' => ['min' => 1, 'max' => 24]
                            ],
                            [
                                'id' => 'stress_level',
                                'text' => 'Como você classificaria seu nível de estresse?',
                                'type' => 'scale',
                                'required' => true,
                                'scale' => ['min' => 1, 'max' => 10, 'labels' => ['Muito baixo', 'Muito alto']]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Histórico Médico',
                        'description' => 'Informações sobre seu histórico de saúde',
                        'questions' => [
                            [
                                'id' => 'medications',
                                'text' => 'Liste todos os medicamentos que você toma regularmente',
                                'type' => 'textarea',
                                'required' => false,
                                'placeholder' => 'Nome do medicamento, dosagem e frequência'
                            ],
                            [
                                'id' => 'allergies',
                                'text' => 'Você tem alguma alergia? (medicamentos, alimentos, etc.)',
                                'type' => 'textarea',
                                'required' => false,
                                'placeholder' => 'Descreva suas alergias'
                            ],
                            [
                                'id' => 'surgeries',
                                'text' => 'Você já realizou alguma cirurgia?',
                                'type' => 'boolean',
                                'required' => true,
                                'follow_up' => [
                                    'if' => true,
                                    'question' => [
                                        'id' => 'surgery_details',
                                        'text' => 'Descreva as cirurgias realizadas e quando',
                                        'type' => 'textarea',
                                        'required' => true
                                    ]
                                ]
                            ],
                            [
                                'id' => 'family_history',
                                'text' => 'Selecione condições de saúde presentes em sua família',
                                'type' => 'multiselect',
                                'required' => false,
                                'options' => [
                                    'Diabetes',
                                    'Hipertensão',
                                    'Doença cardíaca',
                                    'Câncer',
                                    'Alzheimer',
                                    'Depressão',
                                    'AVC',
                                    'Nenhuma'
                                ]
                            ]
                        ]
                    ]
                ]),
                'scoring_rules' => json_encode([
                    'bmi_calculation' => 'weight / (height/100)^2',
                    'risk_factors' => [
                        'smoking' => ['Fumo diariamente' => 3, 'Fumo ocasionalmente' => 2],
                        'alcohol' => ['Diariamente' => 3, '1-2 vezes por semana' => 1],
                        'exercise_frequency' => ['Nunca' => 3, '1-2 vezes' => 2],
                        'sleep_hours' => ['<6' => 2, '>9' => 1],
                        'stress_level' => ['>7' => 2]
                    ]
                ]),
                'risk_assessment_rules' => json_encode([
                    'high_risk' => 'total_score >= 10',
                    'medium_risk' => 'total_score >= 5 && total_score < 10',
                    'low_risk' => 'total_score < 5'
                ]),
                'is_active' => true,
                'version' => 1,
                'estimated_minutes' => 15,
                'required_for' => json_encode(['all_beneficiaries']),
                'languages' => json_encode(['pt-BR', 'en-US']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Avaliação de Saúde Mental',
                'code' => 'mental_health_assessment',
                'description' => 'Questionário focado em bem-estar mental e emocional',
                'type' => 'specific',
                'health_category_id' => 2, // Mental Health
                'sections' => json_encode([
                    [
                        'title' => 'Bem-estar Emocional',
                        'description' => 'Como você tem se sentido nas últimas semanas',
                        'questions' => [
                            [
                                'id' => 'mood_general',
                                'text' => 'Como você descreveria seu humor geral nas últimas 2 semanas?',
                                'type' => 'scale',
                                'required' => true,
                                'scale' => ['min' => 1, 'max' => 10, 'labels' => ['Muito ruim', 'Excelente']]
                            ],
                            [
                                'id' => 'anxiety_frequency',
                                'text' => 'Com que frequência você se sente ansioso(a)?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre']
                            ],
                            [
                                'id' => 'depression_symptoms',
                                'text' => 'Você tem experimentado algum destes sintomas?',
                                'type' => 'multiselect',
                                'required' => true,
                                'options' => [
                                    'Tristeza persistente',
                                    'Perda de interesse em atividades',
                                    'Alterações no apetite',
                                    'Problemas de sono',
                                    'Fadiga',
                                    'Dificuldade de concentração',
                                    'Pensamentos negativos',
                                    'Nenhum'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Suporte Social',
                        'description' => 'Sua rede de apoio',
                        'questions' => [
                            [
                                'id' => 'social_support',
                                'text' => 'Você sente que tem apoio adequado de família e amigos?',
                                'type' => 'scale',
                                'required' => true,
                                'scale' => ['min' => 1, 'max' => 5, 'labels' => ['Nenhum apoio', 'Muito apoio']]
                            ],
                            [
                                'id' => 'isolation_feeling',
                                'text' => 'Com que frequência você se sente sozinho(a) ou isolado(a)?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre']
                            ],
                            [
                                'id' => 'professional_help',
                                'text' => 'Você já procurou ajuda profissional para saúde mental?',
                                'type' => 'boolean',
                                'required' => true,
                                'follow_up' => [
                                    'if' => true,
                                    'question' => [
                                        'id' => 'help_effectiveness',
                                        'text' => 'Como você avalia a ajuda recebida?',
                                        'type' => 'scale',
                                        'required' => true,
                                        'scale' => ['min' => 1, 'max' => 5, 'labels' => ['Não ajudou', 'Muito útil']]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]),
                'scoring_rules' => json_encode([
                    'mental_health_score' => [
                        'mood_general' => 'direct_score',
                        'anxiety_frequency' => ['Sempre' => 5, 'Frequentemente' => 4, 'Às vezes' => 3, 'Raramente' => 2, 'Nunca' => 1],
                        'depression_symptoms' => 'count * 2',
                        'social_support' => 'inverse_score',
                        'isolation_feeling' => ['Sempre' => 5, 'Frequentemente' => 4, 'Às vezes' => 3, 'Raramente' => 2, 'Nunca' => 1]
                    ]
                ]),
                'risk_assessment_rules' => json_encode([
                    'needs_immediate_help' => 'mental_health_score >= 35',
                    'needs_support' => 'mental_health_score >= 20 && mental_health_score < 35',
                    'monitor' => 'mental_health_score >= 10 && mental_health_score < 20',
                    'healthy' => 'mental_health_score < 10'
                ]),
                'is_active' => true,
                'version' => 1,
                'estimated_minutes' => 10,
                'required_for' => json_encode(['mental_health_concerns']),
                'languages' => json_encode(['pt-BR']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Avaliação Nutricional',
                'code' => 'nutrition_assessment',
                'description' => 'Questionário sobre hábitos alimentares e nutrição',
                'type' => 'specific',
                'health_category_id' => 3, // Nutrition
                'sections' => json_encode([
                    [
                        'title' => 'Hábitos Alimentares',
                        'description' => 'Seus padrões alimentares diários',
                        'questions' => [
                            [
                                'id' => 'meals_per_day',
                                'text' => 'Quantas refeições você faz por dia?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['1-2', '3', '4', '5 ou mais']
                            ],
                            [
                                'id' => 'breakfast_frequency',
                                'text' => 'Com que frequência você toma café da manhã?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', 'Raramente', '3-4 vezes por semana', 'Diariamente']
                            ],
                            [
                                'id' => 'water_intake',
                                'text' => 'Quantos copos de água você bebe por dia?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Menos de 4', '4-6', '7-8', 'Mais de 8']
                            ],
                            [
                                'id' => 'fruits_vegetables',
                                'text' => 'Quantas porções de frutas e vegetais você consome diariamente?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['0-1', '2-3', '4-5', 'Mais de 5']
                            ],
                            [
                                'id' => 'processed_foods',
                                'text' => 'Com que frequência você consome alimentos ultraprocessados?',
                                'type' => 'select',
                                'required' => true,
                                'options' => ['Nunca', 'Raramente', 'Semanalmente', 'Várias vezes por semana', 'Diariamente']
                            ],
                            [
                                'id' => 'dietary_restrictions',
                                'text' => 'Você segue alguma dieta específica ou tem restrições alimentares?',
                                'type' => 'multiselect',
                                'required' => false,
                                'options' => [
                                    'Vegetariana',
                                    'Vegana',
                                    'Sem glúten',
                                    'Sem lactose',
                                    'Low carb',
                                    'Diabética',
                                    'Outra',
                                    'Nenhuma'
                                ]
                            ]
                        ]
                    ]
                ]),
                'scoring_rules' => json_encode([
                    'nutrition_score' => [
                        'meals_per_day' => ['3' => 0, '4' => 0, '1-2' => 2, '5 ou mais' => 1],
                        'breakfast_frequency' => ['Diariamente' => 0, '3-4 vezes por semana' => 1, 'Raramente' => 2, 'Nunca' => 3],
                        'water_intake' => ['Mais de 8' => 0, '7-8' => 0, '4-6' => 1, 'Menos de 4' => 3],
                        'fruits_vegetables' => ['Mais de 5' => 0, '4-5' => 0, '2-3' => 1, '0-1' => 3],
                        'processed_foods' => ['Nunca' => 0, 'Raramente' => 0, 'Semanalmente' => 1, 'Várias vezes por semana' => 2, 'Diariamente' => 3]
                    ]
                ]),
                'risk_assessment_rules' => json_encode([
                    'poor_nutrition' => 'nutrition_score >= 10',
                    'needs_improvement' => 'nutrition_score >= 5 && nutrition_score < 10',
                    'good_nutrition' => 'nutrition_score < 5'
                ]),
                'is_active' => true,
                'version' => 1,
                'estimated_minutes' => 5,
                'required_for' => json_encode(['weight_management', 'diabetes', 'hypertension']),
                'languages' => json_encode(['pt-BR']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('questionnaire_templates')->insert($templates);
    }
}