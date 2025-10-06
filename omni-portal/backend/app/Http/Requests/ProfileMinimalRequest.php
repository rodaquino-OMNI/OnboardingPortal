<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * ProfileMinimalRequest - Validation for minimal profile completion
 *
 * Validates:
 * - Name (required)
 * - CPF (Brazilian tax ID format)
 * - Birthdate (valid date, 18+ years old)
 * - Phone (Brazilian format)
 * - Address (optional)
 */
class ProfileMinimalRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authenticated users only (enforced by middleware)
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'min:3',
                'max:255',
                'regex:/^[a-zA-ZÀ-ÿ\s]+$/', // Letters and spaces only
            ],
            'cpf' => [
                'required',
                'string',
                'regex:/^\d{3}\.\d{3}\.\d{3}-\d{2}$/', // Format: 123.456.789-01
                'unique:users,cpf,' . $this->user()?->id, // Allow updating own CPF
            ],
            'birthdate' => [
                'required',
                'date',
                'before:-18 years', // Must be 18+ years old
                'after:1900-01-01',
            ],
            'phone' => [
                'required',
                'string',
                'regex:/^\(\d{2}\) \d{4,5}-\d{4}$/', // Format: (11) 98765-4321
            ],
            'address' => [
                'nullable',
                'string',
                'max:500',
            ],
        ];
    }

    /**
     * Get custom error messages
     */
    public function messages(): array
    {
        return [
            'name.required' => 'O nome é obrigatório.',
            'name.regex' => 'O nome deve conter apenas letras.',
            'cpf.required' => 'O CPF é obrigatório.',
            'cpf.regex' => 'O CPF deve estar no formato 123.456.789-01.',
            'cpf.unique' => 'Este CPF já está cadastrado.',
            'birthdate.required' => 'A data de nascimento é obrigatória.',
            'birthdate.before' => 'Você deve ter pelo menos 18 anos.',
            'phone.required' => 'O telefone é obrigatório.',
            'phone.regex' => 'O telefone deve estar no formato (11) 98765-4321.',
        ];
    }

    /**
     * Prepare data for validation
     *
     * Clean up CPF and phone formats before validation
     */
    protected function prepareForValidation(): void
    {
        // Keep formatted values for validation
        // The regex validators expect formatted input
    }

    /**
     * Get validated CPF without formatting
     */
    public function getCleanCpf(): string
    {
        return preg_replace('/[^0-9]/', '', $this->cpf);
    }

    /**
     * Get validated phone without formatting
     */
    public function getCleanPhone(): string
    {
        return preg_replace('/[^0-9]/', '', $this->phone);
    }
}
