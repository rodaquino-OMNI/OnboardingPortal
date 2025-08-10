<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ClinicalAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_uuid',
        'beneficiary_id',
        'questionnaire_id',
        'alert_type',
        'category',
        'priority',
        'risk_score',
        'risk_factors',
        'risk_scores_detail',
        'title',
        'message',
        'clinical_recommendations',
        'intervention_options',
        'status',
        'assigned_to',
        'acknowledged_by',
        'resolved_by',
        'acknowledged_at',
        'started_at',
        'resolved_at',
        'escalated_at',
        'sla_hours',
        'sla_deadline',
        'sla_breached',
        'clinical_notes',
        'resolution_notes',
        'metadata',
        'audit_trail'
    ];

    protected $casts = [
        'risk_factors' => 'array',
        'risk_scores_detail' => 'array',
        'clinical_recommendations' => 'array',
        'intervention_options' => 'array',
        'metadata' => 'array',
        'audit_trail' => 'array',
        'acknowledged_at' => 'datetime',
        'started_at' => 'datetime',
        'resolved_at' => 'datetime',
        'escalated_at' => 'datetime',
        'sla_deadline' => 'datetime',
        'sla_breached' => 'boolean'
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->alert_uuid)) {
                $model->alert_uuid = (string) Str::uuid();
            }

            // Calculate SLA deadline based on priority
            if (empty($model->sla_deadline)) {
                $slaHours = $model->getSlaHoursByPriority();
                $model->sla_hours = $slaHours;
                $model->sla_deadline = now()->addHours($slaHours);
            }

            // Initialize audit trail
            if (empty($model->audit_trail)) {
                $model->audit_trail = [];
            }
            
            $model->addAuditEntry('alert_created', 'System generated alert');
        });

        static::updating(function ($model) {
            // Track status changes
            if ($model->isDirty('status')) {
                $oldStatus = $model->getOriginal('status');
                $newStatus = $model->status;
                $model->addAuditEntry('status_changed', "Status changed from {$oldStatus} to {$newStatus}");

                // Update timestamps based on status
                switch ($newStatus) {
                    case 'acknowledged':
                        $model->acknowledged_at = now();
                        break;
                    case 'in_progress':
                        $model->started_at = now();
                        break;
                    case 'resolved':
                        $model->resolved_at = now();
                        break;
                    case 'escalated':
                        $model->escalated_at = now();
                        break;
                }
            }

            // Check SLA breach
            if (!$model->sla_breached && now()->isAfter($model->sla_deadline) && !in_array($model->status, ['resolved', 'dismissed'])) {
                $model->sla_breached = true;
                $model->addAuditEntry('sla_breached', 'SLA deadline exceeded');
            }
        });
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function questionnaire(): BelongsTo
    {
        return $this->belongsTo(HealthQuestionnaire::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function workflows(): HasMany
    {
        return $this->hasMany(AlertWorkflow::class, 'alert_id');
    }

    public function getSlaHoursByPriority(): int
    {
        return match($this->priority) {
            'emergency' => 1,
            'urgent' => 4,
            'high' => 24,
            'medium' => 48,
            'low' => 72,
            default => 24
        };
    }

    public function addAuditEntry(string $action, string $description, ?array $metadata = null): void
    {
        $auditTrail = $this->audit_trail ?? [];
        
        $auditTrail[] = [
            'timestamp' => now()->toIso8601String(),
            'action' => $action,
            'description' => $description,
            'user_id' => auth()->id(),
            'metadata' => $metadata
        ];
        
        $this->audit_trail = $auditTrail;
    }

    public function getTimeToSlaBreachAttribute(): ?string
    {
        if ($this->sla_breached || in_array($this->status, ['resolved', 'dismissed'])) {
            return null;
        }

        $diff = now()->diff($this->sla_deadline);
        
        if (now()->isAfter($this->sla_deadline)) {
            return 'Breached';
        }

        return $diff->format('%d days %h hours %i minutes');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeActive($query)
    {
        return $query->whereNotIn('status', ['resolved', 'dismissed']);
    }

    public function scopeHighPriority($query)
    {
        return $query->whereIn('priority', ['emergency', 'urgent', 'high']);
    }

    public function scopeSlaBreached($query)
    {
        return $query->where('sla_breached', true);
    }

    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    public function canBeEscalated(): bool
    {
        return in_array($this->status, ['pending', 'acknowledged', 'in_progress']) 
            && !$this->escalated_at;
    }

    public function escalate(string $reason, ?int $userId = null): void
    {
        $this->update([
            'status' => 'escalated',
            'escalated_at' => now()
        ]);

        $this->addAuditEntry('escalated', $reason, [
            'escalated_by' => $userId ?? auth()->id()
        ]);
    }

    public function getFormattedRiskFactorsAttribute(): array
    {
        $factors = $this->risk_factors ?? [];
        $formatted = [];

        foreach ($factors as $factor => $value) {
            $formatted[] = [
                'factor' => str_replace('_', ' ', ucfirst($factor)),
                'value' => $value,
                'severity' => $this->calculateFactorSeverity($factor, $value)
            ];
        }

        return $formatted;
    }

    private function calculateFactorSeverity(string $factor, $value): string
    {
        // Implementation would depend on specific risk factor thresholds
        if (is_numeric($value)) {
            if ($value > 20) return 'high';
            if ($value > 10) return 'medium';
            return 'low';
        }
        
        return 'unknown';
    }
}