<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\Beneficiary;
use App\Services\CalendarService;
use App\Services\InterviewNotificationService;
use App\Services\GamificationService;
use App\Services\TimezoneService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class InterviewController extends Controller
{
    protected CalendarService $calendarService;
    protected InterviewNotificationService $notificationService;
    protected GamificationService $gamificationService;
    protected TimezoneService $timezoneService;

    public function __construct(
        CalendarService $calendarService,
        InterviewNotificationService $notificationService,
        GamificationService $gamificationService,
        TimezoneService $timezoneService
    ) {
        $this->calendarService = $calendarService;
        $this->notificationService = $notificationService;
        $this->gamificationService = $gamificationService;
        $this->timezoneService = $timezoneService;
    }

    /**
     * List interviews for authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|string|in:scheduled,confirmed,in_progress,completed,cancelled,rescheduled',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
            'per_page' => 'nullable|integer|min:1|max:100'
        ]);

        $user = $request->user();
        
        // Get beneficiary if user is a beneficiary
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary && !$user->hasRole(['admin', 'healthcare_professional'])) {
            return response()->json([
                'success' => false,
                'message' => 'User must be a beneficiary or healthcare professional.'
            ], 403);
        }

        $query = Interview::with([
            'slot:id,date,start_time,end_time,interview_type,meeting_type,location',
            'beneficiary:id,name,email,phone',
            'healthcareProfessional:id,name,email,specialization'
        ]);

        // Filter by user role
        if ($beneficiary) {
            $query->where('beneficiary_id', $beneficiary->id);
        } elseif ($user->hasRole('healthcare_professional')) {
            $query->where('healthcare_professional_id', $user->id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->date_from) {
            $query->whereHas('slot', function ($q) use ($request) {
                $q->where('date', '>=', $request->date_from);
            });
        }

        if ($request->date_to) {
            $query->whereHas('slot', function ($q) use ($request) {
                $q->where('date', '<=', $request->date_to);
            });
        }

        $interviews = $query->orderBy('scheduled_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data' => $interviews,
            'meta' => [
                'user_role' => $user->getRoleNames()->first(),
                'upcoming_count' => $this->getUpcomingCount($user, $beneficiary),
                'completed_count' => $this->getCompletedCount($user, $beneficiary)
            ]
        ]);
    }

    /**
     * Get upcoming interviews
     */
    public function upcoming(Request $request): JsonResponse
    {
        $user = $request->user();
        $beneficiary = $user->beneficiary;

        $query = Interview::with([
            'slot:id,date,start_time,end_time,interview_type,meeting_type,location,meeting_link',
            'beneficiary:id,name,email,phone',
            'healthcareProfessional:id,name,email,specialization'
        ])
        ->whereIn('status', ['scheduled', 'confirmed'])
        ->whereHas('slot', function ($q) {
            $q->where('date', '>=', now()->toDateString());
        });

        if ($beneficiary) {
            $query->where('beneficiary_id', $beneficiary->id);
        } elseif ($user->hasRole('healthcare_professional')) {
            $query->where('healthcare_professional_id', $user->id);
        }

        $interviews = $query->orderBy('scheduled_at')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $interviews,
            'meta' => [
                'count' => $interviews->count(),
                'next_interview' => $interviews->first()?->scheduled_at
            ]
        ]);
    }

    /**
     * Book an interview slot
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'interview_slot_id' => 'required|exists:interview_slots,id',
            'notes' => 'nullable|string|max:1000',
            'preferred_meeting_type' => 'nullable|string|in:in_person,video,phone'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Only beneficiaries can book interviews.'
            ], 403);
        }

        // Check if beneficiary meets requirements
        if (!$this->checkBookingRequirements($beneficiary)) {
            return response()->json([
                'success' => false,
                'message' => 'Please complete your registration, upload required documents, and complete the health questionnaire before booking.',
                'requirements' => $this->getBookingRequirements($beneficiary)
            ], 400);
        }

        $slot = InterviewSlot::findOrFail($validated['interview_slot_id']);

        // Check slot availability
        if (!$slot->is_available || $slot->current_bookings >= $slot->max_bookings) {
            return response()->json([
                'success' => false,
                'message' => 'This interview slot is no longer available.'
            ], 400);
        }

        // Check for existing interview in same time slot
        $existingInterview = Interview::where('beneficiary_id', $beneficiary->id)
            ->where('interview_slot_id', $slot->id)
            ->whereNotIn('status', ['cancelled'])
            ->first();

        if ($existingInterview) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an interview booked in this time slot.'
            ], 400);
        }

        // Check for conflicts with other interviews (2-hour buffer)
        if ($this->hasInterviewConflict($beneficiary, $slot)) {
            return response()->json([
                'success' => false,
                'message' => 'This interview conflicts with another appointment. Please maintain at least 2 hours between interviews.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            // Create interview with timezone awareness
            $scheduledAt = Carbon::parse($slot->date . ' ' . $slot->start_time, $slot->timezone ?? 'America/Sao_Paulo');
            
            $interview = Interview::create([
                'beneficiary_id' => $beneficiary->id,
                'interview_slot_id' => $slot->id,
                'healthcare_professional_id' => $slot->healthcare_professional_id,
                'booking_reference' => $this->generateBookingReference(),
                'status' => 'scheduled',
                'scheduled_at' => $scheduledAt,
                'interview_type' => $slot->interview_type,
                'meeting_type' => $validated['preferred_meeting_type'] ?? $slot->meeting_type,
                'meeting_link' => $slot->meeting_link,
                'pre_interview_notes' => $validated['notes'],
                'booked_at' => now(),
                'timezone' => $slot->timezone ?? 'America/Sao_Paulo',
                'beneficiary_timezone' => $beneficiary->timezone ?? 'America/Sao_Paulo',
                'professional_timezone' => $slot->timezone ?? 'America/Sao_Paulo',
                'duration_minutes' => $slot->duration_minutes,
                'reminder_sent_at' => null,
                'confirmation_sent_at' => null
            ]);

            // Update slot booking count
            $slot->increment('current_bookings');
            
            if ($slot->current_bookings >= $slot->max_bookings) {
                $slot->update(['is_available' => false]);
            }

            // Award gamification points
            $this->gamificationService->awardPoints($beneficiary->id, 'interview_scheduled', 150, [
                'interview_id' => $interview->id,
                'interview_type' => $slot->interview_type
            ]);

            // Send notifications
            $this->notificationService->sendInterviewScheduledNotification($interview);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Interview scheduled successfully!',
                'data' => [
                    'interview' => $interview->load([
                        'slot:id,date,start_time,end_time,interview_type,meeting_type,location',
                        'healthcareProfessional:id,name,email,specialization'
                    ]),
                    'booking_reference' => $interview->booking_reference,
                    'gamification' => [
                        'points_earned' => 150,
                        'achievement_unlocked' => 'Interview Scheduled'
                    ]
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to schedule interview.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show specific interview
     */
    public function show(Interview $interview): JsonResponse
    {
        $user = auth()->user();
        $beneficiary = $user->beneficiary;

        // Check permissions
        if ($beneficiary && $interview->beneficiary_id !== $beneficiary->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view this interview.'
            ], 403);
        }

        if ($user->hasRole('healthcare_professional') && $interview->healthcare_professional_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view this interview.'
            ], 403);
        }

        $interview->load([
            'slot:id,date,start_time,end_time,interview_type,meeting_type,location,meeting_link',
            'beneficiary:id,name,email,phone,date_of_birth',
            'healthcareProfessional:id,name,email,specialization',
            'documents',
            'rescheduleHistory'
        ]);

        return response()->json([
            'success' => true,
            'data' => $interview
        ]);
    }

    /**
     * Reschedule interview
     */
    public function reschedule(Request $request, Interview $interview): JsonResponse
    {
        $validated = $request->validate([
            'new_interview_slot_id' => 'required|exists:interview_slots,id',
            'reason' => 'required|string|max:500'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        // Check permissions
        if ($beneficiary && $interview->beneficiary_id !== $beneficiary->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to reschedule this interview.'
            ], 403);
        }

        // Check if interview can be rescheduled
        if (!in_array($interview->status, ['scheduled', 'confirmed'])) {
            return response()->json([
                'success' => false,
                'message' => 'Only scheduled or confirmed interviews can be rescheduled.'
            ], 400);
        }

        // Check 24-hour advance notice
        if ($interview->scheduled_at <= now()->addHours(24)) {
            return response()->json([
                'success' => false,
                'message' => 'Interviews must be rescheduled at least 24 hours in advance.'
            ], 400);
        }

        // Check maximum reschedule limit
        if ($interview->reschedule_count >= 3) {
            return response()->json([
                'success' => false,
                'message' => 'Maximum reschedule limit (3) reached for this interview.'
            ], 400);
        }

        $newSlot = InterviewSlot::findOrFail($validated['new_interview_slot_id']);

        // Check new slot availability
        if (!$newSlot->is_available || $newSlot->current_bookings >= $newSlot->max_bookings) {
            return response()->json([
                'success' => false,
                'message' => 'The selected time slot is no longer available.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            $oldSlot = $interview->slot;
            $oldScheduledAt = $interview->scheduled_at;

            // Update interview with timezone awareness
            $newScheduledAt = Carbon::parse($newSlot->date . ' ' . $newSlot->start_time, $newSlot->timezone ?? 'America/Sao_Paulo');
            
            $interview->update([
                'interview_slot_id' => $newSlot->id,
                'healthcare_professional_id' => $newSlot->healthcare_professional_id,
                'scheduled_at' => $newScheduledAt,
                'status' => 'rescheduled',
                'reschedule_reason' => $validated['reason'],
                'reschedule_count' => $interview->reschedule_count + 1,
                'rescheduled_at' => now(),
                'rescheduled_by' => $user->id,
                'meeting_link' => $newSlot->meeting_link,
                'meeting_type' => $newSlot->meeting_type,
                'timezone' => $newSlot->timezone ?? 'America/Sao_Paulo',
                'professional_timezone' => $newSlot->timezone ?? 'America/Sao_Paulo',
                'duration_minutes' => $newSlot->duration_minutes
            ]);

            // Update old slot
            $oldSlot->decrement('current_bookings');
            if ($oldSlot->current_bookings < $oldSlot->max_bookings) {
                $oldSlot->update(['is_available' => true]);
            }

            // Update new slot
            $newSlot->increment('current_bookings');
            if ($newSlot->current_bookings >= $newSlot->max_bookings) {
                $newSlot->update(['is_available' => false]);
            }

            // Log reschedule history
            $interview->rescheduleHistory()->create([
                'old_slot_id' => $oldSlot->id,
                'new_slot_id' => $newSlot->id,
                'old_scheduled_at' => $oldScheduledAt,
                'new_scheduled_at' => $interview->scheduled_at,
                'reason' => $validated['reason'],
                'rescheduled_by' => $user->id
            ]);

            // Send notifications
            $this->notificationService->sendInterviewRescheduledNotification($interview, $oldScheduledAt);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Interview rescheduled successfully.',
                'data' => $interview->fresh([
                    'slot:id,date,start_time,end_time,interview_type,meeting_type,location',
                    'healthcareProfessional:id,name,email,specialization'
                ])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to reschedule interview.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel interview
     */
    public function cancel(Request $request, Interview $interview): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:500'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        // Check permissions
        if ($beneficiary && $interview->beneficiary_id !== $beneficiary->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to cancel this interview.'
            ], 403);
        }

        if (!in_array($interview->status, ['scheduled', 'confirmed', 'rescheduled'])) {
            return response()->json([
                'success' => false,
                'message' => 'This interview cannot be cancelled.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            // Update interview
            $interview->update([
                'status' => 'cancelled',
                'cancellation_reason' => $validated['reason'],
                'cancelled_at' => now(),
                'cancelled_by' => $user->id
            ]);

            // Update slot availability
            $slot = $interview->slot;
            $slot->decrement('current_bookings');
            if ($slot->current_bookings < $slot->max_bookings) {
                $slot->update(['is_available' => true]);
            }

            // Send notifications
            $this->notificationService->sendInterviewCancelledNotification($interview);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Interview cancelled successfully.',
                'data' => $interview->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel interview.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Start interview (healthcare professionals only)
     */
    public function start(Interview $interview): JsonResponse
    {
        $user = auth()->user();

        if (!$user->hasRole('healthcare_professional') || $interview->healthcare_professional_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to start this interview.'
            ], 403);
        }

        if ($interview->status !== 'confirmed') {
            return response()->json([
                'success' => false,
                'message' => 'Only confirmed interviews can be started.'
            ], 400);
        }

        $interview->update([
            'status' => 'in_progress',
            'started_at' => now()
        ]);

        // Send notification
        $this->notificationService->sendInterviewStartedNotification($interview);

        return response()->json([
            'success' => true,
            'message' => 'Interview started successfully.',
            'data' => $interview->fresh()
        ]);
    }

    /**
     * Complete interview (healthcare professionals only)
     */
    public function complete(Request $request, Interview $interview): JsonResponse
    {
        $validated = $request->validate([
            'session_notes' => 'required|string|max:2000',
            'duration_minutes' => 'required|integer|min:1|max:480',
            'follow_up_required' => 'boolean',
            'follow_up_notes' => 'nullable|string|max:1000'
        ]);

        $user = $request->user();

        if (!$user->hasRole('healthcare_professional') || $interview->healthcare_professional_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to complete this interview.'
            ], 403);
        }

        if ($interview->status !== 'in_progress') {
            return response()->json([
                'success' => false,
                'message' => 'Only in-progress interviews can be completed.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            $interview->update([
                'status' => 'completed',
                'ended_at' => now(),
                'session_notes' => $validated['session_notes'],
                'actual_duration_minutes' => $validated['duration_minutes'],
                'follow_up_required' => $validated['follow_up_required'] ?? false,
                'follow_up_notes' => $validated['follow_up_notes']
            ]);

            // Award gamification points to beneficiary
            $this->gamificationService->awardPoints(
                $interview->beneficiary_id,
                'interview_completed',
                200,
                ['interview_id' => $interview->id]
            );

            // Check for punctuality bonus
            if ($interview->started_at <= $interview->scheduled_at->addMinutes(5)) {
                $this->gamificationService->awardPoints(
                    $interview->beneficiary_id,
                    'punctuality_bonus',
                    25,
                    ['interview_id' => $interview->id]
                );
            }

            // Send completion notification
            $this->notificationService->sendInterviewCompletedNotification($interview);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Interview completed successfully.',
                'data' => $interview->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete interview.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available interview slots with timezone support
     */
    public function getAvailableSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_date' => 'required|date|after_or_equal:today',
            'end_date' => 'required|date|after:start_date',
            'interview_type' => 'nullable|string|in:initial,follow_up,medical,psychological,nutritional',
            'meeting_type' => 'nullable|string|in:in_person,video,phone',
            'timezone' => 'nullable|timezone',
            'professional_id' => 'nullable|exists:users,id',
            'include_recommendations' => 'nullable|boolean'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Only beneficiaries can view available slots.'
            ], 403);
        }

        // Get user timezone
        $userTimezone = $validated['timezone'] ?? $beneficiary->timezone ?? 'America/Sao_Paulo';

        // Get preferences for recommendations
        $preferences = [];
        if ($validated['include_recommendations'] ?? false) {
            $preferences = $this->getUserPreferences($beneficiary);
        }

        // Get available slots with advanced features
        $slots = $this->calendarService->getAvailableSlots(
            Carbon::parse($validated['start_date']),
            Carbon::parse($validated['end_date']),
            $preferences
        );

        // Filter by criteria
        if (isset($validated['interview_type'])) {
            $slots = $slots->where('interview_type', $validated['interview_type']);
        }

        if (isset($validated['meeting_type'])) {
            $slots = $slots->where('meeting_type', $validated['meeting_type']);
        }

        if (isset($validated['professional_id'])) {
            $slots = $slots->where('healthcare_professional_id', $validated['professional_id']);
        }

        // Convert times to user timezone
        $slotsWithTimezone = $slots->map(function ($slot) use ($userTimezone) {
            $slotData = $slot->toArray();
            
            // Convert start and end times to user timezone
            $startDateTime = Carbon::parse($slot->date . ' ' . $slot->start_time, $slot->timezone ?? 'America/Sao_Paulo');
            $endDateTime = Carbon::parse($slot->date . ' ' . $slot->end_time, $slot->timezone ?? 'America/Sao_Paulo');
            
            $slotData['start_datetime_utc'] = $startDateTime->toIso8601String();
            $slotData['end_datetime_utc'] = $endDateTime->toIso8601String();
            
            $slotData['start_datetime_local'] = $startDateTime->setTimezone($userTimezone)->toIso8601String();
            $slotData['end_datetime_local'] = $endDateTime->setTimezone($userTimezone)->toIso8601String();
            
            $slotData['display_time'] = $startDateTime->setTimezone($userTimezone)->format('H:i') . ' - ' . 
                                       $endDateTime->setTimezone($userTimezone)->format('H:i');
            
            // Include professional info
            if ($slot->healthcareProfessional) {
                $slotData['professional'] = [
                    'id' => $slot->healthcareProfessional->id,
                    'name' => $slot->healthcareProfessional->name,
                    'specialization' => $slot->healthcareProfessional->specialization ?? null,
                    'rating' => $slot->healthcareProfessional->professional_rating ?? null
                ];
            }

            // Include recommendation score if enabled
            if (isset($slotData['recommendation_score'])) {
                $slotData['recommendation_reason'] = $this->getRecommendationReason($slot, $preferences);
            }
            
            return $slotData;
        });

        // Sort by recommendation score if enabled
        if ($validated['include_recommendations'] ?? false) {
            $slotsWithTimezone = $slotsWithTimezone->sortByDesc('recommendation_score')->values();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'slots' => $slotsWithTimezone,
                'timezone' => $userTimezone,
                'total_count' => $slotsWithTimezone->count(),
                'filters_applied' => array_filter($validated, fn($v) => !is_null($v))
            ]
        ]);
    }

    /**
     * Get recommended interview slots based on user preferences
     */
    public function getRecommendedSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days_ahead' => 'nullable|integer|min:1|max:30',
            'limit' => 'nullable|integer|min:1|max:20'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Only beneficiaries can view recommended slots.'
            ], 403);
        }

        $daysAhead = $validated['days_ahead'] ?? 7;
        $limit = $validated['limit'] ?? 5;

        // Get user preferences from history and profile
        $preferences = $this->getUserPreferences($beneficiary);

        // Get recommended slots
        $recommendedSlots = $this->calendarService->getAvailableSlots(
            now(),
            now()->addDays($daysAhead),
            $preferences
        );

        // Sort by recommendation score and limit
        $topSlots = $recommendedSlots
            ->sortByDesc('recommendation_score')
            ->take($limit)
            ->values();

        // Enhance with timezone and reasons
        $enhancedSlots = $topSlots->map(function ($slot) use ($beneficiary, $preferences) {
            $slotData = $slot->toArray();
            
            // Convert to user timezone
            $userTimezone = $beneficiary->timezone ?? 'America/Sao_Paulo';
            $startDateTime = Carbon::parse($slot->date . ' ' . $slot->start_time, $slot->timezone ?? 'America/Sao_Paulo');
            
            $slotData['datetime_local'] = $startDateTime->setTimezone($userTimezone)->toIso8601String();
            $slotData['display_datetime'] = $startDateTime->setTimezone($userTimezone)->format('d/m/Y H:i');
            
            // Add recommendation reason
            $slotData['recommendation_reasons'] = $this->getDetailedRecommendationReasons($slot, $preferences);
            
            // Add professional info
            if ($slot->healthcareProfessional) {
                $slotData['professional'] = [
                    'id' => $slot->healthcareProfessional->id,
                    'name' => $slot->healthcareProfessional->name,
                    'specialization' => $slot->healthcareProfessional->specialization,
                    'languages' => $slot->languages_available ?? ['pt']
                ];
            }
            
            return $slotData;
        });

        return response()->json([
            'success' => true,
            'data' => [
                'recommended_slots' => $enhancedSlots,
                'user_preferences' => $preferences,
                'search_period' => [
                    'start' => now()->toDateString(),
                    'end' => now()->addDays($daysAhead)->toDateString()
                ]
            ]
        ]);
    }

    /**
     * Check slot availability with conflict detection
     */
    public function checkSlotAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'interview_slot_id' => 'required|exists:interview_slots,id',
            'check_conflicts' => 'nullable|boolean'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Only beneficiaries can check slot availability.'
            ], 403);
        }

        $slot = InterviewSlot::with('healthcareProfessional')->findOrFail($validated['interview_slot_id']);

        // Basic availability check
        $isAvailable = $slot->hasCapacity() && $slot->canBeBooked();

        $response = [
            'available' => $isAvailable,
            'slot' => [
                'id' => $slot->id,
                'date' => $slot->date->toDateString(),
                'time' => $slot->time_range,
                'remaining_capacity' => $slot->remaining_capacity,
                'booking_deadline' => $slot->getDateTimeInTimezone($beneficiary->timezone ?? 'America/Sao_Paulo')
                    ->subHours($slot->cancellation_deadline_hours)
                    ->toIso8601String()
            ]
        ];

        // Check for conflicts if requested
        if (($validated['check_conflicts'] ?? true) && $isAvailable) {
            $conflicts = $this->calendarService->detectConflicts($beneficiary->id, $slot);
            
            if ($conflicts->isNotEmpty()) {
                $response['available'] = false;
                $response['conflicts'] = $conflicts->map(function ($conflict) {
                    return [
                        'interview_id' => $conflict->id,
                        'scheduled_at' => $conflict->scheduled_at->toIso8601String(),
                        'type' => $conflict->interview_type,
                        'conflict_reason' => 'Time conflict with existing appointment'
                    ];
                });
            }
        }

        // Add warnings if any
        $warnings = [];
        
        // Check if slot is soon (within 48 hours)
        if ($slot->getDateTimeInTimezone()->diffInHours(now()) < 48) {
            $warnings[] = 'This appointment is scheduled within the next 48 hours';
        }

        // Check if it's the last available slot
        if ($slot->remaining_capacity === 1) {
            $warnings[] = 'This is the last available spot for this time slot';
        }

        if (!empty($warnings)) {
            $response['warnings'] = $warnings;
        }

        return response()->json([
            'success' => true,
            'data' => $response
        ]);
    }

    /**
     * Update notification preferences
     */
    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email_notifications' => 'nullable|boolean',
            'sms_notifications' => 'nullable|boolean',
            'whatsapp_notifications' => 'nullable|boolean',
            'notification_timezone' => 'nullable|timezone',
            'reminder_hours_before' => 'nullable|integer|min:1|max:72'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Only beneficiaries can update notification preferences.'
            ], 403);
        }

        // Update preferences (you might want to add these fields to the beneficiary model)
        $preferences = [
            'email_enabled' => $validated['email_notifications'] ?? true,
            'sms_enabled' => $validated['sms_notifications'] ?? false,
            'whatsapp_enabled' => $validated['whatsapp_notifications'] ?? false,
            'timezone' => $validated['notification_timezone'] ?? $beneficiary->timezone ?? 'America/Sao_Paulo',
            'reminder_hours' => $validated['reminder_hours_before'] ?? 24
        ];

        // Store in beneficiary metadata or preferences table
        $beneficiary->update([
            'notification_preferences' => $preferences
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notification preferences updated successfully.',
            'data' => $preferences
        ]);
    }

    /**
     * Get interview history with advanced filters
     */
    public function getHistory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'status' => 'nullable|array',
            'status.*' => 'string|in:scheduled,confirmed,in_progress,completed,cancelled,no_show,rescheduled',
            'professional_id' => 'nullable|exists:users,id',
            'interview_type' => 'nullable|string',
            'include_feedback' => 'nullable|boolean',
            'sort_by' => 'nullable|string|in:date,status,professional,type',
            'sort_order' => 'nullable|string|in:asc,desc'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary && !$user->hasRole(['admin', 'healthcare_professional'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view interview history.'
            ], 403);
        }

        $query = Interview::with([
            'slot',
            'healthcareProfessional',
            'rescheduleHistory'
        ]);

        // Apply role-based filtering
        if ($beneficiary) {
            $query->where('beneficiary_id', $beneficiary->id);
        } elseif ($user->hasRole('healthcare_professional')) {
            $query->where('healthcare_professional_id', $user->id);
        }

        // Apply filters
        if ($validated['date_from'] ?? null) {
            $query->where('scheduled_at', '>=', $validated['date_from']);
        }

        if ($validated['date_to'] ?? null) {
            $query->where('scheduled_at', '<=', $validated['date_to']);
        }

        if ($validated['status'] ?? null) {
            $query->whereIn('status', $validated['status']);
        }

        if ($validated['professional_id'] ?? null) {
            $query->where('healthcare_professional_id', $validated['professional_id']);
        }

        if ($validated['interview_type'] ?? null) {
            $query->where('interview_type', $validated['interview_type']);
        }

        // Apply sorting
        $sortBy = $validated['sort_by'] ?? 'date';
        $sortOrder = $validated['sort_order'] ?? 'desc';

        switch ($sortBy) {
            case 'date':
                $query->orderBy('scheduled_at', $sortOrder);
                break;
            case 'status':
                $query->orderBy('status', $sortOrder);
                break;
            case 'professional':
                $query->join('users', 'interviews.healthcare_professional_id', '=', 'users.id')
                      ->orderBy('users.name', $sortOrder)
                      ->select('interviews.*');
                break;
            case 'type':
                $query->orderBy('interview_type', $sortOrder);
                break;
        }

        $interviews = $query->paginate(20);

        // Include statistics
        $stats = [
            'total_interviews' => $interviews->total(),
            'completed' => Interview::where('beneficiary_id', $beneficiary?->id)->where('status', 'completed')->count(),
            'cancelled' => Interview::where('beneficiary_id', $beneficiary?->id)->where('status', 'cancelled')->count(),
            'no_shows' => Interview::where('beneficiary_id', $beneficiary?->id)->where('status', 'no_show')->count(),
            'average_rating' => Interview::where('beneficiary_id', $beneficiary?->id)->whereNotNull('beneficiary_rating')->avg('beneficiary_rating')
        ];

        return response()->json([
            'success' => true,
            'data' => $interviews,
            'statistics' => $stats
        ]);
    }

    /**
     * Rate completed interview
     */
    public function rateInterview(Request $request, Interview $interview): JsonResponse
    {
        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'feedback' => 'nullable|string|max:1000',
            'would_recommend' => 'nullable|boolean'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        // Check permissions
        if (!$beneficiary || $interview->beneficiary_id !== $beneficiary->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to rate this interview.'
            ], 403);
        }

        // Check if interview is completed
        if ($interview->status !== 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Only completed interviews can be rated.'
            ], 400);
        }

        // Check if already rated
        if ($interview->beneficiary_rating) {
            return response()->json([
                'success' => false,
                'message' => 'This interview has already been rated.'
            ], 400);
        }

        // Update interview with rating
        $interview->update([
            'beneficiary_rating' => $validated['rating'],
            'beneficiary_feedback' => $validated['feedback'],
            'would_recommend' => $validated['would_recommend'] ?? null
        ]);

        // Award gamification points for feedback
        $this->gamificationService->awardPoints(
            $beneficiary->id,
            'interview_feedback',
            50,
            ['interview_id' => $interview->id]
        );

        return response()->json([
            'success' => true,
            'message' => 'Thank you for your feedback!',
            'data' => [
                'rating' => $interview->beneficiary_rating,
                'points_earned' => 50
            ]
        ]);
    }

    /**
     * Check if beneficiary meets booking requirements
     */
    private function checkBookingRequirements(Beneficiary $beneficiary): bool
    {
        // Check registration completion
        if (!$beneficiary->registration_completed) {
            return false;
        }

        // Check required documents
        $requiredDocs = $beneficiary->documents()
            ->whereIn('document_type', ['cpf', 'rg', 'address_proof'])
            ->where('status', 'approved')
            ->count();

        if ($requiredDocs < 3) {
            return false;
        }

        // Check health questionnaire
        $healthQuestionnaire = $beneficiary->healthQuestionnaires()
            ->where('status', 'completed')
            ->latest()
            ->first();

        return $healthQuestionnaire !== null;
    }

    /**
     * Get booking requirements status
     */
    private function getBookingRequirements(Beneficiary $beneficiary): array
    {
        return [
            'registration_completed' => $beneficiary->registration_completed,
            'required_documents' => $beneficiary->documents()
                ->whereIn('document_type', ['cpf', 'rg', 'address_proof'])
                ->where('status', 'approved')
                ->count() >= 3,
            'health_questionnaire' => $beneficiary->healthQuestionnaires()
                ->where('status', 'completed')
                ->exists()
        ];
    }

    /**
     * Check for interview conflicts
     */
    private function hasInterviewConflict(Beneficiary $beneficiary, InterviewSlot $slot): bool
    {
        $slotStart = Carbon::parse($slot->date . ' ' . $slot->start_time);
        $slotEnd = Carbon::parse($slot->date . ' ' . $slot->end_time);

        return Interview::where('beneficiary_id', $beneficiary->id)
            ->whereNotIn('status', ['cancelled'])
            ->whereHas('slot', function ($query) use ($slotStart, $slotEnd) {
                $query->where(function ($q) use ($slotStart, $slotEnd) {
                    // Check for overlapping appointments with 2-hour buffer
                    $q->whereBetween(DB::raw("DATETIME(date, start_time)"), [
                        $slotStart->subHours(2)->toDateTimeString(),
                        $slotEnd->addHours(2)->toDateTimeString()
                    ]);
                });
            })
            ->exists();
    }

    /**
     * Generate unique booking reference
     */
    private function generateBookingReference(): string
    {
        do {
            $reference = 'INT-' . now()->format('Y') . '-' . str_pad(mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
        } while (Interview::where('booking_reference', $reference)->exists());

        return $reference;
    }

    /**
     * Get upcoming interviews count
     */
    private function getUpcomingCount($user, $beneficiary): int
    {
        $query = Interview::whereIn('status', ['scheduled', 'confirmed'])
            ->whereHas('slot', function ($q) {
                $q->where('date', '>=', now()->toDateString());
            });

        if ($beneficiary) {
            $query->where('beneficiary_id', $beneficiary->id);
        } elseif ($user->hasRole('healthcare_professional')) {
            $query->where('healthcare_professional_id', $user->id);
        }

        return $query->count();
    }

    /**
     * Get completed interviews count
     */
    private function getCompletedCount($user, $beneficiary): int
    {
        $query = Interview::where('status', 'completed');

        if ($beneficiary) {
            $query->where('beneficiary_id', $beneficiary->id);
        } elseif ($user->hasRole('healthcare_professional')) {
            $query->where('healthcare_professional_id', $user->id);
        }

        return $query->count();
    }

    /**
     * Get user preferences for slot recommendations
     */
    private function getUserPreferences(Beneficiary $beneficiary): array
    {
        // Get preferences from past interviews
        $pastInterviews = Interview::where('beneficiary_id', $beneficiary->id)
            ->where('status', 'completed')
            ->with('slot')
            ->limit(10)
            ->get();

        $preferences = [
            'preferred_times' => [],
            'preferred_days' => [],
            'preferred_professionals' => [],
            'preferred_meeting_type' => 'video',
            'language' => $beneficiary->preferred_language ?? 'pt',
            'timezone' => $beneficiary->timezone ?? 'America/Sao_Paulo'
        ];

        // Analyze past booking patterns
        foreach ($pastInterviews as $interview) {
            $slot = $interview->slot;
            if ($slot) {
                // Track preferred times
                $hour = Carbon::parse($slot->start_time)->hour;
                $preferences['preferred_times'][] = $hour;
                
                // Track preferred days
                $dayOfWeek = $slot->date->dayOfWeek;
                $preferences['preferred_days'][] = $dayOfWeek;
                
                // Track preferred professionals
                if ($interview->beneficiary_rating >= 4) {
                    $preferences['preferred_professionals'][] = $interview->healthcare_professional_id;
                }
                
                // Track meeting type preference
                $preferences['preferred_meeting_type'] = $interview->meeting_type;
            }
        }

        // Calculate most common preferences
        if (!empty($preferences['preferred_times'])) {
            $timeCounts = array_count_values($preferences['preferred_times']);
            arsort($timeCounts);
            $preferences['preferred_times'] = array_keys(array_slice($timeCounts, 0, 3, true));
        }

        if (!empty($preferences['preferred_days'])) {
            $dayCounts = array_count_values($preferences['preferred_days']);
            arsort($dayCounts);
            $preferences['preferred_days'] = array_keys(array_slice($dayCounts, 0, 3, true));
        }

        if (!empty($preferences['preferred_professionals'])) {
            $preferences['preferred_professionals'] = array_unique($preferences['preferred_professionals']);
        }

        // Add health conditions if relevant
        $healthQuestionnaire = $beneficiary->healthQuestionnaires()
            ->where('status', 'completed')
            ->latest()
            ->first();

        if ($healthQuestionnaire && isset($healthQuestionnaire->responses['conditions'])) {
            $preferences['health_conditions'] = $healthQuestionnaire->responses['conditions'];
        }

        return $preferences;
    }

    /**
     * Get recommendation reason for a slot
     */
    private function getRecommendationReason(InterviewSlot $slot, array $preferences): string
    {
        $reasons = [];

        // Check time preference
        $slotHour = Carbon::parse($slot->start_time)->hour;
        if (in_array($slotHour, $preferences['preferred_times'] ?? [])) {
            $reasons[] = 'Matches your preferred time';
        }

        // Check day preference
        if (in_array($slot->date->dayOfWeek, $preferences['preferred_days'] ?? [])) {
            $reasons[] = 'On your preferred day';
        }

        // Check professional preference
        if (in_array($slot->healthcare_professional_id, $preferences['preferred_professionals'] ?? [])) {
            $reasons[] = 'With a professional you rated highly';
        }

        // Check language match
        if (in_array($preferences['language'] ?? 'pt', $slot->languages_available ?? [])) {
            $reasons[] = 'Available in your preferred language';
        }

        // Check meeting type
        if ($slot->meeting_type === ($preferences['preferred_meeting_type'] ?? 'video')) {
            $reasons[] = 'Your preferred meeting type';
        }

        return implode(', ', $reasons) ?: 'Good availability';
    }

    /**
     * Get detailed recommendation reasons
     */
    private function getDetailedRecommendationReasons(InterviewSlot $slot, array $preferences): array
    {
        $reasons = [];

        // Time preference
        $slotHour = Carbon::parse($slot->start_time)->hour;
        if (in_array($slotHour, $preferences['preferred_times'] ?? [])) {
            $reasons[] = [
                'type' => 'time_preference',
                'description' => 'This time slot matches your usual booking pattern',
                'weight' => 'high'
            ];
        }

        // Day preference
        if (in_array($slot->date->dayOfWeek, $preferences['preferred_days'] ?? [])) {
            $reasons[] = [
                'type' => 'day_preference',
                'description' => 'This day of the week works well with your schedule',
                'weight' => 'medium'
            ];
        }

        // Professional preference
        if (in_array($slot->healthcare_professional_id, $preferences['preferred_professionals'] ?? [])) {
            $reasons[] = [
                'type' => 'professional_preference',
                'description' => 'You had a great experience with this professional before',
                'weight' => 'high'
            ];
        }

        // Language match
        if (in_array($preferences['language'] ?? 'pt', $slot->languages_available ?? [])) {
            $reasons[] = [
                'type' => 'language_match',
                'description' => 'Consultation available in your preferred language',
                'weight' => 'high'
            ];
        }

        // Specialization match
        if (isset($preferences['health_conditions']) && $slot->specialization_required) {
            foreach ($preferences['health_conditions'] as $condition) {
                if (stripos($slot->specialization_required, $condition) !== false) {
                    $reasons[] = [
                        'type' => 'specialization_match',
                        'description' => 'Professional specializes in your health needs',
                        'weight' => 'high'
                    ];
                    break;
                }
            }
        }

        // Soon availability
        if ($slot->date->diffInDays(now()) <= 3) {
            $reasons[] = [
                'type' => 'soon_available',
                'description' => 'Available within the next 3 days',
                'weight' => 'low'
            ];
        }

        return $reasons;
    }
}