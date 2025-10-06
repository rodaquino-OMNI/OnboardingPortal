<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * RegisterRequest - Validation for user registration
 *
 * Validates:
 * - Email uniqueness
 * - Password strength (min 8 chars, mixed case, numbers, symbols)
 * - LGPD consent
 * - Terms acceptance
 */
class RegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Public endpoint
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => [
                'required',
                'email',
                'max:255',
                'unique:users,email',
            ],
            'password' => [
                'required',
                'confirmed',
                Password::min(8)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
            'lgpd_consent' => [
                'required',
                'boolean',
                'accepted', // Must be true
            ],
            'terms_accepted' => [
                'required',
                'boolean',
                'accepted', // Must be true
            ],
        ];
    }

    /**
     * Get custom error messages
     */
    public function messages(): array
    {
        return [
            'email.required' => 'O email é obrigatório.',
            'email.email' => 'O email deve ser um endereço válido.',
            'email.unique' => 'Este email já está cadastrado.',
            'password.required' => 'A senha é obrigatória.',
            'password.confirmed' => 'As senhas não coincidem.',
            'lgpd_consent.required' => 'O consentimento LGPD é obrigatório.',
            'lgpd_consent.accepted' => 'Você deve aceitar os termos de privacidade.',
            'terms_accepted.required' => 'A aceitação dos termos é obrigatória.',
            'terms_accepted.accepted' => 'Você deve aceitar os termos de uso.',
        ];
    }
}
