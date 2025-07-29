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
        Schema::create('video_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->onDelete('cascade');
            $table->string('session_id')->unique(); // Vonage session ID
            $table->enum('provider', ['vonage', 'webrtc', 'teams', 'zoom'])->default('vonage');
            $table->enum('status', ['created', 'active', 'ended', 'failed'])->default('created');
            $table->json('participants'); // Array of participant data
            $table->json('settings'); // Session settings (recording, chat, screen share, etc.)
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            
            // Recording information
            $table->string('recording_archive_id')->nullable(); // Vonage archive ID
            $table->enum('recording_status', ['not_started', 'recording', 'stopped', 'available', 'failed'])->default('not_started');
            $table->timestamp('recording_started_at')->nullable();
            $table->timestamp('recording_stopped_at')->nullable();
            $table->integer('recording_duration')->nullable(); // In seconds
            $table->bigInteger('recording_size')->nullable(); // In bytes
            $table->string('recording_url')->nullable(); // Secure URL for download
            $table->foreignId('recording_started_by')->nullable()->constrained('users')->onDelete('set null');
            
            // Session lifecycle
            $table->timestamp('started_at')->nullable(); // When first participant joined
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('ended_by')->nullable()->constrained('users')->onDelete('set null');
            $table->integer('duration_minutes')->nullable(); // Actual session duration
            
            // Quality and analytics
            $table->json('session_analytics')->nullable(); // Stream quality, connection stats
            $table->json('technical_issues')->nullable(); // Any technical problems encountered
            $table->integer('quality_rating')->nullable(); // 1-5 overall session quality
            
            // Chat and interaction features
            $table->boolean('chat_enabled')->default(true);
            $table->boolean('screen_share_enabled')->default(true);
            $table->boolean('recording_enabled')->default(true);
            $table->json('chat_messages')->nullable(); // Store chat history
            $table->json('screen_share_sessions')->nullable(); // Screen sharing activity log
            
            // HIPAA compliance and security
            $table->boolean('hipaa_compliant')->default(true);
            $table->boolean('encryption_enabled')->default(true);
            $table->string('encryption_key_id')->nullable(); // Reference to encryption key
            $table->json('security_audit_log')->nullable(); // Security events
            
            // Billing and usage
            $table->integer('bandwidth_used')->nullable(); // In MB
            $table->integer('storage_used')->nullable(); // For recordings, in MB
            $table->decimal('session_cost', 10, 4)->nullable(); // Cost calculation
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for performance
            $table->index('interview_id');
            $table->index('session_id');
            $table->index('provider');
            $table->index('status');
            $table->index('created_by');
            $table->index('recording_archive_id');
            $table->index('recording_status');
            $table->index(['status', 'created_at']);
            $table->index(['provider', 'status']);
            $table->index(['interview_id', 'status']);
            $table->index(['created_at', 'ended_at']); // For duration queries
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('video_sessions');
    }
};