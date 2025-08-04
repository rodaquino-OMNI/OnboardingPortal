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
            // Work-related information
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
            
            // Personal information - CRITICAL MISSING FIELDS ADDED
            'birth_date' => [
                'required',
                'date',
                'before:today',
                'after:1900-01-01',
                function ($attribute, $value, $fail) {
                    $birthDate = \Carbon\Carbon::parse($value);
                    $age = $birthDate->age;
                    if ($age < 16) {
                        $fail('Você deve ter pelo menos 16 anos para se cadastrar.');
                    }
                    if ($age > 120) {
                        $fail('Data de nascimento inválida.');
                    }
                },
            ],
            'gender' => [
                'required',
                'string',
                'in:masculine,feminine,non_binary,prefer_not_to_say',
            ],
            'marital_status' => [
                'required',
                'string',
                'in:single,married,divorced,widowed,separated,common_law',
            ],
            
            // Additional validation for address fields if provided
            'address' => ['sometimes', 'string', 'max:255'],
            'number' => ['sometimes', 'string', 'max:20'],
            'complement' => ['sometimes', 'nullable', 'string', 'max:100'],
            'neighborhood' => ['sometimes', 'string', 'max:100'],
            'city' => ['sometimes', 'string', 'max:100'],
            'state' => ['sometimes', 'string', 'size:2'],
            'zip_code' => ['sometimes', 'string', 'regex:/^\d{5}-?\d{3}$/'],
            'emergency_contact_name' => ['sometimes', 'string', 'max:255'],
            'emergency_contact_phone' => ['sometimes', 'string', 'regex:/^\(\d{2}\) \d{4,5}-\d{4}$|^\d{10,11}$/'],
            'emergency_contact_relationship' => ['sometimes', 'string', 'max:100'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            // Work-related messages
            'phone.required' => 'O telefone é obrigatório.',
            'phone.regex' => 'O telefone deve estar no formato (XX) XXXXX-XXXX.',
            'department.required' => 'O departamento é obrigatório.',
            'job_title.required' => 'O cargo é obrigatório.',
            'employee_id.required' => 'O ID do funcionário é obrigatório.',
            'employee_id.unique' => 'Este ID de funcionário já está cadastrado.',
            'start_date.required' => 'A data de início é obrigatória.',
            'start_date.after_or_equal' => 'A data de início deve ser hoje ou uma data futura.',
            
            // Personal information messages
            'birth_date.required' => 'A data de nascimento é obrigatória.',
            'birth_date.date' => 'A data de nascimento deve ser uma data válida.',
            'birth_date.before' => 'A data de nascimento deve ser anterior a hoje.',
            'birth_date.after' => 'Data de nascimento inválida.',
            'gender.required' => 'O gênero é obrigatório.',
            'gender.in' => 'Selecione uma opção válida de gênero.',
            'marital_status.required' => 'O estado civil é obrigatório.',
            'marital_status.in' => 'Selecione um estado civil válido.',
            
            // Address validation messages
            'zip_code.regex' => 'O CEP deve estar no formato XXXXX-XXX.',
            'state.size' => 'O estado deve ter 2 caracteres (ex: SP).',
            'emergency_contact_phone.regex' => 'O telefone do contato de emergência deve estar no formato (XX) XXXXX-XXXX.',
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
        
        // Clean emergency contact phone if provided
        if ($this->has('emergency_contact_phone') && !preg_match('/^\(\d{2}\) \d{4,5}-\d{4}$/', $this->emergency_contact_phone)) {
            $phone = preg_replace('/[^0-9]/', '', $this->emergency_contact_phone);
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
            $this->merge(['emergency_contact_phone' => $phone]);
        }
        
        // Clean ZIP code
        if ($this->has('zip_code')) {
            $zipCode = preg_replace('/[^0-9]/', '', $this->zip_code);
            if (strlen($zipCode) === 8) {
                $zipCode = substr($zipCode, 0, 5) . '-' . substr($zipCode, 5, 3);
            }
            $this->merge(['zip_code' => $zipCode]);
        }
        
        // Normalize gender and marital status to lowercase for consistent storage
        if ($this->has('gender')) {
            $this->merge(['gender' => strtolower($this->gender)]);
        }
        
        if ($this->has('marital_status')) {
            $this->merge(['marital_status' => strtolower($this->marital_status)]);
        }
    }
}