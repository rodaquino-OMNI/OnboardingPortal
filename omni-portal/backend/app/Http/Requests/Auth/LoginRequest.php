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
            'email' => ['required', 'string', 'max:255'], // Allow both email and CPF
            'password' => ['required', 'string', 'min:8'],
            'remember' => ['boolean'],
            'device_name' => ['sometimes', 'string', 'max:100'], // Limit device name length
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'email.required' => 'CPF ou e-mail é obrigatório.',
            'password.required' => 'A senha é obrigatória.',
        ];
    }

    /**
     * Get the login field (email or CPF)
     */
    public function getLoginField(): string
    {
        $login = trim($this->input('email'));
        
        // Clean the login input and check if it's a CPF
        $cleanedLogin = preg_replace('/[^0-9]/', '', $login);
        
        // Check if it's a CPF (exactly 11 digits after cleaning)
        if (strlen($cleanedLogin) === 11 && preg_match('/^\d{11}$/', $cleanedLogin)) {
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
        $value = trim($this->input('email'));
        
        // Clean CPF if needed
        if ($field === 'cpf') {
            $value = preg_replace('/[^0-9]/', '', $value);
        } else {
            // For email, normalize to lowercase and validate format
            $value = strtolower($value);
        }
        
        return [
            $field => $value,
            'password' => $this->input('password'),
        ];
    }
}