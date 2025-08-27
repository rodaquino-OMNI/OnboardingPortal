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
        // Check if table exists before trying to modify it
        if (Schema::hasTable('gamification_badges')) {
            Schema::table('gamification_badges', function (Blueprint $table) {
                // Increase category column length to handle longer values like 'telemedicine'
                $table->string('category', 50)->change();
            });
        } else {
            // Create the table if it doesn't exist
            Schema::create('gamification_badges', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('icon')->nullable();
                $table->string('category', 50)->default('general');
                $table->integer('points_required')->default(0);
                $table->string('criteria')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                
                // Add performance indexes
                $table->index(['category', 'is_active']);
                $table->index(['points_required']);
                $table->index(['name']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gamification_badges', function (Blueprint $table) {
            //
        });
    }
};
