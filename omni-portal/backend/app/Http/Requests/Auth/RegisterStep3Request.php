<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterStep3Request extends FormRequest
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
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)
                    ->mixedCase()
                    ->numbers()
                    ->symbols()
                    ->uncompromised(),
            ],
            'password_confirmation' => ['required', 'string'],
            'security_question' => ['required', 'string', 'max:255'],
            'security_answer' => ['required', 'string', 'max:255', 'min:3'],
            'two_factor_enabled' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'password.required' => 'A senha é obrigatória.',
            'password.confirmed' => 'As senhas não coincidem.',
            'password.min' => 'A senha deve ter pelo menos 8 caracteres.',
            'password.mixed_case' => 'A senha deve conter letras maiúsculas e minúsculas.',
            'password.numbers' => 'A senha deve conter pelo menos um número.',
            'password.symbols' => 'A senha deve conter pelo menos um símbolo especial.',
            'password.uncompromised' => 'Esta senha foi comprometida em vazamentos de dados. Por favor, escolha outra.',
            'password_confirmation.required' => 'A confirmação da senha é obrigatória.',
            'security_question.required' => 'A pergunta de segurança é obrigatória.',
            'security_answer.required' => 'A resposta de segurança é obrigatória.',
            'security_answer.min' => 'A resposta de segurança deve ter pelo menos 3 caracteres.',
        ];
    }

    /**
     * Get password strength info
     */
    public function getPasswordStrength(): array
    {
        $password = $this->input('password', '');
        $strength = 0;
        $feedback = [];

        // Length check
        if (strlen($password) >= 8) {
            $strength += 20;
        } else {
            $feedback[] = 'Mínimo 8 caracteres';
        }

        if (strlen($password) >= 12) {
            $strength += 10;
        }

        // Uppercase check
        if (preg_match('/[A-Z]/', $password)) {
            $strength += 20;
        } else {
            $feedback[] = 'Adicione letras maiúsculas';
        }

        // Lowercase check
        if (preg_match('/[a-z]/', $password)) {
            $strength += 20;
        } else {
            $feedback[] = 'Adicione letras minúsculas';
        }

        // Number check
        if (preg_match('/[0-9]/', $password)) {
            $strength += 20;
        } else {
            $feedback[] = 'Adicione números';
        }

        // Special character check
        if (preg_match('/[^A-Za-z0-9]/', $password)) {
            $strength += 10;
        } else {
            $feedback[] = 'Adicione símbolos especiais';
        }

        // Additional length bonus
        if (strlen($password) >= 16) {
            $strength += 10;
        }

        return [
            'score' => min($strength, 100),
            'feedback' => $feedback,
            'level' => $this->getStrengthLevel($strength),
        ];
    }

    /**
     * Get strength level based on score
     */
    private function getStrengthLevel(int $score): string
    {
        if ($score < 40) return 'weak';
        if ($score < 60) return 'fair';
        if ($score < 80) return 'good';
        return 'strong';
    }
}