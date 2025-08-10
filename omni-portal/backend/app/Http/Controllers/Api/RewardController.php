<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reward;
use App\Models\UserReward;
use App\Models\RewardTransaction;
use App\Services\RewardDeliveryService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class RewardController extends Controller
{
    protected RewardDeliveryService $deliveryService;

    public function __construct(RewardDeliveryService $deliveryService)
    {
        $this->middleware('auth:sanctum');
        $this->deliveryService = $deliveryService;
    }

    /**
     * List all available rewards for the user
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            $beneficiary = $user->beneficiary;
            $userPoints = $beneficiary ? $beneficiary->gamification_points : 0;

            $rewards = Reward::where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('points_required')
                ->get()
                ->map(function ($reward) use ($user, $userPoints) {
                    // Check user's reward status
                    $userReward = UserReward::where('user_id', $user->id)
                        ->where('reward_id', $reward->id)
                        ->first();

                    return [
                        'id' => $reward->id,
                        'code' => $reward->code,
                        'name' => $reward->name,
                        'description' => $reward->description,
                        'benefits' => $reward->benefits,
                        'points_required' => $reward->points_required,
                        'type' => $reward->type,
                        'icon' => $reward->icon,
                        'color_scheme' => $reward->color_scheme,
                        'is_premium' => $reward->is_premium,
                        'is_available' => $reward->isAvailable(),
                        'is_unlocked' => $userPoints >= $reward->points_required,
                        'can_claim' => $reward->canBeClaimed($user),
                        'user_status' => $userReward ? $userReward->status : null,
                        'redemption_code' => $userReward && $userReward->status === 'claimed' 
                            ? $userReward->redemption_code 
                            : null,
                        'claimed_at' => $userReward ? $userReward->claimed_at : null,
                        'delivered_at' => $userReward ? $userReward->delivered_at : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'rewards' => $rewards,
                    'user_points' => $userPoints,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching rewards: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar recompensas'
            ], 500);
        }
    }

    /**
     * Get a specific reward details
     */
    public function show($id): JsonResponse
    {
        try {
            $user = Auth::user();
            $reward = Reward::findOrFail($id);
            $beneficiary = $user->beneficiary;
            $userPoints = $beneficiary ? $beneficiary->gamification_points : 0;

            $userReward = UserReward::where('user_id', $user->id)
                ->where('reward_id', $reward->id)
                ->first();

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $reward->id,
                    'code' => $reward->code,
                    'name' => $reward->name,
                    'description' => $reward->description,
                    'benefits' => $reward->benefits,
                    'points_required' => $reward->points_required,
                    'type' => $reward->type,
                    'icon' => $reward->icon,
                    'color_scheme' => $reward->color_scheme,
                    'is_premium' => $reward->is_premium,
                    'is_available' => $reward->isAvailable(),
                    'is_unlocked' => $userPoints >= $reward->points_required,
                    'can_claim' => $reward->canBeClaimed($user),
                    'user_status' => $userReward ? $userReward->status : null,
                    'redemption_code' => $userReward && in_array($userReward->status, ['claimed', 'delivered'])
                        ? $userReward->redemption_code 
                        : null,
                    'claimed_at' => $userReward ? $userReward->claimed_at : null,
                    'delivered_at' => $userReward ? $userReward->delivered_at : null,
                    'delivery_details' => $userReward ? $userReward->delivery_details : null,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching reward: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Recompensa não encontrada'
            ], 404);
        }
    }

    /**
     * Claim a reward
     */
    public function claim(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();
            $reward = Reward::findOrFail($id);

            // Check if user can claim
            if (!$reward->canBeClaimed($user)) {
                throw ValidationException::withMessages([
                    'reward' => 'Você não pode resgatar esta recompensa no momento'
                ]);
            }

            DB::beginTransaction();

            // Create or update user reward
            $userReward = UserReward::firstOrCreate(
                [
                    'user_id' => $user->id,
                    'reward_id' => $reward->id,
                ],
                [
                    'status' => 'unlocked',
                    'unlocked_at' => now(),
                ]
            );

            // Mark as claimed
            $userReward->markAsClaimed();

            // Process automatic delivery for certain reward types
            if ($reward->delivery_config['auto_deliver'] ?? false) {
                $this->deliveryService->processDelivery($userReward);
            }

            // Award bonus points if configured
            if ($bonusPoints = $reward->delivery_config['bonus_points'] ?? 0) {
                $beneficiary = $user->beneficiary;
                if ($beneficiary) {
                    $beneficiary->increment('gamification_points', $bonusPoints);
                    
                    // Log bonus points
                    RewardTransaction::create([
                        'user_id' => $user->id,
                        'reward_id' => $reward->id,
                        'action' => 'redeem',
                        'points_at_time' => $beneficiary->gamification_points,
                        'metadata' => ['bonus_points' => $bonusPoints],
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Recompensa resgatada com sucesso!',
                'data' => [
                    'redemption_code' => $userReward->redemption_code,
                    'status' => $userReward->status,
                    'bonus_points' => $bonusPoints ?? 0,
                ]
            ]);

        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error claiming reward: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao resgatar recompensa'
            ], 500);
        }
    }

    /**
     * Redeem a reward (use the claimed reward)
     */
    public function redeem(Request $request, $id): JsonResponse
    {
        $request->validate([
            'redemption_code' => 'required|string'
        ]);

        try {
            $user = Auth::user();
            $reward = Reward::findOrFail($id);

            $userReward = UserReward::where('user_id', $user->id)
                ->where('reward_id', $reward->id)
                ->where('redemption_code', $request->redemption_code)
                ->firstOrFail();

            if (!$userReward->canBeRedeemed()) {
                throw ValidationException::withMessages([
                    'reward' => 'Esta recompensa não pode ser utilizada'
                ]);
            }

            // Process redemption based on reward type
            $result = $this->deliveryService->processRedemption($userReward, $request->all());

            return response()->json([
                'success' => true,
                'message' => 'Recompensa utilizada com sucesso!',
                'data' => $result
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            Log::error('Error redeeming reward: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao utilizar recompensa'
            ], 500);
        }
    }

    /**
     * Get user's reward history
     */
    public function history(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            $history = UserReward::with('reward')
                ->where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($userReward) {
                    return [
                        'id' => $userReward->id,
                        'reward' => [
                            'id' => $userReward->reward->id,
                            'name' => $userReward->reward->name,
                            'description' => $userReward->reward->description,
                            'icon' => $userReward->reward->icon,
                            'points_required' => $userReward->reward->points_required,
                        ],
                        'status' => $userReward->status,
                        'redemption_code' => in_array($userReward->status, ['claimed', 'delivered']) 
                            ? $userReward->redemption_code 
                            : null,
                        'unlocked_at' => $userReward->unlocked_at,
                        'claimed_at' => $userReward->claimed_at,
                        'delivered_at' => $userReward->delivered_at,
                        'expires_at' => $userReward->expires_at,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $history
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching reward history: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar histórico de recompensas'
            ], 500);
        }
    }
}