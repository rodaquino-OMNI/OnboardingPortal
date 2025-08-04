<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TelemedicineAppointmentType;
use App\Models\Interview;
use App\Models\InterviewSlot;
use App\Models\Beneficiary;
use App\Models\VideoSession;
use App\Services\CalendarService;
use App\Services\InterviewNotificationService;
use App\Services\GamificationService;
use App\Services\TimezoneService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class TelemedicineSchedulingController extends Controller
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
     * Check if user is eligible for telemedicine scheduling (completion reward)
     */
    public function checkEligibility(Request $request): JsonResponse
    {
        $user = $request->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found.',
                'eligible' => false
            ], 403);
        }

        // Check onboarding completion requirements
        $requirements = $this->getCompletionRequirements($beneficiary);
        $allCompleted = collect($requirements)->every(fn($req) => $req['completed']);

        // Calculate total points for eligibility
        $progress = $beneficiary->getOrCreateGamificationProgress();
        $hasMinimumPoints = $progress->total_points >= 500; // Minimum points required

        $eligible = $allCompleted && $hasMinimumPoints;

        return response()->json([
            'success' => true,
            'eligible' => $eligible,
            'data' => [
                'requirements' => $requirements,
                'total_points' => $progress->total_points,
                'minimum_points_required' => 500,
                'points_sufficient' => $hasMinimumPoints,
                'completion_percentage' => $this->calculateCompletionPercentage($requirements),
                'reward_type' => 'telemedicine_consultation',
                'reward_description' => 'Your first appointment with health concierge',
                'next_steps' => $eligible ? 
                    ['You can now book your telemedicine consultation!'] :
                    $this->getNextSteps($requirements, $hasMinimumPoints)
            ]
        ]);
    }

    /**
     * Get available telemedicine appointment types
     */
    public function getAppointmentTypes(Request $request): JsonResponse
    {
        $user = $request->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found.'
            ], 403);
        }

        // Check eligibility first
        $eligibilityCheck = $this->checkEligibility($request);
        $eligibilityData = $eligibilityCheck->getData(true);
        
        if (!$eligibilityData['eligible']) {
            return response()->json([
                'success' => false,
                'message' => 'You must complete all onboarding steps to access telemedicine scheduling.',
                'eligibility' => $eligibilityData['data']
            ], 400);
        }

        $appointmentTypes = TelemedicineAppointmentType::active()
            ->where(function ($query) use ($beneficiary) {
                // Filter by beneficiary's document availability
                $query->where(function ($q) use ($beneficiary) {
                    $q->whereNull('required_documents')
                      ->orWhere('required_documents', '[]')
                      ->orWhereRaw('JSON_LENGTH(required_documents) = 0');
                })->orWhere(function ($q) use ($beneficiary) {
                    // Or check if beneficiary has required documents
                    $availableDocTypes = $beneficiary->documents()
                        ->where('status', 'approved')
                        ->pluck('document_type')
                        ->toArray();
                    
                    $q->whereRaw('JSON_CONTAINS(?, required_documents)', [json_encode($availableDocTypes)]);
                });
            })
            ->get()
            ->map(function ($type) use ($beneficiary) {
                return [
                    'id' => $type->id,
                    'name' => $type->name,
                    'slug' => $type->slug,
                    'description' => $type->description,
                    'duration_minutes' => $type->default_duration_minutes,
                    'preparation_time_minutes' => $type->getPreparationTimeMinutes(),
                    'total_duration_minutes' => $type->total_duration_minutes,
                    'base_price' => $type->base_price,
                    'formatted_price' => $type->formatted_price,
                    'preparation_checklist' => $type->preparation_checklist,
                    'required_documents' => $type->required_documents,
                    'allows_emergency_booking' => $type->allows_emergency_booking,
                    'advance_booking_days' => $type->advance_booking_days,
                    'minimum_notice_hours' => $type->minimum_notice_hours,
                    'has_required_documents' => $type->beneficiaryHasRequiredDocuments($beneficiary),
                    'next_available_slot' => $type->getNextAvailableSlot()?->date ?? null,
                    'specializations_required' => $type->specializations_required,
                    'gamification' => [
                        'points_for_booking' => 300, // Higher points for telemedicine as a reward
                        'points_for_completion' => 500,
                        'points_for_preparation' => 100,
                        'bonus_for_punctuality' => 50
                    ]
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'appointment_types' => $appointmentTypes,
                'total_available' => $appointmentTypes->count(),
                'recommended_type' => $this->getRecommendedAppointmentType($beneficiary, $appointmentTypes),
                'eligibility_status' => 'eligible',
                'reward_context' => [
                    'is_completion_reward' => true,
                    'reward_title' => 'Parabéns! Consulta de Telemedicina Desbloqueada',
                    'reward_description' => 'Como recompensa por completar todo o onboarding, você ganhou acesso à consulta com nosso concierge de saúde.',
                    'special_benefits' => [
                        'Consulta prioritária',
                        'Pontos extras de gamificação',
                        'Acesso a recursos exclusivos',
                        'Acompanhamento personalizado'
                    ]
                ]
            ]
        ]);
    }

    /**
     * Get available slots for telemedicine appointments
     */
    public function getAvailableSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'appointment_type_id' => 'required|exists:telemedicine_appointment_types,id',
            'start_date' => 'nullable|date|after_or_equal:today',
            'end_date' => 'nullable|date|after:start_date',
            'timezone' => 'nullable|timezone',
            'preferred_professional_id' => 'nullable|exists:users,id'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found.'
            ], 403);
        }

        // Check eligibility
        $eligibilityCheck = $this->checkEligibility($request);
        $eligibilityData = $eligibilityCheck->getData(true);
        
        if (!$eligibilityData['eligible']) {
            return response()->json([
                'success' => false,
                'message' => 'You must complete all onboarding steps to access telemedicine scheduling.',
                'eligibility' => $eligibilityData['data']
            ], 400);
        }

        $appointmentType = TelemedicineAppointmentType::findOrFail($validated['appointment_type_id']);
        
        // Check if beneficiary meets requirements for this appointment type
        if (!$appointmentType->beneficiaryHasRequiredDocuments($beneficiary)) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have the required documents for this appointment type.',
                'required_documents' => $appointmentType->required_documents
            ], 400);
        }

        $startDate = Carbon::parse($validated['start_date'] ?? now()->addDay());
        $endDate = Carbon::parse($validated['end_date'] ?? now()->addDays(30));
        $timezone = $validated['timezone'] ?? $beneficiary->timezone ?? 'America/Sao_Paulo';

        // Get available slots that support telemedicine
        $slots = InterviewSlot::available()
            ->where('is_telemedicine_enabled', true)
            ->where('date', '>=', $startDate->toDateString())
            ->where('date', '<=', $endDate->toDateString())
            ->whereJsonContains('supported_appointment_types', $appointmentType->id)
            ->where('date', '>=', now()->addHours($appointmentType->minimum_notice_hours ?? 24)->toDateString())
            ->when($validated['preferred_professional_id'] ?? null, function ($query, $professionalId) {
                $query->where('healthcare_professional_id', $professionalId);
            })
            ->with(['healthcareProfessional'])
            ->orderBy('date')
            ->orderBy('start_time')
            ->get()
            ->map(function ($slot) use ($timezone, $appointmentType, $beneficiary) {
                $startDateTime = Carbon::parse($slot->date . ' ' . $slot->start_time, $slot->timezone ?? 'America/Sao_Paulo');
                $endDateTime = Carbon::parse($slot->date . ' ' . $slot->end_time, $slot->timezone ?? 'America/Sao_Paulo');

                return [
                    'id' => $slot->id,
                    'date' => $slot->date->toDateString(),
                    'start_time' => $slot->start_time,
                    'end_time' => $slot->end_time,
                    'duration_minutes' => $slot->duration_minutes,
                    'timezone' => $slot->timezone ?? 'America/Sao_Paulo',
                    'datetime_utc' => $startDateTime->toIso8601String(),
                    'datetime_local' => $startDateTime->setTimezone($timezone)->toIso8601String(),
                    'display_time' => $startDateTime->setTimezone($timezone)->format('H:i'),
                    'display_date' => $startDateTime->setTimezone($timezone)->format('d/m/Y'),
                    'display_datetime' => $startDateTime->setTimezone($timezone)->format('d/m/Y \à\s H:i'),
                    'available_spots' => max(0, $slot->max_bookings - $slot->current_bookings),
                    'is_soon' => $startDateTime->diffInHours(now()) < 48,
                    'is_today' => $startDateTime->setTimezone($timezone)->isToday(),
                    'is_tomorrow' => $startDateTime->setTimezone($timezone)->isTomorrow(),
                    'professional' => [
                        'id' => $slot->healthcareProfessional->id,
                        'name' => $slot->healthcareProfessional->name,
                        'specialization' => $slot->healthcareProfessional->specialization ?? 'Concierge de Saúde',
                        'rating' => $slot->healthcareProfessional->professional_rating ?? 5,
                        'languages' => $slot->languages_available ?? ['pt'],
                        'experience_years' => $slot->healthcareProfessional->experience_years ?? 5
                    ],
                    'appointment_type_compatible' => true,
                    'video_platform' => $slot->video_platform ?? 'jitsi',
                    'meeting_link_available' => !empty($slot->meeting_link),
                    'special_notes' => $slot->special_notes,
                    'gamification_preview' => [
                        'points_for_booking' => 300,
                        'bonus_available' => $startDateTime->diffInHours(now()) < 24 ? 'early_booking' : null
                    ]
                ];
            });

        // Group slots by date for better UX
        $slotsByDate = $slots->groupBy(function ($slot) {
            return Carbon::parse($slot['datetime_local'])->toDateString();
        });

        return response()->json([
            'success' => true,
            'data' => [
                'slots' => $slots,
                'slots_by_date' => $slotsByDate,
                'total_slots' => $slots->count(),
                'date_range' => [
                    'start' => $startDate->toDateString(),
                    'end' => $endDate->toDateString()
                ],
                'timezone' => $timezone,
                'appointment_type' => [
                    'id' => $appointmentType->id,
                    'name' => $appointmentType->name,
                    'duration_minutes' => $appointmentType->default_duration_minutes,
                    'preparation_time' => $appointmentType->getPreparationTimeMinutes()
                ],
                'next_available' => $slots->first(),
                'stats' => [
                    'today_slots' => $slots->where('is_today', true)->count(),
                    'tomorrow_slots' => $slots->where('is_tomorrow', true)->count(),
                    'this_week_slots' => $slots->filter(function ($slot) {
                        return Carbon::parse($slot['datetime_local'])->isCurrentWeek();
                    })->count()
                ]
            ]
        ]);
    }

    /**
     * Book a telemedicine appointment
     */
    public function bookAppointment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'appointment_type_id' => 'required|exists:telemedicine_appointment_types,id',
            'interview_slot_id' => 'required|exists:interview_slots,id',
            'preferred_language' => 'nullable|string|in:pt,en,es',
            'chief_complaint' => 'nullable|string|max:500',
            'symptoms' => 'nullable|array',
            'symptoms.*' => 'string|max:100',
            'current_medications' => 'nullable|array',
            'current_medications.*' => 'string|max:100',
            'preparation_preferences' => 'nullable|array'
        ]);

        $user = $request->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            return response()->json([
                'success' => false,
                'message' => 'Beneficiary profile not found.'
            ], 403);
        }

        // Check eligibility
        $eligibilityCheck = $this->checkEligibility($request);
        $eligibilityData = $eligibilityCheck->getData(true);
        
        if (!$eligibilityData['eligible']) {
            return response()->json([
                'success' => false,
                'message' => 'You must complete all onboarding steps to access telemedicine scheduling.',
                'eligibility' => $eligibilityData['data']
            ], 400);
        }

        $appointmentType = TelemedicineAppointmentType::findOrFail($validated['appointment_type_id']);
        $slot = InterviewSlot::findOrFail($validated['interview_slot_id']);

        // Validate slot availability and compatibility
        if (!$slot->is_available || $slot->current_bookings >= $slot->max_bookings) {
            return response()->json([
                'success' => false,
                'message' => 'This time slot is no longer available.'
            ], 400);
        }

        if (!$slot->is_telemedicine_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'This slot does not support telemedicine appointments.'
            ], 400);
        }

        // Check for existing appointments
        $existingAppointment = Interview::where('beneficiary_id', $beneficiary->id)
            ->where('interview_slot_id', $slot->id)
            ->whereNotIn('status', ['cancelled'])
            ->first();

        if ($existingAppointment) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an appointment booked in this time slot.'
            ], 400);
        }

        DB::beginTransaction();

        try {
            $scheduledAt = Carbon::parse($slot->date . ' ' . $slot->start_time, $slot->timezone ?? 'America/Sao_Paulo');
            
            // Create telemedicine appointment using existing Interview model with telemedicine fields
            $appointment = Interview::create([
                'beneficiary_id' => $beneficiary->id,
                'interview_slot_id' => $slot->id,
                'healthcare_professional_id' => $slot->healthcare_professional_id,
                'appointment_type_id' => $appointmentType->id,
                'booking_reference' => $this->generateTelemedicineReference(),
                'status' => 'scheduled',
                'scheduled_at' => $scheduledAt,
                'interview_type' => 'telemedicine_consultation',
                'meeting_type' => 'video',
                'meeting_link' => $slot->meeting_link,
                'meeting_platform' => $slot->video_platform ?? 'jitsi',
                'notes' => $validated['chief_complaint'] ?? null,
                'booked_at' => now(),
                'timezone' => $slot->timezone ?? 'America/Sao_Paulo',
                'beneficiary_timezone' => $beneficiary->timezone ?? 'America/Sao_Paulo',
                'professional_timezone' => $slot->timezone ?? 'America/Sao_Paulo',
                'actual_duration_minutes' => $appointmentType->default_duration_minutes,
                
                // Telemedicine specific fields
                'is_telemedicine' => true,
                'telemedicine_setup_checklist' => [
                    'camera_test' => false,
                    'microphone_test' => false,
                    'internet_test' => false,
                    'quiet_environment' => false,
                    'documents_ready' => false,
                    'medications_list' => false
                ],
                'setup_checklist_completed' => false,
                'preparation_confirmed' => false,
                'emergency_contact' => $beneficiary->emergency_contact ?? null,
                
                // Clinical preparation
                'vital_signs_data' => null,
                'prescription_reviewed' => false,
                'requires_in_person_followup' => false,
                'consultation_cost' => $appointmentType->base_price,
                'insurance_covered' => true, // As completion reward
            ]);

            // Update slot booking count
            $slot->increment('current_bookings');
            if ($slot->current_bookings >= $slot->max_bookings) {
                $slot->update(['is_available' => false]);
            }

            // Award special gamification points for telemedicine completion reward
            $this->gamificationService->awardPoints($beneficiary, 'telemedicine_scheduled', [
                'appointment_id' => $appointment->id,
                'appointment_type' => $appointmentType->slug,
                'is_completion_reward' => true,
                'reward_tier' => 'premium',
                'multiplier' => 2.0, // Double points for completion reward
                'base_points' => 300
            ]);

            // Award special completion bonus badge - with null safety check
            $pioneerBadge = \App\Models\GamificationBadge::where('slug', 'telemedicine_pioneer')->first();
            if ($pioneerBadge && $beneficiary) {
                try {
                    $this->gamificationService->awardBadge($beneficiary, $pioneerBadge);
                    
                    Log::info('Telemedicine pioneer badge awarded', [
                        'beneficiary_id' => $beneficiary->id,
                        'badge_id' => $pioneerBadge->id,
                        'appointment_id' => $appointment->id
                    ]);
                } catch (\Exception $e) {
                    Log::warning('Failed to award telemedicine pioneer badge', [
                        'beneficiary_id' => $beneficiary->id,
                        'badge_slug' => 'telemedicine_pioneer',
                        'error' => $e->getMessage(),
                        'appointment_id' => $appointment->id ?? null
                    ]);
                    
                    // Don't fail the entire appointment booking if badge award fails
                    // Continue with the transaction
                }
            } else {
                Log::warning('Telemedicine pioneer badge not found or beneficiary missing', [
                    'badge_exists' => $pioneerBadge !== null,
                    'beneficiary_exists' => $beneficiary !== null,
                    'beneficiary_id' => $beneficiary?->id,
                    'appointment_id' => $appointment->id ?? null
                ]);
            }

            // Create video session preparation
            $videoSession = VideoSession::create([
                'interview_id' => $appointment->id,
                'session_id' => 'tm_' . uniqid(),
                'provider' => $slot->video_platform ?? 'jitsi',
                'status' => 'created',
                'participants' => [
                    [
                        'id' => $beneficiary->user_id,
                        'role' => 'patient',
                        'name' => $beneficiary->full_name,
                        'status' => 'invited'
                    ],
                    [
                        'id' => $slot->healthcare_professional_id,
                        'role' => 'professional',
                        'name' => $slot->healthcareProfessional->name,
                        'status' => 'invited'
                    ]
                ],
                'settings' => [
                    'auto_record' => true,
                    'chat_enabled' => true,
                    'screen_share_enabled' => true,
                    'waiting_room' => true,
                    'language' => $validated['preferred_language'] ?? 'pt'
                ],
                'created_by' => $user->id,
                'hipaa_compliant' => true,
                'encryption_enabled' => true
            ]);

            // Send special telemedicine notification
            $this->notificationService->sendTelemedicineAppointmentScheduledNotification($appointment, [
                'is_completion_reward' => true,
                'preparation_checklist' => $appointmentType->preparation_checklist,
                'video_session_id' => $videoSession->session_id
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Parabéns! Sua consulta de telemedicina foi agendada com sucesso!',
                'data' => [
                    'appointment' => [
                        'id' => $appointment->id,
                        'reference' => $appointment->booking_reference,
                        'scheduled_at' => $appointment->scheduled_at->toIso8601String(),
                        'display_datetime' => $appointment->scheduled_at->setTimezone($beneficiary->timezone ?? 'America/Sao_Paulo')->format('d/m/Y à\s H:i'),
                        'duration_minutes' => $appointment->actual_duration_minutes,
                        'type' => $appointmentType->name,
                        'professional' => [
                            'name' => $slot->healthcareProfessional->name,
                            'specialization' => $slot->healthcareProfessional->specialization ?? 'Concierge de Saúde'
                        ],
                        'video_session' => [
                            'session_id' => $videoSession->session_id,
                            'platform' => $videoSession->provider,
                            'join_url' => $slot->meeting_link
                        ],
                        'preparation' => [
                            'checklist' => $appointmentType->preparation_checklist,
                            'recommended_time' => $appointmentType->getPreparationTimeMinutes() . ' minutes before',
                            'technical_check_required' => true
                        ]
                    ],
                    'gamification' => [
                        'points_earned' => 300,
                        'badge_unlocked' => 'Pioneiro da Telemedicina',
                        'achievement' => 'Primeira consulta de telemedicina agendada',
                        'completion_reward' => true,
                        'special_benefits' => [
                            'Pontos extras por ser recompensa de conclusão',
                            'Acesso prioritário a recursos exclusivos',
                            'Emblema especial de pioneiro'
                        ]
                    ],
                    'next_steps' => [
                        'Complete o checklist de preparação',
                        'Teste sua câmera e microfone',
                        'Tenha seus documentos em mãos',
                        'Entre na sala virtual 10 minutos antes'
                    ],
                    'completion_context' => [
                        'reward_title' => 'Recompensa de Conclusão Desbloqueada!',
                        'message' => 'Como você completou todo o processo de onboarding, ganhou acesso exclusivo à consulta com nosso concierge de saúde.',
                        'special_status' => 'priority_patient'
                    ]
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to schedule telemedicine appointment.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get completion requirements for telemedicine eligibility
     */
    private function getCompletionRequirements(Beneficiary $beneficiary): array
    {
        // Check registration completion
        $registrationCompleted = $beneficiary->registration_completed ?? false;

        // Check required documents
        $requiredDocuments = ['cpf', 'rg', 'address_proof'];
        $approvedDocs = $beneficiary->documents()
            ->whereIn('document_type', $requiredDocuments)
            ->where('status', 'approved')
            ->count();
        $documentsCompleted = $approvedDocs >= count($requiredDocuments);

        // Check health questionnaire
        $healthQuestionnaireCompleted = $beneficiary->healthQuestionnaires()
            ->where('status', 'completed')
            ->exists();

        // Check profile completion
        $profileFields = ['full_name', 'birth_date', 'phone', 'address', 'city', 'state'];
        $completedFields = 0;
        foreach ($profileFields as $field) {
            if (!empty($beneficiary->$field)) {
                $completedFields++;
            }
        }
        $profileCompleted = $completedFields >= count($profileFields);

        return [
            'registration' => [
                'completed' => $registrationCompleted,
                'title' => 'Registro Completo',
                'description' => 'Informações básicas preenchidas'
            ],
            'documents' => [
                'completed' => $documentsCompleted,
                'title' => 'Documentos Aprovados',
                'description' => "Documentos necessários aprovados ({$approvedDocs}/" . count($requiredDocuments) . ")"
            ],
            'health_questionnaire' => [
                'completed' => $healthQuestionnaireCompleted,
                'title' => 'Questionário de Saúde',
                'description' => 'Avaliação de saúde preenchida'
            ],
            'profile' => [
                'completed' => $profileCompleted,
                'title' => 'Perfil Completo',
                'description' => "Dados pessoais completos ({$completedFields}/" . count($profileFields) . ")"
            ]
        ];
    }

    /**
     * Calculate completion percentage
     */
    private function calculateCompletionPercentage(array $requirements): int
    {
        $total = count($requirements);
        $completed = collect($requirements)->filter(fn($req) => $req['completed'])->count();
        
        return $total > 0 ? round(($completed / $total) * 100) : 0;
    }

    /**
     * Get next steps for completion
     */
    private function getNextSteps(array $requirements, bool $hasMinimumPoints): array
    {
        $steps = [];
        
        foreach ($requirements as $key => $requirement) {
            if (!$requirement['completed']) {
                switch ($key) {
                    case 'registration':
                        $steps[] = 'Complete seu registro pessoal';
                        break;
                    case 'documents':
                        $steps[] = 'Faça upload e aguarde aprovação dos documentos';
                        break;
                    case 'health_questionnaire':
                        $steps[] = 'Preencha o questionário de saúde';
                        break;
                    case 'profile':
                        $steps[] = 'Complete todas as informações do seu perfil';
                        break;
                }
            }
        }

        if (!$hasMinimumPoints) {
            $steps[] = 'Continue participando para ganhar mais pontos (500 pontos necessários)';
        }

        return $steps;
    }

    /**
     * Get recommended appointment type based on health profile
     */
    private function getRecommendedAppointmentType(Beneficiary $beneficiary, $appointmentTypes)
    {
        if ($appointmentTypes->isEmpty()) {
            return null;
        }

        // Get latest health questionnaire
        $healthQuestionnaire = $beneficiary->healthQuestionnaires()
            ->where('status', 'completed')
            ->latest()
            ->first();

        // Simple recommendation logic - can be enhanced with ML
        if ($healthQuestionnaire && isset($healthQuestionnaire->responses['conditions'])) {
            $conditions = $healthQuestionnaire->responses['conditions'];
            
            // If has chronic conditions, recommend follow-up type
            if (!empty($conditions)) {
                $followUpType = $appointmentTypes->where('slug', 'follow-up')->first();
                if ($followUpType) {
                    return $followUpType;
                }
            }
        }

        // Default to initial consultation
        return $appointmentTypes->where('slug', 'initial-consultation')->first() ?? $appointmentTypes->first();
    }

    /**
     * Generate unique telemedicine reference
     */
    private function generateTelemedicineReference(): string
    {
        do {
            $reference = 'TM-' . now()->format('Y') . '-' . str_pad(mt_rand(1, 999999), 6, '0', STR_PAD_LEFT);
        } while (Interview::where('booking_reference', $reference)->exists());

        return $reference;
    }
}