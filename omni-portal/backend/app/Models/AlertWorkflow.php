<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class AlertWorkflow extends Model
{
    use HasFactory;

    protected $fillable = [
        'workflow_uuid',
        'alert_id',
        'beneficiary_id',
        'action_type',
        'action_description',
        'action_metadata',
        'performed_by',
        'performer_role',
        'clinical_notes',
        'assessments_performed',
        'interventions_applied',
        'next_actions',
        'next_review_date',
        'assigned_to_next',
        'outcome',
        'outcome_metrics',
        'action_timestamp'
    ];

    protected $casts = [
        'action_metadata' => 'array',
        'assessments_performed' => 'array',
        'interventions_applied' => 'array',
        'next_actions' => 'array',
        'outcome_metrics' => 'array',
        'next_review_date' => 'datetime',
        'action_timestamp' => 'datetime'
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->workflow_uuid)) {
                $model->workflow_uuid = (string) Str::uuid();
            }

            if (empty($model->action_timestamp)) {
                $model->action_timestamp = now();
            }

            // Set performer role if not provided
            if (empty($model->performer_role) && $model->performed_by) {
                $user = User::find($model->performed_by);
                $model->performer_role = $user?->roles->first()?->name ?? 'unknown';
            }
        });

        static::created(function ($model) {
            // Update alert status based on workflow action
            $model->updateAlertStatus();

            // Trigger notifications if needed
            $model->triggerNotifications();
        });
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(ClinicalAlert::class, 'alert_id');
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function assignedToNext(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_next');
    }

    private function updateAlertStatus(): void
    {
        if (!$this->alert) return;

        $statusMap = [
            'alert_acknowledged' => 'acknowledged',
            'intervention_planned' => 'in_progress',
            'resolved' => 'resolved',
            'closed_no_action' => 'dismissed',
            'escalated_to_specialist' => 'escalated'
        ];

        if (isset($statusMap[$this->action_type])) {
            $this->alert->update([
                'status' => $statusMap[$this->action_type]
            ]);
        }

        // Update assignment if changed
        if ($this->assigned_to_next && $this->alert->assigned_to !== $this->assigned_to_next) {
            $this->alert->update([
                'assigned_to' => $this->assigned_to_next
            ]);
        }
    }

    private function triggerNotifications(): void
    {
        // Notify next assigned user
        if ($this->assigned_to_next && $this->assigned_to_next !== $this->performed_by) {
            $assignedUser = User::find($this->assigned_to_next);
            if ($assignedUser) {
                // Trigger notification (implementation depends on notification system)
                // Notification::send($assignedUser, new AlertAssignedNotification($this->alert));
            }
        }

        // Escalation notifications
        if ($this->action_type === 'escalated_to_specialist') {
            $this->sendEscalationNotifications();
        }
    }

    private function sendEscalationNotifications(): void
    {
        // Get escalation rules and notify appropriate parties
        $escalationRules = AlertEscalationRule::where('is_active', true)
            ->where('trigger_type', 'manual_escalation')
            ->first();

        if ($escalationRules) {
            // Implementation of escalation notification logic
        }
    }

    public function getActionSummary(): array
    {
        return [
            'action' => $this->getFormattedActionType(),
            'performer' => $this->performedBy->name ?? 'System',
            'role' => $this->performer_role,
            'timestamp' => $this->action_timestamp->format('M d, Y H:i'),
            'has_clinical_notes' => !empty($this->clinical_notes),
            'has_interventions' => !empty($this->interventions_applied),
            'has_next_steps' => !empty($this->next_actions),
            'outcome' => $this->outcome
        ];
    }

    public function getFormattedActionType(): string
    {
        $types = [
            'alert_created' => 'Alert Created',
            'alert_acknowledged' => 'Alert Acknowledged',
            'assessment_scheduled' => 'Assessment Scheduled',
            'intervention_planned' => 'Intervention Planned',
            'patient_contacted' => 'Patient Contacted',
            'follow_up_scheduled' => 'Follow-up Scheduled',
            'escalated_to_specialist' => 'Escalated to Specialist',
            'resolved' => 'Resolved',
            'closed_no_action' => 'Closed - No Action Needed'
        ];

        return $types[$this->action_type] ?? ucwords(str_replace('_', ' ', $this->action_type));
    }

    public function scopeByAlert($query, $alertId)
    {
        return $query->where('alert_id', $alertId);
    }

    public function scopeByPerformer($query, $userId)
    {
        return $query->where('performed_by', $userId);
    }

    public function scopeRecent($query, $days = 7)
    {
        return $query->where('action_timestamp', '>=', now()->subDays($days));
    }

    public function scopeWithOutcome($query, $outcome)
    {
        return $query->where('outcome', $outcome);
    }

    public function isSuccessful(): bool
    {
        return in_array($this->outcome, ['successful', 'partially_successful']);
    }

    public function requiresFollowUp(): bool
    {
        return !empty($this->next_actions) || $this->next_review_date;
    }

    public function getDaysUntilNextReview(): ?int
    {
        if (!$this->next_review_date) {
            return null;
        }

        return now()->diffInDays($this->next_review_date, false);
    }

    public function getInterventionsSummary(): array
    {
        $interventions = $this->interventions_applied ?? [];
        
        return array_map(function ($intervention) {
            return [
                'type' => $intervention['type'] ?? 'unknown',
                'description' => $intervention['description'] ?? '',
                'duration' => $intervention['duration'] ?? null,
                'resources' => $intervention['resources'] ?? [],
                'expected_outcome' => $intervention['expected_outcome'] ?? ''
            ];
        }, $interventions);
    }
}