<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create rewards table
        Schema::create('rewards', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description');
            $table->json('benefits'); // Array of benefits
            $table->integer('points_required');
            $table->enum('type', [
                'badge',           // Visual badge only
                'discount',        // Percentage discount
                'service_upgrade', // Service upgrade (e.g., premium consultation)
                'physical_item',   // Physical item delivery
                'digital_item',    // Digital item (report, guide, etc.)
                'feature_unlock',  // Unlock app features
                'priority_access', // Priority support/scheduling
            ]);
            $table->json('delivery_config')->nullable(); // Configuration for reward delivery
            $table->string('icon')->nullable();
            $table->string('color_scheme')->nullable();
            $table->boolean('is_premium')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_limited')->default(false);
            $table->integer('quantity_available')->nullable(); // For limited rewards
            $table->integer('quantity_claimed')->default(0);
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            
            $table->index('code');
            $table->index('points_required');
            $table->index('is_active');
        });

        // Create user_rewards table (tracking claimed rewards)
        Schema::create('user_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('reward_id')->constrained('rewards')->onDelete('cascade');
            $table->enum('status', [
                'unlocked',    // User has enough points but hasn't claimed
                'claimed',     // User claimed the reward
                'delivered',   // Reward was delivered/activated
                'expired',     // Reward expired before use
                'revoked'      // Reward was revoked (admin action)
            ])->default('unlocked');
            $table->timestamp('unlocked_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('delivery_details')->nullable(); // Store delivery information
            $table->json('usage_data')->nullable(); // Track usage (e.g., discount codes)
            $table->string('redemption_code')->nullable()->unique(); // Unique code for redemption
            $table->text('notes')->nullable();
            $table->timestamps();
            
            $table->unique(['user_id', 'reward_id']);
            $table->index('status');
            $table->index('redemption_code');
        });

        // Create reward_transactions table (audit trail)
        Schema::create('reward_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->enum('action', [
                'unlock',
                'claim',
                'deliver',
                'expire',
                'revoke',
                'redeem'
            ]);
            $table->integer('points_at_time');
            $table->json('metadata')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at');
            
            $table->index(['user_id', 'created_at']);
            $table->index('action');
        });

        // Create reward_delivery_queue table (for async delivery)
        Schema::create('reward_delivery_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_reward_id')->constrained('user_rewards')->onDelete('cascade');
            $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->integer('attempts')->default(0);
            $table->json('delivery_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            
            $table->index(['status', 'scheduled_at']);
        });

        // Insert initial rewards data
        $this->seedInitialRewards();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reward_delivery_queue');
        Schema::dropIfExists('reward_transactions');
        Schema::dropIfExists('user_rewards');
        Schema::dropIfExists('rewards');
    }

    /**
     * Seed initial rewards matching the frontend display
     */
    private function seedInitialRewards(): void
    {
        $rewards = [
            [
                'code' => 'welcome-badge',
                'name' => 'Emblema de Boas-Vindas',
                'description' => 'Seu primeiro passo na jornada',
                'benefits' => json_encode(['Primeira conquista', '+10 pontos extras']),
                'points_required' => 10,
                'type' => 'badge',
                'delivery_config' => json_encode(['auto_deliver' => true, 'bonus_points' => 10]),
                'icon' => 'award',
                'color_scheme' => 'from-green-400 to-green-600',
                'is_premium' => false,
                'sort_order' => 1,
            ],
            [
                'code' => 'early-bird',
                'name' => 'Early Bird',
                'description' => 'Complete tarefas matinais',
                'benefits' => json_encode(['Bônus de produtividade', '+25 pontos']),
                'points_required' => 50,
                'type' => 'badge',
                'delivery_config' => json_encode(['auto_deliver' => true, 'bonus_points' => 25]),
                'icon' => 'clock',
                'color_scheme' => 'from-yellow-400 to-orange-500',
                'is_premium' => false,
                'sort_order' => 2,
            ],
            [
                'code' => 'team-player',
                'name' => 'Team Player',
                'description' => 'Colabore com colegas',
                'benefits' => json_encode(['Reconhecimento da equipe', '+50 pontos']),
                'points_required' => 100,
                'type' => 'badge',
                'delivery_config' => json_encode(['auto_deliver' => true, 'bonus_points' => 50]),
                'icon' => 'users',
                'color_scheme' => 'from-blue-400 to-blue-600',
                'is_premium' => false,
                'sort_order' => 3,
            ],
            [
                'code' => 'health-champion',
                'name' => 'Campeão da Saúde',
                'description' => 'Complete avaliações de saúde',
                'benefits' => json_encode(['Relatório personalizado', '+100 pontos']),
                'points_required' => 200,
                'type' => 'digital_item',
                'delivery_config' => json_encode([
                    'auto_deliver' => false,
                    'bonus_points' => 100,
                    'report_type' => 'health_assessment_premium'
                ]),
                'icon' => 'heart',
                'color_scheme' => 'from-red-400 to-pink-600',
                'is_premium' => false,
                'sort_order' => 4,
            ],
            [
                'code' => 'premium-consultation',
                'name' => 'Consulta Premium Exclusiva',
                'description' => 'Acesso VIP ao concierge de saúde',
                'benefits' => json_encode([
                    'Atendimento prioritário 24/7',
                    'Especialistas exclusivos',
                    'Sem filas de espera',
                    'Acompanhamento personalizado',
                    'Relatórios detalhados',
                    'Suporte via WhatsApp'
                ]),
                'points_required' => 500,
                'type' => 'service_upgrade',
                'delivery_config' => json_encode([
                    'auto_deliver' => false,
                    'service_type' => 'telemedicine_premium',
                    'priority_level' => 'vip',
                    'features' => [
                        'priority_scheduling' => true,
                        'exclusive_specialists' => true,
                        'no_waiting' => true,
                        'personalized_followup' => true,
                        'detailed_reports' => true,
                        'whatsapp_support' => true
                    ]
                ]),
                'icon' => 'crown',
                'color_scheme' => 'from-purple-500 to-pink-600',
                'is_premium' => true,
                'sort_order' => 5,
            ]
        ];

        foreach ($rewards as $reward) {
            DB::table('rewards')->insert(array_merge($reward, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
};