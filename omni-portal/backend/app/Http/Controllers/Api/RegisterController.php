<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterStep1Request;
use App\Http\Requests\Auth\RegisterStep2Request;
use App\Http\Requests\Auth\RegisterStep3Request;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;

class RegisterController extends Controller
{
    /**
     * Handle single-step registration
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|min:3',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'cpf' => 'required|string|size:11|unique:users',
        ]);

        try {
            DB::beginTransaction();
            
            // Sanitize user input before storing
            $sanitizedName = $this->sanitizeInput($request->name);
            $sanitizedEmail = strtolower(trim($request->email));
            $sanitizedCpf = preg_replace('/[^0-9]/', '', $request->cpf);
            
            // Create user
            $user = User::create([
                'name' => $sanitizedName,
                'email' => $sanitizedEmail,
                'cpf' => $sanitizedCpf,
                'password' => Hash::make($request->password),
                'registration_step' => 'completed',
                'lgpd_consent' => true,
                'lgpd_consent_at' => now(),
                'lgpd_consent_ip' => $request->ip(),
                'role' => 'beneficiary',
                'is_active' => true,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
            
            // Create beneficiary record - using nullable fields instead of placeholders
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'cpf' => $user->cpf,
                'full_name' => $user->name,
                // Required fields with temporary placeholder values
                'birth_date' => '2000-01-01', // Placeholder date
                'phone' => '00000000000', // Placeholder phone
                'address' => 'A ser preenchido', // Placeholder address
                'number' => '0', // Placeholder number
                'neighborhood' => 'A ser preenchido', // Placeholder neighborhood
                'city' => 'A ser preenchido', // Placeholder city
                'state' => 'SP', // Default state
                'zip_code' => '00000-000', // Placeholder zip
                'onboarding_status' => 'in_progress',
                'onboarding_completed_at' => null,
            ]);
            
            // Initialize gamification progress
            $gamification = GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'total_points' => 100,
                'current_level' => 1,
                'last_activity_date' => now()->toDateString(),
            ]);
            
            DB::commit();
            
            // Create token
            $token = $user->createToken('web')->plainTextToken;
            
            // Load relationships
            $user->load(['beneficiary', 'beneficiary.gamificationProgress']);
            
            return response()->json([
                'message' => 'Registration successful',
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer',
            ], 201)->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration error: ' . $e->getMessage(), [
                'request_data' => $request->except(['password', 'password_confirmation']),
                'user_agent' => $request->userAgent(),
                'ip' => $request->ip()
            ]);
            
            return response()->json([
                'message' => 'Registration failed',
                'error' => 'An error occurred during registration. Please try again.',
                'code' => 'REGISTRATION_ERROR'
            ], 500)->header('Content-Type', 'application/json');
        }
    }

    /**
     * Handle step 1 of registration (personal info + LGPD)
     */
    public function step1(RegisterStep1Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();
            
            // Sanitize input before storing
            $sanitizedName = $this->sanitizeInput($request->name);
            $sanitizedEmail = strtolower(trim($request->email));
            $sanitizedCpf = preg_replace('/[^0-9]/', '', $request->cpf);
            
            // Create user with basic info
            $user = User::create([
                'name' => $sanitizedName,
                'email' => $sanitizedEmail,
                'cpf' => $sanitizedCpf,
                'password' => Hash::make(uniqid()), // Temporary password
                'registration_step' => 'contact',
                'lgpd_consent' => (bool) $request->lgpd_consent,
                'lgpd_consent_explicit' => (bool) $request->lgpd_consent_explicit,
                'lgpd_consent_at' => now(),
                'lgpd_consent_ip' => $request->ip(),
                'role' => 'beneficiary',
                'is_active' => false, // Will be activated after completion
            ]);
            
            // Create beneficiary record - using nullable fields instead of placeholders
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'cpf' => $user->cpf,
                'full_name' => $user->name,
                // Required fields with temporary placeholder values
                'birth_date' => '2000-01-01', // Placeholder date
                'phone' => '00000000000', // Placeholder phone
                'address' => 'A ser preenchido', // Placeholder address
                'number' => '0', // Placeholder number
                'neighborhood' => 'A ser preenchido', // Placeholder neighborhood
                'city' => 'A ser preenchido', // Placeholder city
                'state' => 'SP', // Default state
                'zip_code' => '00000-000', // Placeholder zip
                'onboarding_status' => 'in_progress',
                'onboarding_completed_at' => null,
            ]);
            
            // Initialize gamification progress
            $gamification = GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'total_points' => 100,
                'current_level' => 1,
                'last_activity_date' => now()->toDateString(),
            ]);
            
            DB::commit();
            
            // Create temporary token for next steps
            $token = $user->createToken('registration')->plainTextToken;
            
            return response()->json([
                'message' => 'Etapa 1 concluída com sucesso',
                'user_id' => $user->id,
                'registration_step' => 'contact',
                'token' => $token,
                'token_type' => 'Bearer',
            ], 201)->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration step 1 error: ' . $e->getMessage(), [
                'request_data' => $request->except(['password', 'password_confirmation']),
                'user_agent' => $request->userAgent(),
                'ip' => $request->ip()
            ]);
            
            return response()->json([
                'message' => 'Erro ao processar registro',
                'error' => 'Ocorreu um erro ao criar sua conta. Por favor, tente novamente.',
                'code' => 'REGISTRATION_STEP1_ERROR'
            ], 500)->header('Content-Type', 'application/json');
        }
    }
    
    /**
     * Handle step 2 of registration (contact and work info)
     */
    public function step2(RegisterStep2Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Verify user is in correct step
        if ($user->registration_step !== 'contact') {
            throw ValidationException::withMessages([
                'step' => ['Etapa de registro inválida.'],
            ]);
        }
        
        try {
            // Update user with contact info
            $user->update([
                'phone' => $request->phone,
                'department' => $request->department,
                'job_title' => $request->job_title,
                'employee_id' => $request->employee_id,
                'start_date' => $request->start_date,
                'preferred_language' => $request->input('preferred_language', 'pt-BR'),
                'registration_step' => 'security',
            ]);
            
            // Update beneficiary with all validated data - NO MORE PLACEHOLDERS
            $beneficiaryData = [
                'birth_date' => $request->birth_date,
                'gender' => $request->gender,
                'marital_status' => $request->marital_status,
                'phone' => $request->phone, // Update phone in beneficiary too
            ];

            // Add optional address fields if provided
            if ($request->filled('address')) {
                $beneficiaryData['address'] = $request->address;
            }
            if ($request->filled('number')) {
                $beneficiaryData['number'] = $request->number;
            }
            if ($request->filled('complement')) {
                $beneficiaryData['complement'] = $request->complement;
            }
            if ($request->filled('neighborhood')) {
                $beneficiaryData['neighborhood'] = $request->neighborhood;
            }
            if ($request->filled('city')) {
                $beneficiaryData['city'] = $request->city;
            }
            if ($request->filled('state')) {
                $beneficiaryData['state'] = $request->state;
            }
            if ($request->filled('zip_code')) {
                $beneficiaryData['zip_code'] = $request->zip_code;
            }
            if ($request->filled('emergency_contact_name')) {
                $beneficiaryData['emergency_contact_name'] = $request->emergency_contact_name;
            }
            if ($request->filled('emergency_contact_phone')) {
                $beneficiaryData['emergency_contact_phone'] = $request->emergency_contact_phone;
            }
            if ($request->filled('emergency_contact_relationship')) {
                $beneficiaryData['emergency_contact_relationship'] = $request->emergency_contact_relationship;
            }

            $user->beneficiary->update($beneficiaryData);
            
            return response()->json([
                'message' => 'Etapa 2 concluída com sucesso',
                'registration_step' => 'security',
            ])->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            Log::error('Registration step 2 error: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'request_data' => $request->except(['password', 'password_confirmation']),
            ]);
            
            return response()->json([
                'message' => 'Erro ao atualizar informações',
                'error' => 'Ocorreu um erro ao salvar suas informações. Por favor, tente novamente.',
                'code' => 'REGISTRATION_STEP2_ERROR'
            ], 500)->header('Content-Type', 'application/json');
        }
    }
    
    /**
     * Handle step 3 of registration (security)
     */
    public function step3(RegisterStep3Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Verify user is in correct step
        if ($user->registration_step !== 'security') {
            throw ValidationException::withMessages([
                'step' => ['Etapa de registro inválida.'],
            ]);
        }
        
        try {
            DB::beginTransaction();
            
            // Update user with security info
            $user->update([
                'password' => Hash::make($request->password),
                'registration_step' => 'completed',
                'is_active' => true,
                'status' => 'active',
                'email_verified_at' => now(), // Auto-verify for now
            ]);
            
            // Store security question (you might want to encrypt this)
            $user->update([
                'preferences' => array_merge($user->preferences ?? [], [
                    'security_question' => $request->security_question,
                    'security_answer' => Hash::make(strtolower($request->security_answer)),
                    'two_factor_enabled' => $request->input('two_factor_enabled', false),
                ]),
            ]);
            
            // Update beneficiary onboarding status - Move from profile_incomplete to in_progress
            $user->beneficiary->update([
                'onboarding_status' => 'in_progress',
            ]);
            
            // Award registration points (gamification)
            $gamification = $user->beneficiary->gamificationProgress;
            if ($gamification) {
                $gamification->update([
                    'total_points' => $gamification->total_points + 100,
                ]);
            }
            
            // Assign default role
            $user->assignRole('beneficiary');
            
            DB::commit();
            
            // Revoke registration token
            $user->currentAccessToken()->delete();
            
            // Create new authenticated token
            $token = $user->createToken('web')->plainTextToken;
            
            // Load relationships
            $user->load(['roles', 'beneficiary', 'gamificationProgress']);
            
            return response()->json([
                'message' => 'Registro concluído com sucesso! Você ganhou 100 pontos!',
                'user' => $user,
                'token' => $token,
                'token_type' => 'Bearer',
                'gamification' => [
                    'points_earned' => 100,
                    'total_points' => $gamification->total_points ?? 0,
                    'level' => $gamification->current_level ?? 1,
                ],
            ])->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration step 3 error: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'request_data' => $request->except(['password', 'password_confirmation', 'security_answer']),
            ]);
            
            return response()->json([
                'message' => 'Erro ao finalizar registro',
                'error' => 'Ocorreu um erro ao completar seu registro. Por favor, tente novamente.',
                'code' => 'REGISTRATION_STEP3_ERROR'
            ], 500)->header('Content-Type', 'application/json');
        }
    }
    
    /**
     * Get current registration progress
     */
    public function progress(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $steps = [
            'personal' => [
                'completed' => true,
                'title' => 'Informações Pessoais',
            ],
            'contact' => [
                'completed' => in_array($user->registration_step, ['contact', 'security', 'completed']),
                'title' => 'Informações de Contato',
            ],
            'security' => [
                'completed' => in_array($user->registration_step, ['security', 'completed']),
                'title' => 'Segurança',
            ],
        ];
        
        return response()->json([
            'current_step' => $user->registration_step,
            'steps' => $steps,
            'completed' => $user->isRegistrationCompleted(),
        ])->header('Content-Type', 'application/json');
    }
    
    /**
     * Validate profile completion based on required fields
     */
    public function validateProfileCompletion(Request $request): JsonResponse
    {
        $user = $request->user();
        $beneficiary = $user->beneficiary;
        
        $requiredFields = [
            'birth_date' => $beneficiary->birth_date,
            'gender' => $beneficiary->gender,
            'marital_status' => $beneficiary->marital_status,
            'phone' => $beneficiary->phone,
        ];
        
        $missingFields = [];
        $hasPlaceholders = false;
        
        foreach ($requiredFields as $field => $value) {
            if (empty($value)) {
                $missingFields[] = $field;
            }
            
            // Check for old placeholder values that might still exist
            if ($this->isPlaceholderValue($field, $value)) {
                $hasPlaceholders = true;
                $missingFields[] = $field . ' (placeholder detected)';
            }
        }
        
        $isComplete = empty($missingFields) && !$hasPlaceholders;
        
        return response()->json([
            'is_complete' => $isComplete,
            'missing_fields' => $missingFields,
            'completion_percentage' => $this->calculateCompletionPercentage($beneficiary),
            'profile_quality_score' => $this->calculateProfileQualityScore($beneficiary),
        ])->header('Content-Type', 'application/json');
    }
    
    /**
     * Check if a value is a placeholder or invalid data
     */
    private function isPlaceholderValue(string $field, $value): bool
    {
        if (empty($value) || is_null($value)) return true;
        
        // Legacy placeholder patterns that should be considered invalid
        $legacyPlaceholders = [
            'birth_date' => ['2000-01-01', '1900-01-01'],
            'phone' => ['11999999999', '(11) 99999-9999', '00000000000'],
            'address' => ['TBD', 'To be updated', 'A ser atualizado', 'Pending'],
            'city' => ['TBD', 'To be updated', 'A ser atualizado', 'Pending'],
            'neighborhood' => ['TBD', 'To be updated', 'A ser atualizado', 'Pending'],
            'zip_code' => ['00000-000', '0000-000'],
            'number' => ['0', 'TBD'],
        ];
        
        return isset($legacyPlaceholders[$field]) && in_array($value, $legacyPlaceholders[$field]);
    }
    
    /**
     * Calculate profile completion percentage
     */
    private function calculateCompletionPercentage($beneficiary): int
    {
        $totalFields = 15; // Total relevant profile fields
        $completedFields = 0;
        
        $fields = [
            'birth_date', 'gender', 'marital_status', 'phone', 'address', 
            'city', 'state', 'zip_code', 'emergency_contact_name', 
            'emergency_contact_phone', 'emergency_contact_relationship',
            'occupation', 'monthly_income', 'has_health_insurance',
            'health_insurance_provider'
        ];
        
        foreach ($fields as $field) {
            if (!empty($beneficiary->$field) && !$this->isPlaceholderValue($field, $beneficiary->$field)) {
                $completedFields++;
            }
        }
        
        return round(($completedFields / $totalFields) * 100);
    }
    
    /**
     * Calculate profile quality score (0-100)
     */
    private function calculateProfileQualityScore($beneficiary): int
    {
        $score = 0;
        
        // Essential fields (60 points total)
        $essentialFields = ['birth_date', 'gender', 'marital_status', 'phone'];
        foreach ($essentialFields as $field) {
            if (!empty($beneficiary->$field) && !$this->isPlaceholderValue($field, $beneficiary->$field)) {
                $score += 15;
            }
        }
        
        // Important fields (30 points total)
        $importantFields = ['address', 'city', 'state', 'zip_code', 'emergency_contact_name', 'emergency_contact_phone'];
        foreach ($importantFields as $field) {
            if (!empty($beneficiary->$field) && !$this->isPlaceholderValue($field, $beneficiary->$field)) {
                $score += 5;
            }
        }
        
        // Additional fields (10 points total)
        $additionalFields = ['occupation', 'monthly_income', 'health_insurance_provider'];
        foreach ($additionalFields as $field) {
            if (!empty($beneficiary->$field)) {
                $score += 3;
            }
        }
        
        return min($score, 100);
    }

    /**
     * Sanitize input to prevent XSS and other injection attacks
     */
    private function sanitizeInput(?string $input): ?string
    {
        if (empty($input)) {
            return $input;
        }
        
        // Remove HTML tags and encode special characters
        $sanitized = strip_tags($input);
        $sanitized = htmlspecialchars($sanitized, ENT_QUOTES, 'UTF-8');
        
        return trim($sanitized);
    }

    /**
     * Sanitize user output to prevent XSS
     */
    private function sanitizeUserOutput($user): array
    {
        $userData = $user->toArray();
        
        // Sanitize string fields that might contain user input
        $stringFields = ['name', 'email', 'department', 'job_title'];
        
        foreach ($stringFields as $field) {
            if (isset($userData[$field]) && is_string($userData[$field])) {
                $userData[$field] = htmlspecialchars($userData[$field], ENT_QUOTES, 'UTF-8');
            }
        }
        
        // Sanitize nested beneficiary data if present
        if (isset($userData['beneficiary']) && is_array($userData['beneficiary'])) {
            $beneficiaryStringFields = ['full_name', 'address', 'city', 'state', 'neighborhood'];
            
            foreach ($beneficiaryStringFields as $field) {
                if (isset($userData['beneficiary'][$field]) && is_string($userData['beneficiary'][$field])) {
                    $userData['beneficiary'][$field] = htmlspecialchars($userData['beneficiary'][$field], ENT_QUOTES, 'UTF-8');
                }
            }
        }
        
        return $userData;
    }

    /**
     * Cancel registration and delete incomplete account
     */
    public function cancel(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Only allow cancellation if registration is not completed
        if ($user->isRegistrationCompleted()) {
            throw ValidationException::withMessages([
                'registration' => ['Não é possível cancelar um registro já concluído.'],
            ]);
        }
        
        try {
            DB::beginTransaction();
            
            // Delete related records
            $user->beneficiary?->gamificationProgress?->delete();
            $user->beneficiary?->delete();
            $user->tokens()->delete();
            $user->delete();
            
            DB::commit();
            
            return response()->json([
                'message' => 'Registro cancelado com sucesso',
            ])->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration cancellation error: ' . $e->getMessage(), [
                'user_id' => $user->id,
            ]);
            
            return response()->json([
                'message' => 'Erro ao cancelar registro',
                'error' => 'Ocorreu um erro ao cancelar o registro. Por favor, tente novamente.',
                'code' => 'REGISTRATION_CANCEL_ERROR'
            ], 500)->header('Content-Type', 'application/json');
        }
    }
}