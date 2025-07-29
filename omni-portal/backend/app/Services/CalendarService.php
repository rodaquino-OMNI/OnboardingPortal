<?php

namespace App\Services;

use App\Models\InterviewSlot;
use App\Models\Interview;
use App\Models\Beneficiary;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class CalendarService
{
    /**
     * Check if there's a conflict for the given time slot
     */
    public function hasConflict(int $healthcareProfessionalId, string $date, string $startTime, string $endTime): bool
    {
        $conflictingSlots = InterviewSlot::where('healthcare_professional_id', $healthcareProfessionalId)
            ->where('date', $date)
            ->where(function ($query) use ($startTime, $endTime) {
                $query->where(function ($q) use ($startTime, $endTime) {
                    // Check for overlapping time slots
                    $q->where('start_time', '<', $endTime)
                      ->where('end_time', '>', $startTime);
                });
            })
            ->exists();

        return $conflictingSlots;
    }

    /**
     * Get calendar view for a healthcare professional
     */
    public function getCalendarView(int $healthcareProfessionalId, int $month, int $year, string $view = 'month'): array
    {
        $cacheKey = "calendar_view_{$healthcareProfessionalId}_{$month}_{$year}_{$view}";
        
        return Cache::remember($cacheKey, 3600, function () use ($healthcareProfessionalId, $month, $year, $view) {
            $startDate = Carbon::create($year, $month, 1);
            $endDate = $startDate->copy()->endOfMonth();

            if ($view === 'week') {
                $startDate = $startDate->startOfWeek();
                $endDate = $startDate->copy()->endOfWeek();
            } elseif ($view === 'day') {
                $endDate = $startDate->copy();
            }

            // Get all slots for the period
            $slots = InterviewSlot::with(['interviews' => function ($query) {
                $query->whereNotIn('status', ['cancelled']);
            }])
            ->where('healthcare_professional_id', $healthcareProfessionalId)
            ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();

            // Group slots by date
            $calendar = [];
            $statistics = [
                'total_slots' => $slots->count(),
                'booked_slots' => 0,
                'available_slots' => 0,
                'total_interviews' => 0,
                'revenue' => 0
            ];

            foreach ($slots as $slot) {
                $date = $slot->date->format('Y-m-d');
                
                if (!isset($calendar[$date])) {
                    $calendar[$date] = [
                        'date' => $date,
                        'day_name' => $slot->date->format('l'),
                        'slots' => [],
                        'daily_stats' => [
                            'total_slots' => 0,
                            'booked_slots' => 0,
                            'available_slots' => 0,
                            'revenue' => 0
                        ]
                    ];
                }

                $slotData = [
                    'id' => $slot->id,
                    'start_time' => $slot->start_time,
                    'end_time' => $slot->end_time,
                    'duration_minutes' => $slot->duration_minutes,
                    'interview_type' => $slot->interview_type,
                    'meeting_type' => $slot->meeting_type,
                    'location' => $slot->location,
                    'is_available' => $slot->is_available,
                    'current_bookings' => $slot->current_bookings,
                    'max_bookings' => $slot->max_bookings,
                    'price' => $slot->price,
                    'interviews' => $slot->interviews->map(function ($interview) {
                        return [
                            'id' => $interview->id,
                            'booking_reference' => $interview->booking_reference,
                            'status' => $interview->status,
                            'beneficiary_name' => $interview->beneficiary->name ?? 'Unknown',
                            'meeting_link' => $interview->meeting_link
                        ];
                    })
                ];

                $calendar[$date]['slots'][] = $slotData;
                $calendar[$date]['daily_stats']['total_slots']++;

                if ($slot->current_bookings > 0) {
                    $calendar[$date]['daily_stats']['booked_slots']++;
                    $statistics['booked_slots']++;
                    $statistics['total_interviews'] += $slot->current_bookings;
                    $statistics['revenue'] += ($slot->price * $slot->current_bookings);
                    $calendar[$date]['daily_stats']['revenue'] += ($slot->price * $slot->current_bookings);
                } else {
                    $calendar[$date]['daily_stats']['available_slots']++;
                    $statistics['available_slots']++;
                }
            }

            return [
                'calendar' => array_values($calendar),
                'statistics' => $statistics,
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'view' => $view,
                    'month' => $month,
                    'year' => $year
                ]
            ];
        });
    }

    /**
     * Suggest alternative slots when conflict occurs
     */
    public function suggestAlternativeSlots(int $healthcareProfessionalId, string $date, string $startTime, string $endTime, int $limit = 5): array
    {
        $requestedDate = Carbon::parse($date);
        $requestedStart = Carbon::parse($startTime);
        $requestedEnd = Carbon::parse($endTime);
        $duration = $requestedEnd->diffInMinutes($requestedStart);

        // Search for alternatives within ±3 days
        $searchStart = $requestedDate->copy()->subDays(3);
        $searchEnd = $requestedDate->copy()->addDays(3);

        $alternatives = InterviewSlot::where('healthcare_professional_id', $healthcareProfessionalId)
            ->where('is_available', true)
            ->where('current_bookings', '<', DB::raw('max_bookings'))
            ->whereBetween('date', [$searchStart->toDateString(), $searchEnd->toDateString()])
            ->where('duration_minutes', '>=', $duration)
            ->orderByRaw("ABS(DATEDIFF(date, ?))", [$date])
            ->orderBy('start_time')
            ->limit($limit)
            ->get();

        return $alternatives->map(function ($slot) use ($requestedDate) {
            $slotDate = Carbon::parse($slot->date);
            $daysDiff = $slotDate->diffInDays($requestedDate);
            
            return [
                'id' => $slot->id,
                'date' => $slot->date,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'duration_minutes' => $slot->duration_minutes,
                'interview_type' => $slot->interview_type,
                'meeting_type' => $slot->meeting_type,
                'location' => $slot->location,
                'price' => $slot->price,
                'available_bookings' => $slot->max_bookings - $slot->current_bookings,
                'days_difference' => $daysDiff,
                'recommendation_score' => $this->calculateRecommendationScore($slot, $daysDiff)
            ];
        })->sortByDesc('recommendation_score')->values()->toArray();
    }

    /**
     * Get availability summary for a healthcare professional
     */
    public function getAvailabilitySummary(int $healthcareProfessionalId, int $days = 30): array
    {
        $cacheKey = "availability_summary_{$healthcareProfessionalId}_{$days}";

        return Cache::remember($cacheKey, 1800, function () use ($healthcareProfessionalId, $days) {
            $startDate = now()->toDateString();
            $endDate = now()->addDays($days)->toDateString();

            $summary = InterviewSlot::selectRaw('
                COUNT(*) as total_slots,
                SUM(CASE WHEN is_available = 1 AND current_bookings < max_bookings THEN 1 ELSE 0 END) as available_slots,
                SUM(current_bookings) as total_bookings,
                SUM(max_bookings) as total_capacity,
                AVG(price) as average_price,
                DATE(date) as slot_date
            ')
            ->where('healthcare_professional_id', $healthcareProfessionalId)
            ->whereBetween('date', [$startDate, $endDate])
            ->groupBy('slot_date')
            ->orderBy('slot_date')
            ->get();

            $totalStats = [
                'total_slots' => $summary->sum('total_slots'),
                'available_slots' => $summary->sum('available_slots'),
                'total_bookings' => $summary->sum('total_bookings'),
                'total_capacity' => $summary->sum('total_capacity'),
                'utilization_rate' => $summary->sum('total_capacity') > 0 
                    ? round(($summary->sum('total_bookings') / $summary->sum('total_capacity')) * 100, 2)
                    : 0,
                'average_price' => round($summary->avg('average_price'), 2)
            ];

            return [
                'daily_breakdown' => $summary,
                'summary_stats' => $totalStats,
                'period' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'days' => $days
                ]
            ];
        });
    }

    /**
     * Get workload analysis for healthcare professional
     */
    public function getWorkloadAnalysis(int $healthcareProfessionalId, string $period = 'month'): array
    {
        $cacheKey = "workload_analysis_{$healthcareProfessionalId}_{$period}";

        return Cache::remember($cacheKey, 3600, function () use ($healthcareProfessionalId, $period) {
            $startDate = match ($period) {
                'week' => now()->startOfWeek(),
                'month' => now()->startOfMonth(),
                'quarter' => now()->startOfQuarter(),
                default => now()->startOfMonth()
            };

            $endDate = match ($period) {
                'week' => now()->endOfWeek(),
                'month' => now()->endOfMonth(),
                'quarter' => now()->endOfQuarter(),
                default => now()->endOfMonth()
            };

            // Get interview statistics
            $interviews = Interview::selectRaw('
                COUNT(*) as total_interviews,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_interviews,
                COUNT(CASE WHEN status = "cancelled" THEN 1 END) as cancelled_interviews,
                AVG(CASE WHEN status = "completed" THEN actual_duration_minutes END) as avg_duration,
                AVG(CASE WHEN status = "completed" AND rating IS NOT NULL THEN rating END) as avg_rating,
                SUM(CASE WHEN status = "completed" THEN slot.price ELSE 0 END) as total_revenue
            ')
            ->join('interview_slots as slot', 'interviews.interview_slot_id', '=', 'slot.id')
            ->where('interviews.healthcare_professional_id', $healthcareProfessionalId)
            ->whereBetween('interviews.scheduled_at', [$startDate, $endDate])
            ->first();

            // Get peak hours analysis
            $peakHours = Interview::selectRaw('
                HOUR(scheduled_at) as hour,
                COUNT(*) as interview_count
            ')
            ->where('healthcare_professional_id', $healthcareProfessionalId)
            ->where('status', 'completed')
            ->whereBetween('scheduled_at', [$startDate, $endDate])
            ->groupBy('hour')
            ->orderByDesc('interview_count')
            ->limit(5)
            ->get();

            // Get interview type distribution
            $typeDistribution = Interview::selectRaw('
                slot.interview_type,
                COUNT(*) as count,
                AVG(CASE WHEN interviews.status = "completed" THEN interviews.rating END) as avg_rating
            ')
            ->join('interview_slots as slot', 'interviews.interview_slot_id', '=', 'slot.id')
            ->where('interviews.healthcare_professional_id', $healthcareProfessionalId)
            ->whereBetween('interviews.scheduled_at', [$startDate, $endDate])
            ->groupBy('slot.interview_type')
            ->get();

            return [
                'overview' => [
                    'total_interviews' => $interviews->total_interviews ?? 0,
                    'completed_interviews' => $interviews->completed_interviews ?? 0,
                    'cancelled_interviews' => $interviews->cancelled_interviews ?? 0,
                    'completion_rate' => $interviews->total_interviews > 0 
                        ? round(($interviews->completed_interviews / $interviews->total_interviews) * 100, 2)
                        : 0,
                    'average_duration' => round($interviews->avg_duration ?? 0, 1),
                    'average_rating' => round($interviews->avg_rating ?? 0, 2),
                    'total_revenue' => $interviews->total_revenue ?? 0
                ],
                'peak_hours' => $peakHours->map(function ($item) {
                    return [
                        'hour' => $item->hour . ':00',
                        'interview_count' => $item->interview_count
                    ];
                }),
                'type_distribution' => $typeDistribution->map(function ($item) {
                    return [
                        'type' => $item->interview_type,
                        'count' => $item->count,
                        'average_rating' => round($item->avg_rating ?? 0, 2)
                    ];
                }),
                'period' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'period_type' => $period
                ]
            ];
        });
    }

    /**
     * Clear cache for healthcare professional
     */
    public function clearCache(int $healthcareProfessionalId): void
    {
        $patterns = [
            "calendar_view_{$healthcareProfessionalId}_*",
            "availability_summary_{$healthcareProfessionalId}_*",
            "workload_analysis_{$healthcareProfessionalId}_*",
            "calendar_availability_{$healthcareProfessionalId}"
        ];

        foreach ($patterns as $pattern) {
            Cache::forget($pattern);
        }
    }

    /**
     * Calculate recommendation score for alternative slots
     */
    private function calculateRecommendationScore(InterviewSlot $slot, int $daysDifference): float
    {
        $score = 100;

        // Prefer closer dates
        $score -= ($daysDifference * 5);

        // Prefer morning slots (9-12)
        $hour = Carbon::parse($slot->start_time)->hour;
        if ($hour >= 9 && $hour <= 12) {
            $score += 10;
        }

        // Prefer slots with higher availability
        $availabilityRate = 1 - ($slot->current_bookings / $slot->max_bookings);
        $score += ($availabilityRate * 20);

        // Prefer video/phone over in-person for flexibility
        if (in_array($slot->meeting_type, ['video', 'phone'])) {
            $score += 5;
        }

        return max(0, $score);
    }

    /**
     * Get available slots with intelligent recommendations
     */
    public function getAvailableSlots(
        Carbon $startDate,
        Carbon $endDate,
        array $preferences = []
    ): Collection {
        $slots = InterviewSlot::where('date', '>=', $startDate)
            ->where('date', '<=', $endDate)
            ->where('is_available', true)
            ->with(['healthcareProfessional'])
            ->get();

        // Apply timezone conversion if provided
        if (isset($preferences['timezone'])) {
            $slots = $this->convertSlotsToUserTimezone($slots, $preferences['timezone']);
        }

        // Add intelligence scoring
        return $slots->map(function ($slot) use ($preferences) {
            $slot->recommendation_score = $this->calculateAdvancedRecommendationScore($slot, $preferences);
            return $slot;
        })->sortByDesc('recommendation_score');
    }

    /**
     * Advanced conflict detection with buffer zones
     */
    public function detectConflicts(
        Beneficiary $beneficiary,
        InterviewSlot $slot,
        array $options = []
    ): array {
        $bufferMinutes = $options['buffer_minutes'] ?? 120;
        $slotStart = Carbon::parse($slot->date . ' ' . $slot->start_time);
        $slotEnd = Carbon::parse($slot->date . ' ' . $slot->end_time);

        $conflicts = Interview::where('beneficiary_id', $beneficiary->id)
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->whereHas('slot', function ($query) use ($slotStart, $slotEnd, $bufferMinutes) {
                $query->where(function ($q) use ($slotStart, $slotEnd, $bufferMinutes) {
                    $bufferStart = $slotStart->copy()->subMinutes($bufferMinutes);
                    $bufferEnd = $slotEnd->copy()->addMinutes($bufferMinutes);
                    
                    $q->whereBetween(
                        DB::raw("CONCAT(date, ' ', start_time)"),
                        [$bufferStart, $bufferEnd]
                    );
                });
            })
            ->with(['slot', 'healthcareProfessional'])
            ->get();

        $conflictDetails = [];
        foreach ($conflicts as $conflict) {
            $conflictDetails[] = [
                'interview_id' => $conflict->id,
                'scheduled_at' => $conflict->scheduled_at,
                'type' => $conflict->slot->interview_type,
                'healthcare_professional' => $conflict->healthcareProfessional->name,
                'conflict_type' => $this->determineConflictType($slot, $conflict->slot, $bufferMinutes)
            ];
        }

        return [
            'has_conflicts' => count($conflicts) > 0,
            'conflicts' => $conflictDetails,
            'buffer_minutes' => $bufferMinutes,
            'recommendations' => $this->generateAlternativeSlots($slot, $conflicts)
        ];
    }

    /**
     * Intelligent slot recommendation with advanced scoring
     */
    private function calculateAdvancedRecommendationScore(InterviewSlot $slot, array $preferences): float
    {
        $score = 100; // Base score

        // Time preference scoring
        $slotHour = Carbon::parse($slot->start_time)->hour;
        $preferredHour = $preferences['preferred_time'] ?? 14; // 2 PM default
        $timeDiff = abs($slotHour - $preferredHour);
        $score -= ($timeDiff * 5); // Reduce score by 5 for each hour difference

        // Professional preference
        if (isset($preferences['preferred_professional_id'])) {
            if ($slot->healthcare_professional_id == $preferences['preferred_professional_id']) {
                $score += 20;
            }
        }

        // Date preference (sooner is better, but not too soon)
        $daysFromNow = Carbon::parse($slot->date)->diffInDays(now());
        if ($daysFromNow >= 2 && $daysFromNow <= 7) {
            $score += 10; // Sweet spot
        } elseif ($daysFromNow < 2) {
            $score -= 15; // Too soon
        } elseif ($daysFromNow > 14) {
            $score -= 10; // Too far
        }

        // Workload balancing
        $professionalLoad = $this->getProfessionalWorkload($slot->healthcare_professional_id);
        if ($professionalLoad < 0.7) { // Less than 70% capacity
            $score += 15;
        } elseif ($professionalLoad > 0.9) { // Over 90% capacity
            $score -= 20;
        }

        // Meeting type preference
        if (isset($preferences['preferred_meeting_type'])) {
            if ($slot->meeting_type === $preferences['preferred_meeting_type']) {
                $score += 10;
            }
        }

        // Language/specialization match
        if (isset($preferences['language']) && isset($slot->healthcareProfessional->languages)) {
            if (in_array($preferences['language'], $slot->healthcareProfessional->languages)) {
                $score += 15;
            }
        }

        return max(0, $score);
    }

    /**
     * Get professional workload percentage
     */
    private function getProfessionalWorkload(int $professionalId): float
    {
        $cacheKey = "professional_workload_{$professionalId}";
        
        return Cache::remember($cacheKey, 300, function () use ($professionalId) {
            $totalSlots = InterviewSlot::where('healthcare_professional_id', $professionalId)
                ->where('date', '>=', now()->toDateString())
                ->where('date', '<=', now()->addDays(7)->toDateString())
                ->count();

            if ($totalSlots === 0) {
                return 0;
            }

            $bookedSlots = InterviewSlot::where('healthcare_professional_id', $professionalId)
                ->where('date', '>=', now()->toDateString())
                ->where('date', '<=', now()->addDays(7)->toDateString())
                ->where('current_bookings', '>', 0)
                ->sum('current_bookings');

            $maxCapacity = InterviewSlot::where('healthcare_professional_id', $professionalId)
                ->where('date', '>=', now()->toDateString())
                ->where('date', '<=', now()->addDays(7)->toDateString())
                ->sum('max_bookings');

            return $maxCapacity > 0 ? ($bookedSlots / $maxCapacity) : 0;
        });
    }

    /**
     * Convert slots to user timezone
     */
    private function convertSlotsToUserTimezone(
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

            return $slot;
        });
    }

    /**
     * Determine conflict type
     */
    private function determineConflictType(InterviewSlot $newSlot, InterviewSlot $existingSlot, int $bufferMinutes): string
    {
        $newStart = Carbon::parse($newSlot->date . ' ' . $newSlot->start_time);
        $newEnd = Carbon::parse($newSlot->date . ' ' . $newSlot->end_time);
        $existingStart = Carbon::parse($existingSlot->date . ' ' . $existingSlot->start_time);
        $existingEnd = Carbon::parse($existingSlot->date . ' ' . $existingSlot->end_time);

        // Direct overlap
        if ($newStart < $existingEnd && $newEnd > $existingStart) {
            return 'direct_overlap';
        }

        // Buffer zone conflict
        $bufferStart = $existingStart->copy()->subMinutes($bufferMinutes);
        $bufferEnd = $existingEnd->copy()->addMinutes($bufferMinutes);
        
        if ($newStart >= $bufferStart && $newStart <= $bufferEnd) {
            return 'buffer_conflict';
        }

        return 'unknown';
    }

    /**
     * Generate alternative slots when conflicts occur
     */
    private function generateAlternativeSlots(InterviewSlot $conflictingSlot, Collection $conflicts): array
    {
        $alternatives = [];
        $searchDate = Carbon::parse($conflictingSlot->date);
        
        // Search for alternatives within ±7 days
        for ($i = -7; $i <= 7; $i++) {
            if ($i === 0) continue; // Skip the conflicting date
            
            $checkDate = $searchDate->copy()->addDays($i);
            
            $availableSlots = InterviewSlot::where('healthcare_professional_id', $conflictingSlot->healthcare_professional_id)
                ->where('date', $checkDate->toDateString())
                ->where('is_available', true)
                ->where('current_bookings', '<', DB::raw('max_bookings'))
                ->get();
            
            foreach ($availableSlots as $slot) {
                $alternatives[] = [
                    'slot_id' => $slot->id,
                    'date' => $slot->date,
                    'start_time' => $slot->start_time,
                    'end_time' => $slot->end_time,
                    'days_difference' => abs($i),
                    'available_spots' => $slot->max_bookings - $slot->current_bookings
                ];
            }
        }
        
        // Sort by days difference and return top 5
        usort($alternatives, function ($a, $b) {
            return $a['days_difference'] - $b['days_difference'];
        });
        
        return array_slice($alternatives, 0, 5);
    }
}