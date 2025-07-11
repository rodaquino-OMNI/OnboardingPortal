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
        Schema::create('interviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->foreignId('interview_slot_id')->constrained()->onDelete('cascade');
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            $table->string('booking_reference')->unique(); // Unique booking ID
            $table->enum('status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'])->default('scheduled');
            $table->timestamp('scheduled_at');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->onDelete('set null');
            $table->boolean('beneficiary_joined')->default(false);
            $table->boolean('professional_joined')->default(false);
            $table->integer('duration_minutes')->nullable(); // Actual duration
            $table->text('pre_interview_notes')->nullable(); // Notes before interview
            $table->text('interview_notes')->nullable(); // Notes during interview
            $table->text('post_interview_notes')->nullable(); // Summary after interview
            $table->json('discussion_topics')->nullable(); // Topics covered
            $table->json('recommendations')->nullable(); // Professional recommendations
            $table->json('follow_up_actions')->nullable(); // Required follow-ups
            $table->date('next_appointment_date')->nullable();
            $table->integer('beneficiary_rating')->nullable(); // 1-5 rating
            $table->text('beneficiary_feedback')->nullable();
            $table->integer('professional_rating')->nullable(); // Professional's rating of session
            $table->boolean('requires_follow_up')->default(false);
            $table->boolean('documents_reviewed')->default(false);
            $table->json('reviewed_documents')->nullable(); // IDs of documents reviewed
            $table->string('recording_url')->nullable(); // If session was recorded
            $table->json('technical_issues')->nullable(); // Any technical problems
            $table->string('meeting_platform')->nullable(); // zoom, teams, etc.
            $table->string('meeting_id')->nullable(); // External meeting ID
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('beneficiary_id');
            $table->index('interview_slot_id');
            $table->index('healthcare_professional_id');
            $table->index('booking_reference');
            $table->index('status');
            $table->index('scheduled_at');
            $table->index(['beneficiary_id', 'status']);
            $table->index(['healthcare_professional_id', 'scheduled_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interviews');
    }
};