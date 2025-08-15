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
        Schema::table('gamification_badges', function (Blueprint $table) {
            // Increase category column length to handle longer values like 'telemedicine'
            $table->string('category', 50)->change();
        });
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
