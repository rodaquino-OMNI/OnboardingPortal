<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class InterviewSlotRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Only healthcare professionals and admins can create/update slots
        return $this->user()->hasRole(['healthcare_professional', 'admin']);
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $rules = [
            'date' => [
                'required',
                'date',
                'after_or_equal:today'
            ],
            'start_time' => [
                'required',
                'string',
                'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', // HH:MM format
            ],
            'end_time' => [
                'required',
                'string',
                'regex:/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', // HH:MM format
                'after:start_time'
            ],
            'interviewer_id' => [
                'nullable',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value && !$this->user()->hasRole('admin')) {
                        // Non-admin users can only assign slots to themselves
                        if ($value != $this->user()->id) {
                            $fail('You can only create slots for yourself.');
                        }
                    }
                },
            ],
            'max_interviews' => [
                'integer',
                'min:1',
                'max:10'
            ],
            'is_available' => 'boolean',
            'location' => [
                'nullable',
                'string',
                'max:255'
            ],
            'notes' => [
                'nullable',
                'string',
                'max:500'
            ],
        ];

        // Additional validation for update requests
        if ($this->isMethod('PUT') || $this->isMethod('PATCH')) {
            // Make fields optional for updates
            $rules['date'][0] = 'sometimes';
            $rules['start_time'][0] = 'sometimes';
            $rules['end_time'][0] = 'sometimes';
        }

        return $rules;
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'date.required' => 'A data da consulta é obrigatória.',
            'date.date' => 'A data deve ser uma data válida.',
            'date.after_or_equal' => 'A data não pode ser anterior a hoje.',
            'start_time.required' => 'O horário de início é obrigatório.',
            'start_time.regex' => 'O horário de início deve estar no formato HH:MM.',
            'end_time.required' => 'O horário de término é obrigatório.',
            'end_time.regex' => 'O horário de término deve estar no formato HH:MM.',
            'end_time.after' => 'O horário de término deve ser posterior ao horário de início.',
            'interviewer_id.exists' => 'O profissional selecionado não existe.',
            'max_interviews.integer' => 'O número máximo de entrevistas deve ser um número inteiro.',
            'max_interviews.min' => 'Deve haver pelo menos 1 vaga disponível.',
            'max_interviews.max' => 'O máximo de vagas permitidas é 10.',
            'location.max' => 'A localização pode ter no máximo 255 caracteres.',
            'notes.max' => 'As observações podem ter no máximo 500 caracteres.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Validate business hours
            if ($this->start_time && $this->end_time) {
                $this->validateBusinessHours($validator);
            }

            // Validate slot duration
            if ($this->start_time && $this->end_time) {
                $this->validateSlotDuration($validator);
            }

            // Validate date not too far in future
            if ($this->date) {
                $this->validateDateRange($validator);
            }
        });
    }

    /**
     * Validate business hours (8:00 - 18:00)
     */
    protected function validateBusinessHours($validator): void
    {
        $startTime = Carbon::createFromTimeString($this->start_time);
        $endTime = Carbon::createFromTimeString($this->end_time);
        $businessStart = Carbon::createFromTimeString('08:00');
        $businessEnd = Carbon::createFromTimeString('18:00');

        if ($startTime->lt($businessStart) || $startTime->gt($businessEnd)) {
            $validator->errors()->add(
                'start_time',
                'O horário de início deve estar entre 08:00 e 18:00.'
            );
        }

        if ($endTime->lt($businessStart) || $endTime->gt($businessEnd)) {
            $validator->errors()->add(
                'end_time',
                'O horário de término deve estar entre 08:00 e 18:00.'
            );
        }
    }

    /**
     * Validate slot duration (minimum 30 minutes, maximum 4 hours)
     */
    protected function validateSlotDuration($validator): void
    {
        $startTime = Carbon::createFromTimeString($this->start_time);
        $endTime = Carbon::createFromTimeString($this->end_time);
        $durationMinutes = $startTime->diffInMinutes($endTime);

        if ($durationMinutes < 30) {
            $validator->errors()->add(
                'end_time',
                'A duração mínima do horário deve ser de 30 minutos.'
            );
        }

        if ($durationMinutes > 240) { // 4 hours
            $validator->errors()->add(
                'end_time',
                'A duração máxima do horário deve ser de 4 horas.'
            );
        }
    }

    /**
     * Validate date range (not more than 3 months in future)
     */
    protected function validateDateRange($validator): void
    {
        $date = Carbon::parse($this->date);
        $maxDate = now()->addMonths(3);

        if ($date->gt($maxDate)) {
            $validator->errors()->add(
                'date',
                'A data não pode ser superior a 3 meses no futuro.'
            );
        }
    }

    /**
     * Get validated data with defaults
     */
    public function validatedWithDefaults(): array
    {
        $validated = $this->validated();

        // Set defaults
        $validated['interviewer_id'] = $validated['interviewer_id'] ?? $this->user()->id;
        $validated['max_interviews'] = $validated['max_interviews'] ?? 1;
        $validated['is_available'] = $validated['is_available'] ?? true;

        return $validated;
    }
}