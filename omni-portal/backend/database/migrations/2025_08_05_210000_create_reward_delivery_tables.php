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
        // Service upgrades table
        Schema::create('service_upgrades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->string('service_type');
            $table->string('upgrade_type');
            $table->json('features')->nullable();
            $table->timestamp('activated_at');
            $table->timestamp('expires_at')->nullable();
            $table->enum('status', ['active', 'expired', 'cancelled'])->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['beneficiary_id', 'status']);
            $table->index('service_type');
        });

        // Beneficiary service access table
        Schema::create('beneficiary_service_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->string('service_type');
            $table->string('access_level')->default('basic');
            $table->json('features')->nullable();
            $table->timestamp('granted_at');
            $table->timestamp('expires_at')->nullable();
            $table->string('source')->nullable();
            $table->string('source_reference')->nullable();
            $table->timestamps();
            
            $table->unique(['beneficiary_id', 'service_type']);
            $table->index('access_level');
        });

        // Digital assets table
        Schema::create('digital_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->string('asset_type');
            $table->string('asset_name');
            $table->string('asset_path')->nullable();
            $table->string('access_url')->nullable();
            $table->string('download_token')->unique();
            $table->integer('download_count')->default(0);
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('regenerated_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index('download_token');
            $table->index(['beneficiary_id', 'asset_type']);
        });

        // Discount codes table
        Schema::create('discount_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->enum('discount_type', ['percentage', 'fixed']);
            $table->decimal('discount_value', 10, 2);
            $table->string('applicable_to')->default('all');
            $table->decimal('minimum_amount', 10, 2)->default(0);
            $table->timestamp('valid_from');
            $table->timestamp('valid_until');
            $table->integer('max_uses')->default(1);
            $table->integer('used_count')->default(0);
            $table->timestamp('last_used_at')->nullable();
            $table->json('usage_details')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index('code');
            $table->index(['user_id', 'valid_until']);
        });

        // Shipping orders table
        Schema::create('shipping_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->string('item_name');
            $table->text('item_description')->nullable();
            $table->json('shipping_address');
            $table->enum('status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled'])->default('pending');
            $table->string('tracking_number')->nullable();
            $table->string('carrier')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('estimated_delivery')->nullable();
            $table->json('shipping_updates')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'status']);
            $table->index('tracking_number');
        });

        // Feature access table
        Schema::create('feature_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->string('feature_key');
            $table->boolean('enabled')->default(true);
            $table->timestamp('unlocked_at');
            $table->string('unlocked_by')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->unique(['beneficiary_id', 'feature_key']);
            $table->index(['enabled', 'expires_at']);
        });

        // Priority access table
        Schema::create('priority_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->foreignId('reward_id')->nullable()->constrained('rewards')->onDelete('set null');
            $table->string('access_type')->default('general');
            $table->enum('priority_level', ['standard', 'high', 'vip', 'platinum'])->default('high');
            $table->json('services')->nullable();
            $table->timestamp('granted_at');
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('usage_log')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['beneficiary_id', 'is_active']);
            $table->index(['priority_level', 'expires_at']);
        });

        // Report generation service table (for digital items)
        Schema::create('generated_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained('beneficiaries')->onDelete('cascade');
            $table->string('report_type');
            $table->string('report_name');
            $table->string('file_path')->nullable();
            $table->string('access_token')->unique();
            $table->json('report_data')->nullable();
            $table->enum('status', ['pending', 'generating', 'completed', 'failed'])->default('pending');
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index(['beneficiary_id', 'report_type']);
            $table->index('access_token');
        });

        // Reward delivery queue (already referenced in main migration)
        if (!Schema::hasTable('reward_delivery_queue')) {
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
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('generated_reports');
        Schema::dropIfExists('priority_access');
        Schema::dropIfExists('feature_access');
        Schema::dropIfExists('shipping_orders');
        Schema::dropIfExists('discount_codes');
        Schema::dropIfExists('digital_assets');
        Schema::dropIfExists('beneficiary_service_access');
        Schema::dropIfExists('service_upgrades');
        Schema::dropIfExists('reward_delivery_queue');
    }
};