<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterStep2Request extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'phone' => [
                'required',
                'string',
                'regex:/^\(\d{2}\) \d{4,5}-\d{4}$|^\d{10,11}$/',
            ],
            'department' => ['required', 'string', 'max:100'],
            'job_title' => ['required', 'string', 'max:100'],
            'employee_id' => [
                'required',
                'string',
                'max:50',
                Rule::unique('users', 'employee_id'),
            ],
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'preferred_language' => ['sometimes', 'string', 'in:pt-BR,en,es'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'O telefone é obrigatório.',
            'phone.regex' => 'O telefone deve estar no formato (XX) XXXXX-XXXX.',
            'department.required' => 'O departamento é obrigatório.',
            'job_title.required' => 'O cargo é obrigatório.',
            'employee_id.required' => 'O ID do funcionário é obrigatório.',
            'employee_id.unique' => 'Este ID de funcionário já está cadastrado.',
            'start_date.required' => 'A data de início é obrigatória.',
            'start_date.after_or_equal' => 'A data de início deve ser hoje ou uma data futura.',
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Clean phone number - remove special characters but keep the format for validation
        if ($this->has('phone') && !preg_match('/^\(\d{2}\) \d{4,5}-\d{4}$/', $this->phone)) {
            $phone = preg_replace('/[^0-9]/', '', $this->phone);
            if (strlen($phone) === 10) {
                $phone = sprintf('(%s) %s-%s', 
                    substr($phone, 0, 2), 
                    substr($phone, 2, 4), 
                    substr($phone, 6, 4)
                );
            } elseif (strlen($phone) === 11) {
                $phone = sprintf('(%s) %s-%s', 
                    substr($phone, 0, 2), 
                    substr($phone, 2, 5), 
                    substr($phone, 7, 4)
                );
            }
            $this->merge(['phone' => $phone]);
        }
    }
}