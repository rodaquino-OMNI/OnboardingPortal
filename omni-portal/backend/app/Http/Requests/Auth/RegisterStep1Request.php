<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Services\BrazilianDocumentService;

class RegisterStep1Request extends FormRequest
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
            'name' => ['required', 'string', 'max:255', 'min:3'],
            'cpf' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $documentService = app(BrazilianDocumentService::class);
                    $validation = $documentService->validateCPF($value);
                    
                    if (!$validation['is_valid']) {
                        $fail(implode(' ', $validation['errors']));
                    }
                },
                Rule::unique('users', 'cpf'),
            ],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email'),
            ],
            'lgpd_consent' => [
                'required',
                'boolean',
                'accepted',
                function ($attribute, $value, $fail) {
                    // Strict LGPD consent validation
                    if (!$value || $value !== true) {
                        $fail('Você deve aceitar os termos da LGPD para prosseguir.');
                    }
                    
                    // Additional security check for explicit consent
                    if (!$this->has('lgpd_consent_explicit') || !$this->input('lgpd_consent_explicit')) {
                        $fail('Consentimento explícito da LGPD é obrigatório.');
                    }
                },
            ],
            'lgpd_consent_explicit' => ['required', 'boolean', 'accepted'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'O nome completo é obrigatório.',
            'name.min' => 'O nome deve ter pelo menos 3 caracteres.',
            'cpf.required' => 'O CPF é obrigatório.',
            'cpf.regex' => 'O CPF deve estar no formato XXX.XXX.XXX-XX ou conter 11 dígitos.',
            'cpf.unique' => 'Este CPF já está cadastrado no sistema.',
            'email.required' => 'O e-mail é obrigatório.',
            'email.email' => 'Por favor, insira um e-mail válido.',
            'email.unique' => 'Este e-mail já está cadastrado no sistema.',
            'lgpd_consent.required' => 'Você deve aceitar os termos da LGPD.',
            'lgpd_consent.accepted' => 'Você deve aceitar os termos da LGPD para continuar.',
            'lgpd_consent_explicit.required' => 'Consentimento explícito da LGPD é obrigatório.',
            'lgpd_consent_explicit.accepted' => 'Você deve dar consentimento explícito para o tratamento de dados pessoais.',
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // Clean CPF - remove dots and dashes using the document service
        if ($this->has('cpf')) {
            $documentService = app(BrazilianDocumentService::class);
            $this->merge([
                'cpf' => $documentService->cleanCPF($this->cpf)
            ]);
        }
    }

    // CPF validation is now handled by the BrazilianDocumentService
}