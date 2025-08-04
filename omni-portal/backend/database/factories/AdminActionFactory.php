<?php

namespace Database\Factories;

use App\Models\AdminAction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AdminAction>
 */
class AdminActionFactory extends Factory
{
    protected $model = AdminAction::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $actionTypes = [
            'user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate',
            'user_reset_password', 'user_change_role', 'user_bulk_import', 'user_export',
            'company_create', 'company_update', 'company_delete', 'company_activate', 'company_deactivate',
            'system_backup', 'system_restore', 'system_maintenance', 'system_config_update',
            'report_generate', 'report_export', 'audit_log_export', 'data_cleanup',
            'permission_grant', 'permission_revoke', 'role_create', 'role_update', 'role_delete',
            'document_review', 'document_approve', 'document_reject', 'document_delete',
            'interview_reschedule', 'interview_cancel', 'slot_create', 'slot_update', 'slot_delete',
            'gamification_update', 'badge_create', 'badge_update', 'level_create', 'level_update'
        ];

        $actionType = fake()->randomElement($actionTypes);
        $success = fake()->boolean(85);

        // Generate action data based on action type
        $actionData = $this->generateActionData($actionType);

        return [
            'admin_user_id' => User::factory()->state(['role' => 'super_admin']),
            'target_user_id' => fake()->optional(0.7)->passthrough(User::factory()),
            'action_type' => $actionType,
            'action_data' => $actionData,
            'description' => $this->generateDescription($actionType, $actionData),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'success' => $success,
            'error_message' => !$success ? fake()->sentence() : null,
            'performed_at' => fake()->dateTimeBetween('-30 days', 'now'),
        ];
    }

    /**
     * Generate action data based on action type.
     */
    private function generateActionData(string $actionType): array
    {
        switch ($actionType) {
            case 'user_create':
            case 'user_update':
                return [
                    'name' => fake()->name(),
                    'email' => fake()->email(),
                    'role' => fake()->randomElement(['beneficiary', 'company_admin', 'healthcare_professional']),
                    'status' => fake()->randomElement(['active', 'inactive']),
                ];

            case 'user_change_role':
                return [
                    'old_role' => fake()->randomElement(['beneficiary', 'company_admin']),
                    'new_role' => fake()->randomElement(['company_admin', 'healthcare_professional']),
                ];

            case 'user_bulk_import':
                return [
                    'file_name' => fake()->words(2, true) . '.csv',
                    'records_processed' => fake()->numberBetween(10, 500),
                    'records_successful' => fake()->numberBetween(8, 450),
                    'records_failed' => fake()->numberBetween(0, 50),
                ];

            case 'company_create':
            case 'company_update':
                return [
                    'company_name' => fake()->company(),
                    'cnpj' => fake()->numerify('##.###.###/####-##'),
                    'max_beneficiaries' => fake()->numberBetween(50, 5000),
                    'features_enabled' => fake()->randomElements(['gamification', 'video_consultations', 'documents'], 3),
                ];

            case 'system_backup':
                return [
                    'backup_type' => fake()->randomElement(['full', 'incremental', 'differential']),
                    'backup_size' => fake()->numberBetween(100, 5000) . 'MB',
                    'tables_included' => fake()->numberBetween(15, 25),
                ];

            case 'report_generate':
            case 'report_export':
                return [
                    'report_type' => fake()->randomElement(['user_activity', 'company_statistics', 'system_performance', 'audit_summary']),
                    'date_range' => [
                        'start' => fake()->dateTimeBetween('-30 days', '-1 day')->format('Y-m-d'),
                        'end' => fake()->dateTimeBetween('-1 day', 'now')->format('Y-m-d'),
                    ],
                    'format' => fake()->randomElement(['pdf', 'excel', 'csv']),
                    'records_included' => fake()->numberBetween(100, 10000),
                ];

            case 'permission_grant':
            case 'permission_revoke':
                return [
                    'permission' => fake()->randomElement(['user.create', 'user.delete', 'company.manage', 'system.admin']),
                    'resource' => fake()->randomElement(['users', 'companies', 'system', 'reports']),
                ];

            case 'document_review':
            case 'document_approve':
            case 'document_reject':
                return [
                    'document_id' => fake()->numberBetween(1, 1000),
                    'document_type' => fake()->randomElement(['id', 'medical', 'financial', 'address']),
                    'review_notes' => fake()->optional(0.7)->sentence(),
                ];

            case 'gamification_update':
                return [
                    'beneficiary_id' => fake()->numberBetween(1, 1000),
                    'points_awarded' => fake()->numberBetween(10, 100),
                    'level_change' => fake()->optional(0.3)->numberBetween(1, 2),
                    'badges_earned' => fake()->optional(0.4)->randomElements(['first_steps', 'completionist', 'streak_master'], 1),
                ];

            case 'badge_create':
            case 'badge_update':
                return [
                    'badge_name' => fake()->words(2, true),
                    'points_value' => fake()->numberBetween(10, 100),
                    'rarity' => fake()->randomElement(['common', 'rare', 'legendary']),
                    'criteria' => [
                        'type' => 'points',
                        'value' => fake()->numberBetween(100, 1000),
                    ],
                ];

            default:
                return [
                    'action_details' => fake()->sentence(),
                    'timestamp' => now()->toISOString(),
                ];
        }
    }

    /**
     * Generate description based on action type and data.
     */
    private function generateDescription(string $actionType, array $actionData): string
    {
        switch ($actionType) {
            case 'user_create':
                return "Created new user: {$actionData['name']} ({$actionData['email']})";
            
            case 'user_update':
                return "Updated user profile for: {$actionData['name']}";
            
            case 'user_delete':
                return "Deleted user account";
            
            case 'user_activate':
                return "Activated user account";
            
            case 'user_deactivate':
                return "Deactivated user account";
            
            case 'user_change_role':
                return "Changed user role from {$actionData['old_role']} to {$actionData['new_role']}";
            
            case 'user_bulk_import':
                return "Bulk imported {$actionData['records_successful']} users from {$actionData['file_name']}";
            
            case 'company_create':
                return "Created new company: {$actionData['company_name']}";
            
            case 'company_update':
                return "Updated company settings for: {$actionData['company_name']}";
            
            case 'system_backup':
                return "Created {$actionData['backup_type']} system backup ({$actionData['backup_size']})";
            
            case 'report_generate':
                return "Generated {$actionData['report_type']} report with {$actionData['records_included']} records";
            
            case 'permission_grant':
                return "Granted {$actionData['permission']} permission";
            
            case 'permission_revoke':
                return "Revoked {$actionData['permission']} permission";
            
            case 'document_approve':
                return "Approved document (Type: {$actionData['document_type']})";
            
            case 'document_reject':
                return "Rejected document (Type: {$actionData['document_type']})";
            
            case 'gamification_update':
                return "Updated gamification progress: awarded {$actionData['points_awarded']} points";
            
            case 'badge_create':
                return "Created new badge: {$actionData['badge_name']} ({$actionData['rarity']})";
            
            default:
                return "Performed {$actionType} action";
        }
    }

    /**
     * Create a successful admin action.
     */
    public function successful(): static
    {
        return $this->state(fn (array $attributes) => [
            'success' => true,
            'error_message' => null,
        ]);
    }

    /**
     * Create a failed admin action.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'success' => false,
            'error_message' => fake()->sentence(),
        ]);
    }

    /**
     * Create a user management action.
     */
    public function userManagement(): static
    {
        return $this->state(fn (array $attributes) => [
            'action_type' => fake()->randomElement(['user_create', 'user_update', 'user_delete', 'user_activate', 'user_deactivate']),
            'target_user_id' => User::factory(),
        ]);
    }

    /**
     * Create a system administration action.
     */
    public function systemAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'action_type' => fake()->randomElement(['system_backup', 'system_restore', 'system_maintenance', 'system_config_update']),
            'target_user_id' => null,
        ]);
    }

    /**
     * Create a report generation action.
     */
    public function reportGeneration(): static
    {
        return $this->state(fn (array $attributes) => [
            'action_type' => 'report_generate',
            'action_data' => [
                'report_type' => fake()->randomElement(['user_activity', 'company_statistics', 'system_performance']),
                'date_range' => [
                    'start' => fake()->dateTimeBetween('-30 days', '-1 day')->format('Y-m-d'),
                    'end' => fake()->dateTimeBetween('-1 day', 'now')->format('Y-m-d'),
                ],
                'format' => fake()->randomElement(['pdf', 'excel', 'csv']),
                'records_included' => fake()->numberBetween(100, 10000),
            ],
        ]);
    }

    /**
     * Create a recent admin action.
     */
    public function recent(): static
    {
        return $this->state(fn (array $attributes) => [
            'performed_at' => fake()->dateTimeBetween('-7 days', 'now'),
        ]);
    }

    /**
     * Create a super admin action.
     */
    public function superAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'admin_user_id' => User::factory()->state(['role' => 'super_admin']),
            'action_type' => fake()->randomElement(['system_backup', 'user_bulk_import', 'company_delete', 'system_maintenance']),
        ]);
    }

    /**
     * Create a company admin action.
     */
    public function companyAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'admin_user_id' => User::factory()->state(['role' => 'company_admin']),
            'action_type' => fake()->randomElement(['user_update', 'user_activate', 'user_deactivate', 'report_generate']),
        ]);
    }
}