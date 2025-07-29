<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\VideoConferencingService;
use App\Models\Interview;
use App\Models\VideoSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class VideoConferencingController extends Controller
{
    protected VideoConferencingService $videoService;

    public function __construct(VideoConferencingService $videoService)
    {
        $this->videoService = $videoService;
    }

    /**
     * Create a new video session for interview
     */
    public function createSession(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'interview_id' => 'required|exists:interviews,id',
                'participants' => 'required|array|min:2',
                'participants.*.id' => 'required|string',
                'participants.*.name' => 'required|string',
                'participants.*.role' => 'required|in:patient,doctor,moderator',
                'record_session' => 'boolean',
                'enable_chat' => 'boolean',
                'enable_screen_share' => 'boolean'
            ]);

            $interview = Interview::findOrFail($validated['interview_id']);
            
            // Check permissions
            $user = Auth::user();
            if (!$this->canAccessInterview($user, $interview)) {
                return response()->json([
                    'message' => 'Acesso negado a esta consulta'
                ], 403);
            }

            // Prepare participants for video service
            $participants = collect($validated['participants'])->map(function ($participant) {
                return [
                    'id' => $participant['id'],
                    'name' => $participant['name'],
                    'role' => $this->mapRoleToVonage($participant['role'])
                ];
            })->toArray();

            // Create video session
            $sessionResult = $this->videoService->createSession($participants, [
                'record' => $validated['record_session'] ?? true,
                'chat' => $validated['enable_chat'] ?? true,
                'screen_share' => $validated['enable_screen_share'] ?? true
            ]);

            if (!$sessionResult['success']) {
                return response()->json([
                    'message' => 'Falha ao criar sessão de vídeo',
                    'error' => 'Video service unavailable'
                ], 500);
            }

            // Store video session in database
            $videoSession = VideoSession::create([
                'interview_id' => $interview->id,
                'session_id' => $sessionResult['sessionId'],
                'provider' => 'vonage',
                'status' => 'created',
                'participants' => $validated['participants'],
                'settings' => [
                    'record_session' => $validated['record_session'] ?? true,
                    'enable_chat' => $validated['enable_chat'] ?? true,
                    'enable_screen_share' => $validated['enable_screen_share'] ?? true,
                    'hipaa_compliant' => true
                ],
                'created_by' => $user->id
            ]);

            // Update interview status
            $interview->update([
                'status' => 'confirmed',
                'meeting_platform' => 'vonage_video',
                'meeting_id' => $sessionResult['sessionId']
            ]);

            Log::info('Video session created', [
                'interview_id' => $interview->id,
                'session_id' => $sessionResult['sessionId'],
                'user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Sessão de vídeo criada com sucesso',
                'session' => [
                    'id' => $videoSession->id,
                    'session_id' => $sessionResult['sessionId'],
                    'tokens' => $sessionResult['tokens'],
                    'archive_mode' => $sessionResult['archiveMode'] ?? 'always',
                    'encryption_enabled' => $sessionResult['encryptionEnabled'] ?? true,
                    'participants' => $validated['participants'],
                    'settings' => $videoSession->settings
                ]
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Video session creation error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro interno do servidor',
                'error' => 'Failed to create video session'
            ], 500);
        }
    }

    /**
     * Join an existing video session
     */
    public function joinSession(Request $request, string $sessionId): JsonResponse
    {
        try {
            $validated = $request->validate([
                'participant_id' => 'required|string',
                'participant_name' => 'required|string',
                'role' => 'required|in:patient,doctor,moderator'
            ]);

            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            // Check permissions
            if (!$this->canJoinSession($user, $videoSession)) {
                return response()->json([
                    'message' => 'Acesso negado a esta sessão'
                ], 403);
            }

            // Generate token for participant
            $token = $this->videoService->generateToken(
                $sessionId,
                $this->mapRoleToVonage($validated['role']),
                $validated['participant_name']
            );

            // Update session participants
            $participants = $videoSession->participants;
            $participantExists = false;
            
            foreach ($participants as &$participant) {
                if ($participant['id'] === $validated['participant_id']) {
                    $participant['joined_at'] = now();
                    $participant['status'] = 'joined';
                    $participantExists = true;
                    break;
                }
            }

            if (!$participantExists) {
                $participants[] = [
                    'id' => $validated['participant_id'],
                    'name' => $validated['participant_name'],
                    'role' => $validated['role'],
                    'joined_at' => now(),
                    'status' => 'joined'
                ];
            }

            $videoSession->update([
                'participants' => $participants,
                'status' => 'active'
            ]);

            // Update interview status
            if ($videoSession->interview) {
                $videoSession->interview->update([
                    'status' => 'in_progress',
                    'started_at' => now()
                ]);
            }

            Log::info('Participant joined video session', [
                'session_id' => $sessionId,
                'participant_id' => $validated['participant_id'],
                'user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Conectado à sessão com sucesso',
                'session' => [
                    'id' => $videoSession->id,
                    'session_id' => $sessionId,
                    'token' => $token,
                    'settings' => $videoSession->settings,
                    'participants' => $participants
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Video session join error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao conectar à sessão',
                'error' => 'Failed to join session'
            ], 500);
        }
    }

    /**
     * Start recording session
     */
    public function startRecording(Request $request, string $sessionId): JsonResponse
    {
        try {
            $validated = $request->validate([
                'name' => 'string|max:255',
                'include_audio' => 'boolean',
                'include_video' => 'boolean'
            ]);

            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            // Check permissions - only doctors and moderators can start recording
            if (!$this->canControlRecording($user, $videoSession)) {
                return response()->json([
                    'message' => 'Permissão insuficiente para gravar'
                ], 403);
            }

            $recordingResult = $this->videoService->startRecording($sessionId, [
                'name' => $validated['name'] ?? 'Consultation_' . date('Y-m-d_H-i-s'),
                'hasAudio' => $validated['include_audio'] ?? true,
                'hasVideo' => $validated['include_video'] ?? true
            ]);

            if (!$recordingResult['success']) {
                return response()->json([
                    'message' => 'Falha ao iniciar gravação',
                    'error' => $recordingResult['message'] ?? 'Recording service error'
                ], 500);
            }

            // Update session with recording info
            $videoSession->update([
                'recording_archive_id' => $recordingResult['archiveId'],
                'recording_status' => 'recording',
                'recording_started_at' => now(),
                'recording_started_by' => $user->id
            ]);

            Log::info('Recording started', [
                'session_id' => $sessionId,
                'archive_id' => $recordingResult['archiveId'],
                'user_id' => $user->id
            ]);

            return response()->json([
                'message' => 'Gravação iniciada com sucesso',
                'recording' => [
                    'archive_id' => $recordingResult['archiveId'],
                    'status' => $recordingResult['status'],
                    'started_at' => now()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Recording start error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao iniciar gravação',
                'error' => 'Recording service error'
            ], 500);
        }
    }

    /**
     * Stop recording session
     */
    public function stopRecording(string $sessionId): JsonResponse
    {
        try {
            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            if (!$this->canControlRecording($user, $videoSession)) {
                return response()->json([
                    'message' => 'Permissão insuficiente para parar gravação'
                ], 403);
            }

            if (!$videoSession->recording_archive_id) {
                return response()->json([
                    'message' => 'Nenhuma gravação ativa encontrada'
                ], 404);
            }

            $recordingResult = $this->videoService->stopRecording($videoSession->recording_archive_id);

            if (!$recordingResult['success']) {
                return response()->json([
                    'message' => 'Falha ao parar gravação',
                    'error' => $recordingResult['message'] ?? 'Recording service error'
                ], 500);
            }

            // Update session
            $videoSession->update([
                'recording_status' => 'stopped',
                'recording_stopped_at' => now(),
                'recording_duration' => $recordingResult['duration'] ?? 0
            ]);

            Log::info('Recording stopped', [
                'session_id' => $sessionId,
                'archive_id' => $videoSession->recording_archive_id,
                'duration' => $recordingResult['duration'] ?? 0
            ]);

            return response()->json([
                'message' => 'Gravação finalizada com sucesso',
                'recording' => [
                    'archive_id' => $videoSession->recording_archive_id,
                    'status' => $recordingResult['status'],
                    'duration' => $recordingResult['duration'] ?? 0,
                    'stopped_at' => now()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Recording stop error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao parar gravação',
                'error' => 'Recording service error'
            ], 500);
        }
    }

    /**
     * Get session status and analytics
     */
    public function getSessionStatus(string $sessionId): JsonResponse
    {
        try {
            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            if (!$this->canAccessSession($user, $videoSession)) {
                return response()->json([
                    'message' => 'Acesso negado a esta sessão'
                ], 403);
            }

            // Get analytics from video service
            $analytics = $this->videoService->getSessionAnalytics($sessionId);
            
            // Validate session health
            $health = $this->videoService->validateSessionHealth($sessionId);

            return response()->json([
                'session' => [
                    'id' => $videoSession->id,
                    'session_id' => $sessionId,
                    'status' => $videoSession->status,
                    'participants' => $videoSession->participants,
                    'created_at' => $videoSession->created_at,
                    'recording_status' => $videoSession->recording_status,
                    'settings' => $videoSession->settings
                ],
                'analytics' => $analytics,
                'health' => $health
            ]);

        } catch (\Exception $e) {
            Log::error('Session status error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao obter status da sessão',
                'error' => 'Session service error'
            ], 500);
        }
    }

    /**
     * Enable screen sharing
     */
    public function enableScreenSharing(Request $request, string $sessionId): JsonResponse
    {
        try {
            $validated = $request->validate([
                'participant_id' => 'required|string'
            ]);

            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            if (!$this->canControlSession($user, $videoSession)) {
                return response()->json([
                    'message' => 'Permissão insuficiente para compartilhar tela'
                ], 403);
            }

            $screenResult = $this->videoService->enableScreenSharing($sessionId, $validated['participant_id']);

            if (!$screenResult['success']) {
                return response()->json([
                    'message' => 'Falha ao habilitar compartilhamento de tela',
                    'error' => $screenResult['message'] ?? 'Screen sharing service error'
                ], 500);
            }

            return response()->json([
                'message' => 'Compartilhamento de tela habilitado',
                'screen_token' => $screenResult['screenToken'],
                'instructions' => $screenResult['instructions']
            ]);

        } catch (\Exception $e) {
            Log::error('Screen sharing error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro no compartilhamento de tela',
                'error' => 'Screen sharing service error'
            ], 500);
        }
    }

    /**
     * End video session
     */
    public function endSession(string $sessionId): JsonResponse
    {
        try {
            $videoSession = VideoSession::where('session_id', $sessionId)->firstOrFail();
            $user = Auth::user();

            if (!$this->canControlSession($user, $videoSession)) {
                return response()->json([
                    'message' => 'Permissão insuficiente para finalizar sessão'
                ], 403);
            }

            // Stop recording if active
            if ($videoSession->recording_status === 'recording') {
                $this->videoService->stopRecording($videoSession->recording_archive_id);
            }

            // Update session status
            $videoSession->update([
                'status' => 'ended',
                'ended_at' => now(),
                'ended_by' => $user->id
            ]);

            // Update interview status
            if ($videoSession->interview) {
                $videoSession->interview->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'duration_minutes' => $videoSession->created_at->diffInMinutes(now())
                ]);
            }

            Log::info('Video session ended', [
                'session_id' => $sessionId,
                'user_id' => $user->id,
                'duration' => $videoSession->created_at->diffInMinutes(now())
            ]);

            return response()->json([
                'message' => 'Sessão finalizada com sucesso',
                'session' => [
                    'id' => $videoSession->id,
                    'duration_minutes' => $videoSession->created_at->diffInMinutes(now()),
                    'ended_at' => now()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Session end error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao finalizar sessão',
                'error' => 'Session service error'
            ], 500);
        }
    }

    /**
     * Get recording download URL
     */
    public function getRecordingUrl(string $archiveId): JsonResponse
    {
        try {
            $videoSession = VideoSession::where('recording_archive_id', $archiveId)->firstOrFail();
            $user = Auth::user();

            if (!$this->canAccessRecording($user, $videoSession)) {
                return response()->json([
                    'message' => 'Acesso negado à gravação'
                ], 403);
            }

            $recordingResult = $this->videoService->getRecordingUrl($archiveId, true);

            if (!$recordingResult['success']) {
                return response()->json([
                    'message' => 'Gravação não disponível',
                    'error' => $recordingResult['message'] ?? 'Recording not ready'
                ], 404);
            }

            return response()->json([
                'message' => 'URL de gravação gerada',
                'recording' => [
                    'url' => $recordingResult['url'],
                    'duration' => $recordingResult['duration'],
                    'size' => $recordingResult['size'],
                    'expires_at' => $recordingResult['expiresAt']
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Recording URL error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erro ao acessar gravação',
                'error' => 'Recording service error'
            ], 500);
        }
    }

    /**
     * Check if user can access interview
     */
    protected function canAccessInterview($user, Interview $interview): bool
    {
        return $user->id === $interview->beneficiary_id ||
               $user->id === $interview->healthcare_professional_id ||
               $user->hasRole(['admin', 'healthcare_professional']);
    }

    /**
     * Check if user can join session
     */
    protected function canJoinSession($user, VideoSession $videoSession): bool
    {
        if (!$videoSession->interview) {
            return false;
        }

        return $this->canAccessInterview($user, $videoSession->interview);
    }

    /**
     * Check if user can access session
     */
    protected function canAccessSession($user, VideoSession $videoSession): bool
    {
        return $this->canJoinSession($user, $videoSession);
    }

    /**
     * Check if user can control session (end, recording, etc.)
     */
    protected function canControlSession($user, VideoSession $videoSession): bool
    {
        return $user->hasRole(['admin', 'healthcare_professional']) ||
               ($videoSession->interview && $user->id === $videoSession->interview->healthcare_professional_id);
    }

    /**
     * Check if user can control recording
     */
    protected function canControlRecording($user, VideoSession $videoSession): bool
    {
        return $this->canControlSession($user, $videoSession);
    }

    /**
     * Check if user can access recording
     */
    protected function canAccessRecording($user, VideoSession $videoSession): bool
    {
        return $this->canAccessSession($user, $videoSession);
    }

    /**
     * Map application roles to Vonage roles
     */
    protected function mapRoleToVonage(string $role): string
    {
        return match($role) {
            'doctor', 'moderator' => 'moderator',
            'patient' => 'publisher',
            default => 'subscriber'
        };
    }
}