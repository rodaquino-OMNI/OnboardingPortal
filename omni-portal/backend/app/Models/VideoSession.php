<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class VideoSession extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'interview_id',
        'session_id',
        'provider',
        'status',
        'participants',
        'settings',
        'created_by',
        'recording_archive_id',
        'recording_status',
        'recording_started_at',
        'recording_stopped_at',
        'recording_duration',
        'recording_size',
        'recording_url',
        'recording_started_by',
        'started_at',
        'ended_at',
        'ended_by',
        'duration_minutes',
        'session_analytics',
        'technical_issues',
        'quality_rating',
        'chat_enabled',
        'screen_share_enabled',
        'recording_enabled',
        'chat_messages',
        'screen_share_sessions',
        'hipaa_compliant',
        'encryption_enabled',
        'encryption_key_id',
        'security_audit_log',
        'bandwidth_used',
        'storage_used',
        'session_cost'
    ];

    protected $casts = [
        'participants' => 'array',
        'settings' => 'array',
        'session_analytics' => 'array',
        'technical_issues' => 'array',
        'chat_messages' => 'array',
        'screen_share_sessions' => 'array',
        'security_audit_log' => 'array',
        'recording_started_at' => 'datetime',
        'recording_stopped_at' => 'datetime',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'chat_enabled' => 'boolean',
        'screen_share_enabled' => 'boolean',
        'recording_enabled' => 'boolean',
        'hipaa_compliant' => 'boolean',
        'encryption_enabled' => 'boolean',
        'session_cost' => 'decimal:4'
    ];

    /**
     * Relationships
     */
    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recordingStartedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recording_started_by');
    }

    public function endedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ended_by');
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeRecording($query)
    {
        return $query->where('recording_status', 'recording');
    }

    public function scopeHipaaCompliant($query)
    {
        return $query->where('hipaa_compliant', true);
    }

    public function scopeByProvider($query, string $provider)
    {
        return $query->where('provider', $provider);
    }

    public function scopeForInterview($query, int $interviewId)
    {
        return $query->where('interview_id', $interviewId);
    }

    /**
     * Accessors & Mutators
     */
    public function getIsActiveAttribute(): bool
    {
        return $this->status === 'active';
    }

    public function getIsRecordingAttribute(): bool
    {
        return $this->recording_status === 'recording';
    }

    public function getHasRecordingAttribute(): bool
    {
        return in_array($this->recording_status, ['stopped', 'available']);
    }

    public function getActiveParticipantsAttribute(): array
    {
        return collect($this->participants)
            ->filter(fn($p) => isset($p['status']) && $p['status'] === 'joined')
            ->values()
            ->toArray();
    }

    public function getSessionDurationAttribute(): ?int
    {
        if (!$this->started_at) {
            return null;
        }

        $endTime = $this->ended_at ?? now();
        return $this->started_at->diffInMinutes($endTime);
    }

    public function getRecordingDurationFormattedAttribute(): ?string
    {
        if (!$this->recording_duration) {
            return null;
        }

        $hours = floor($this->recording_duration / 3600);
        $minutes = floor(($this->recording_duration % 3600) / 60);
        $seconds = $this->recording_duration % 60;

        if ($hours > 0) {
            return sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
        }

        return sprintf('%02d:%02d', $minutes, $seconds);
    }

    public function getRecordingSizeFormattedAttribute(): ?string
    {
        if (!$this->recording_size) {
            return null;
        }

        $size = $this->recording_size;
        $units = ['B', 'KB', 'MB', 'GB'];
        $unitIndex = 0;

        while ($size >= 1024 && $unitIndex < count($units) - 1) {
            $size /= 1024;
            $unitIndex++;
        }

        return round($size, 2) . ' ' . $units[$unitIndex];
    }

    /**
     * Business Logic Methods
     */
    public function addParticipant(array $participantData): void
    {
        $participants = $this->participants;
        
        // Check if participant already exists
        $existingIndex = collect($participants)->search(function ($p) use ($participantData) {
            return $p['id'] === $participantData['id'];
        });

        if ($existingIndex !== false) {
            // Update existing participant
            $participants[$existingIndex] = array_merge($participants[$existingIndex], $participantData);
        } else {
            // Add new participant
            $participants[] = array_merge($participantData, [
                'joined_at' => now(),
                'status' => 'joined'
            ]);
        }

        $this->update(['participants' => $participants]);
    }

    public function removeParticipant(string $participantId): void
    {
        $participants = collect($this->participants)
            ->map(function ($participant) use ($participantId) {
                if ($participant['id'] === $participantId) {
                    $participant['status'] = 'left';
                    $participant['left_at'] = now();
                }
                return $participant;
            })
            ->toArray();

        $this->update(['participants' => $participants]);
    }

    public function addChatMessage(array $messageData): void
    {
        $messages = $this->chat_messages ?? [];
        $messages[] = array_merge($messageData, [
            'timestamp' => now(),
            'id' => uniqid('msg_')
        ]);

        $this->update(['chat_messages' => $messages]);
    }

    public function logTechnicalIssue(array $issueData): void
    {
        $issues = $this->technical_issues ?? [];
        $issues[] = array_merge($issueData, [
            'timestamp' => now(),
            'id' => uniqid('issue_')
        ]);

        $this->update(['technical_issues' => $issues]);
    }

    public function logSecurityEvent(array $eventData): void
    {
        $log = $this->security_audit_log ?? [];
        $log[] = array_merge($eventData, [
            'timestamp' => now(),
            'id' => uniqid('sec_')
        ]);

        $this->update(['security_audit_log' => $log]);
    }

    public function updateAnalytics(array $analyticsData): void
    {
        $currentAnalytics = $this->session_analytics ?? [];
        $updatedAnalytics = array_merge($currentAnalytics, [
            'last_updated' => now(),
            'data' => $analyticsData
        ]);

        $this->update(['session_analytics' => $updatedAnalytics]);
    }

    public function calculateCost(): float
    {
        // Simple cost calculation - in production this would be more sophisticated
        $baseCost = 0.10; // $0.10 base cost
        $minuteCost = 0.02; // $0.02 per minute
        $recordingCost = $this->recording_duration ? ($this->recording_duration / 60) * 0.05 : 0; // $0.05 per minute of recording
        $storageCost = $this->recording_size ? ($this->recording_size / (1024 * 1024)) * 0.01 : 0; // $0.01 per MB stored

        $totalCost = $baseCost + 
                    (($this->session_duration ?? 0) * $minuteCost) + 
                    $recordingCost + 
                    $storageCost;

        $this->update(['session_cost' => $totalCost]);

        return $totalCost;
    }

    public function canBeJoined(): bool
    {
        return in_array($this->status, ['created', 'active']) && 
               (!$this->ended_at || $this->ended_at->isFuture());
    }

    public function shouldAutoEnd(): bool
    {
        // Auto-end sessions after 4 hours or if no participants for 30 minutes
        if ($this->created_at->diffInHours(now()) > 4) {
            return true;
        }

        $activeParticipants = $this->active_participants;
        if (empty($activeParticipants) && $this->started_at && $this->started_at->diffInMinutes(now()) > 30) {
            return true;
        }

        return false;
    }

    /**
     * Event Handlers
     */
    protected static function booted(): void
    {
        static::creating(function (VideoSession $session) {
            if (!$session->session_id) {
                $session->session_id = 'vs_' . uniqid();
            }
        });

        static::updating(function (VideoSession $session) {
            // Calculate duration when session ends
            if ($session->isDirty('status') && $session->status === 'ended' && !$session->duration_minutes) {
                $session->duration_minutes = $session->session_duration;
            }

            // Calculate cost when session ends or recording stops
            if (($session->isDirty('status') && $session->status === 'ended') ||
                ($session->isDirty('recording_status') && $session->recording_status === 'stopped')) {
                $session->calculateCost();
            }
        });
    }
}