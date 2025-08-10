<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class ClinicalReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_uuid',
        'report_type',
        'period_start',
        'period_end',
        'format',
        'file_path',
        'file_size',
        'sections_included',
        'filters_applied',
        'statistics',
        'risk_distribution',
        'alert_summary',
        'intervention_outcomes',
        'total_patients_analyzed',
        'high_risk_patients',
        'interventions_recommended',
        'follow_ups_scheduled',
        'key_findings',
        'trends_identified',
        'recommendations',
        'generated_by',
        'generated_at',
        'generation_time_seconds',
        'generation_status',
        'error_message',
        'recipients',
        'sent_at',
        'is_scheduled',
        'schedule_cron',
        'authorized_viewers',
        'view_count',
        'last_viewed_at',
        'contains_pii',
        'is_anonymized',
        'compliance_metadata'
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'sections_included' => 'array',
        'filters_applied' => 'array',
        'statistics' => 'array',
        'risk_distribution' => 'array',
        'alert_summary' => 'array',
        'intervention_outcomes' => 'array',
        'key_findings' => 'array',
        'trends_identified' => 'array',
        'recommendations' => 'array',
        'recipients' => 'array',
        'authorized_viewers' => 'array',
        'compliance_metadata' => 'array',
        'generated_at' => 'datetime',
        'sent_at' => 'datetime',
        'last_viewed_at' => 'datetime',
        'is_scheduled' => 'boolean',
        'contains_pii' => 'boolean',
        'is_anonymized' => 'boolean'
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->report_uuid)) {
                $model->report_uuid = (string) Str::uuid();
            }

            if (empty($model->sections_included)) {
                $model->sections_included = $model->getDefaultSections();
            }

            $model->generation_status = 'pending';
        });

        static::deleting(function ($model) {
            // Delete associated file when report is deleted
            if ($model->file_path && Storage::disk('reports')->exists($model->file_path)) {
                Storage::disk('reports')->delete($model->file_path);
            }
        });
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public function getDefaultSections(): array
    {
        return match($this->report_type) {
            'daily_summary' => [
                'new_assessments',
                'critical_alerts',
                'interventions_today',
                'key_metrics'
            ],
            'weekly_analysis' => [
                'executive_summary',
                'risk_trends',
                'alert_analysis',
                'intervention_outcomes',
                'recommendations'
            ],
            'monthly_comprehensive' => [
                'executive_summary',
                'population_health',
                'risk_distribution',
                'alert_statistics',
                'intervention_analysis',
                'cost_benefit',
                'trends',
                'recommendations'
            ],
            default => [
                'summary',
                'statistics',
                'alerts',
                'recommendations'
            ]
        };
    }

    public function markAsGenerated(string $filePath, int $fileSize, int $generationTime): void
    {
        $this->update([
            'file_path' => $filePath,
            'file_size' => $fileSize,
            'generation_time_seconds' => $generationTime,
            'generation_status' => 'completed',
            'generated_at' => now()
        ]);
    }

    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'generation_status' => 'failed',
            'error_message' => $errorMessage
        ]);
    }

    public function incrementViewCount(): void
    {
        $this->increment('view_count');
        $this->update(['last_viewed_at' => now()]);
    }

    public function canBeViewedBy(User $user): bool
    {
        // Admin can view all reports
        if ($user->hasRole('admin') || $user->hasRole('clinical_admin')) {
            return true;
        }

        // Check if user is in authorized viewers
        if (in_array($user->id, $this->authorized_viewers ?? [])) {
            return true;
        }

        // Check if user generated the report
        if ($this->generated_by === $user->id) {
            return true;
        }

        return false;
    }

    public function getDownloadUrl(): ?string
    {
        if (!$this->file_path || $this->generation_status !== 'completed') {
            return null;
        }

        return Storage::disk('reports')->temporaryUrl(
            $this->file_path,
            now()->addMinutes(30)
        );
    }

    public function scopeCompleted($query)
    {
        return $query->where('generation_status', 'completed');
    }

    public function scopeScheduled($query)
    {
        return $query->where('is_scheduled', true);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('report_type', $type);
    }

    public function scopeForPeriod($query, $startDate, $endDate)
    {
        return $query->whereBetween('period_start', [$startDate, $endDate])
                    ->orWhereBetween('period_end', [$startDate, $endDate]);
    }

    public function getRiskSummaryAttribute(): array
    {
        $distribution = $this->risk_distribution ?? [];
        
        return [
            'total' => array_sum($distribution),
            'critical' => $distribution['critical'] ?? 0,
            'high' => $distribution['high'] ?? 0,
            'medium' => $distribution['medium'] ?? 0,
            'low' => $distribution['low'] ?? 0,
            'critical_percentage' => $this->calculatePercentage($distribution['critical'] ?? 0, array_sum($distribution))
        ];
    }

    private function calculatePercentage($value, $total): float
    {
        if ($total == 0) return 0;
        return round(($value / $total) * 100, 2);
    }

    public function shouldBeDistributed(): bool
    {
        return $this->generation_status === 'completed' 
            && !empty($this->recipients) 
            && !$this->sent_at;
    }

    public function markAsDistributed(): void
    {
        $this->update(['sent_at' => now()]);
    }

    public function getFormattedPeriod(): string
    {
        if ($this->period_start->eq($this->period_end)) {
            return $this->period_start->format('M d, Y');
        }

        return $this->period_start->format('M d, Y') . ' - ' . $this->period_end->format('M d, Y');
    }

    public function getMetricsSummary(): array
    {
        return [
            'patients_analyzed' => $this->total_patients_analyzed,
            'high_risk_count' => $this->high_risk_patients,
            'high_risk_percentage' => $this->calculatePercentage($this->high_risk_patients, $this->total_patients_analyzed),
            'interventions' => $this->interventions_recommended,
            'follow_ups' => $this->follow_ups_scheduled,
            'generation_time' => gmdate('H:i:s', $this->generation_time_seconds)
        ];
    }
}