<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewCancelledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $interview;
    protected $role;

    public function __construct(Interview $interview, string $role = 'beneficiary')
    {
        $this->interview = $interview;
        $this->role = $role;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $interview = $this->interview;
        $date = $interview->scheduled_at->format('d/m/Y');
        $time = $interview->scheduled_at->format('H:i');
        
        if ($this->role === 'beneficiary') {
            return (new MailMessage)
                ->subject('Entrevista Cancelada - ' . $date)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Infelizmente, sua entrevista foi cancelada.')
                ->line('**Data:** ' . $date . ' às ' . $time)
                ->line('**Motivo:** ' . ($interview->cancellation_reason ?? 'Não informado'))
                ->line('Você pode agendar uma nova entrevista através do sistema.')
                ->action('Agendar Nova Entrevista', url('/dashboard/interviews/schedule'))
                ->line('Pedimos desculpas pelo inconveniente causado.');
        } else {
            return (new MailMessage)
                ->subject('Entrevista Cancelada - ' . $date)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Uma entrevista foi cancelada.')
                ->line('**Beneficiário:** ' . ($interview->beneficiary->user->name ?? 'N/A'))
                ->line('**Data:** ' . $date . ' às ' . $time)
                ->line('**Motivo:** ' . ($interview->cancellation_reason ?? 'Não informado'))
                ->action('Ver Agenda', url('/dashboard/calendar'))
                ->line('O horário ficou disponível para novos agendamentos.');
        }
    }

    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        
        return [
            'type' => 'interview_cancelled',
            'role' => $this->role,
            'interview_id' => $interview->id,
            'title' => 'Entrevista Cancelada',
            'message' => $this->getDatabaseMessage(),
            'data' => [
                'scheduled_at' => $interview->scheduled_at,
                'cancellation_reason' => $interview->cancellation_reason,
                'interviewer_name' => $interview->interviewer->name ?? null,
                'beneficiary_name' => $interview->beneficiary->user->name ?? null,
            ],
            'action_url' => $this->role === 'beneficiary' ? 
                url('/dashboard/interviews/schedule') : 
                url('/dashboard/calendar'),
        ];
    }

    protected function getDatabaseMessage(): string
    {
        $interview = $this->interview;
        $date = $interview->scheduled_at->format('d/m/Y H:i');

        if ($this->role === 'beneficiary') {
            return "Sua entrevista de {$date} foi cancelada. Motivo: " . ($interview->cancellation_reason ?? 'Não informado');
        } else {
            $beneficiario = $interview->beneficiary->user->name ?? 'beneficiário';
            return "Entrevista com {$beneficiario} de {$date} foi cancelada.";
        }
    }
}