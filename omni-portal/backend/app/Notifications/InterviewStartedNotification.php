<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewStartedNotification extends Notification
{
    use Queueable;

    protected $interview;

    public function __construct(Interview $interview)
    {
        $this->interview = $interview;
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        
        return [
            'type' => 'interview_started',
            'interview_id' => $interview->id,
            'title' => 'Entrevista Iniciada',
            'message' => 'Sua entrevista começou! ' . ($interview->meeting_link ? 'Acesse o link da reunião.' : 'Dirija-se ao local da entrevista.'),
            'data' => [
                'started_at' => $interview->started_at,
                'meeting_link' => $interview->meeting_link,
                'interviewer_name' => $interview->interviewer->name ?? null,
            ],
            'action_url' => $interview->meeting_link ?: url('/dashboard/interviews/' . $interview->id),
        ];
    }
}