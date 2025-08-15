<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ProfileController extends Controller
{
    /**
     * Get complete profile data for authenticated user
     */
    public function show(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            // Load all related data with eager loading
            $user->load([
                'beneficiary.healthQuestionnaires' => function($query) {
                    $query->latest()->limit(1);
                },
                'beneficiary.company',
                'gamificationProgress'
            ]);
            
            // Get health questionnaire data (now loaded via eager loading)
            $healthData = $user->beneficiary?->healthQuestionnaires->first();
            
            // Parse emergency contacts from beneficiary table
            $emergencyContacts = [];
            if ($user->beneficiary) {
                if ($user->beneficiary->emergency_contact_name) {
                    $emergencyContacts[] = [
                        'id' => '1',
                        'name' => $user->beneficiary->emergency_contact_name,
                        'phone' => $user->beneficiary->emergency_contact_phone,
                        'relationship' => $user->beneficiary->emergency_contact_relationship,
                        'isPrimary' => true
                    ];
                }
            }
            
            // Get documents separately
            $documentsQuery = Document::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();
            
            // Format documents
            $documents = $documentsQuery->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'type' => $doc->type,
                    'name' => $doc->filename ?? $doc->type,
                    'status' => $doc->status,
                    'uploadDate' => $doc->created_at->format('Y-m-d'),
                    'expiryDate' => $doc->expiry_date?->format('Y-m-d'),
                    'file_path' => $doc->file_path
                ];
            });
            
            // Format health information
            $healthInfo = null;
            if ($healthData) {
                $healthInfo = [
                    'bloodType' => $healthData->blood_type,
                    'allergies' => json_decode($healthData->allergies ?? '[]', true) ?: [],
                    'chronicConditions' => json_decode($healthData->chronic_conditions ?? '[]', true) ?: [],
                    'medications' => json_decode($healthData->current_medications ?? '[]', true) ?: [],
                    'lastCheckup' => $healthData->last_medical_checkup,
                    'healthRiskScore' => $this->calculateHealthRiskScore($healthData),
                    'preventiveCareStatus' => $this->calculatePreventiveCareStatus($healthData)
                ];
            }
            
            // Format insurance information
            $insuranceInfo = null;
            if ($user->beneficiary) {
                $insuranceInfo = [
                    'planName' => $user->beneficiary->health_insurance_provider ?? 'AUSTA Premium',
                    'planType' => 'Coparticipação',
                    'memberSince' => $user->created_at->format('Y-m-d'),
                    'memberNumber' => $user->beneficiary->health_insurance_number,
                    'coverage' => ['Consultas', 'Exames', 'Internação', 'Emergência', 'Telemedicina'],
                    'benefitsUsed' => 35, // This would come from usage tracking
                    'nextRenewal' => now()->addYear()->format('Y-m-d')
                ];
            }
            
            // Format profile data
            $profileData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'cpf' => $user->cpf,
                'phone' => $user->phone ?? $user->beneficiary?->phone,
                'birthDate' => $user->beneficiary?->birth_date,
                'gender' => $user->beneficiary?->gender,
                'address' => [
                    'street' => $user->beneficiary?->address,
                    'number' => $user->beneficiary?->number,
                    'complement' => $user->beneficiary?->complement,
                    'neighborhood' => $user->beneficiary?->neighborhood,
                    'city' => $user->beneficiary?->city,
                    'state' => $user->beneficiary?->state,
                    'zipCode' => $user->beneficiary?->zip_code
                ],
                'company' => $user->beneficiary?->company?->name ?? 'AUSTA',
                'department' => $user->department,
                'position' => $user->job_title,
                'employeeId' => $user->employee_id,
                'startDate' => $user->start_date,
                'status' => $user->status,
                'onboardingStatus' => $user->beneficiary?->onboarding_status,
                'onboardingStep' => $user->beneficiary?->onboarding_step,
                'lgpdConsent' => $user->lgpd_consent,
                'lgpdConsentAt' => $user->lgpd_consent_at
            ];
            
            // Get recent activity
            $recentActivity = $this->getRecentActivity($user);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'profile' => $profileData,
                    'health' => $healthInfo,
                    'emergencyContacts' => $emergencyContacts,
                    'documents' => $documents,
                    'insurance' => $insuranceInfo,
                    'gamification' => [
                        'points' => $user->gamificationProgress?->total_points ?? 0,
                        'level' => $user->gamificationProgress?->current_level ?? 1,
                        'badges' => [] // TODO: Implement badge loading
                    ],
                    'recentActivity' => $recentActivity
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error fetching profile:', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar dados do perfil'
            ], 500);
        }
    }
    
    /**
     * Update profile data
     */
    public function update(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|array',
            'address.street' => 'sometimes|string',
            'address.number' => 'sometimes|string',
            'address.complement' => 'sometimes|string',
            'address.neighborhood' => 'sometimes|string',
            'address.city' => 'sometimes|string',
            'address.state' => 'sometimes|string|size:2',
            'address.zipCode' => 'sometimes|string',
            'department' => 'sometimes|string',
            'position' => 'sometimes|string'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        DB::beginTransaction();
        
        try {
            $user = $request->user();
            
            // Update user fields
            if ($request->has('name')) {
                $user->name = $request->name;
            }
            if ($request->has('phone')) {
                $user->phone = $request->phone;
            }
            if ($request->has('department')) {
                $user->department = $request->department;
            }
            if ($request->has('position')) {
                $user->job_title = $request->position;
            }
            
            $user->save();
            
            // Update beneficiary fields
            if ($user->beneficiary && $request->has('address')) {
                $beneficiary = $user->beneficiary;
                $address = $request->address;
                
                if (isset($address['street'])) $beneficiary->address = $address['street'];
                if (isset($address['number'])) $beneficiary->number = $address['number'];
                if (isset($address['complement'])) $beneficiary->complement = $address['complement'];
                if (isset($address['neighborhood'])) $beneficiary->neighborhood = $address['neighborhood'];
                if (isset($address['city'])) $beneficiary->city = $address['city'];
                if (isset($address['state'])) $beneficiary->state = $address['state'];
                if (isset($address['zipCode'])) $beneficiary->zip_code = $address['zipCode'];
                
                $beneficiary->save();
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Perfil atualizado com sucesso'
            ]);
            
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating profile:', ['error' => $e->getMessage()]);
            
            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar perfil'
            ], 500);
        }
    }
    
    /**
     * Update emergency contacts
     */
    public function updateEmergencyContacts(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'contacts' => 'required|array|max:2',
            'contacts.*.name' => 'required|string|max:255',
            'contacts.*.phone' => 'required|string|max:20',
            'contacts.*.relationship' => 'required|string|max:50'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $user = $request->user();
            $beneficiary = $user->beneficiary;
            
            if (!$beneficiary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Beneficiário não encontrado'
                ], 404);
            }
            
            // Update primary contact (first in array)
            $primaryContact = $request->contacts[0] ?? null;
            if ($primaryContact) {
                $beneficiary->emergency_contact_name = $primaryContact['name'];
                $beneficiary->emergency_contact_phone = $primaryContact['phone'];
                $beneficiary->emergency_contact_relationship = $primaryContact['relationship'];
            }
            
            // Store secondary contacts in custom_fields JSON
            if (count($request->contacts) > 1) {
                $customFields = json_decode($beneficiary->custom_fields ?? '{}', true);
                $customFields['secondary_emergency_contacts'] = array_slice($request->contacts, 1);
                $beneficiary->custom_fields = json_encode($customFields);
            }
            
            $beneficiary->save();
            
            return response()->json([
                'success' => true,
                'message' => 'Contatos de emergência atualizados'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error updating emergency contacts:', ['error' => $e->getMessage()]);
            
            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar contatos'
            ], 500);
        }
    }
    
    /**
     * Update privacy settings
     */
    public function updatePrivacySettings(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'notifications' => 'sometimes|array',
            'notifications.email' => 'sometimes|boolean',
            'notifications.sms' => 'sometimes|boolean',
            'notifications.push' => 'sometimes|boolean',
            'dataSharing' => 'sometimes|array',
            'dataSharing.analytics' => 'sometimes|boolean',
            'dataSharing.research' => 'sometimes|boolean',
            'dataSharing.partners' => 'sometimes|boolean'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            $user = $request->user();
            $beneficiary = $user->beneficiary;
            
            if ($beneficiary && $request->has('notifications')) {
                $notificationPrefs = json_decode($beneficiary->notification_preferences ?? '{}', true);
                $notificationPrefs = array_merge($notificationPrefs, $request->notifications);
                $beneficiary->notification_preferences = json_encode($notificationPrefs);
                $beneficiary->save();
            }
            
            // Store data sharing preferences in user preferences
            if ($request->has('dataSharing')) {
                $preferences = json_decode($user->preferences ?? '{}', true);
                $preferences['dataSharing'] = $request->dataSharing;
                $user->preferences = json_encode($preferences);
                $user->save();
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Configurações de privacidade atualizadas'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error updating privacy settings:', ['error' => $e->getMessage()]);
            
            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar configurações'
            ], 500);
        }
    }
    
    /**
     * Calculate health risk score based on questionnaire data
     */
    private function calculateHealthRiskScore($healthData): string
    {
        $riskScore = 0;
        
        // Check chronic conditions
        $conditions = json_decode($healthData->chronic_conditions ?? '[]', true);
        $riskScore += count($conditions) * 20;
        
        // Check BMI
        if ($healthData->bmi) {
            if ($healthData->bmi < 18.5 || $healthData->bmi > 30) {
                $riskScore += 15;
            } elseif ($healthData->bmi > 25) {
                $riskScore += 10;
            }
        }
        
        // Check smoking
        if ($healthData->smoking_status === 'current') {
            $riskScore += 25;
        }
        
        // Check physical activity
        if ($healthData->physical_activity_level === 'sedentary') {
            $riskScore += 15;
        }
        
        // Check stress level
        if ($healthData->stress_level === 'high') {
            $riskScore += 10;
        }
        
        // Determine risk level
        if ($riskScore < 30) return 'low';
        if ($riskScore < 60) return 'medium';
        return 'high';
    }
    
    /**
     * Calculate preventive care completion status
     */
    private function calculatePreventiveCareStatus($healthData): int
    {
        $totalChecks = 5;
        $completedChecks = 0;
        
        if ($healthData->last_medical_checkup && 
            now()->diffInMonths($healthData->last_medical_checkup) < 12) {
            $completedChecks++;
        }
        
        if ($healthData->last_dental_checkup && 
            now()->diffInMonths($healthData->last_dental_checkup) < 6) {
            $completedChecks++;
        }
        
        if ($healthData->last_eye_exam && 
            now()->diffInMonths($healthData->last_eye_exam) < 24) {
            $completedChecks++;
        }
        
        if ($healthData->vaccinations) {
            $completedChecks++;
        }
        
        if ($healthData->screening_tests) {
            $completedChecks++;
        }
        
        return intval(($completedChecks / $totalChecks) * 100);
    }
    
    /**
     * Get recent activity for user
     */
    private function getRecentActivity($user): array
    {
        $activities = [];
        
        // Get recent documents
        $recentDocs = Document::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(3)
            ->get();
            
        foreach ($recentDocs as $doc) {
            $activities[] = [
                'id' => 'doc_' . $doc->id,
                'type' => 'document',
                'title' => 'Documento Enviado',
                'description' => $doc->filename ?? $doc->type,
                'timestamp' => $doc->created_at->toIso8601String(),
                'icon' => 'FileText',
                'color' => 'text-blue-500'
            ];
        }
        
        // Get health questionnaire activity
        if ($user->beneficiary) {
            $healthQuest = HealthQuestionnaire::where('beneficiary_id', $user->beneficiary->id)
                ->where('completed_at', '!=', null)
                ->orderBy('completed_at', 'desc')
                ->first();
                
            if ($healthQuest) {
                $activities[] = [
                    'id' => 'health_' . $healthQuest->id,
                    'type' => 'health',
                    'title' => 'Questionário de Saúde',
                    'description' => 'Avaliação de saúde completada',
                    'timestamp' => $healthQuest->completed_at,
                    'icon' => 'Heart',
                    'color' => 'text-red-500'
                ];
            }
        }
        
        // Sort by timestamp
        usort($activities, function($a, $b) {
            return strtotime($b['timestamp']) - strtotime($a['timestamp']);
        });
        
        return array_slice($activities, 0, 10); // Return only last 10 activities
    }
}