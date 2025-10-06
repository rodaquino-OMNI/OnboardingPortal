<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates users table with authentication and gamification fields
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();

            // Authentication fields
            $table->string('email')->unique();
            $table->string('password');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('email_verification_token', 64)->nullable()->unique();
            $table->rememberToken();

            // Profile fields
            $table->string('name')->nullable();
            $table->string('cpf', 14)->nullable()->unique(); // Format: 123.456.789-01
            $table->date('birthdate')->nullable();
            $table->string('phone', 20)->nullable(); // Format: (11) 98765-4321
            $table->string('address', 500)->nullable();

            // LGPD compliance
            $table->boolean('lgpd_consent')->default(false);
            $table->boolean('terms_accepted')->default(false);
            $table->timestamp('lgpd_consent_at')->nullable();
            $table->timestamp('terms_accepted_at')->nullable();

            // Gamification fields
            $table->integer('points_balance')->default(0);
            $table->integer('current_level')->default(1);
            $table->integer('current_streak')->default(0);
            $table->timestamp('last_action_at')->nullable();
            $table->timestamp('streak_started_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Indexes for performance
            $table->index('email');
            $table->index('cpf');
            $table->index('points_balance');
            $table->index('current_level');
            $table->index('current_streak');
            $table->index('email_verification_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
