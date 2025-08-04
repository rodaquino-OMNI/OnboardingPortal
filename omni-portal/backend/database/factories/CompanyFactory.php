<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Company>
 */
class CompanyFactory extends Factory
{
    protected $model = Company::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $companyName = fake()->company();
        $slug = Str::slug($companyName);

        // Generate Brazilian CNPJ format
        $cnpj = fake()->numerify('##.###.###/####-##');

        $contractStartDate = fake()->dateTimeBetween('-2 years', 'now');
        $contractEndDate = fake()->dateTimeBetween($contractStartDate, '+3 years');

        // Generate company settings
        $settings = [
            'theme' => fake()->randomElement(['light', 'dark', 'auto']),
            'notification_preferences' => [
                'email_notifications' => fake()->boolean(80),
                'sms_notifications' => fake()->boolean(60),
                'push_notifications' => fake()->boolean(70),
            ],
            'working_hours' => [
                'start' => fake()->numberBetween(7, 9) . ':00',
                'end' => fake()->numberBetween(17, 19) . ':00',
                'timezone' => 'America/Sao_Paulo',
            ],
            'language' => fake()->randomElement(['pt-BR', 'en-US', 'es-ES']),
            'currency' => fake()->randomElement(['BRL', 'USD', 'EUR']),
        ];

        // Generate onboarding configuration
        $onboardingConfig = [
            'steps' => [
                'personal_info' => [
                    'required' => true,
                    'order' => 1,
                    'fields' => ['name', 'email', 'phone', 'cpf']
                ],
                'documents' => [
                    'required' => true,
                    'order' => 2,
                    'required_documents' => ['id', 'proof_of_address', 'medical_records']
                ],
                'health_assessment' => [
                    'required' => fake()->boolean(80),
                    'order' => 3,
                    'questionnaire_id' => fake()->optional()->randomNumber(3)
                ],
                'interview_scheduling' => [
                    'required' => fake()->boolean(70),
                    'order' => 4,
                    'auto_scheduling' => fake()->boolean(30)
                ]
            ],
            'welcome_message' => fake()->text(200),
            'completion_message' => fake()->text(150),
            'estimated_duration' => fake()->numberBetween(15, 60), // minutes
            'reminder_schedule' => [
                'initial_delay' => 24, // hours
                'frequency' => 72, // hours
                'max_reminders' => 3
            ]
        ];

        // Generate enabled features
        $featuresEnabled = fake()->randomElements([
            'gamification',
            'video_consultations',
            'document_management',
            'health_assessments',
            'appointment_scheduling',
            'mobile_app',
            'api_access',
            'custom_branding',
            'analytics_dashboard',
            'bulk_imports',
            'automated_reminders',
            'multi_language_support'
        ], fake()->numberBetween(4, 8));

        // Generate custom fields
        $customFields = [];
        $customFieldCount = fake()->numberBetween(0, 5);
        for ($i = 0; $i < $customFieldCount; $i++) {
            $customFields[] = [
                'name' => fake()->words(2, true),
                'type' => fake()->randomElement(['text', 'number', 'select', 'checkbox', 'date']),
                'required' => fake()->boolean(60),
                'options' => fake()->randomElement(['text', 'number', 'date']) ? null : fake()->words(3),
                'order' => $i + 1,
            ];
        }

