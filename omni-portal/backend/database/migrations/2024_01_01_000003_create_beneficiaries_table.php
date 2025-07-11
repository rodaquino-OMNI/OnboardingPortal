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
        Schema::create('beneficiaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('company_id')->nullable()->constrained()->onDelete('set null');
            $table->string('cpf', 14)->unique();
            $table->string('full_name');
            $table->date('birth_date');
            $table->enum('gender', ['male', 'female', 'other', 'prefer_not_to_say'])->nullable();
            $table->string('phone', 20);
            $table->string('mobile_phone', 20)->nullable();
            $table->string('address');
            $table->string('number', 10);
            $table->string('complement')->nullable();
            $table->string('neighborhood');
            $table->string('city');
            $table->string('state', 2);
            $table->string('zip_code', 10);
            $table->string('country')->default('BR');
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 20)->nullable();
            $table->string('emergency_contact_relationship')->nullable();
            $table->enum('marital_status', ['single', 'married', 'divorced', 'widowed', 'other'])->nullable();
            $table->string('occupation')->nullable();
            $table->decimal('monthly_income', 10, 2)->nullable();
            $table->boolean('has_health_insurance')->default(false);
            $table->string('health_insurance_provider')->nullable();
            $table->string('health_insurance_number')->nullable();
            $table->enum('onboarding_status', ['pending', 'in_progress', 'completed', 'cancelled'])->default('pending');
            $table->integer('onboarding_step')->default(1);
            $table->timestamp('onboarding_completed_at')->nullable();
            $table->json('custom_fields')->nullable(); // For additional custom data
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('cpf');
            $table->index('company_id');
            $table->index('onboarding_status');
            $table->index(['user_id', 'company_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beneficiaries');
    }
};