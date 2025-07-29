<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class WhatsAppService
{
    private string $apiUrl;
    private ?string $apiKey;
    private ?string $phoneNumberId;
    private bool $enabled;

    public function __construct()
    {
        $this->apiUrl = config('services.whatsapp.api_url', 'https://graph.facebook.com/v17.0');
        $this->apiKey = config('services.whatsapp.api_key', '');
        $this->phoneNumberId = config('services.whatsapp.phone_number_id', '');
        $this->enabled = config('services.whatsapp.enabled', false);
    }

    /**
     * Send WhatsApp message
     */
    public function send($notification): bool
    {
        if (!$this->enabled) {
            Log::info('WhatsApp service is disabled');
            return false;
        }

        try {
            $recipient = $notification->notifiable;
            $phoneNumber = $this->formatPhoneNumber($recipient->phone ?? $recipient->whatsapp_number);
            
            if (!$phoneNumber) {
                Log::warning('No valid WhatsApp number for recipient', ['recipient_id' => $recipient->id]);
                return false;
            }

            $message = $this->formatMessage($notification);
            
            $response = Http::withToken($this->apiKey)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $phoneNumber,
                    'type' => 'template',
                    'template' => $message
                ]);

            if ($response->successful()) {
                Log::info('WhatsApp message sent successfully', [
                    'recipient' => $phoneNumber,
                    'message_id' => $response->json('messages.0.id')
                ]);
                return true;
            } else {
                Log::error('WhatsApp API error', [
                    'response' => $response->body(),
                    'status' => $response->status()
                ]);
                return false;
            }
        } catch (\Exception $e) {
            Log::error('WhatsApp service error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Send interview scheduled notification
     */
    public function sendInterviewScheduledNotification($interview): bool
    {
        $template = [
            'name' => 'interview_scheduled',
            'language' => [
                'code' => 'pt_BR'
            ],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $interview->beneficiary->name],
                        ['type' => 'text', 'text' => $interview->scheduled_at->format('d/m/Y')],
                        ['type' => 'text', 'text' => $interview->scheduled_at->format('H:i')],
                        ['type' => 'text', 'text' => $interview->healthcareProfessional->name],
                        ['type' => 'text', 'text' => $interview->booking_reference]
                    ]
                ]
            ]
        ];

        return $this->sendTemplate($interview->beneficiary->phone, $template);
    }

    /**
     * Send interview reminder notification
     */
    public function sendInterviewReminderNotification($interview): bool
    {
        $hoursUntil = $interview->scheduled_at->diffInHours(now());
        
        $template = [
            'name' => 'interview_reminder',
            'language' => [
                'code' => 'pt_BR'
            ],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $interview->beneficiary->name],
                        ['type' => 'text', 'text' => $hoursUntil],
                        ['type' => 'text', 'text' => $interview->scheduled_at->format('H:i')],
                        ['type' => 'text', 'text' => $interview->meeting_link ?? 'Informado em breve']
                    ]
                ]
            ]
        ];

        return $this->sendTemplate($interview->beneficiary->phone, $template);
    }

    /**
     * Send interview cancelled notification
     */
    public function sendInterviewCancelledNotification($interview): bool
    {
        $template = [
            'name' => 'interview_cancelled',
            'language' => [
                'code' => 'pt_BR'
            ],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $interview->beneficiary->name],
                        ['type' => 'text', 'text' => $interview->scheduled_at->format('d/m/Y às H:i')],
                        ['type' => 'text', 'text' => $interview->cancellation_reason ?? 'Não especificado']
                    ]
                ]
            ]
        ];

        return $this->sendTemplate($interview->beneficiary->phone, $template);
    }

    /**
     * Send custom message
     */
    public function sendCustomMessage(string $phoneNumber, string $message): bool
    {
        if (!$this->enabled) {
            return false;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $this->formatPhoneNumber($phoneNumber),
                    'type' => 'text',
                    'text' => [
                        'preview_url' => false,
                        'body' => $message
                    ]
                ]);

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('WhatsApp custom message error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Send template message
     */
    private function sendTemplate(string $phoneNumber, array $template): bool
    {
        if (!$this->enabled) {
            return false;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->post("{$this->apiUrl}/{$this->phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'recipient_type' => 'individual',
                    'to' => $this->formatPhoneNumber($phoneNumber),
                    'type' => 'template',
                    'template' => $template
                ]);

            if ($response->successful()) {
                Log::info('WhatsApp template sent', [
                    'template' => $template['name'],
                    'recipient' => $phoneNumber
                ]);
                return true;
            } else {
                Log::error('WhatsApp template error', [
                    'response' => $response->body(),
                    'template' => $template['name']
                ]);
                return false;
            }
        } catch (\Exception $e) {
            Log::error('WhatsApp template exception', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Format phone number for WhatsApp
     */
    private function formatPhoneNumber(string $phoneNumber): string
    {
        // Remove all non-numeric characters
        $phoneNumber = preg_replace('/[^0-9]/', '', $phoneNumber);
        
        // Add Brazil country code if not present
        if (strlen($phoneNumber) === 11) {
            $phoneNumber = '55' . $phoneNumber;
        }
        
        return $phoneNumber;
    }

    /**
     * Format notification message
     */
    private function formatMessage($notification): array
    {
        $method = 'format' . class_basename($notification) . 'Template';
        
        if (method_exists($this, $method)) {
            return $this->$method($notification);
        }
        
        // Default template
        return [
            'name' => 'default_notification',
            'language' => ['code' => 'pt_BR'],
            'components' => []
        ];
    }

    /**
     * Check if WhatsApp service is available
     */
    public function isAvailable(): bool
    {
        return $this->enabled && !empty($this->apiKey) && !empty($this->phoneNumberId);
    }

    /**
     * Validate phone number for WhatsApp
     */
    public function validatePhoneNumber(string $phoneNumber): bool
    {
        $formatted = $this->formatPhoneNumber($phoneNumber);
        
        // Brazilian phone number validation
        // Must be 13 digits: 55 + 2 area code + 9 + 8 digits
        return preg_match('/^55\d{2}9\d{8}$/', $formatted) === 1;
    }

    /**
     * Get message status
     */
    public function getMessageStatus(string $messageId): ?array
    {
        if (!$this->enabled) {
            return null;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->get("{$this->apiUrl}/{$messageId}");

            if ($response->successful()) {
                return $response->json();
            }

            return null;
        } catch (\Exception $e) {
            Log::error('WhatsApp status check error', ['error' => $e->getMessage()]);
            return null;
        }
    }
}