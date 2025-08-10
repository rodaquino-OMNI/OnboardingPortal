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
        Schema::create('webhook_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('webhook_id')->unique();
            $table->string('health_plan_id')->index();
            $table->string('endpoint');
            $table->json('events'); // Array of event types to trigger webhook
            $table->text('secret'); // Encrypted webhook secret
            $table->json('retry_policy')->nullable(); // Retry configuration
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->timestamp('last_triggered_at')->nullable();
            $table->integer('trigger_count')->default(0);
            $table->integer('failure_count')->default(0);
            $table->timestamps();
            
            $table->index(['health_plan_id', 'status']);
            $table->index('status');
        });

        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('webhook_id');
            $table->unsignedBigInteger('alert_id')->nullable();
            $table->string('endpoint');
            $table->integer('status_code')->nullable();
            $table->boolean('success')->default(false);
            $table->integer('attempt_number')->default(1);
            $table->text('response_body')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            
            $table->foreign('alert_id')->references('id')->on('clinical_alerts')->onDelete('cascade');
            $table->index(['webhook_id', 'success']);
            $table->index('delivered_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webhook_deliveries');
        Schema::dropIfExists('webhook_configurations');
    }
};