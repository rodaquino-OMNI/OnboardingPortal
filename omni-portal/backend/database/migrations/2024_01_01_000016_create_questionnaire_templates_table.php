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
        Schema::create('questionnaire_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->text('description')->nullable();
            $table->enum('type', ['initial', 'periodic', 'specific', 'custom'])->default('custom');
            $table->foreignId('health_category_id')->nullable()->constrained()->onDelete('set null');
            $table->json('sections')->nullable(); // Questionnaire sections and questions
            $table->json('scoring_rules')->nullable(); // How to calculate scores
            $table->json('risk_assessment_rules')->nullable(); // Rules for risk assessment
            $table->boolean('is_active')->default(true);
            $table->integer('version')->default(1);
            $table->integer('estimated_minutes')->default(10);
            $table->json('required_for')->nullable(); // User types or conditions
            $table->json('languages')->default('["pt-BR"]'); // Available languages
            $table->timestamps();
            
            // Indexes
            $table->index('code');
            $table->index('type');
            $table->index('health_category_id');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questionnaire_templates');
    }
};