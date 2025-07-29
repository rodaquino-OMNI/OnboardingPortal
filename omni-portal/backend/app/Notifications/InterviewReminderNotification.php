<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewReminderNotification extends Notification implements ShouldQueue
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
                ->subject('Lembrete: Entrevista Amanhã - ' . $date)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Este é um lembrete sobre sua entrevista amanhã.')
                ->line('**Data:** ' . $date)
                ->line('**Horário:** ' . $time)
                ->line('**Profissional:** ' . ($interview->interviewer->name ?? 'A definir'))
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->line('**Dicas importantes:**')
                ->line('• Chegue 10 minutos antes do horário')
                ->line('• Tenha seus documentos em mãos')
                ->line('• Prepare-se para falar sobre sua experiência')
                ->action('Visualizar Entrevista', url('/dashboard/interviews/' . $interview->id))
                ->line('Boa sorte na sua entrevista!');
        } else {
            return (new MailMessage)
                ->subject('Lembrete: Entrevista Amanhã - ' . $date)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Lembrete sobre sua entrevista agendada para amanhã.')
                ->line('**Beneficiário:** ' . ($interview->beneficiary->user->name ?? 'N/A'))
                ->line('**Data:** ' . $date)
                ->line('**Horário:** ' . $time)
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->action('Preparar Entrevista', url('/dashboard/interviews/' . $interview->id))
                ->line('Obrigado por sua dedicação ao programa!');
        }
    }

    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        
        return [
            'type' => 'interview_reminder',
            'role' => $this->role,
            'interview_id' => $interview->id,
            'title' => 'Lembrete: Entrevista Amanhã',
            'message' => $this->getDatabaseMessage(),
            'data' => [
                'scheduled_at' => $interview->scheduled_at,
                'interviewer_name' => $interview->interviewer->name ?? null,
                'beneficiary_name' => $interview->beneficiary->user->name ?? null,
                'meeting_link' => $interview->meeting_link,
                'location' => $interview->slot->location ?? null,
            ],
            'action_url' => url('/dashboard/interviews/' . $interview->id),
        ];
    }

    protected function getDatabaseMessage(): string
    {
        $interview = $this->interview;
        $date = $interview->scheduled_at->format('d/m/Y');
        $time = $interview->scheduled_at->format('H:i');

        if ($this->role === 'beneficiary') {
            return "Lembrete: Você tem uma entrevista amanhã ({$date}) às {$time}.";
        } else {
            $beneficiario = $interview->beneficiary->user->name ?? 'beneficiário';
            return "Lembrete: Entrevista com {$beneficiario} amanhã ({$date}) às {$time}.";
        }
    }
}