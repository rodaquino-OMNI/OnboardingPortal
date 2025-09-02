<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RegistrationController extends Controller
{
    /**
     * Step 1: Basic user information
     */
    public function step1(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'cpf' => 'required|string|max:14|unique:users',
            'lgpd_consent' => 'required|boolean|accepted'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Create user with basic info
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'cpf' => $request->cpf,
                'password' => Hash::make(uniqid()), // Temporary password
                'registration_step' => 1,
                'lgpd_consent' => true,
                'lgpd_consent_date' => now()
            ]);

            // Store registration progress in session
            session(['registration_user_id' => $user->id]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Step 1 completed successfully',
                'user_id' => $user->id,
                'registration_step' => 'step2',
                'token' => $user->createToken('registration')->plainTextToken
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration step 1 failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again.'
            ], 500);
        }
    }

    /**
     * Step 2: Additional profile information
     */
    public function step2(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|max:20',
            'department' => 'required|string|max:100',
            'job_title' => 'required|string|max:100',
            'employee_id' => 'required|string|max:50|unique:users',
            'start_date' => 'required|date',
            'birth_date' => 'nullable|date|before:today',
            'gender' => 'nullable|in:male,female,other,prefer_not_to_say',
            'marital_status' => 'nullable|in:single,married,divorced,widowed,other',
            'preferred_language' => 'nullable|string|max:10'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found. Please restart registration.'
                ], 404);
            }

            // Update user profile
            $user->update([
                'phone' => $request->phone,
                'department' => $request->department,
                'job_title' => $request->job_title,
                'employee_id' => $request->employee_id,
                'start_date' => $request->start_date,
                'birth_date' => $request->birth_date,
                'gender' => $request->gender,
                'marital_status' => $request->marital_status,
                'preferred_language' => $request->preferred_language ?? 'pt',
                'registration_step' => 2
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Step 2 completed successfully',
                'registration_step' => 'step3'
            ]);

        } catch (\Exception $e) {
            Log::error('Registration step 2 failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile. Please try again.'
            ], 500);
        }
    }

    /**
     * Step 3: Security settings
     */
    public function step3(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required',
            'security_question' => 'required|string|max:255',
            'security_answer' => 'required|string|max:255',
            'two_factor_enabled' => 'nullable|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found. Please restart registration.'
                ], 404);
            }

            // Update security settings
            $user->update([
                'password' => Hash::make($request->password),
                'security_question' => $request->security_question,
                'security_answer' => Hash::make($request->security_answer),
                'two_factor_enabled' => $request->two_factor_enabled ?? false,
                'registration_step' => 3,
                'registration_completed_at' => now(),
                'email_verified_at' => now() // Auto-verify for now
            ]);

            // Assign default role
            if (class_exists('Spatie\Permission\Models\Role')) {
                $userRole = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'user']);
                $user->assignRole($userRole);
            }

            // Award registration points (gamification)
            if (method_exists($user, 'awardPoints')) {
                $user->awardPoints(100, 'registration_completed');
            }

            return response()->json([
                'success' => true,
                'message' => 'Registration completed successfully',
                'user' => $user->fresh(),
                'token' => $user->createToken('auth')->plainTextToken,
                'token_type' => 'Bearer',
                'gamification' => [
                    'points_earned' => 100,
                    'total_points' => $user->points ?? 100,
                    'level' => $user->level ?? 1
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Registration step 3 failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete registration. Please try again.'
            ], 500);
        }
    }

    /**
     * Get registration progress
     */
    public function getProgress(Request $request)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $steps = [
            'step1' => [
                'completed' => $user->registration_step >= 1,
                'title' => 'Basic Information'
            ],
            'step2' => [
                'completed' => $user->registration_step >= 2,
                'title' => 'Profile Details'
            ],
            'step3' => [
                'completed' => $user->registration_step >= 3,
                'title' => 'Security Settings'
            ]
        ];

        return response()->json([
            'success' => true,
            'current_step' => 'step' . ($user->registration_step + 1),
            'steps' => $steps,
            'completed' => $user->registration_step >= 3
        ]);
    }

    /**
     * Cancel registration
     */
    public function cancel(Request $request)
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        // Only allow cancellation if registration not completed
        if ($user->registration_step >= 3) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot cancel completed registration'
            ], 400);
        }

        try {
            // Delete incomplete registration
            $user->tokens()->delete();
            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'Registration cancelled successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to cancel registration: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel registration'
            ], 500);
        }
    }
}