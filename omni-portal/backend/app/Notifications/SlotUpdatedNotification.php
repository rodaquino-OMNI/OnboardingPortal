<?php

namespace App\Notifications;

use App\Models\InterviewSlot;
use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SlotUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $slot;
    protected $interview;

    public function __construct(InterviewSlot $slot, Interview $interview)
    {
        $this->slot = $slot;
        $this->interview = $interview;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $slot = $this->slot;
        $interview = $this->interview;
        
        return (new MailMessage)
            ->subject('Horário de Entrevista Atualizado - ' . $slot->date)
            ->greeting('Olá, ' . $notifiable->name . '!')
            ->line('Informamos que houve uma atualização no horário da sua entrevista.')
            ->line('**Data:** ' . $slot->date)
            ->line('**Horário:** ' . $slot->start_time . ' às ' . $slot->end_time)
            ->when($slot->location, function ($message) use ($slot) {
                return $message->line('**Local:** ' . $slot->location);
            })
            ->when($slot->notes, function ($message) use ($slot) {
                return $message->line('**Observações:** ' . $slot->notes);
            })
            ->line('Por favor, confirme se ainda pode comparecer no horário atualizado.')
            ->action('Visualizar Entrevista', url('/dashboard/interviews/' . $interview->id))
            ->line('Caso não possa comparecer, reagende com antecedência.');
    }

    public function toArray($notifiable): array
    {
        $slot = $this->slot;
        $interview = $this->interview;
        
        return [
            'type' => 'slot_updated',
            'slot_id' => $slot->id,
            'interview_id' => $interview->id,
            'title' => 'Horário Atualizado',
            'message' => "O horário da sua entrevista de {$slot->date} foi atualizado.",
            'data' => [
                'date' => $slot->date,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'location' => $slot->location,
                'notes' => $slot->notes,
            ],
            'action_url' => url('/dashboard/interviews/' . $interview->id),
        ];
    }
}