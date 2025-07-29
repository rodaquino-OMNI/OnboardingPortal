<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class InterviewScheduledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $interview;
    protected $role;

    /**
     * Create a new notification instance.
     */
    public function __construct(Interview $interview, string $role = 'beneficiary')
    {
        $this->interview = $interview;
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
        $date = $interview->scheduled_at->format('d/m/Y');
        $time = $interview->scheduled_at->format('H:i');
        
        if ($this->role === 'beneficiary') {
            return (new MailMessage)
                ->subject('Entrevista Agendada - ' . $date . ' às ' . $time)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Sua entrevista foi agendada com sucesso.')
                ->line('**Data:** ' . $date)
                ->line('**Horário:** ' . $time)
                ->line('**Tipo:** ' . $this->getInterviewTypeLabel($interview->type))
                ->line('**Profissional:** ' . ($interview->interviewer->name ?? 'A definir'))
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->line('Por favor, chegue com 10 minutos de antecedência.')
                ->action('Visualizar Entrevista', url('/dashboard/interviews/' . $interview->id))
                ->line('Caso precise reagendar, faça-o com pelo menos 24 horas de antecedência.');
        } else {
            return (new MailMessage)
                ->subject('Nova Entrevista Agendada - ' . $date . ' às ' . $time)
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Uma nova entrevista foi agendada com você.')
                ->line('**Beneficiário:** ' . ($interview->beneficiary->user->name ?? 'N/A'))
                ->line('**Data:** ' . $date)
                ->line('**Horário:** ' . $time)
                ->line('**Tipo:** ' . $this->getInterviewTypeLabel($interview->type))
                ->when($interview->meeting_link, function ($message) use ($interview) {
                    return $message->line('**Link da reunião:** ' . $interview->meeting_link);
                })
                ->when($interview->slot->location, function ($message) use ($interview) {
                    return $message->line('**Local:** ' . $interview->slot->location);
                })
                ->action('Ver Agenda', url('/dashboard/calendar'))
                ->line('Obrigado por sua dedicação ao programa!');
        }
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        
        return [
            'type' => 'interview_scheduled',
            'role' => $this->role,
            'interview_id' => $interview->id,
            'title' => $this->role === 'beneficiary' ? 'Entrevista Agendada' : 'Nova Entrevista Agendada',
            'message' => $this->getDatabaseMessage(),
            'data' => [
                'scheduled_at' => $interview->scheduled_at,
                'interviewer_name' => $interview->interviewer->name ?? null,
                'beneficiary_name' => $interview->beneficiary->user->name ?? null,
                'type' => $interview->type,
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
        $interview = $this->interview;
        $date = $interview->scheduled_at->format('d/m/Y');
        $time = $interview->scheduled_at->format('H:i');

        if ($this->role === 'beneficiary') {
            $profissional = $interview->interviewer->name ?? 'profissional designado';
            return "Sua entrevista foi agendada para {$date} às {$time} com {$profissional}.";
        } else {
            $beneficiario = $interview->beneficiary->user->name ?? 'beneficiário';
            return "Nova entrevista agendada com {$beneficiario} para {$date} às {$time}.";
        }
    }

    /**
     * Get interview type label in Portuguese
     */
    protected function getInterviewTypeLabel(string $type): string
    {
        $labels = [
            'in_person' => 'Presencial',
            'online' => 'Online',
            'phone' => 'Telefone',
        ];

        return $labels[$type] ?? ucfirst($type);
    }
}