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
        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // 'id_card', 'cpf', 'medical_report', etc.
            $table->string('name');
            $table->string('category'); // 'personal', 'medical', 'financial', 'legal'
            $table->text('description')->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('accepted_formats')->nullable(); // ['pdf', 'jpg', 'png']
            $table->integer('max_file_size')->default(10485760); // 10MB in bytes
            $table->integer('min_file_size')->default(1024); // 1KB in bytes
            $table->boolean('requires_verification')->default(true);
            $table->boolean('expires')->default(false);
            $table->integer('validity_days')->nullable(); // How long until it expires
            $table->json('validation_rules')->nullable(); // Custom validation rules
            $table->json('ocr_fields')->nullable(); // Fields to extract via OCR
            $table->integer('sort_order')->default(0);
            $table->json('required_for_steps')->nullable(); // Which onboarding steps require this
            $table->timestamps();
            
            // Indexes
            $table->index('code');
            $table->index('category');
            $table->index('is_required');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_types');
    }
};