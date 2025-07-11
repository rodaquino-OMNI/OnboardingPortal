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
        Schema::create('interview_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('healthcare_professional_id')->constrained('users')->onDelete('cascade');
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('duration_minutes')->default(30);
            $table->enum('status', ['available', 'booked', 'blocked', 'completed', 'cancelled'])->default('available');
            $table->enum('interview_type', ['initial', 'follow_up', 'medical', 'psychological', 'nutritional'])->default('initial');
            $table->boolean('is_recurring')->default(false);
            $table->enum('recurrence_pattern', ['daily', 'weekly', 'biweekly', 'monthly'])->nullable();
            $table->date('recurrence_end_date')->nullable();
            $table->integer('max_bookings')->default(1); // For group sessions
            $table->integer('current_bookings')->default(0);
            $table->decimal('price', 8, 2)->nullable(); // If paid consultations
            $table->string('meeting_link')->nullable(); // For video consultations
            $table->enum('meeting_type', ['in_person', 'video', 'phone'])->default('video');
            $table->string('location')->nullable(); // For in-person meetings
            $table->text('notes')->nullable(); // Internal notes
            $table->json('availability_rules')->nullable(); // Custom availability rules
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('healthcare_professional_id');
            $table->index('date');
            $table->index('status');
            $table->index(['date', 'start_time']);
            $table->index(['healthcare_professional_id', 'date', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interview_slots');
    }
};