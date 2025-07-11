<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'user_type',
        'event_type',
        'event_category',
        'model_type',
        'model_id',
        'action',
        'old_values',
        'new_values',
        'changed_fields',
        'ip_address',
        'user_agent',
        'browser',
        'browser_version',
        'platform',
        'device_type',
        'country',
        'city',
        'latitude',
        'longitude',
        'session_id',
        'request_id',
        'request_method',
        'request_url',
        'request_headers',
        'request_body',
        'response_status',
        'response_time',
        'is_sensitive_data',
        'is_successful',
        'error_message',
        'data_classification',
        'legal_basis',
        'user_consent',
        'consent_timestamp',
        'purpose',
        'retention_days',
        'expires_at',
        'tags',
        'context',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'changed_fields' => 'array',
        'request_headers' => 'array',
        'request_body' => 'array',
        'is_sensitive_data' => 'boolean',
        'is_successful' => 'boolean',
        'user_consent' => 'boolean',
        'consent_timestamp' => 'datetime',
        'expires_at' => 'datetime',
        'tags' => 'array',
        'context' => 'array',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'response_time' => 'decimal:3',
    ];

    /**
     * Get the user that performed the action
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the model that was affected by the action
     */
    public function model()
    {
        if ($this->model_type && $this->model_id) {
            return $this->morphTo('model', 'model_type', 'model_id');
        }
        return null;
    }

    /**
     * Scope to filter by event type
     */
    public function scopeByEventType($query, string $eventType)
    {
        return $query->where('event_type', $eventType);
    }

    /**
     * Scope to filter by event category
     */
    public function scopeByEventCategory($query, string $eventCategory)
    {
        return $query->where('event_category', $eventCategory);
    }

    /**
     * Scope to filter by user
     */
    public function scopeByUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to filter by model
     */
    public function scopeByModel($query, string $modelType, int $modelId = null)
    {
        $query = $query->where('model_type', $modelType);
        
        if ($modelId) {
            $query->where('model_id', $modelId);
        }
        
        return $query;
    }

    /**
     * Scope to filter by action
     */
    public function scopeByAction($query, string $action)
    {
        return $query->where('action', $action);
    }

    /**
     * Scope to filter sensitive data
     */
    public function scopeSensitiveData($query)
    {
        return $query->where('is_sensitive_data', true);
    }

    /**
     * Scope to filter by IP address
     */
    public function scopeByIpAddress($query, string $ipAddress)
    {
        return $query->where('ip_address', $ipAddress);
    }

    /**
     * Scope to filter by date range
     */
    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    /**
     * Scope to filter by data classification
     */
    public function scopeByDataClassification($query, string $classification)
    {
        return $query->where('data_classification', $classification);
    }

    /**
     * Scope to filter by legal basis
     */
    public function scopeByLegalBasis($query, string $legalBasis)
    {
        return $query->where('legal_basis', $legalBasis);
    }

    /**
     * Scope to filter by consent
     */
    public function scopeWithUserConsent($query, bool $hasConsent = true)
    {
        return $query->where('user_consent', $hasConsent);
    }

    /**
     * Scope to filter expired logs
     */
    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<', now());
    }

    /**
     * Get formatted IP address
     */
    public function getFormattedIpAttribute(): ?string
    {
        if (!$this->ip_address) {
            return null;
        }

        // Anonymize the last octet for privacy
        $parts = explode('.', $this->ip_address);
        if (count($parts) === 4) {
            $parts[3] = 'xxx';
            return implode('.', $parts);
        }

        return $this->ip_address;
    }

    /**
     * Get user agent info
     */
    public function getUserAgentInfoAttribute(): array
    {
        return [
            'browser' => $this->browser,
            'browser_version' => $this->browser_version,
            'platform' => $this->platform,
            'device_type' => $this->device_type,
        ];
    }

    /**
     * Get location info
     */
    public function getLocationInfoAttribute(): array
    {
        return [
            'country' => $this->country,
            'city' => $this->city,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
        ];
    }

    /**
     * Check if log is expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    /**
     * Get human-readable event description
     */
    public function getEventDescriptionAttribute(): string
    {
        $descriptions = [
            'login' => 'Usuário fez login',
            'logout' => 'Usuário fez logout',
            'data_access' => 'Dados foram acessados',
            'data_modification' => 'Dados foram modificados',
            'data_deletion' => 'Dados foram excluídos',
            'data_export' => 'Dados foram exportados',
            'consent_given' => 'Consentimento foi dado',
            'consent_withdrawn' => 'Consentimento foi retirado',
            'privacy_settings_update' => 'Configurações de privacidade foram atualizadas',
            'account_deletion' => 'Conta foi excluída',
            'password_change' => 'Senha foi alterada',
            'profile_update' => 'Perfil foi atualizado',
            'document_upload' => 'Documento foi enviado',
            'document_download' => 'Documento foi baixado',
            'health_questionnaire_submit' => 'Questionário de saúde foi enviado',
            'interview_scheduled' => 'Entrevista foi agendada',
            'gamification_update' => 'Progresso de gamificação foi atualizado',
        ];

        return $descriptions[$this->event_type] ?? 'Evento não identificado';
    }

    /**
     * Get risk level based on event type and data sensitivity
     */
    public function getRiskLevelAttribute(): string
    {
        if ($this->is_sensitive_data) {
            $highRiskEvents = ['data_export', 'data_deletion', 'account_deletion', 'consent_withdrawn'];
            if (in_array($this->event_type, $highRiskEvents)) {
                return 'high';
            }
            return 'medium';
        }

        return 'low';
    }

    /**
     * Create audit log entry
     */
    public static function createLog(array $data): self
    {
        // Set default values
        $data = array_merge([
            'created_at' => now(),
            'is_successful' => true,
            'user_consent' => false,
            'is_sensitive_data' => false,
            'data_classification' => 'internal',
            'retention_days' => 2555, // 7 years for LGPD compliance
            'expires_at' => now()->addDays(2555),
        ], $data);

        return self::create($data);
    }

    /**
     * Clean up expired logs
     */
    public static function cleanupExpiredLogs(): int
    {
        return self::expired()->delete();
    }
}