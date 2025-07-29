<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewSlot;
use App\Services\CalendarService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class InterviewSlotController extends Controller
{
    protected CalendarService $calendarService;

    public function __construct(CalendarService $calendarService)
    {
        $this->calendarService = $calendarService;
    }

    /**
     * List available interview slots with filtering
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'nullable|date|after_or_equal:today',
            'date_to' => 'nullable|date|after:date_from',
            'interviewer_id' => 'nullable|exists:users,id',
            'type' => 'nullable|string|in:initial,follow_up,medical,psychological,nutritional',
            'meeting_type' => 'nullable|string|in:in_person,video,phone',
            'per_page' => 'nullable|integer|min:1|max:100'
        ]);

        $query = InterviewSlot::with(['healthcareProfessional:id,name,email'])
            ->where('is_available', true)
            ->where('date', '>=', now()->toDateString());

        if ($request->date_from) {
            $query->where('date', '>=', $request->date_from);
        }

        if ($request->date_to) {
            $query->where('date', '<=', $request->date_to);
        }

        if ($request->interviewer_id) {
            $query->where('healthcare_professional_id', $request->interviewer_id);
        }

        if ($request->type) {
            $query->where('interview_type', $request->type);
        }

        if ($request->meeting_type) {
            $query->where('meeting_type', $request->meeting_type);
        }

        $slots = $query->orderBy('date')
            ->orderBy('start_time')
            ->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data' => $slots,
            'meta' => [
                'total_available' => $slots->total(),
                'upcoming_this_week' => $this->getUpcomingThisWeek(),
                'popular_times' => $this->getPopularTimes()
            ]
        ]);
    }

    /**
     * Create new interview slot
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date|after_or_equal:today|before:' . now()->addMonths(3)->toDateString(),
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'interview_type' => 'required|string|in:initial,follow_up,medical,psychological,nutritional',
            'meeting_type' => 'required|string|in:in_person,video,phone',
            'max_bookings' => 'nullable|integer|min:1|max:10',
            'location' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'recurring' => 'nullable|string|in:none,daily,weekly,biweekly,monthly',
            'recurring_until' => 'nullable|date|after:date|required_if:recurring,daily,weekly,biweekly,monthly',
            'price' => 'nullable|numeric|min:0|max:9999.99'
        ]);

        // Validate business hours (8:00 - 18:00)
        $startTime = Carbon::createFromFormat('H:i', $validated['start_time']);
        $endTime = Carbon::createFromFormat('H:i', $validated['end_time']);
        
        if ($startTime->hour < 8 || $endTime->hour > 18) {
            throw ValidationException::withMessages([
                'time' => 'Interview slots must be within business hours (08:00 - 18:00).'
            ]);
        }

        // Validate duration (30 min - 4 hours)
        $duration = $endTime->diffInMinutes($startTime);
        if ($duration < 30 || $duration > 240) {
            throw ValidationException::withMessages([
                'duration' => 'Interview duration must be between 30 minutes and 4 hours.'
            ]);
        }

        // Check for conflicts
        if ($this->calendarService->hasConflict(
            $request->user()->id,
            $validated['date'],
            $validated['start_time'],
            $validated['end_time']
        )) {
            throw ValidationException::withMessages([
                'conflict' => 'This time slot conflicts with an existing appointment.'
            ]);
        }

        DB::beginTransaction();

        try {
            $slotsCreated = [];
            $dates = $this->generateRecurringDates($validated);

            foreach ($dates as $date) {
                $slot = InterviewSlot::create([
                    'healthcare_professional_id' => $request->user()->id,
                    'date' => $date,
                    'start_time' => $validated['start_time'],
                    'end_time' => $validated['end_time'],
                    'duration_minutes' => $duration,
                    'interview_type' => $validated['interview_type'],
                    'meeting_type' => $validated['meeting_type'],
                    'max_bookings' => $validated['max_bookings'] ?? 1,
                    'current_bookings' => 0,
                    'location' => $validated['location'],
                    'notes' => $validated['notes'],
                    'price' => $validated['price'] ?? 0,
                    'status' => 'available',
                    'is_available' => true
                ]);

                $slotsCreated[] = $slot;
            }

            DB::commit();

            // Clear cache
            Cache::forget("calendar_availability_{$request->user()->id}");

            return response()->json([
                'success' => true,
                'message' => count($slotsCreated) === 1 
                    ? 'Interview slot created successfully.' 
                    : count($slotsCreated) . ' interview slots created successfully.',
                'data' => $slotsCreated,
                'meta' => [
                    'slots_created' => count($slotsCreated),
                    'recurring_type' => $validated['recurring'] ?? 'none'
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create interview slot.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk create interview slots
     */
    public function bulkCreate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slots' => 'required|array|max:50',
            'slots.*.date' => 'required|date|after_or_equal:today|before:' . now()->addMonths(3)->toDateString(),
            'slots.*.start_time' => 'required|date_format:H:i',
            'slots.*.end_time' => 'required|date_format:H:i|after:slots.*.start_time',
            'slots.*.interview_type' => 'required|string|in:initial,follow_up,medical,psychological,nutritional',
            'slots.*.meeting_type' => 'required|string|in:in_person,video,phone'
        ]);

        $userId = $request->user()->id;
        $slotsCreated = [];
        $conflicts = [];

        DB::beginTransaction();

        try {
            foreach ($validated['slots'] as $index => $slotData) {
                // Check for conflicts
                if ($this->calendarService->hasConflict(
                    $userId,
                    $slotData['date'],
                    $slotData['start_time'],
                    $slotData['end_time']
                )) {
                    $conflicts[] = [
                        'index' => $index,
                        'date' => $slotData['date'],
                        'time' => $slotData['start_time'] . ' - ' . $slotData['end_time']
                    ];
                    continue;
                }

                $duration = Carbon::createFromFormat('H:i', $slotData['end_time'])
                    ->diffInMinutes(Carbon::createFromFormat('H:i', $slotData['start_time']));

                $slot = InterviewSlot::create([
                    'healthcare_professional_id' => $userId,
                    'date' => $slotData['date'],
                    'start_time' => $slotData['start_time'],
                    'end_time' => $slotData['end_time'],
                    'duration_minutes' => $duration,
                    'interview_type' => $slotData['interview_type'],
                    'meeting_type' => $slotData['meeting_type'],
                    'max_bookings' => 1,
                    'current_bookings' => 0,
                    'status' => 'available',
                    'is_available' => true
                ]);

                $slotsCreated[] = $slot;
            }

            DB::commit();

            // Clear cache
            Cache::forget("calendar_availability_{$userId}");

            return response()->json([
                'success' => true,
                'message' => count($slotsCreated) . ' slots created successfully.',
                'data' => [
                    'slots_created' => $slotsCreated,
                    'conflicts' => $conflicts
                ],
                'meta' => [
                    'total_requested' => count($validated['slots']),
                    'successfully_created' => count($slotsCreated),
                    'conflicts_found' => count($conflicts)
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create interview slots.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get calendar view for a healthcare professional
     */
    public function calendar(Request $request): JsonResponse
    {
        $request->validate([
            'month' => 'nullable|integer|min:1|max:12',
            'year' => 'nullable|integer|min:' . now()->year . '|max:' . (now()->year + 2),
            'view' => 'nullable|string|in:month,week,day'
        ]);

        $month = $request->month ?? now()->month;
        $year = $request->year ?? now()->year;
        $view = $request->view ?? 'month';

        $calendar = $this->calendarService->getCalendarView(
            $request->user()->id,
            $month,
            $year,
            $view
        );

        return response()->json([
            'success' => true,
            'data' => $calendar,
            'meta' => [
                'month' => $month,
                'year' => $year,
                'view' => $view,
                'total_slots' => $calendar['statistics']['total_slots'] ?? 0,
                'booked_slots' => $calendar['statistics']['booked_slots'] ?? 0
            ]
        ]);
    }

    /**
     * Check availability for specific time slot
     */
    public function checkAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'healthcare_professional_id' => 'required|exists:users,id',
            'date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time'
        ]);

        $isAvailable = !$this->calendarService->hasConflict(
            $validated['healthcare_professional_id'],
            $validated['date'],
            $validated['start_time'],
            $validated['end_time']
        );

        $alternatives = [];
        if (!$isAvailable) {
            $alternatives = $this->calendarService->suggestAlternativeSlots(
                $validated['healthcare_professional_id'],
                $validated['date'],
                $validated['start_time'],
                $validated['end_time']
            );
        }

        return response()->json([
            'success' => true,
            'data' => [
                'is_available' => $isAvailable,
                'alternatives' => $alternatives,
                'message' => $isAvailable 
                    ? 'Time slot is available.' 
                    : 'Time slot is not available. Check alternatives.'
            ]
        ]);
    }

    /**
     * Show specific interview slot
     */
    public function show(InterviewSlot $interviewSlot): JsonResponse
    {
        $interviewSlot->load(['healthcareProfessional:id,name,email', 'interviews']);

        return response()->json([
            'success' => true,
            'data' => $interviewSlot
        ]);
    }

    /**
     * Update interview slot
     */
    public function update(Request $request, InterviewSlot $interviewSlot): JsonResponse
    {
        // Check permissions
        if ($interviewSlot->healthcare_professional_id !== $request->user()->id && !$request->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to modify this slot.'
            ], 403);
        }

        $validated = $request->validate([
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'location' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'is_available' => 'sometimes|boolean',
            'max_bookings' => 'sometimes|integer|min:1|max:10'
        ]);

        // Check if slot has bookings before major changes
        if ($interviewSlot->current_bookings > 0 && (
            isset($validated['start_time']) || isset($validated['end_time'])
        )) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot modify time for slots with existing bookings.'
            ], 400);
        }

        $interviewSlot->update($validated);

        // Clear cache
        Cache::forget("calendar_availability_{$interviewSlot->healthcare_professional_id}");

        return response()->json([
            'success' => true,
            'message' => 'Interview slot updated successfully.',
            'data' => $interviewSlot->fresh(['healthcareProfessional:id,name,email'])
        ]);
    }

    /**
     * Delete interview slot
     */
    public function destroy(InterviewSlot $interviewSlot): JsonResponse
    {
        // Check permissions
        if ($interviewSlot->healthcare_professional_id !== auth()->id() && !auth()->user()->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this slot.'
            ], 403);
        }

        // Check if slot has bookings
        if ($interviewSlot->current_bookings > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete slot with existing bookings. Cancel bookings first.'
            ], 400);
        }

        $interviewSlot->delete();

        // Clear cache
        Cache::forget("calendar_availability_{$interviewSlot->healthcare_professional_id}");

        return response()->json([
            'success' => true,
            'message' => 'Interview slot deleted successfully.'
        ]);
    }

    /**
     * Generate recurring dates based on pattern
     */
    private function generateRecurringDates(array $data): array
    {
        $dates = [$data['date']];

        if (!isset($data['recurring']) || $data['recurring'] === 'none') {
            return $dates;
        }

        $startDate = Carbon::parse($data['date']);
        $endDate = Carbon::parse($data['recurring_until']);
        $currentDate = $startDate->copy();

        while ($currentDate->lt($endDate)) {
            switch ($data['recurring']) {
                case 'daily':
                    $currentDate->addDay();
                    break;
                case 'weekly':
                    $currentDate->addWeek();
                    break;
                case 'biweekly':
                    $currentDate->addWeeks(2);
                    break;
                case 'monthly':
                    $currentDate->addMonth();
                    break;
            }

            if ($currentDate->lte($endDate)) {
                $dates[] = $currentDate->toDateString();
            }
        }

        return $dates;
    }

    /**
     * Get upcoming slots this week
     */
    private function getUpcomingThisWeek(): int
    {
        return InterviewSlot::where('is_available', true)
            ->whereBetween('date', [
                now()->startOfWeek()->toDateString(),
                now()->endOfWeek()->toDateString()
            ])
            ->count();
    }

    /**
     * Get popular time slots
     */
    private function getPopularTimes(): array
    {
        return Cache::remember('popular_interview_times', 3600, function () {
            return InterviewSlot::select('start_time')
                ->selectRaw('COUNT(*) as count')
                ->where('current_bookings', '>', 0)
                ->groupBy('start_time')
                ->orderByDesc('count')
                ->limit(5)
                ->get()
                ->toArray();
        });
    }
}