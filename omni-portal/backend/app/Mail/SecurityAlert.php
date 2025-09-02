<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Security Alert Email
 * 
 * Sends security alerts to administrators when critical security events occur,
 * such as multiple session fingerprint mismatches or suspicious activity patterns.
 */
class SecurityAlert extends Mailable
{
    use Queueable, SerializesModels;

    public array $alertData;

    /**
     * Create a new message instance.
     */
    public function __construct(array $alertData)
    {
        $this->alertData = $alertData;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('🚨 Security Alert: ' . $this->alertData['type'])
            ->view('emails.security-alert')
            ->with([
                'alertData' => $this->alertData,
                'appName' => config('app.name'),
                'timestamp' => now()->toDateTimeString(),
            ]);
    }
}