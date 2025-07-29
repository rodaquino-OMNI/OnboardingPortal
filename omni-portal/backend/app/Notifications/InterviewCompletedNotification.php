<?php

namespace App\Notifications;

use App\Models\Interview;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InterviewCompletedNotification extends Notification implements ShouldQueue
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
        
        if ($this->role === 'beneficiary') {
            return (new MailMessage)
                ->subject('Entrevista Concluída - Próximos Passos')
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('Sua entrevista foi concluída com sucesso!')
                ->line('**Data:** ' . $interview->ended_at->format('d/m/Y'))
                ->line('**Duração:** ' . $interview->duration_minutes . ' minutos')
                ->when($interview->rating, function ($message) use ($interview) {
                    return $message->line('**Avaliação:** ' . $interview->rating . '/5 estrelas');
                })
                ->line('**Próximos passos:**')
                ->line('• Aguarde o contato da equipe')
                ->line('• Continue acompanhando seu painel')
                ->line('• Mantenha seus dados atualizados')
                ->action('Ver Dashboard', url('/dashboard'))
                ->line('Parabéns pelo seu desempenho!');
        } else {
            return (new MailMessage)
                ->subject('Entrevista Concluída')
                ->greeting('Olá, ' . $notifiable->name . '!')
                ->line('A entrevista foi marcada como concluída.')
                ->line('**Beneficiário:** ' . ($interview->beneficiary->user->name ?? 'N/A'))
                ->line('**Data:** ' . $interview->ended_at->format('d/m/Y'))
                ->line('**Duração:** ' . $interview->duration_minutes . ' minutos')
                ->when($interview->rating, function ($message) use ($interview) {
                    return $message->line('**Avaliação dada:** ' . $interview->rating . '/5 estrelas');
                })
                ->action('Ver Relatório', url('/dashboard/interviews/' . $interview->id))
                ->line('Obrigado por sua dedicação!');
        }
    }

    public function toArray($notifiable): array
    {
        $interview = $this->interview;
        
        return [
            'type' => 'interview_completed',
            'role' => $this->role,
            'interview_id' => $interview->id,
            'title' => 'Entrevista Concluída',
            'message' => $this->getDatabaseMessage(),
            'data' => [
                'ended_at' => $interview->ended_at,
                'duration_minutes' => $interview->duration_minutes,
                'rating' => $interview->rating,
                'interviewer_name' => $interview->interviewer->name ?? null,
                'beneficiary_name' => $interview->beneficiary->user->name ?? null,
            ],
            'action_url' => $this->role === 'beneficiary' ? 
                url('/dashboard') : 
                url('/dashboard/interviews/' . $interview->id),
        ];
    }

    protected function getDatabaseMessage(): string
    {
        $interview = $this->interview;

        if ($this->role === 'beneficiary') {
            return "Sua entrevista foi concluída! Duração: {$interview->duration_minutes} minutos.";
        } else {
            $beneficiario = $interview->beneficiary->user->name ?? 'beneficiário';
            return "Entrevista com {$beneficiario} foi concluída ({$interview->duration_minutes} min).";
        }
    }
}