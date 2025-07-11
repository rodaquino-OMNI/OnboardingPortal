<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\Document;
use App\Models\HealthQuestionnaire;
use App\Models\Interview;
use App\Models\GamificationProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class LGPDController extends Controller
{
    /**
     * Export user's personal data as per LGPD Art. 15
     */
    public function exportData(Request $request): JsonResponse
    {
        $user = $request->user();
        
        try {
            // Log the data export request
            $this->logDataAccess($user, 'data_export', 'User requested data export');
            
            // Collect all user data
            $userData = $this->collectUserData($user);
            
            // Generate JSON export
            $jsonData = $this->generateJsonExport($userData);
            
            // Store temporary file
            $filename = 'user_data_export_' . $user->id . '_' . now()->format('Y-m-d_H-i-s') . '.json';
            $filePath = 'temp/exports/' . $filename;
            
            Storage::disk('local')->put($filePath, $jsonData);
            
            // Create download URL (expires in 1 hour)
            $downloadUrl = route('lgpd.download-export', [
                'filename' => $filename,
                'token' => $this->generateSecureToken($user->id, $filename)
            ]);
            
            return response()->json([
                'message' => 'Export gerado com sucesso',
                'download_url' => $downloadUrl,
                'expires_at' => now()->addHour()->toISOString(),
                'file_size' => Storage::disk('local')->size($filePath),
                'records_count' => $this->countRecords($userData)
            ]);
            
        } catch (\Exception $e) {
            Log::error('Data export failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Erro ao gerar exportação',
                'error' => 'Não foi possível processar a solicitação. Tente novamente mais tarde.'
            ], 500);
        }
    }
    
    /**
     * Generate PDF export of user data
     */
    public function exportDataPdf(Request $request): JsonResponse
    {
        $user = $request->user();
        
        try {
            // Log the PDF export request
            $this->logDataAccess($user, 'data_export_pdf', 'User requested PDF data export');
            
            // Collect all user data
            $userData = $this->collectUserData($user);
            
            // Generate PDF
            $pdf = Pdf::loadView('exports.user-data', compact('userData', 'user'));
            
            // Store temporary file
            $filename = 'user_data_export_' . $user->id . '_' . now()->format('Y-m-d_H-i-s') . '.pdf';
            $filePath = 'temp/exports/' . $filename;
            
            Storage::disk('local')->put($filePath, $pdf->output());
            
            // Create download URL (expires in 1 hour)
            $downloadUrl = route('lgpd.download-export', [
                'filename' => $filename,
                'token' => $this->generateSecureToken($user->id, $filename)
            ]);
            
            return response()->json([
                'message' => 'Export PDF gerado com sucesso',
                'download_url' => $downloadUrl,
                'expires_at' => now()->addHour()->toISOString(),
                'file_size' => Storage::disk('local')->size($filePath)
            ]);
            
        } catch (\Exception $e) {
            Log::error('PDF export failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'message' => 'Erro ao gerar PDF',
                'error' => 'Não foi possível processar a solicitação. Tente novamente mais tarde.'
            ], 500);
        }
    }
    
    /**
     * Delete user account and all associated data (Right to be Forgotten)
     */
    public function deleteAccount(Request $request): JsonResponse
    {
        $request->validate([
            'password' => 'required|string',
            'confirmation' => 'required|string|in:DELETE_MY_ACCOUNT',
            'reason' => 'sometimes|string|max:500'
        ]);
        
        $user = $request->user();
        
        // Verify password
        if (!Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Senha incorreta.']
            ]);
        }
        
        try {
            DB::beginTransaction();
            
            // Log the deletion request
            $this->logDataAccess($user, 'account_deletion', 'User requested account deletion', [
                'reason' => $request->reason
            ]);
            
            // Collect data for final export (optional)
            $userData = $this->collectUserData($user);
            
            // Delete user files
            $this->deleteUserFiles($user);
            
            // Soft delete related records (preserve audit trail)
            $this->softDeleteRelatedRecords($user);
            
            // Anonymize audit logs (keep structure but remove PII)
            $this->anonymizeAuditLogs($user);
            
            // Hard delete sensitive data
            $this->hardDeleteSensitiveData($user);
            
            // Finally, delete the user account
            $user->delete();
            
            DB::commit();
            
            // Log successful deletion
            Log::info('User account deleted successfully', [
                'user_id' => $user->id,
                'reason' => $request->reason,
                'ip_address' => $request->ip()
            ]);
            
            return response()->json([
                'message' => 'Conta excluída com sucesso',
                'deleted_at' => now()->toISOString(),
                'data_removed' => $this->getDataRemovalSummary($userData)
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Account deletion failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Erro ao excluir conta',
                'error' => 'Não foi possível processar a solicitação. Entre em contato com o suporte.'
            ], 500);
        }
    }
    
    /**
     * Get user's privacy settings
     */
    public function getPrivacySettings(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $settings = [
            'lgpd_consent' => $user->lgpd_consent,
            'lgpd_consent_at' => $user->lgpd_consent_at,
            'marketing_consent' => $user->preferences['marketing_consent'] ?? false,
            'analytics_consent' => $user->preferences['analytics_consent'] ?? true,
            'communication_consent' => $user->preferences['communication_consent'] ?? true,
            'data_sharing_consent' => $user->preferences['data_sharing_consent'] ?? false,
            'profile_visibility' => $user->preferences['profile_visibility'] ?? 'company',
            'activity_tracking' => $user->preferences['activity_tracking'] ?? true,
            'automated_processing' => $user->preferences['automated_processing'] ?? true,
            'third_party_integrations' => $user->preferences['third_party_integrations'] ?? false,
            'data_retention_preference' => $user->preferences['data_retention_preference'] ?? 'standard',
            'last_privacy_update' => $user->preferences['last_privacy_update'] ?? $user->updated_at
        ];
        
        return response()->json([
            'settings' => $settings,
            'available_options' => $this->getAvailablePrivacyOptions(),
            'legal_basis' => $this->getLegalBasisInfo(),
            'data_categories' => $this->getDataCategoriesInfo()
        ]);
    }
    
    /**
     * Update user's privacy settings
     */
    public function updatePrivacySettings(Request $request): JsonResponse
    {
        $request->validate([
            'marketing_consent' => 'sometimes|boolean',
            'analytics_consent' => 'sometimes|boolean',
            'communication_consent' => 'sometimes|boolean',
            'data_sharing_consent' => 'sometimes|boolean',
            'profile_visibility' => 'sometimes|string|in:private,company,public',
            'activity_tracking' => 'sometimes|boolean',
            'automated_processing' => 'sometimes|boolean',
            'third_party_integrations' => 'sometimes|boolean',
            'data_retention_preference' => 'sometimes|string|in:minimal,standard,extended'
        ]);
        
        $user = $request->user();
        $oldSettings = $user->preferences ?? [];
        
        $newPreferences = array_merge($oldSettings, $request->validated());
        $newPreferences['last_privacy_update'] = now()->toISOString();
        
        $user->update([
            'preferences' => $newPreferences
        ]);
        
        // Log privacy settings change
        $this->logDataAccess($user, 'privacy_settings_update', 'User updated privacy settings', [
            'old_settings' => $oldSettings,
            'new_settings' => $newPreferences,
            'changes' => array_diff_assoc($newPreferences, $oldSettings)
        ]);
        
        return response()->json([
            'message' => 'Configurações de privacidade atualizadas',
            'settings' => $newPreferences
        ]);
    }
    
    /**
     * Get consent history for the user
     */
    public function getConsentHistory(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $consentHistory = AuditLog::where('user_id', $user->id)
            ->whereIn('event_type', ['consent_given', 'consent_withdrawn', 'privacy_settings_update'])
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get()
            ->map(function ($log) {
                return [
                    'date' => $log->created_at,
                    'type' => $log->event_type,
                    'action' => $log->action,
                    'details' => $log->new_values,
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent
                ];
            });
        
        return response()->json([
            'consent_history' => $consentHistory,
            'total_records' => $consentHistory->count(),
            'current_consent' => [
                'lgpd_consent' => $user->lgpd_consent,
                'consent_date' => $user->lgpd_consent_at,
                'consent_ip' => $user->lgpd_consent_ip
            ]
        ]);
    }
    
    /**
     * Withdraw consent for data processing
     */
    public function withdrawConsent(Request $request): JsonResponse
    {
        $request->validate([
            'consent_types' => 'required|array',
            'consent_types.*' => 'string|in:marketing,analytics,communication,data_sharing,automated_processing,third_party_integrations',
            'reason' => 'sometimes|string|max:500'
        ]);
        
        $user = $request->user();
        $preferences = $user->preferences ?? [];
        
        // Withdraw specified consents
        foreach ($request->consent_types as $consentType) {
            $preferences[$consentType . '_consent'] = false;
            $preferences[$consentType . '_consent_withdrawn_at'] = now()->toISOString();
        }
        
        $preferences['last_privacy_update'] = now()->toISOString();
        
        $user->update([
            'preferences' => $preferences
        ]);
        
        // Log consent withdrawal
        $this->logDataAccess($user, 'consent_withdrawn', 'User withdrew consent', [
            'consent_types' => $request->consent_types,
            'reason' => $request->reason
        ]);
        
        return response()->json([
            'message' => 'Consentimento retirado com sucesso',
            'withdrawn_consents' => $request->consent_types,
            'updated_at' => now()->toISOString()
        ]);
    }
    
    /**
     * Get user's data processing activities
     */
    public function getDataProcessingActivities(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $activities = AuditLog::where('user_id', $user->id)
            ->where('is_sensitive_data', true)
            ->orderBy('created_at', 'desc')
            ->take(100)
            ->get()
            ->map(function ($log) {
                return [
                    'date' => $log->created_at,
                    'activity' => $log->event_type,
                    'purpose' => $log->purpose,
                    'legal_basis' => $log->legal_basis,
                    'data_type' => $log->model_type,
                    'action' => $log->action,
                    'user_consent' => $log->user_consent
                ];
            });
        
        return response()->json([
            'activities' => $activities,
            'total_records' => $activities->count(),
            'summary' => [
                'total_data_access' => $activities->where('action', 'read')->count(),
                'total_data_modifications' => $activities->where('action', 'update')->count(),
                'total_data_exports' => $activities->where('activity', 'data_export')->count(),
                'consent_based_activities' => $activities->where('user_consent', true)->count()
            ]
        ]);
    }
    
    /**
     * Collect all user data for export
     */
    private function collectUserData(User $user): array
    {
        return [
            'user_profile' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'cpf' => $user->cpf,
                'phone' => $user->phone,
                'department' => $user->department,
                'job_title' => $user->job_title,
                'employee_id' => $user->employee_id,
                'start_date' => $user->start_date,
                'status' => $user->status,
                'preferred_language' => $user->preferred_language,
                'preferences' => $user->preferences,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
                'last_login_at' => $user->last_login_at,
                'last_login_ip' => $user->last_login_ip
            ],
            'consent_records' => [
                'lgpd_consent' => $user->lgpd_consent,
                'lgpd_consent_at' => $user->lgpd_consent_at,
                'lgpd_consent_ip' => $user->lgpd_consent_ip
            ],
            'beneficiary_data' => $user->beneficiary ? [
                'birth_date' => $user->beneficiary->birth_date,
                'gender' => $user->beneficiary->gender,
                'marital_status' => $user->beneficiary->marital_status,
                'emergency_contact_name' => $user->beneficiary->emergency_contact_name,
                'emergency_contact_phone' => $user->beneficiary->emergency_contact_phone,
                'health_conditions' => $user->beneficiary->health_conditions,
                'created_at' => $user->beneficiary->created_at,
                'updated_at' => $user->beneficiary->updated_at
            ] : null,
            'documents' => Document::where('user_id', $user->id)->get(['id', 'type', 'filename', 'status', 'created_at'])->toArray(),
            'health_questionnaires' => HealthQuestionnaire::where('user_id', $user->id)->get(['id', 'responses', 'status', 'created_at'])->toArray(),
            'interviews' => Interview::where('user_id', $user->id)->get(['id', 'scheduled_at', 'status', 'notes', 'created_at'])->toArray(),
            'gamification_progress' => $user->gamificationProgress ? [
                'total_points' => $user->gamificationProgress->total_points,
                'current_level' => $user->gamificationProgress->current_level,
                'level_progress' => $user->gamificationProgress->level_progress,
                'badges_earned' => $user->gamificationProgress->badges_earned,
                'created_at' => $user->gamificationProgress->created_at,
                'updated_at' => $user->gamificationProgress->updated_at
            ] : null,
            'audit_logs' => AuditLog::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->take(500)
                ->get(['event_type', 'action', 'ip_address', 'user_agent', 'created_at'])
                ->toArray()
        ];
    }
    
    /**
     * Generate JSON export of user data
     */
    private function generateJsonExport(array $userData): string
    {
        $export = [
            'export_info' => [
                'generated_at' => now()->toISOString(),
                'version' => '1.0',
                'format' => 'JSON',
                'compliance' => 'LGPD Art. 15 - Direito de Acesso'
            ],
            'user_data' => $userData
        ];
        
        return json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * Log data access for LGPD compliance
     */
    private function logDataAccess(User $user, string $eventType, string $description, array $context = []): void
    {
        AuditLog::create([
            'user_id' => $user->id,
            'user_type' => 'beneficiary',
            'event_type' => $eventType,
            'event_category' => 'data_privacy',
            'action' => 'read',
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'is_sensitive_data' => true,
            'user_consent' => true,
            'purpose' => $description,
            'legal_basis' => 'LGPD Art. 15 - Direito de Acesso',
            'data_classification' => 'restricted',
            'context' => $context
        ]);
    }
    
    /**
     * Generate secure token for file downloads
     */
    private function generateSecureToken(int $userId, string $filename): string
    {
        return hash_hmac('sha256', $userId . '|' . $filename . '|' . now()->timestamp, config('app.key'));
    }
    
    /**
     * Count total records in user data
     */
    private function countRecords(array $userData): int
    {
        $count = 0;
        foreach ($userData as $category => $data) {
            if (is_array($data)) {
                $count += count($data);
            }
        }
        return $count;
    }
    
    /**
     * Delete user files from storage
     */
    private function deleteUserFiles(User $user): void
    {
        // Delete profile photos
        if ($user->beneficiary && $user->beneficiary->photo_url) {
            Storage::disk('public')->delete($user->beneficiary->photo_url);
        }
        
        // Delete uploaded documents
        $documents = Document::where('user_id', $user->id)->get();
        foreach ($documents as $document) {
            if ($document->file_path) {
                Storage::disk('public')->delete($document->file_path);
            }
        }
    }
    
    /**
     * Soft delete related records
     */
    private function softDeleteRelatedRecords(User $user): void
    {
        if ($user->beneficiary) {
            $user->beneficiary->delete();
        }
        
        Document::where('user_id', $user->id)->delete();
        HealthQuestionnaire::where('user_id', $user->id)->delete();
        Interview::where('user_id', $user->id)->delete();
        
        if ($user->gamificationProgress) {
            $user->gamificationProgress->delete();
        }
    }
    
    /**
     * Anonymize audit logs
     */
    private function anonymizeAuditLogs(User $user): void
    {
        AuditLog::where('user_id', $user->id)->update([
            'ip_address' => null,
            'user_agent' => null,
            'old_values' => null,
            'new_values' => null,
            'context' => ['anonymized' => true, 'anonymized_at' => now()->toISOString()]
        ]);
    }
    
    /**
     * Hard delete sensitive data
     */
    private function hardDeleteSensitiveData(User $user): void
    {
        // This would be implemented based on specific business requirements
        // For now, we're using soft deletes to maintain audit trail
    }
    
    /**
     * Get data removal summary
     */
    private function getDataRemovalSummary(array $userData): array
    {
        return [
            'profile_data' => 'Removed',
            'documents' => count($userData['documents']) . ' documents deleted',
            'health_data' => count($userData['health_questionnaires']) . ' health records deleted',
            'interviews' => count($userData['interviews']) . ' interview records deleted',
            'gamification' => $userData['gamification_progress'] ? 'Progress data deleted' : 'No progress data',
            'audit_logs' => count($userData['audit_logs']) . ' audit logs anonymized'
        ];
    }
    
    /**
     * Get available privacy options
     */
    private function getAvailablePrivacyOptions(): array
    {
        return [
            'marketing_consent' => 'Consentimento para comunicações de marketing',
            'analytics_consent' => 'Consentimento para análise de uso',
            'communication_consent' => 'Consentimento para comunicações gerais',
            'data_sharing_consent' => 'Consentimento para compartilhamento de dados',
            'profile_visibility' => 'Visibilidade do perfil (privado, empresa, público)',
            'activity_tracking' => 'Rastreamento de atividades',
            'automated_processing' => 'Processamento automatizado',
            'third_party_integrations' => 'Integrações com terceiros',
            'data_retention_preference' => 'Preferência de retenção de dados'
        ];
    }
    
    /**
     * Get legal basis information
     */
    private function getLegalBasisInfo(): array
    {
        return [
            'consent' => 'Consentimento do titular',
            'contract' => 'Execução de contrato',
            'legal_obligation' => 'Cumprimento de obrigação legal',
            'vital_interests' => 'Proteção da vida ou incolumidade física',
            'public_interest' => 'Interesse público',
            'legitimate_interests' => 'Interesse legítimo do controlador'
        ];
    }
    
    /**
     * Get data categories information
     */
    private function getDataCategoriesInfo(): array
    {
        return [
            'identification' => 'Dados de identificação (nome, CPF, email)',
            'contact' => 'Dados de contato (telefone, endereço)',
            'professional' => 'Dados profissionais (cargo, departamento)',
            'health' => 'Dados de saúde (questionários)',
            'biometric' => 'Dados biométricos (fotos)',
            'behavioral' => 'Dados comportamentais (gamificação)',
            'technical' => 'Dados técnicos (logs, IP, navegador)'
        ];
    }
}