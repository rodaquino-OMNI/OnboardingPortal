<?php

namespace App\Notifications;

use App\Models\InterviewSlot;
use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SlotCancelledNotification extends Notification implements ShouldQueue
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
            ->subject('URGENTE: Horário de Entrevista Cancelado')
            ->greeting('Olá, ' . $notifiable->name . '!')
            ->line('Infelizmente, o horário da sua entrevista foi cancelado.')
            ->line('**Data cancelada:** ' . $slot->date)
            ->line('**Horário:** ' . $slot->start_time . ' às ' . $slot->end_time)
            ->line('**AÇÃO NECESSÁRIA:** Você precisa reagendar sua entrevista urgentemente.')
            ->line('Disponibilizamos novos horários para que você possa reagendar.')
            ->action('Reagendar Agora', url('/dashboard/interviews/schedule'))
            ->line('Pedimos desculpas pelo inconveniente e contamos com sua compreensão.')
            ->line('**Importante:** Reagende o mais rápido possível para não perder sua oportunidade.');
    }

    public function toArray($notifiable): array
    {
        $slot = $this->slot;
        $interview = $this->interview;
        
        return [
            'type' => 'slot_cancelled',
            'slot_id' => $slot->id,
            'interview_id' => $interview->id,
            'title' => 'URGENTE: Horário Cancelado',
            'message' => "O horário da sua entrevista ({$slot->date} {$slot->start_time}) foi cancelado. Reagende urgentemente!",
            'data' => [
                'cancelled_date' => $slot->date,
                'cancelled_time' => $slot->start_time . ' - ' . $slot->end_time,
                'requires_action' => true,
            ],
            'action_url' => url('/dashboard/interviews/schedule'),
            'priority' => 'high',
        ];
    }
}