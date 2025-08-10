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
        Schema::create('health_plan_integrations', function (Blueprint $table) {
            $table->id();
            $table->string('plan_id')->unique();
            $table->string('plan_name');
            $table->string('contact_email');
            $table->string('contact_phone')->nullable();
            $table->boolean('api_access_enabled')->default(false);
            $table->string('api_key')->nullable(); // Encrypted API key
            $table->string('api_secret')->nullable(); // Encrypted API secret
            $table->json('allowed_endpoints')->nullable(); // Specific endpoints this plan can access
            $table->json('ip_whitelist')->nullable(); // IP addresses allowed for this plan
            $table->integer('rate_limit')->default(1000); // Requests per hour
            $table->enum('status', ['active', 'inactive', 'suspended', 'pending'])->default('pending');
            $table->timestamp('last_api_access')->nullable();
            $table->integer('total_api_calls')->default(0);
            $table->date('subscription_start')->nullable();
            $table->date('subscription_end')->nullable();
            $table->json('features_enabled')->nullable(); // Specific features/modules enabled
            $table->json('data_sharing_agreement')->nullable(); // Terms and conditions
            $table->timestamps();
            
            $table->index('plan_id');
            $table->index('status');
            $table->index(['status', 'api_access_enabled']);
        });

        // OAuth2 tokens for external API access
        Schema::create('oauth_health_plan_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('health_plan_id');
            $table->string('access_token', 500);
            $table->string('refresh_token', 500)->nullable();
            $table->string('token_type')->default('Bearer');
            $table->json('scopes')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            
            $table->foreign('health_plan_id')->references('plan_id')->on('health_plan_integrations')->onDelete('cascade');
            $table->index('health_plan_id');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oauth_health_plan_tokens');
        Schema::dropIfExists('health_plan_integrations');
    }
};