<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Interview;
use App\Models\InterviewSlot;

class InterviewRescheduleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $interview = $this->route('interview');
        
        if (is_string($interview)) {
            $interview = Interview::find($interview);
        }

        if (!$interview) {
            return false;
        }

        $user = $this->user();

        // User can reschedule if they are:
        // 1. The beneficiary who owns the interview
        // 2. The interviewer assigned to the interview
        // 3. An admin
        return ($user->beneficiary && $interview->beneficiary_id === $user->beneficiary->id) ||
               $interview->interviewer_id === $user->id ||
               $user->hasRole('admin');
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'new_interview_slot_id' => [
                'required',
                'exists:interview_slots,id',
                'different:interview_slot_id', // Must be different from current slot
                function ($attribute, $value, $fail) {
                    $interview = $this->getInterview();
                    if (!$interview) return;

                    $newSlot = InterviewSlot::find($value);
                    if (!$newSlot) {
                        $fail('O novo horário selecionado não existe.');
                        return;
                    }

                    // Check if new slot is available
                    if (!$newSlot->is_available) {
                        $fail('O novo horário selecionado não está disponível.');
                        return;
                    }

                    // Check if new slot is in the past
                    $slotDateTime = $newSlot->date . ' ' . $newSlot->start_time;
                    if (now()->gt($slotDateTime)) {
                        $fail('Não é possível reagendar para horários passados.');
                        return;
                    }

                    // Check if new slot has capacity
                    if ($newSlot->current_bookings >= $newSlot->max_interviews) {
                        $fail('O novo horário selecionado está lotado.');
                        return;
                    }

                    // Check minimum advance notice (24 hours)
                    $currentSlotDateTime = \Carbon\Carbon::parse($interview->slot->date . ' ' . $interview->slot->start_time);
                    if (now()->diffInHours($currentSlotDateTime, false) < 24) {
                        $fail('Não é possível reagendar com menos de 24 horas de antecedência.');
                        return;
                    }

                    // Check if new slot is within business rules (max 3 months future)
                    $newSlotDate = \Carbon\Carbon::parse($newSlot->date);
                    $maxDate = now()->addMonths(3);
                    
                    if ($newSlotDate->gt($maxDate)) {
                        $fail('Não é possível reagendar com mais de 3 meses de antecedência.');
                        return;
                    }
                },
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500'
            ],
            'reason' => [
                'nullable',
                'string',
                'max:255'
            ],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'new_interview_slot_id.required' => 'Você deve selecionar um novo horário para reagendar.',
            'new_interview_slot_id.exists' => 'O novo horário selecionado não existe.',
            'new_interview_slot_id.different' => 'O novo horário deve ser diferente do horário atual.',
            'notes.max' => 'As observações podem ter no máximo 500 caracteres.',
            'reason.max' => 'O motivo pode ter no máximo 255 caracteres.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $interview = $this->getInterview();
            if (!$interview) return;

            // Check if interview can be rescheduled
            $this->validateInterviewStatus($validator, $interview);

            // Check for conflicts with new slot
            if ($this->new_interview_slot_id) {
                $this->validateNewSlotConflicts($validator, $interview);
            }

            // Validate reschedule limits
            $this->validateRescheduleLimit($validator, $interview);
        });
    }

    /**
     * Validate interview status allows rescheduling
     */
    protected function validateInterviewStatus($validator, Interview $interview): void
    {
        $allowedStatuses = ['scheduled', 'rescheduled', 'confirmed'];
        
        if (!in_array($interview->status, $allowedStatuses)) {
            $validator->errors()->add(
                'new_interview_slot_id',
                'Esta entrevista não pode ser reagendada devido ao seu status atual.'
            );
            return;
        }

        // Check if interview is too close (within 24 hours)
        if ($interview->scheduled_at->diffInHours(now()) < 24) {
            $validator->errors()->add(
                'new_interview_slot_id',
                'Não é possível reagendar entrevistas com menos de 24 horas de antecedência.'
            );
        }
    }

    /**
     * Check for conflicts with the new slot
     */
    protected function validateNewSlotConflicts($validator, Interview $interview): void
    {
        $newSlot = InterviewSlot::find($this->new_interview_slot_id);
        if (!$newSlot) return;

        $beneficiaryId = $interview->beneficiary_id;
        $newSlotStart = \Carbon\Carbon::parse($newSlot->date . ' ' . $newSlot->start_time);
        $newSlotEnd = \Carbon\Carbon::parse($newSlot->date . ' ' . $newSlot->end_time);

        // Check for existing interviews in the new time slot (excluding current interview)
        $conflictingInterview = Interview::where('beneficiary_id', $beneficiaryId)
            ->where('id', '!=', $interview->id)
            ->whereIn('status', ['scheduled', 'rescheduled', 'confirmed'])
            ->whereBetween('scheduled_at', [
                $newSlotStart->copy()->subHours(2),
                $newSlotEnd->copy()->addHours(2)
            ])
            ->first();

        if ($conflictingInterview) {
            $conflictTime = $conflictingInterview->scheduled_at->format('d/m/Y H:i');
            $validator->errors()->add(
                'new_interview_slot_id',
                "Você já possui uma entrevista agendada próxima ao novo horário ({$conflictTime}). Mantenha um intervalo mínimo de 2 horas entre entrevistas."
            );
        }
    }

    /**
     * Validate reschedule limits (max 3 reschedules per interview)
     */
    protected function validateRescheduleLimit($validator, Interview $interview): void
    {
        // Count how many times this interview has been rescheduled
        $rescheduleCount = Interview::where('beneficiary_id', $interview->beneficiary_id)
            ->where(function ($query) use ($interview) {
                $query->where('id', $interview->id)
                      ->orWhere('rescheduled_from', $interview->id);
            })
            ->where('status', 'rescheduled')
            ->count();

        if ($rescheduleCount >= 3) {
            $validator->errors()->add(
                'new_interview_slot_id',
                'Esta entrevista já foi reagendada o número máximo de vezes permitido (3). Entre em contato com o suporte.'
            );
        }
    }

    /**
     * Get the interview being rescheduled
     */
    protected function getInterview(): ?Interview
    {
        $interviewId = $this->route('interview');
        
        if (is_string($interviewId)) {
            return Interview::with(['slot', 'beneficiary'])->find($interviewId);
        }
        
        return $interviewId;
    }

    /**
     * Get validated data with computed fields
     */
    public function validatedWithComputed(): array
    {
        $validated = $this->validated();
        
        // Add computed fields based on new slot
        if ($this->new_interview_slot_id) {
            $newSlot = InterviewSlot::find($this->new_interview_slot_id);
            if ($newSlot) {
                $validated['scheduled_at'] = \Carbon\Carbon::parse($newSlot->date . ' ' . $newSlot->start_time);
                $validated['interviewer_id'] = $newSlot->interviewer_id;
                $validated['status'] = 'rescheduled';
            }
        }

        // Add current interview slot as rescheduled_from
        $interview = $this->getInterview();
        if ($interview) {
            $validated['rescheduled_from'] = $interview->interview_slot_id;
        }

        return $validated;
    }
}