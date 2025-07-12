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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->morphs('notifiable'); // notifiable_type and notifiable_id
            $table->text('data'); // JSON data for the notification
            $table->timestamp('read_at')->nullable();
            $table->string('channel')->default('database'); // 'database', 'email', 'sms', 'push'
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal');
            $table->string('category')->nullable(); // 'system', 'health', 'appointment', 'gamification', etc.
            $table->string('action_url')->nullable(); // URL to action
            $table->string('action_text')->nullable(); // Button text
            $table->timestamp('expires_at')->nullable(); // When notification becomes irrelevant
            $table->json('metadata')->nullable(); // Additional metadata
            $table->timestamps();
            
            // Indexes (morphs() already creates notifiable_type + notifiable_id index)
            $table->index('read_at');
            $table->index('channel');
            $table->index('priority');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};