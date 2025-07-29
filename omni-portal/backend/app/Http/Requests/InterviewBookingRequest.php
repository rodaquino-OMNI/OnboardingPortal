<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\InterviewSlot;

class InterviewBookingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Only beneficiaries can book interviews
        return $this->user()->beneficiary !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'interview_slot_id' => [
                'required',
                'exists:interview_slots,id',
                function ($attribute, $value, $fail) {
                    $slot = InterviewSlot::find($value);
                    
                    if (!$slot) {
                        $fail('O horário selecionado não existe.');
                        return;
                    }

                    // Check if slot is available
                    if (!$slot->is_available) {
                        $fail('O horário selecionado não está disponível.');
                        return;
                    }

                    // Check if slot is in the past
                    $slotDateTime = $slot->date . ' ' . $slot->start_time;
                    if (now()->gt($slotDateTime)) {
                        $fail('Não é possível agendar em horários passados.');
                        return;
                    }

                    // Check if slot has capacity
                    if ($slot->current_bookings >= $slot->max_interviews) {
                        $fail('O horário selecionado está lotado.');
                        return;
                    }

                    // Check if slot is within business hours and not too far in future
                    $slotDate = \Carbon\Carbon::parse($slot->date);
                    $maxDate = now()->addMonths(3);
                    
                    if ($slotDate->gt($maxDate)) {
                        $fail('Não é possível agendar com mais de 3 meses de antecedência.');
                        return;
                    }
                },
            ],
            'type' => [
                'required',
                Rule::in(['in_person', 'online', 'phone'])
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500'
            ],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'interview_slot_id.required' => 'Você deve selecionar um horário para a entrevista.',
            'interview_slot_id.exists' => 'O horário selecionado não existe.',
            'type.required' => 'Você deve especificar o tipo da entrevista.',
            'type.in' => 'O tipo da entrevista deve ser presencial, online ou por telefone.',
            'notes.max' => 'As observações podem ter no máximo 500 caracteres.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Check if user already has an interview in this slot
            if ($this->interview_slot_id) {
                $this->validateExistingBooking($validator);
            }

            // Check if user has conflicting interviews
            if ($this->interview_slot_id) {
                $this->validateConflictingInterviews($validator);
            }

            // Validate registration completion
            $this->validateRegistrationCompletion($validator);
        });
    }

    /**
     * Check if user already has an interview in this slot
     */
    protected function validateExistingBooking($validator): void
    {
        $beneficiary = $this->user()->beneficiary;
        if (!$beneficiary) return;

        $existingInterview = \App\Models\Interview::where('beneficiary_id', $beneficiary->id)
            ->where('interview_slot_id', $this->interview_slot_id)
            ->whereIn('status', ['scheduled', 'rescheduled', 'confirmed'])
            ->exists();

        if ($existingInterview) {
            $validator->errors()->add(
                'interview_slot_id',
                'Você já possui uma entrevista agendada neste horário.'
            );
        }
    }

    /**
     * Check for conflicting interviews
     */
    protected function validateConflictingInterviews($validator): void
    {
        $beneficiary = $this->user()->beneficiary;
        if (!$beneficiary) return;

        $slot = InterviewSlot::find($this->interview_slot_id);
        if (!$slot) return;

        $slotStart = \Carbon\Carbon::parse($slot->date . ' ' . $slot->start_time);
        $slotEnd = \Carbon\Carbon::parse($slot->date . ' ' . $slot->end_time);

        // Check for interviews within 2 hours buffer
        $conflictingInterview = \App\Models\Interview::where('beneficiary_id', $beneficiary->id)
            ->whereIn('status', ['scheduled', 'rescheduled', 'confirmed'])
            ->whereBetween('scheduled_at', [
                $slotStart->copy()->subHours(2),
                $slotEnd->copy()->addHours(2)
            ])
            ->with(['slot'])
            ->first();

        if ($conflictingInterview) {
            $conflictTime = $conflictingInterview->scheduled_at->format('d/m/Y H:i');
            $validator->errors()->add(
                'interview_slot_id',
                "Você já possui uma entrevista agendada próxima a este horário ({$conflictTime}). Mantenha um intervalo mínimo de 2 horas entre entrevistas."
            );
        }
    }

    /**
     * Validate registration completion requirements
     */
    protected function validateRegistrationCompletion($validator): void
    {
        $user = $this->user();
        $beneficiary = $user->beneficiary;

        if (!$beneficiary) {
            $validator->errors()->add(
                'interview_slot_id',
                'Você deve completar seu perfil de beneficiário antes de agendar entrevistas.'
            );
            return;
        }

        // Check if user has completed required steps
        if (!$user->isRegistrationCompleted()) {
            $validator->errors()->add(
                'interview_slot_id',
                'Você deve completar seu cadastro antes de agendar entrevistas.'
            );
            return;
        }

        // Check if user has uploaded required documents
        $requiredDocuments = ['rg', 'cpf', 'comprovante_residencia'];
        $uploadedDocuments = \App\Models\Document::where('beneficiary_id', $beneficiary->id)
            ->whereIn('document_type', $requiredDocuments)
            ->where('status', 'approved')
            ->pluck('document_type')
            ->toArray();

        $missingDocuments = array_diff($requiredDocuments, $uploadedDocuments);

        if (!empty($missingDocuments)) {
            $documentNames = [
                'rg' => 'RG',
                'cpf' => 'CPF',
                'comprovante_residencia' => 'Comprovante de Residência'
            ];
            
            $missingNames = array_map(function ($doc) use ($documentNames) {
                return $documentNames[$doc] ?? $doc;
            }, $missingDocuments);

            $validator->errors()->add(
                'interview_slot_id',
                'Você deve enviar e ter aprovados os seguintes documentos antes de agendar: ' . implode(', ', $missingNames)
            );
        }

        // Check if user has completed health questionnaire
        $hasHealthQuestionnaire = \App\Models\HealthQuestionnaire::where('beneficiary_id', $beneficiary->id)
            ->where('status', 'completed')
            ->exists();

        if (!$hasHealthQuestionnaire) {
            $validator->errors()->add(
                'interview_slot_id',
                'Você deve completar o questionário de saúde antes de agendar entrevistas.'
            );
        }
    }

    /**
     * Get validated data with computed fields
     */
    public function validatedWithComputed(): array
    {
        $validated = $this->validated();
        
        // Add beneficiary_id
        $validated['beneficiary_id'] = $this->user()->beneficiary->id;
        
        // Add scheduled_at based on slot
        if ($this->interview_slot_id) {
            $slot = InterviewSlot::find($this->interview_slot_id);
            if ($slot) {
                $validated['scheduled_at'] = \Carbon\Carbon::parse($slot->date . ' ' . $slot->start_time);
                $validated['interviewer_id'] = $slot->interviewer_id;
            }
        }

        return $validated;
    }
}