<?php

namespace App\Services\Rewards;

use App\Models\UserReward;
use App\Models\DigitalAsset;
use App\Services\ReportGenerationService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DigitalItemDeliveryHandler implements RewardDeliveryInterface
{
    protected ReportGenerationService $reportService;

    public function __construct()
    {
        $this->reportService = app(ReportGenerationService::class);
    }

    /**
     * Deliver digital item to user
     */
    public function deliver(UserReward $userReward): array
    {
        try {
            $reward = $userReward->reward;
            $user = $userReward->user;
            $beneficiary = $user->beneficiary;

            if (!$beneficiary) {
                throw new \Exception('Beneficiary not found for user');
            }

            $config = $reward->delivery_config;
            $itemType = $config['report_type'] ?? 'health_assessment_premium';

            // Generate or prepare the digital item
            $digitalAsset = $this->prepareDigitalAsset($beneficiary, $itemType, $config);

            // Store access record
            $access = DigitalAsset::create([
                'beneficiary_id' => $beneficiary->id,
                'reward_id' => $reward->id,
                'asset_type' => $itemType,
                'asset_name' => $digitalAsset['name'],
                'asset_path' => $digitalAsset['path'],
                'access_url' => $digitalAsset['url'],
                'download_token' => Str::random(32),
                'expires_at' => now()->addDays(30),
                'metadata' => [
                    'redemption_code' => $userReward->redemption_code,
                    'file_size' => $digitalAsset['size'] ?? null,
                    'mime_type' => $digitalAsset['mime_type'] ?? 'application/pdf',
                ]
            ]);

            // Send notification with download link
            $this->sendDigitalItemNotification($beneficiary, $access);

            return [
                'success' => true,
                'details' => [
                    'asset_type' => $itemType,
                    'asset_name' => $digitalAsset['name'],
                    'download_url' => $access->getDownloadUrl(),
                    'expires_at' => $access->expires_at->toIso8601String(),
                    'access_token' => $access->download_token,
                ]
            ];

        } catch (\Exception $e) {
            Log::error('Digital item delivery failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Redeem digital item (download or access)
     */
    public function redeem(UserReward $userReward, array $data = []): array
    {
        try {
            $action = $data['action'] ?? 'download';
            $token = $data['token'] ?? null;

            // Find the digital asset
            $asset = DigitalAsset::where('beneficiary_id', $userReward->user->beneficiary->id)
                ->where('reward_id', $userReward->reward_id)
                ->where('download_token', $token ?? $userReward->delivery_details['access_token'] ?? null)
                ->where('expires_at', '>', now())
                ->first();

            if (!$asset) {
                throw new \Exception('Digital asset not found or expired');
            }

            switch ($action) {
                case 'download':
                    return $this->processDownload($asset);
                
                case 'preview':
                    return $this->processPreview($asset);
                
                case 'regenerate':
                    return $this->regenerateAsset($asset, $userReward);
                
                default:
                    return [
                        'success' => true,
                        'asset_info' => [
                            'name' => $asset->asset_name,
                            'type' => $asset->asset_type,
                            'expires_at' => $asset->expires_at->toIso8601String(),
                        ]
                    ];
            }

        } catch (\Exception $e) {
            Log::error('Digital item redemption failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Validate if digital item can be delivered
     */
    public function validate(UserReward $userReward): bool
    {
        return $userReward->status === 'claimed' && !$userReward->isExpired();
    }

    /**
     * Prepare the digital asset based on type
     */
    protected function prepareDigitalAsset($beneficiary, string $type, array $config): array
    {
        switch ($type) {
            case 'health_assessment_premium':
                return $this->generateHealthReport($beneficiary, $config);
            
            case 'wellness_guide':
                return $this->prepareWellnessGuide($beneficiary, $config);
            
            case 'nutrition_plan':
                return $this->generateNutritionPlan($beneficiary, $config);
            
            case 'exercise_program':
                return $this->generateExerciseProgram($beneficiary, $config);
            
            default:
                return $this->prepareGenericAsset($type, $config);
        }
    }

    /**
     * Generate personalized health report
     */
    protected function generateHealthReport($beneficiary, array $config): array
    {
        // Generate comprehensive health report
        $reportData = [
            'beneficiary' => $beneficiary,
            'health_data' => $beneficiary->healthRiskAssessments()->latest()->first(),
            'recommendations' => $this->generateHealthRecommendations($beneficiary),
            'risk_analysis' => $this->analyzeHealthRisks($beneficiary),
        ];

        $fileName = "health_report_{$beneficiary->id}_" . now()->format('Y_m_d') . '.pdf';
        $filePath = "reports/health/{$fileName}";

        // Generate PDF (mock for now)
        Storage::put($filePath, $this->generatePdfContent($reportData));

        return [
            'name' => 'Relatório de Saúde Premium',
            'path' => $filePath,
            'url' => Storage::url($filePath),
            'size' => Storage::size($filePath),
            'mime_type' => 'application/pdf',
        ];
    }

    /**
     * Prepare wellness guide
     */
    protected function prepareWellnessGuide($beneficiary, array $config): array
    {
        $guidePath = 'guides/wellness_guide_premium.pdf';
        
        return [
            'name' => 'Guia de Bem-Estar Personalizado',
            'path' => $guidePath,
            'url' => Storage::url($guidePath),
            'size' => 2048000, // 2MB
            'mime_type' => 'application/pdf',
        ];
    }

    /**
     * Generate nutrition plan
     */
    protected function generateNutritionPlan($beneficiary, array $config): array
    {
        $fileName = "nutrition_plan_{$beneficiary->id}.pdf";
        $filePath = "plans/nutrition/{$fileName}";
        
        return [
            'name' => 'Plano Nutricional Personalizado',
            'path' => $filePath,
            'url' => Storage::url($filePath),
            'size' => 1024000, // 1MB
            'mime_type' => 'application/pdf',
        ];
    }

    /**
     * Generate exercise program
     */
    protected function generateExerciseProgram($beneficiary, array $config): array
    {
        $fileName = "exercise_program_{$beneficiary->id}.pdf";
        $filePath = "programs/exercise/{$fileName}";
        
        return [
            'name' => 'Programa de Exercícios Personalizado',
            'path' => $filePath,
            'url' => Storage::url($filePath),
            'size' => 1536000, // 1.5MB
            'mime_type' => 'application/pdf',
        ];
    }

    /**
     * Prepare generic digital asset
     */
    protected function prepareGenericAsset(string $type, array $config): array
    {
        return [
            'name' => $config['asset_name'] ?? 'Digital Asset',
            'path' => $config['asset_path'] ?? 'assets/generic.pdf',
            'url' => $config['asset_url'] ?? '#',
            'size' => $config['asset_size'] ?? 0,
            'mime_type' => $config['mime_type'] ?? 'application/octet-stream',
        ];
    }

    /**
     * Process download request
     */
    protected function processDownload(DigitalAsset $asset): array
    {
        // Increment download counter
        $asset->increment('download_count');
        $asset->update(['last_accessed_at' => now()]);

        return [
            'success' => true,
            'download_url' => $asset->getSignedDownloadUrl(),
            'filename' => $asset->asset_name,
            'mime_type' => $asset->metadata['mime_type'] ?? 'application/pdf',
        ];
    }

    /**
     * Process preview request
     */
    protected function processPreview(DigitalAsset $asset): array
    {
        return [
            'success' => true,
            'preview_url' => $asset->getPreviewUrl(),
            'asset_type' => $asset->asset_type,
        ];
    }

    /**
     * Regenerate the asset with updated data
     */
    protected function regenerateAsset(DigitalAsset $asset, UserReward $userReward): array
    {
        $beneficiary = $userReward->user->beneficiary;
        $config = $userReward->reward->delivery_config;
        
        // Regenerate the asset
        $newAsset = $this->prepareDigitalAsset($beneficiary, $asset->asset_type, $config);
        
        // Update the asset record
        $asset->update([
            'asset_path' => $newAsset['path'],
            'access_url' => $newAsset['url'],
            'regenerated_at' => now(),
        ]);

        return [
            'success' => true,
            'message' => 'Asset regenerated successfully',
            'download_url' => $asset->getDownloadUrl(),
        ];
    }

    /**
     * Send notification about digital item availability
     */
    protected function sendDigitalItemNotification($beneficiary, DigitalAsset $asset): void
    {
        // Send email/SMS notification with download link
        // This would integrate with your notification service
        Log::info("Digital item ready for download", [
            'beneficiary_id' => $beneficiary->id,
            'asset_id' => $asset->id,
            'download_url' => $asset->getDownloadUrl(),
        ]);
    }

    /**
     * Generate health recommendations
     */
    protected function generateHealthRecommendations($beneficiary): array
    {
        return [
            'nutrition' => ['Increase water intake', 'Add more vegetables'],
            'exercise' => ['30 minutes daily walk', 'Stretching exercises'],
            'lifestyle' => ['8 hours sleep', 'Stress management'],
        ];
    }

    /**
     * Analyze health risks
     */
    protected function analyzeHealthRisks($beneficiary): array
    {
        return [
            'cardiovascular' => 'low',
            'diabetes' => 'moderate',
            'hypertension' => 'low',
        ];
    }

    /**
     * Generate PDF content (mock)
     */
    protected function generatePdfContent(array $data): string
    {
        // This would use a PDF generation library
        return 'PDF content for ' . json_encode($data);
    }
}