        return [
            'name' => $companyName,
            'slug' => $slug,
            'cnpj' => $cnpj,
            'email' => fake()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'website' => fake()->optional(0.7)->url(),
            'logo' => fake()->optional(0.5)->imageUrl(200, 200, 'business'),
            'primary_color' => fake()->hexColor(),
            'secondary_color' => fake()->hexColor(),
            'address' => fake()->streetAddress(),
            'city' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'zip_code' => fake()->postcode(),
            'contact_person_name' => fake()->name(),
            'contact_person_email' => fake()->email(),
            'contact_person_phone' => fake()->phoneNumber(),
            'contract_start_date' => $contractStartDate,
            'contract_end_date' => $contractEndDate,
            'max_beneficiaries' => fake()->numberBetween(50, 5000),
            'is_active' => fake()->boolean(90),
            'settings' => $settings,
            'onboarding_config' => $onboardingConfig,
            'features_enabled' => $featuresEnabled,
            'custom_fields' => $customFields,
        ];
    }

    /**
     * Create a small company (up to 100 beneficiaries).
     */
    public function small(): static
    {
        return $this->state(fn (array $attributes) => [
            'max_beneficiaries' => fake()->numberBetween(50, 100),
            'features_enabled' => fake()->randomElements([
                'gamification',
                'document_management',
                'health_assessments',
                'mobile_app'
            ], 4),
        ]);
    }

    /**
     * Create a medium company (100-1000 beneficiaries).
     */
    public function medium(): static
    {
        return $this->state(fn (array $attributes) => [
            'max_beneficiaries' => fake()->numberBetween(100, 1000),
            'features_enabled' => fake()->randomElements([
                'gamification',
                'video_consultations',
                'document_management',
                'health_assessments',
                'appointment_scheduling',
                'mobile_app',
                'analytics_dashboard'
            ], 6),
        ]);
    }

    /**
     * Create a large company (1000+ beneficiaries).
     */
    public function large(): static
    {
        return $this->state(fn (array $attributes) => [
            'max_beneficiaries' => fake()->numberBetween(1000, 10000),
            'features_enabled' => [
                'gamification',
                'video_consultations',
                'document_management',
                'health_assessments',
                'appointment_scheduling',
                'mobile_app',
                'api_access',
                'custom_branding',
                'analytics_dashboard',
                'bulk_imports',
                'automated_reminders',
                'multi_language_support'
            ],
        ]);
    }

    /**
     * Create an inactive company.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
            'contract_end_date' => fake()->dateTimeBetween('-1 year', 'now'),
        ]);
    }

    /**
     * Create a company with gamification enabled.
     */
    public function withGamification(): static
    {
        return $this->state(function (array $attributes) {
            $features = $attributes['features_enabled'] ?? [];
            if (!in_array('gamification', $features)) {
                $features[] = 'gamification';
            }
            
            return [
                'features_enabled' => $features,
                'onboarding_config' => array_merge($attributes['onboarding_config'] ?? [], [
                    'gamification_settings' => [
                        'points_for_completion' => fake()->numberBetween(50, 200),
                        'badges_enabled' => true,
                        'leaderboard_enabled' => fake()->boolean(70),
                        'challenges_enabled' => fake()->boolean(60),
                    ]
                ])
            ];
        });
    }

    /**
     * Create a tech company.
     */
    public function tech(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => fake()->company() . ' Tech',
            'website' => fake()->url(),
            'features_enabled' => [
                'gamification',
                'video_consultations',
                'document_management',
                'health_assessments',
                'appointment_scheduling',
                'mobile_app',
                'api_access',
                'custom_branding',
                'analytics_dashboard',
                'bulk_imports'
            ],
            'settings' => array_merge($attributes['settings'] ?? [], [
                'theme' => 'dark',
                'language' => 'en-US'
            ])
        ]);
    }

    /**
     * Create a healthcare company.
     */
    public function healthcare(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => fake()->company() . ' Healthcare',
            'features_enabled' => [
                'video_consultations',
                'document_management',
                'health_assessments',
                'appointment_scheduling',
                'mobile_app',
                'analytics_dashboard',
                'automated_reminders'
            ],
            'onboarding_config' => array_merge($attributes['onboarding_config'] ?? [], [
                'steps' => array_merge($attributes['onboarding_config']['steps'] ?? [], [
                    'health_assessment' => [
                        'required' => true,
                        'order' => 3,
                        'detailed_questionnaire' => true
                    ]
                ])
            ])
        ]);
    }

    /**
     * Create a startup company.
     */
    public function startup(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => fake()->company() . ' Startup',
            'max_beneficiaries' => fake()->numberBetween(10, 100),
            'contract_start_date' => fake()->dateTimeBetween('-6 months', 'now'),
            'contract_end_date' => fake()->dateTimeBetween('now', '+2 years'),
            'features_enabled' => fake()->randomElements([
                'gamification',
                'document_management',
                'mobile_app'
            ], 3),
        ]);
    }
}