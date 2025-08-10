<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class RegistrationStateValidator
{
    /**
     * Valid state transitions for registration flow
     */
    private const STATE_TRANSITIONS = [
        null => ['personal'],  // Initial state can only go to personal
        'personal' => ['contact'],  // Personal info must be completed before contact
        'contact' => ['security'],  // Contact info must be completed before security
        'security' => ['completed'],  // Security completes the registration
        'completed' => [],  // No transitions after completion
    ];
    
    /**
     * Maximum time allowed per step (in minutes)
     */
    private const STEP_TIMEOUT = [
        'personal' => 15,
        'contact' => 15,
        'security' => 10,
    ];
    
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  $expectedStep
     * @return mixed
     */
    public function handle(Request $request, Closure $next, string $expectedStep = null)
    {
        $user = $request->user();
        
        // For authenticated users, validate registration state
        if ($user) {
            $this->validateUserState($user, $expectedStep, $request);
        } else {
            // For unauthenticated requests (like step1), validate request integrity
            $this->validateRequestIntegrity($request, $expectedStep);
        }
        
        // Store state transition attempt for audit
        $this->auditStateTransition($request, $expectedStep);
        
        $response = $next($request);
        
        // After successful processing, update state tracking
        if ($response->isSuccessful() && $user) {
            $this->updateStateTracking($user, $expectedStep);
        }
        
        return $response;
    }
    
    /**
     * Validate user's current registration state
     */
    private function validateUserState($user, ?string $expectedStep, Request $request): void
    {
        $currentStep = $user->registration_step;
        
        // Check if user is trying to access the correct step
        if ($expectedStep && $currentStep !== $this->getPreviousStep($expectedStep)) {
            Log::warning('Registration state violation', [
                'user_id' => $user->id,
                'current_step' => $currentStep,
                'attempted_step' => $expectedStep,
                'ip' => $request->ip()
            ]);
            
            throw ValidationException::withMessages([
                'step' => ['Você deve completar as etapas anteriores primeiro.'],
            ]);
        }
        
        // Validate step completion time
        $this->validateStepTimeout($user, $currentStep);
        
        // Validate data integrity from previous steps
        $this->validatePreviousStepsData($user, $expectedStep);
        
        // Check for suspicious patterns
        $this->detectSuspiciousActivity($user, $request);
    }
    
    /**
     * Validate request integrity for unauthenticated requests
     */
    private function validateRequestIntegrity(Request $request, ?string $expectedStep): void
    {
        // For step1, ensure no previous registration attempts from same IP/email
        if ($expectedStep === 'personal') {
            $email = $request->input('email');
            $ip = $request->ip();
            
            // Check rate limiting for registration attempts
            $cacheKey = "registration_attempt:{$ip}:{$email}";
            $attempts = Cache::get($cacheKey, 0);
            
            if ($attempts >= 3) {
                Log::warning('Too many registration attempts', [
                    'email' => $email,
                    'ip' => $ip,
                    'attempts' => $attempts
                ]);
                
                throw ValidationException::withMessages([
                    'email' => ['Muitas tentativas de registro. Por favor, aguarde 30 minutos.'],
                ]);
            }
            
            // Increment attempts
            Cache::put($cacheKey, $attempts + 1, now()->addMinutes(30));
        }
    }
    
    /**
     * Validate step timeout
     */
    private function validateStepTimeout($user, string $currentStep): void
    {
        if (!isset(self::STEP_TIMEOUT[$currentStep])) {
            return;
        }
        
        $stepStartTime = Cache::get("registration_step_start:{$user->id}:{$currentStep}");
        
        if ($stepStartTime && Carbon::parse($stepStartTime)->diffInMinutes(now()) > self::STEP_TIMEOUT[$currentStep]) {
            // Reset registration due to timeout
            $user->update(['registration_step' => null]);
            Cache::forget("registration_step_start:{$user->id}:{$currentStep}");
            
            Log::warning('Registration step timeout', [
                'user_id' => $user->id,
                'step' => $currentStep,
                'started_at' => $stepStartTime
            ]);
            
            throw ValidationException::withMessages([
                'timeout' => ['Sua sessão de registro expirou. Por favor, comece novamente.'],
            ]);
        }
    }
    
    /**
     * Validate data from previous steps
     */
    private function validatePreviousStepsData($user, ?string $expectedStep): void
    {
        if (!$expectedStep) return;
        
        $validations = [
            'contact' => function($user) {
                // Validate personal info was properly saved
                if (empty($user->name) || empty($user->email) || empty($user->cpf)) {
                    throw ValidationException::withMessages([
                        'data' => ['Informações pessoais incompletas. Por favor, reinicie o registro.'],
                    ]);
                }
                
                // Validate LGPD consent
                if (!$user->lgpd_consent || !$user->lgpd_consent_at) {
                    throw ValidationException::withMessages([
                        'lgpd' => ['Consentimento LGPD não registrado.'],
                    ]);
                }
            },
            'security' => function($user) {
                // Validate contact info was properly saved
                if (empty($user->phone) || empty($user->department) || empty($user->job_title)) {
                    throw ValidationException::withMessages([
                        'data' => ['Informações de contato incompletas.'],
                    ]);
                }
                
                // Validate beneficiary record exists with required data
                $beneficiary = $user->beneficiary;
                if (!$beneficiary || empty($beneficiary->birth_date) || empty($beneficiary->gender)) {
                    throw ValidationException::withMessages([
                        'data' => ['Informações do beneficiário incompletas.'],
                    ]);
                }
            },
        ];
        
        if (isset($validations[$expectedStep])) {
            $validations[$expectedStep]($user);
        }
    }
    
    /**
     * Detect suspicious registration patterns
     */
    private function detectSuspiciousActivity($user, Request $request): void
    {
        $suspiciousPatterns = [];
        
        // Check for rapid step progression
        $lastActivity = Cache::get("registration_activity:{$user->id}");
        if ($lastActivity && Carbon::parse($lastActivity)->diffInSeconds(now()) < 5) {
            $suspiciousPatterns[] = 'rapid_progression';
        }
        
        // Check for IP changes during registration
        $registrationIp = Cache::get("registration_ip:{$user->id}");
        if ($registrationIp && $registrationIp !== $request->ip()) {
            $suspiciousPatterns[] = 'ip_change';
        }
        
        // Check for user agent changes
        $registrationAgent = Cache::get("registration_agent:{$user->id}");
        if ($registrationAgent && $registrationAgent !== $request->userAgent()) {
            $suspiciousPatterns[] = 'agent_change';
        }
        
        if (!empty($suspiciousPatterns)) {
            Log::warning('Suspicious registration activity detected', [
                'user_id' => $user->id,
                'patterns' => $suspiciousPatterns,
                'ip' => $request->ip()
            ]);
            
            // For high-risk patterns, block the registration
            if (count($suspiciousPatterns) >= 2) {
                throw ValidationException::withMessages([
                    'security' => ['Atividade suspeita detectada. Por favor, contate o suporte.'],
                ]);
            }
        }
        
        // Update tracking
        Cache::put("registration_activity:{$user->id}", now(), now()->addHours(1));
        Cache::put("registration_ip:{$user->id}", $request->ip(), now()->addHours(1));
        Cache::put("registration_agent:{$user->id}", $request->userAgent(), now()->addHours(1));
    }
    
    /**
     * Audit state transition attempts
     */
    private function auditStateTransition(Request $request, ?string $expectedStep): void
    {
        $user = $request->user();
        
        Log::info('Registration state transition attempt', [
            'user_id' => $user?->id,
            'current_step' => $user?->registration_step,
            'target_step' => $expectedStep,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'timestamp' => now()->toIso8601String()
        ]);
    }
    
    /**
     * Update state tracking after successful step completion
     */
    private function updateStateTracking($user, ?string $completedStep): void
    {
        if (!$completedStep) return;
        
        // Store step completion time
        Cache::put(
            "registration_step_completed:{$user->id}:{$completedStep}",
            now(),
            now()->addDays(1)
        );
        
        // Set start time for next step if applicable
        $nextStep = $this->getNextStep($completedStep);
        if ($nextStep) {
            Cache::put(
                "registration_step_start:{$user->id}:{$nextStep}",
                now(),
                now()->addHours(1)
            );
        }
    }
    
    /**
     * Get previous step in registration flow
     */
    private function getPreviousStep(string $step): ?string
    {
        $steps = array_keys(self::STATE_TRANSITIONS);
        $currentIndex = array_search($step, $steps);
        
        return $currentIndex > 0 ? $steps[$currentIndex - 1] : null;
    }
    
    /**
     * Get next step in registration flow
     */
    private function getNextStep(string $step): ?string
    {
        return self::STATE_TRANSITIONS[$step][0] ?? null;
    }
}