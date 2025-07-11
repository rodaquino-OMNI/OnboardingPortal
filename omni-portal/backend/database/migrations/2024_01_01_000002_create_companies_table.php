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
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('cnpj', 20)->unique();
            $table->string('trading_name')->nullable();
            $table->string('email');
            $table->string('phone', 20);
            $table->string('address');
            $table->string('city');
            $table->string('state', 2);
            $table->string('zip_code', 10);
            $table->string('country')->default('BR');
            $table->string('contact_person');
            $table->string('contact_email');
            $table->string('contact_phone', 20);
            $table->enum('plan_type', ['basic', 'standard', 'premium', 'enterprise'])->default('basic');
            $table->integer('max_beneficiaries')->default(50);
            $table->boolean('is_active')->default(true);
            $table->date('contract_start_date')->nullable();
            $table->date('contract_end_date')->nullable();
            $table->json('settings')->nullable(); // Company-specific settings
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('cnpj');
            $table->index('is_active');
            $table->index('plan_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};