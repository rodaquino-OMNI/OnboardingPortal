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
        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->boolean('enabled')->default(false);
            $table->json('config')->nullable();
            $table->text('description')->nullable();
            $table->timestamp('enabled_at')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();

            $table->index(['key', 'enabled']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('feature_flags');
    }
};
