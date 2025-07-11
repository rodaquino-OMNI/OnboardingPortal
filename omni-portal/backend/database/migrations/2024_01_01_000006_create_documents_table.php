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
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('beneficiary_id')->constrained()->onDelete('cascade');
            $table->foreignId('uploaded_by')->constrained('users')->onDelete('cascade');
            $table->string('document_type'); // 'id_card', 'cpf', 'proof_of_residence', 'medical_report', etc.
            $table->string('document_category'); // 'personal', 'medical', 'financial', 'legal'
            $table->string('original_name');
            $table->string('stored_name'); // UUID or hashed filename
            $table->string('file_path');
            $table->string('mime_type');
            $table->bigInteger('file_size'); // in bytes
            $table->string('file_extension', 10);
            $table->enum('status', ['pending', 'approved', 'rejected', 'expired'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();
            $table->date('expiration_date')->nullable(); // For documents that expire
            $table->boolean('is_encrypted')->default(true);
            $table->string('encryption_key')->nullable(); // Reference to key vault
            $table->json('metadata')->nullable(); // Additional document metadata
            $table->json('ocr_data')->nullable(); // OCR extracted data if applicable
            $table->boolean('is_sensitive')->default(false); // LGPD sensitive data flag
            $table->string('checksum')->nullable(); // File integrity check
            $table->integer('version')->default(1); // Document version
            $table->foreignId('parent_document_id')->nullable()->constrained('documents')->onDelete('set null'); // For versioning
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('beneficiary_id');
            $table->index('document_type');
            $table->index('document_category');
            $table->index('status');
            $table->index('expiration_date');
            $table->index(['beneficiary_id', 'document_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};