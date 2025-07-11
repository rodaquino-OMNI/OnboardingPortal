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

class RegisterController extends Controller
{
    /**
     * Handle step 1 of registration (personal info + LGPD)
     */
    public function step1(RegisterStep1Request $request): JsonResponse
    {
        try {
            DB::beginTransaction();
            
            // Create user with basic info
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'cpf' => $request->cpf,
                'password' => Hash::make(uniqid()), // Temporary password
                'registration_step' => 'contact',
                'lgpd_consent' => true,
                'lgpd_consent_at' => now(),
                'lgpd_consent_ip' => $request->ip(),
                'role' => 'beneficiary',
                'is_active' => false, // Will be activated after completion
            ]);
            
            // Create beneficiary record
            $beneficiary = Beneficiary::create([
                'user_id' => $user->id,
                'cpf' => $user->cpf,
                'onboarding_status' => 'registration',
                'onboarding_completed_at' => null,
            ]);
            
            // Initialize gamification progress
            $gamification = GamificationProgress::create([
                'beneficiary_id' => $beneficiary->id,
                'points' => 0,
                'level' => 1,
                'badges_earned' => 0,
                'last_activity_at' => now(),
            ]);
            
            DB::commit();
            
            // Create temporary token for next steps
            $token = $user->createToken('registration')->plainTextToken;
            
            return response()->json([
                'message' => 'Etapa 1 concluída com sucesso',
                'user_id' => $user->id,
                'registration_step' => 'contact',
                'token' => $token,
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration step 1 error: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Erro ao processar registro',
                'error' => 'Ocorreu um erro ao criar sua conta. Por favor, tente novamente.',
            ], 500);
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
            
            // Update beneficiary
            $user->beneficiary->update([
                'birth_date' => $request->input('birth_date'),
                'gender' => $request->input('gender'),
                'marital_status' => $request->input('marital_status'),
            ]);
            
            return response()->json([
                'message' => 'Etapa 2 concluída com sucesso',
                'registration_step' => 'security',
            ]);
            
        } catch (\Exception $e) {
            Log::error('Registration step 2 error: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Erro ao atualizar informações',
                'error' => 'Ocorreu um erro ao salvar suas informações. Por favor, tente novamente.',
            ], 500);
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
            
            // Update beneficiary onboarding status
            $user->beneficiary->update([
                'onboarding_status' => 'documents',
            ]);
            
            // Award registration points (gamification)
            $gamification = $user->beneficiary->gamificationProgress;
            $gamification->addPoints(100, 'registration_completed');
            
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
                    'total_points' => $gamification->points,
                    'level' => $gamification->level,
                ],
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration step 3 error: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Erro ao finalizar registro',
                'error' => 'Ocorreu um erro ao completar seu registro. Por favor, tente novamente.',
            ], 500);
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
        ]);
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
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration cancellation error: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Erro ao cancelar registro',
            ], 500);
        }
    }
}