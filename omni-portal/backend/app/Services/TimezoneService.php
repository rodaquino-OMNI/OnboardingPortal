<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TimezoneService
{
    private const BRAZIL_TIMEZONES = [
        'America/Sao_Paulo' => 'Horário de Brasília (BRT/BRST)',
        'America/Manaus' => 'Horário do Amazonas (AMT)',
        'America/Fortaleza' => 'Horário de Brasília (BRT)',
        'America/Recife' => 'Horário de Brasília (BRT)',
        'America/Campo_Grande' => 'Horário do Mato Grosso (AMT/AMST)',
        'America/Rio_Branco' => 'Horário do Acre (ACT)',
        'America/Noronha' => 'Horário de Fernando de Noronha (FNT)',
        'America/Belem' => 'Horário de Brasília (BRT)',
        'America/Porto_Velho' => 'Horário do Amazonas (AMT)',
        'America/Cuiaba' => 'Horário do Mato Grosso (AMT/AMST)',
    ];

    /**
     * Convert interview slots to user's timezone
     */
    public function convertSlotsToUserTimezone(
        Collection $slots,
        string $userTimezone = 'America/Sao_Paulo'
    ): Collection {
        return $slots->map(function ($slot) use ($userTimezone) {
            $originalStart = Carbon::parse($slot->date . ' ' . $slot->start_time, 'America/Sao_Paulo');
            $originalEnd = Carbon::parse($slot->date . ' ' . $slot->end_time, 'America/Sao_Paulo');

            $convertedStart = $originalStart->setTimezone($userTimezone);
            $convertedEnd = $originalEnd->setTimezone($userTimezone);

            $slot->display_date = $convertedStart->format('Y-m-d');
            $slot->display_start_time = $convertedStart->format('H:i');
            $slot->display_end_time = $convertedEnd->format('H:i');
            $slot->display_timezone = $userTimezone;
            $slot->timezone_offset = $convertedStart->format('P');
            $slot->display_datetime = $convertedStart->format('Y-m-d H:i:s T');

            // Check if date changes due to timezone conversion
            if ($slot->display_date !== $slot->date->format('Y-m-d')) {
                $slot->date_changed = true;
                $slot->original_date = $slot->date->format('Y-m-d');
            }

            return $slot;
        });
    }

    /**
     * Detect user timezone from IP or browser
     */
    public function detectUserTimezone(Request $request): string
    {
        // Try from request header first
        if ($timezone = $request->header('X-Timezone')) {
            if ($this->isValidTimezone($timezone)) {
                return $timezone;
            }
        }

        // Try from user preferences
        if ($user = $request->user()) {
            if ($timezone = $user->timezone) {
                return $timezone;
            }
        }

        // Try from session
        if ($timezone = session('user_timezone')) {
            if ($this->isValidTimezone($timezone)) {
                return $timezone;
            }
        }

        // Try to detect from IP address
        if ($detectedTimezone = $this->detectTimezoneFromIP($request->ip())) {
            return $detectedTimezone;
        }

        // Default to São Paulo
        return 'America/Sao_Paulo';
    }

    /**
     * Get available Brazilian timezones
     */
    public function getBrazilianTimezones(): array
    {
        return self::BRAZIL_TIMEZONES;
    }

    /**
     * Convert UTC time to user timezone
     */
    public function convertToUserTimezone(string $utcTime, string $userTimezone): string
    {
        return Carbon::parse($utcTime, 'UTC')
            ->setTimezone($userTimezone)
            ->format('Y-m-d H:i:s T');
    }

    /**
     * Convert user timezone to UTC
     */
    public function convertToUTC(string $localTime, string $userTimezone): string
    {
        return Carbon::parse($localTime, $userTimezone)
            ->setTimezone('UTC')
            ->format('Y-m-d H:i:s');
    }

    /**
     * Get business hours for specific timezone
     */
    public function getBusinessHours(string $timezone): array
    {
        // Business hours in local timezone
        $businessHours = [
            'start' => '08:00:00',
            'end' => '18:00:00',
            'timezone' => $timezone
        ];

        // Convert to UTC for storage
        $date = now()->format('Y-m-d');
        $startUTC = $this->convertToUTC($date . ' ' . $businessHours['start'], $timezone);
        $endUTC = $this->convertToUTC($date . ' ' . $businessHours['end'], $timezone);

        return [
            'local' => $businessHours,
            'utc' => [
                'start' => Carbon::parse($startUTC)->format('H:i:s'),
                'end' => Carbon::parse($endUTC)->format('H:i:s')
            ]
        ];
    }

    /**
     * Check if timezone is valid
     */
    public function isValidTimezone(string $timezone): bool
    {
        return in_array($timezone, timezone_identifiers_list());
    }

    /**
     * Detect timezone from IP address
     */
    private function detectTimezoneFromIP(string $ip): ?string
    {
        // In production, you would use a geolocation service
        // For now, return null to use default
        return null;
    }

    /**
     * Get timezone offset in hours
     */
    public function getTimezoneOffset(string $timezone): int
    {
        $now = Carbon::now($timezone);
        return $now->offsetHours;
    }

    /**
     * Format datetime for display with timezone
     */
    public function formatForDisplay(
        string $datetime,
        string $fromTimezone = 'UTC',
        string $toTimezone = 'America/Sao_Paulo',
        string $format = 'd/m/Y H:i'
    ): string {
        return Carbon::parse($datetime, $fromTimezone)
            ->setTimezone($toTimezone)
            ->format($format);
    }

    /**
     * Get timezone abbreviation
     */
    public function getTimezoneAbbreviation(string $timezone): string
    {
        $now = Carbon::now($timezone);
        return $now->format('T');
    }

    /**
     * Check if two timezones have the same offset
     */
    public function haveSameOffset(string $timezone1, string $timezone2): bool
    {
        $offset1 = $this->getTimezoneOffset($timezone1);
        $offset2 = $this->getTimezoneOffset($timezone2);
        
        return $offset1 === $offset2;
    }

    /**
     * Get user-friendly timezone name
     */
    public function getFriendlyTimezoneName(string $timezone): string
    {
        return self::BRAZIL_TIMEZONES[$timezone] ?? $timezone;
    }

    /**
     * Convert appointment time between timezones
     */
    public function convertAppointmentTime(
        string $date,
        string $time,
        string $fromTimezone,
        string $toTimezone
    ): array {
        $datetime = Carbon::parse($date . ' ' . $time, $fromTimezone);
        $converted = $datetime->setTimezone($toTimezone);

        return [
            'original' => [
                'date' => $date,
                'time' => $time,
                'timezone' => $fromTimezone,
                'datetime' => $datetime->format('Y-m-d H:i:s T')
            ],
            'converted' => [
                'date' => $converted->format('Y-m-d'),
                'time' => $converted->format('H:i'),
                'timezone' => $toTimezone,
                'datetime' => $converted->format('Y-m-d H:i:s T'),
                'date_changed' => $date !== $converted->format('Y-m-d')
            ]
        ];
    }

    /**
     * Get next available time in business hours
     */
    public function getNextAvailableTime(string $timezone, int $durationMinutes = 60): Carbon
    {
        $now = Carbon::now($timezone);
        $businessHours = $this->getBusinessHours($timezone);
        
        $businessStart = Carbon::parse($now->format('Y-m-d') . ' ' . $businessHours['local']['start'], $timezone);
        $businessEnd = Carbon::parse($now->format('Y-m-d') . ' ' . $businessHours['local']['end'], $timezone);

        // If current time is before business hours, return start of business hours
        if ($now->lt($businessStart)) {
            return $businessStart;
        }

        // If current time plus duration is within business hours, return current time
        if ($now->copy()->addMinutes($durationMinutes)->lte($businessEnd)) {
            return $now;
        }

        // Otherwise, return start of next business day
        return $businessStart->addDay();
    }

    /**
     * Calculate duration across timezones
     */
    public function calculateDurationAcrossTimezones(
        string $startDatetime,
        string $startTimezone,
        string $endDatetime,
        string $endTimezone
    ): array {
        $start = Carbon::parse($startDatetime, $startTimezone);
        $end = Carbon::parse($endDatetime, $endTimezone);

        $durationMinutes = $start->diffInMinutes($end);
        $durationHours = $start->diffInHours($end);

        return [
            'minutes' => $durationMinutes,
            'hours' => $durationHours,
            'formatted' => $this->formatDuration($durationMinutes)
        ];
    }

    /**
     * Format duration in human-readable format
     */
    private function formatDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes . ' minutos';
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        if ($remainingMinutes === 0) {
            return $hours . ' ' . ($hours === 1 ? 'hora' : 'horas');
        }

        return $hours . ' ' . ($hours === 1 ? 'hora' : 'horas') . ' e ' . $remainingMinutes . ' minutos';
    }
}