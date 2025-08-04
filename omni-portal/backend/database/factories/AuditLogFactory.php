<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\Beneficiary;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AuditLog>
 */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $eventTypes = [
            'login', 'logout', 'data_access', 'data_modification', 'data_deletion',
            'data_export', 'consent_given', 'consent_withdrawn', 'privacy_settings_update',
            'account_deletion', 'password_change', 'profile_update', 'document_upload',
            'document_download', 'health_questionnaire_submit', 'interview_scheduled',
            'gamification_update'
        ];

        $eventCategories = ['authentication', 'data_processing', 'privacy', 'system', 'user_action'];
        $actions = ['create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import'];
        $modelTypes = ['App\\Models\\User', 'App\\Models\\Beneficiary', 'App\\Models\\Document', 'App\\Models\\Interview'];
        
        $eventType = fake()->randomElement($eventTypes);
        $isSuccessful = fake()->boolean(85);
        
        // Generate old and new values for modification events
        $oldValues = null;
        $newValues = null;
        $changedFields = [];
        
        if (in_array($eventType, ['data_modification', 'profile_update', 'privacy_settings_update'])) {
            $fieldNames = ['name', 'email', 'phone', 'status', 'preferences'];
            $changedFields = fake()->randomElements($fieldNames, fake()->numberBetween(1, 3));
            
            $oldValues = [];
            $newValues = [];
            
            foreach ($changedFields as $field) {
                switch ($field) {
                    case 'name':
                        $oldValues[$field] = fake()->name();
                        $newValues[$field] = fake()->name();
                        break;
                    case 'email':
                        $oldValues[$field] = fake()->email();
                        $newValues[$field] = fake()->email();
                        break;
                    case 'phone':
                        $oldValues[$field] = fake()->phoneNumber();
                        $newValues[$field] = fake()->phoneNumber();
                        break;
                    case 'status':
                        $oldValues[$field] = fake()->randomElement(['active', 'inactive']);
                        $newValues[$field] = fake()->randomElement(['active', 'inactive']);
                        break;
                    case 'preferences':
                        $oldValues[$field] = ['theme' => 'light', 'notifications' => true];
                        $newValues[$field] = ['theme' => 'dark', 'notifications' => false];
                        break;
                }
            }
        }

        // Generate request data
        $requestMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        $requestUrls = [
            '/api/users/profile',
            '/api/documents/upload',
            '/api/interviews/schedule',
            '/api/health/questionnaire',
            '/api/gamification/progress',
            '/dashboard',
            '/profile/edit',
            '/documents'
        ];

        $browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
        $platforms = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
        $deviceTypes = ['desktop', 'mobile', 'tablet'];

        $context = [
            'module' => fake()->randomElement(['authentication', 'documents', 'health', 'interviews', 'gamification']),
            'feature' => fake()->randomElement(['upload', 'download', 'view', 'edit', 'delete', 'schedule']),
            'source' => fake()->randomElement(['web', 'mobile_app', 'api']),
        ];

        $tags = fake()->randomElements([
            'security', 'privacy', 'gdpr', 'lgpd', 'sensitive', 'medical', 
            'financial', 'personal', 'authentication', 'system'
        ], fake()->numberBetween(1, 4));

        $dataClassifications = ['public', 'internal', 'confidential', 'restricted'];
        $legalBasis = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'];

        return [
            'user_id' => User::factory(),
            'user_type' => fake()->randomElement(['App\\Models\\User', 'App\\Models\\Beneficiary']),
            'event_type' => $eventType,
            'event_category' => fake()->randomElement($eventCategories),
            'model_type' => fake()->randomElement($modelTypes),
            'model_id' => fake()->numberBetween(1, 1000),
            'action' => fake()->randomElement($actions),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'changed_fields' => $changedFields,
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'browser' => fake()->randomElement($browsers),
            'browser_version' => fake()->numerify('##.#.###'),
            'platform' => fake()->randomElement($platforms),
            'device_type' => fake()->randomElement($deviceTypes),
            'country' => fake()->country(),
            'city' => fake()->city(),
            'latitude' => fake()->latitude(),
            'longitude' => fake()->longitude(),
            'session_id' => fake()->uuid(),
            'request_id' => fake()->uuid(),
            'request_method' => fake()->randomElement($requestMethods),
            'request_url' => fake()->randomElement($requestUrls),
            'request_headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'Authorization' => 'Bearer ' . fake()->sha256(),
            ],
            'request_body' => fake()->optional(0.4)->passthrough([
                'data' => fake()->words(5),
                'timestamp' => fake()->dateTime()->format('Y-m-d H:i:s'),
            ]),
            'response_status' => $isSuccessful ? fake()->randomElement([200, 201, 204]) : fake()->randomElement([400, 401, 403, 404, 500]),
            'response_time' => fake()->randomFloat(3, 0.1, 5.0),
            'is_sensitive_data' => fake()->boolean(30),
            'is_successful' => $isSuccessful,
            'error_message' => !$isSuccessful ? fake()->sentence() : null,
            'data_classification' => fake()->randomElement($dataClassifications),
            'legal_basis' => fake()->randomElement($legalBasis),
            'user_consent' => fake()->boolean(70),
            'consent_timestamp' => fake()->optional(0.7)->dateTimeBetween('-30 days', 'now'),
            'purpose' => fake()->sentence(),
            'retention_days' => fake()->numberBetween(365, 2555), // 1-7 years
            'expires_at' => fake()->dateTimeBetween('+1 year', '+7 years'),
            'tags' => $tags,
            'context' => $context,
        ];
    }

    /**
     * Create a login audit log.
     */
    public function login(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'login',
            'event_category' => 'authentication',
            'action' => 'login',
            'is_successful' => fake()->boolean(90),
            'response_status' => fake()->boolean(90) ? 200 : fake()->randomElement([401, 403]),
        ]);
    }

    /**
     * Create a logout audit log.
     */
    public function logout(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'logout',
            'event_category' => 'authentication',
            'action' => 'logout',
            'is_successful' => true,
            'response_status' => 200,
        ]);
    }

    /**
     * Create a data modification audit log.
     */
    public function dataModification(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => 'data_modification',
            'event_category' => 'data_processing',
            'action' => 'update',
            'old_values' => [
                'name' => fake()->name(),
                'email' => fake()->email(),
            ],
            'new_values' => [
                'name' => fake()->name(),
                'email' => fake()->email(),
            ],
            'changed_fields' => ['name', 'email'],
            'is_sensitive_data' => fake()->boolean(60),
        ]);
    }

    /**
     * Create a sensitive data audit log.
     */
    public function sensitiveData(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_sensitive_data' => true,
            'data_classification' => fake()->randomElement(['confidential', 'restricted']),
            'legal_basis' => fake()->randomElement(['consent', 'legal_obligation']),
            'user_consent' => true,
            'consent_timestamp' => fake()->dateTimeBetween('-30 days', 'now'),
            'tags' => array_merge($attributes['tags'] ?? [], ['sensitive', 'medical']),
        ]);
    }

    /**
     * Create a failed operation audit log.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_successful' => false,
            'response_status' => fake()->randomElement([400, 401, 403, 404, 500]),
            'error_message' => fake()->sentence(),
        ]);
    }

    /**
     * Create a recent audit log.
     */
    public function recent(): static
    {
        return $this->state(fn (array $attributes) => [
            'created_at' => fake()->dateTimeBetween('-7 days', 'now'),
        ]);
    }

    /**
     * Create a document-related audit log.
     */
    public function documentEvent(): static
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => fake()->randomElement(['document_upload', 'document_download']),
            'event_category' => 'user_action',
            'model_type' => 'App\\Models\\Document',
            'action' => fake()->randomElement(['create', 'read']),
            'context' => array_merge($attributes['context'] ?? [], [
                'module' => 'documents',
                'document_type' => fake()->randomElement(['id', 'medical', 'financial']),
            ]),
        ]);
    }

    /**
     * Create a GDPR/LGPD compliance audit log.
     */
    public function gdprCompliant(): static
    {
        return $this->state(fn (array $attributes) => [
            'legal_basis' => 'consent',
            'user_consent' => true,
            'consent_timestamp' => fake()->dateTimeBetween('-30 days', 'now'),
            'data_classification' => 'confidential',
            'retention_days' => 2555, // 7 years
            'tags' => array_merge($attributes['tags'] ?? [], ['gdpr', 'lgpd', 'privacy']),
        ]);
    }

    /**
     * Create an expired audit log.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => fake()->dateTimeBetween('-1 year', '-1 day'),
            'created_at' => fake()->dateTimeBetween('-8 years', '-1 year'),
        ]);
    }
}