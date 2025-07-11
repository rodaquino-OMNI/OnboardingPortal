<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class LoginRequest extends FormRequest
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
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
            'device_name' => ['sometimes', 'string', 'max:255'], // For mobile apps
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'email.required' => 'O e-mail é obrigatório.',
            'email.email' => 'Por favor, insira um e-mail válido.',
            'password.required' => 'A senha é obrigatória.',
        ];
    }

    /**
     * Get the login field (email or CPF)
     */
    public function getLoginField(): string
    {
        $login = $this->input('email');
        
        // Check if it's a CPF (numbers only)
        if (preg_match('/^\d{11}$/', preg_replace('/[^0-9]/', '', $login))) {
            return 'cpf';
        }
        
        return 'email';
    }

    /**
     * Get credentials for authentication
     */
    public function getCredentials(): array
    {
        $field = $this->getLoginField();
        $value = $this->input('email');
        
        // Clean CPF if needed
        if ($field === 'cpf') {
            $value = preg_replace('/[^0-9]/', '', $value);
        }
        
        return [
            $field => $value,
            'password' => $this->input('password'),
        ];
    }
}