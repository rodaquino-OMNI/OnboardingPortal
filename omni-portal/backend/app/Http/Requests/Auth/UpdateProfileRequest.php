<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateProfileRequest extends FormRequest
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
        $userId = $this->user()->id;
        
        return [
            'name' => ['sometimes', 'string', 'max:255', 'min:3'],
            'email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'phone' => [
                'sometimes',
                'string',
                'regex:/^\(\d{2}\) \d{4,5}-\d{4}$|^\d{10,11}$/',
            ],
            'department' => ['sometimes', 'string', 'max:100'],
            'job_title' => ['sometimes', 'string', 'max:100'],
            'preferred_language' => ['sometimes', 'string', 'in:pt-BR,en,es'],
            'current_password' => ['required_with:new_password', 'string'],
            'new_password' => [
                'sometimes',
                'string',
                'confirmed',
                'different:current_password',
                Password::min(8)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
            'new_password_confirmation' => ['required_with:new_password', 'string'],
            'preferences' => ['sometimes', 'array'],
            'preferences.notifications' => ['sometimes', 'boolean'],
            'preferences.theme' => ['sometimes', 'string', 'in:light,dark,auto'],
            'preferences.language' => ['sometimes', 'string', 'in:pt-BR,en,es'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.min' => 'O nome deve ter pelo menos 3 caracteres.',
            'email.email' => 'Por favor, insira um e-mail válido.',
            'email.unique' => 'Este e-mail já está em uso.',
            'phone.regex' => 'O telefone deve estar no formato (XX) XXXXX-XXXX.',
            'current_password.required_with' => 'A senha atual é obrigatória para alterar a senha.',
            'new_password.confirmed' => 'As novas senhas não coincidem.',
            'new_password.different' => 'A nova senha deve ser diferente da senha atual.',
            'new_password.min' => 'A nova senha deve ter pelo menos 8 caracteres.',
            'new_password_confirmation.required_with' => 'A confirmação da nova senha é obrigatória.',
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Clean phone number if provided
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