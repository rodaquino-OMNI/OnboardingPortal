<?php

namespace App\Notifications;

use App\Models\GamificationLevel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class LevelUpNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected GamificationLevel $level;

    /**
     * Create a new notification instance.
     */
    public function __construct(GamificationLevel $level)
    {
        $this->level = $level;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database', 'broadcast'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('🎉 Parabéns! Você subiu de nível!')
            ->greeting('Parabéns, ' . $notifiable->name . '!')
            ->line('Você acabou de alcançar o nível **' . $this->level->name . '** (' . $this->level->level_number . ')!')
            ->line('Título: ' . $this->level->title)
            ->line('Esta é uma conquista incrível no seu processo de onboarding!')
            ->when($this->level->unlocked_features, function (MailMessage $mail) {
                $features = implode(', ', $this->level->unlocked_features);
                return $mail->line('Novos recursos desbloqueados: ' . $features);
            })
            ->when($this->level->discount_percentage > 0, function (MailMessage $mail) {
                return $mail->line('Você agora tem ' . $this->level->discount_percentage . '% de desconto em nossos serviços!');
            })
            ->action('Ver Meu Perfil', url('/profile'))
            ->line('Continue assim para desbloquear ainda mais benefícios!');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'level_up',
            'level' => [
                'number' => $this->level->level_number,
                'name' => $this->level->name,
                'title' => $this->level->title,
                'color' => $this->level->color_theme,
                'icon' => $this->level->icon,
                'description' => $this->level->description,
                'discount_percentage' => $this->level->discount_percentage,
                'unlocked_features' => $this->level->unlocked_features,
                'rewards' => $this->level->rewards,
            ],
            'message' => 'Parabéns! Você alcançou o nível ' . $this->level->name . '!',
            'title' => 'Nível Alcançado!',
        ];
    }

    /**
     * Get the broadcastable representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'type' => 'level_up',
            'level' => [
                'number' => $this->level->level_number,
                'name' => $this->level->name,
                'title' => $this->level->title,
                'color' => $this->level->color_theme,
                'icon' => $this->level->icon,
            ],
            'message' => 'Parabéns! Você alcançou o nível ' . $this->level->name . '!',
            'title' => 'Nível Alcançado!',
        ]);
    }
}