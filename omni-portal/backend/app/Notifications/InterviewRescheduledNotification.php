<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewRescheduledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $interview;
    protected $data;
    protected $role;

    /**
     * Create a new notification instance.
     */
    public function __construct(Interview $interview, array $data, string $role = 'beneficiary')
    {
        $this->interview = $interview;
        $this->data = $data;
        $this->role = $role;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable): MailMessage
    {
        $interview = $this->interview;
        $data = $this->data;
        
        if ($this->role === 'beneficiary') {
            return (new MailMessage)
                ->subject('Entrevista Reagendada - ' . $data['new_date'])
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Sua entrevista foi reagendada.')
                ->line('**Horário anterior:** ' . $data['original_date'] . ' das ' . $data['original_time'])
                ->line('**Novo horário:** ' . $data['new_date'] . ' das ' . $data['new_time'])
                ->line('**Profissional:** ' . ($interview->interviewer->name ?? 'A definir'))
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->action('Visualizar Entrevista', url('/dashboard/interviews/' . $interview->id))
                ->line('Por favor, confirme o novo horário e chegue com 10 minutos de antecedência.');
        } else {
            return (new MailMessage)
                ->subject('Entrevista Reagendada - ' . $data['new_date'])
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Uma entrevista foi reagendada.')
                ->line('**Beneficiário:** ' . ($interview->beneficiary->user->name ?? 'N/A'))
                ->line('**Horário anterior:** ' . $data['original_date'] . ' das ' . $data['original_time'])
                ->line('**Novo horário:** ' . $data['new_date'] . ' das ' . $data['new_time'])
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->action('Ver Agenda', url('/dashboard/calendar'))
                ->line('Por favor, ajuste sua agenda conforme necessário.');
        }
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        $data = $this->data;
        
        return [
            'type' => 'interview_rescheduled',
            'role' => $this->role,
            'interview_id' => $interview->id,
            'title' => 'Entrevista Reagendada',
            'message' => $this->getDatabaseMessage(),
            'data' => [
                'original_date' => $data['original_date'],
                'original_time' => $data['original_time'],
                'new_date' => $data['new_date'],
                'new_time' => $data['new_time'],
                'interviewer_name' => $interview->interviewer->name ?? null,
                'beneficiary_name' => $interview->beneficiary->user->name ?? null,
                'meeting_link' => $interview->meeting_link,
                'location' => $interview->slot->location ?? null,
            ],
            'action_url' => $this->role === 'beneficiary' ? 
                url('/dashboard/interviews/' . $interview->id) : 
                url('/dashboard/calendar'),
        ];
    }

    /**
     * Get the database message based on role
     */
    protected function getDatabaseMessage(): string
    {
        $data = $this->data;

        if ($this->role === 'beneficiary') {
            return "Sua entrevista foi reagendada de {$data['original_date']} {$data['original_time']} para {$data['new_date']} {$data['new_time']}.";
        } else {
            $beneficiario = $this->interview->beneficiary->user->name ?? 'beneficiário';
            return "Entrevista com {$beneficiario} reagendada para {$data['new_date']} {$data['new_time']}.";
        }
    }
}