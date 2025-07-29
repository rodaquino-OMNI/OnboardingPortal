<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client as TwilioClient;
use Aws\Sns\SnsClient;

class SMSService
{
    private string $provider;
    private bool $enabled;
    private $client;

    public function __construct()
    {
        $this->provider = config('services.sms.provider', 'twilio');
        $this->enabled = config('services.sms.enabled', false);
        
        if ($this->enabled) {
            $this->initializeClient();
        }
    }

    /**
     * Initialize SMS client based on provider
     */
    private function initializeClient(): void
    {
        switch ($this->provider) {
            case 'twilio':
                $this->client = new TwilioClient(
                    config('services.sms.twilio.sid'),
                    config('services.sms.twilio.token')
                );
                break;
                
            case 'aws_sns':
                $this->client = new SnsClient([
                    'version' => 'latest',
                    'region' => config('services.sms.aws.region', 'us-east-1'),
                    'credentials' => [
                        'key' => config('services.sms.aws.key'),
                        'secret' => config('services.sms.aws.secret'),
                    ],
                ]);
                break;
                
            default:
                Log::error('Unsupported SMS provider: ' . $this->provider);
                $this->enabled = false;
        }
    }

    /**
     * Send SMS message
     */
    public function send($notification): bool
    {
        if (!$this->enabled) {
            Log::info('SMS service is disabled');
            return false;
        }

        try {
            $recipient = $notification->notifiable;
            $phoneNumber = $this->formatPhoneNumber($recipient->phone);
            
            if (!$phoneNumber) {
                Log::warning('No valid phone number for SMS recipient', ['recipient_id' => $recipient->id]);
                return false;
            }

            $message = $this->formatMessage($notification);
            
            return $this->sendViaProvider($phoneNumber, $message);
            
        } catch (\Exception $e) {
            Log::error('SMS service error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Send SMS via configured provider
     */
    private function sendViaProvider(string $phoneNumber, string $message): bool
    {
        switch ($this->provider) {
            case 'twilio':
                return $this->sendViaTwilio($phoneNumber, $message);
                
            case 'aws_sns':
                return $this->sendViaAWS($phoneNumber, $message);
                
            default:
                return false;
        }
    }

    /**
     * Send SMS via Twilio
     */
    private function sendViaTwilio(string $phoneNumber, string $message): bool
    {
        try {
            $result = $this->client->messages->create(
                $phoneNumber,
                [
                    'from' => config('services.sms.twilio.from'),
                    'body' => $message
                ]
            );
            
            Log::info('SMS sent via Twilio', [
                'sid' => $result->sid,
                'to' => $phoneNumber,
                'status' => $result->status
            ]);
            
            return $result->status !== 'failed';
            
        } catch (\Exception $e) {
            Log::error('Twilio SMS error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Send SMS via AWS SNS
     */
    private function sendViaAWS(string $phoneNumber, string $message): bool
    {
        try {
            $result = $this->client->publish([
                'Message' => $message,
                'PhoneNumber' => $phoneNumber,
                'MessageAttributes' => [
                    'AWS.SNS.SMS.SMSType' => [
                        'DataType' => 'String',
                        'StringValue' => 'Transactional'
                    ]
                ]
            ]);
            
            Log::info('SMS sent via AWS SNS', [
                'messageId' => $result['MessageId'],
                'to' => $phoneNumber
            ]);
            
            return true;
            
        } catch (\Exception $e) {
            Log::error('AWS SNS SMS error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Send interview scheduled SMS
     */
    public function sendInterviewScheduledSMS($interview): bool
    {
        $message = sprintf(
            "Olá %s! Sua entrevista foi agendada para %s às %s com %s. Ref: %s",
            $interview->beneficiary->name,
            $interview->scheduled_at->format('d/m/Y'),
            $interview->scheduled_at->format('H:i'),
            $interview->healthcareProfessional->name,
            $interview->booking_reference
        );
        
        return $this->sendCustomMessage($interview->beneficiary->phone, $message);
    }

    /**
     * Send interview reminder SMS
     */
    public function sendInterviewReminderSMS($interview, int $hoursBeforeInterview): bool
    {
        $message = sprintf(
            "Lembrete: Sua entrevista é em %d %s, às %s. %s. Ref: %s",
            $hoursBeforeInterview,
            $hoursBeforeInterview === 1 ? 'hora' : 'horas',
            $interview->scheduled_at->format('H:i'),
            $interview->meeting_type === 'video' ? 'Link: ' . $interview->meeting_link : 'Local: ' . $interview->slot->location,
            $interview->booking_reference
        );
        
        return $this->sendCustomMessage($interview->beneficiary->phone, $message);
    }

    /**
     * Send interview cancelled SMS
     */
    public function sendInterviewCancelledSMS($interview): bool
    {
        $message = sprintf(
            "Sua entrevista de %s foi cancelada. Entre em contato para reagendar. Ref: %s",
            $interview->scheduled_at->format('d/m/Y H:i'),
            $interview->booking_reference
        );
        
        return $this->sendCustomMessage($interview->beneficiary->phone, $message);
    }

    /**
     * Send interview rescheduled SMS
     */
    public function sendInterviewRescheduledSMS($interview, $oldScheduledAt): bool
    {
        $message = sprintf(
            "Sua entrevista foi remarcada de %s para %s. Ref: %s",
            $oldScheduledAt->format('d/m/Y H:i'),
            $interview->scheduled_at->format('d/m/Y H:i'),
            $interview->booking_reference
        );
        
        return $this->sendCustomMessage($interview->beneficiary->phone, $message);
    }

    /**
     * Send custom SMS message
     */
    public function sendCustomMessage(string $phoneNumber, string $message): bool
    {
        if (!$this->enabled) {
            return false;
        }

        // Limit message to 160 characters for SMS
        $message = mb_substr($message, 0, 160);
        
        return $this->sendViaProvider($this->formatPhoneNumber($phoneNumber), $message);
    }

    /**
     * Format phone number for SMS
     */
    private function formatPhoneNumber(string $phoneNumber): string
    {
        // Remove all non-numeric characters
        $phoneNumber = preg_replace('/[^0-9]/', '', $phoneNumber);
        
        // Add Brazil country code if not present
        if (strlen($phoneNumber) === 11) {
            $phoneNumber = '+55' . $phoneNumber;
        } elseif (strlen($phoneNumber) === 13 && substr($phoneNumber, 0, 2) === '55') {
            $phoneNumber = '+' . $phoneNumber;
        }
        
        return $phoneNumber;
    }

    /**
     * Format notification message
     */
    private function formatMessage($notification): string
    {
        $method = 'format' . class_basename($notification) . 'SMS';
        
        if (method_exists($this, $method)) {
            return $this->$method($notification);
        }
        
        // Default message
        return 'Você tem uma nova notificação do sistema de saúde.';
    }

    /**
     * Check if SMS service is available
     */
    public function isAvailable(): bool
    {
        if (!$this->enabled) {
            return false;
        }
        
        switch ($this->provider) {
            case 'twilio':
                return !empty(config('services.sms.twilio.sid')) && 
                       !empty(config('services.sms.twilio.token'));
                       
            case 'aws_sns':
                return !empty(config('services.sms.aws.key')) && 
                       !empty(config('services.sms.aws.secret'));
                       
            default:
                return false;
        }
    }

    /**
     * Validate phone number for SMS
     */
    public function validatePhoneNumber(string $phoneNumber): bool
    {
        $formatted = $this->formatPhoneNumber($phoneNumber);
        
        // Brazilian phone number validation
        // Must start with +55 and have 13 total digits
        return preg_match('/^\+55\d{2}9?\d{8}$/', $formatted) === 1;
    }

    /**
     * Get SMS status (Twilio only)
     */
    public function getMessageStatus(string $messageSid): ?array
    {
        if (!$this->enabled || $this->provider !== 'twilio') {
            return null;
        }

        try {
            $message = $this->client->messages($messageSid)->fetch();
            
            return [
                'status' => $message->status,
                'error_code' => $message->errorCode,
                'error_message' => $message->errorMessage,
                'date_sent' => $message->dateSent,
                'price' => $message->price,
                'price_unit' => $message->priceUnit
            ];
            
        } catch (\Exception $e) {
            Log::error('SMS status check error', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Get remaining SMS credits (provider specific)
     */
    public function getRemainingCredits(): ?float
    {
        if (!$this->enabled) {
            return null;
        }

        switch ($this->provider) {
            case 'twilio':
                // Twilio doesn't have a direct credit API
                // You would need to implement balance checking via their API
                return null;
                
            default:
                return null;
        }
    }
}