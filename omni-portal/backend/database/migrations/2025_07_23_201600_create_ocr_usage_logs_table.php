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
        Schema::create('ocr_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('provider')->index(); // textract, tesseract
            $table->integer('pages')->default(1);
            $table->decimal('cost', 10, 4)->default(0);
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->unsignedBigInteger('document_id')->nullable()->index();
            $table->string('document_type')->nullable()->index();
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable(); // Additional tracking data
            $table->timestamps();

            // Foreign key constraints
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('document_id')->references('id')->on('documents')->onDelete('set null');

            // Indexes for efficient querying
            $table->index(['provider', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['document_type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ocr_usage_logs');
    }
};