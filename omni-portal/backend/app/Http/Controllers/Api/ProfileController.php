<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfileRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    /**
     * Get user profile
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['beneficiary', 'gamificationProgress', 'roles']);
        
        return response()->json([
            'user' => $user,
            'profile_completion' => $this->calculateProfileCompletion($user),
        ]);
    }
    
    /**
     * Update user profile
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        
        // Check current password if changing password
        if ($request->filled('new_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['A senha atual está incorreta.'],
                ]);
            }
        }
        
        // Update basic info
        $userData = $request->only(['name', 'email', 'phone', 'department', 'job_title', 'preferred_language']);
        
        // Update password if provided
        if ($request->filled('new_password')) {
            $userData['password'] = Hash::make($request->new_password);
        }
        
        // Update preferences if provided
        if ($request->has('preferences')) {
            $userData['preferences'] = array_merge(
                $user->preferences ?? [],
                $request->input('preferences')
            );
        }
        
        $user->update($userData);
        
        // Update beneficiary info if provided
        if ($user->beneficiary && $request->hasAny(['birth_date', 'gender', 'marital_status'])) {
            $user->beneficiary->update(
                $request->only(['birth_date', 'gender', 'marital_status'])
            );
        }
        
        return response()->json([
            'message' => 'Perfil atualizado com sucesso',
            'user' => $user->fresh(['beneficiary', 'gamificationProgress', 'roles']),
        ]);
    }
    
    /**
     * Upload profile photo
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpeg,png,jpg', 'max:2048'], // 2MB max
        ]);
        
        $user = $request->user();
        
        try {
            // Delete old photo if exists
            if ($user->beneficiary && $user->beneficiary->photo_url) {
                Storage::disk('public')->delete($user->beneficiary->photo_url);
            }
            
            // Store new photo
            $path = $request->file('photo')->store('profile-photos', 'public');
            
            // Update beneficiary record
            if ($user->beneficiary) {
                $user->beneficiary->update([
                    'photo_url' => $path,
                ]);
            }
            
            return response()->json([
                'message' => 'Foto de perfil atualizada com sucesso',
                'photo_url' => Storage::url($path),
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao fazer upload da foto',
                'error' => 'Não foi possível processar a imagem. Por favor, tente novamente.',
            ], 500);
        }
    }
    
    /**
     * Delete profile photo
     */
    public function deletePhoto(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if ($user->beneficiary && $user->beneficiary->photo_url) {
            // Delete photo file
            Storage::disk('public')->delete($user->beneficiary->photo_url);
            
            // Update database
            $user->beneficiary->update([
                'photo_url' => null,
            ]);
        }
        
        return response()->json([
            'message' => 'Foto de perfil removida com sucesso',
        ]);
    }
    
    /**
     * Get user preferences
     */
    public function preferences(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $defaultPreferences = [
            'notifications' => true,
            'email_notifications' => true,
            'theme' => 'light',
            'language' => $user->preferred_language ?? 'pt-BR',
        ];
        
        $preferences = array_merge($defaultPreferences, $user->preferences ?? []);
        
        return response()->json([
            'preferences' => $preferences,
        ]);
    }
    
    /**
     * Update user preferences
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.notifications' => ['sometimes', 'boolean'],
            'preferences.email_notifications' => ['sometimes', 'boolean'],
            'preferences.theme' => ['sometimes', 'string', 'in:light,dark,auto'],
            'preferences.language' => ['sometimes', 'string', 'in:pt-BR,en,es'],
        ]);
        
        $user = $request->user();
        
        $user->update([
            'preferences' => array_merge(
                $user->preferences ?? [],
                $request->input('preferences')
            ),
        ]);
        
        // Update preferred language if changed
        if ($request->has('preferences.language')) {
            $user->update([
                'preferred_language' => $request->input('preferences.language'),
            ]);
        }
        
        return response()->json([
            'message' => 'Preferências atualizadas com sucesso',
            'preferences' => $user->preferences,
        ]);
    }
    
    /**
     * Get security settings
     */
    public function security(Request $request): JsonResponse
    {
        $user = $request->user();
        $preferences = $user->preferences ?? [];
        
        return response()->json([
            'two_factor_enabled' => $preferences['two_factor_enabled'] ?? false,
            'has_security_question' => isset($preferences['security_question']),
            'last_login_at' => $user->last_login_at,
            'last_login_ip' => $user->last_login_ip,
        ]);
    }
    
    /**
     * Calculate profile completion percentage
     */
    private function calculateProfileCompletion($user): array
    {
        $fields = [
            'name' => 10,
            'email' => 10,
            'cpf' => 10,
            'phone' => 10,
            'department' => 5,
            'job_title' => 5,
            'employee_id' => 5,
            'start_date' => 5,
        ];
        
        $beneficiaryFields = [
            'photo_url' => 10,
            'birth_date' => 10,
            'gender' => 5,
            'marital_status' => 5,
            'emergency_contact_name' => 5,
            'emergency_contact_phone' => 5,
        ];
        
        $completed = 0;
        
        // Check user fields
        foreach ($fields as $field => $weight) {
            if (!empty($user->$field)) {
                $completed += $weight;
            }
        }
        
        // Check beneficiary fields
        if ($user->beneficiary) {
            foreach ($beneficiaryFields as $field => $weight) {
                if (!empty($user->beneficiary->$field)) {
                    $completed += $weight;
                }
            }
        }
        
        return [
            'percentage' => $completed,
            'completed' => $completed === 100,
        ];
    }
}