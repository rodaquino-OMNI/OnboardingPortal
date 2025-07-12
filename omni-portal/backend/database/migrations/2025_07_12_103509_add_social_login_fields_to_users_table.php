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
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('password');
            $table->string('facebook_id')->nullable()->unique()->after('google_id');
            $table->string('instagram_id')->nullable()->unique()->after('facebook_id');
            $table->string('avatar_url')->nullable()->after('instagram_id');
            $table->string('social_provider')->nullable()->after('avatar_url');
            $table->boolean('social_login')->default(false)->after('social_provider');
            
            // Make password nullable for social login users
            $table->string('password')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'google_id',
                'facebook_id',
                'instagram_id',
                'avatar_url',
                'social_provider',
                'social_login'
            ]);
            
            // Revert password to not nullable
            $table->string('password')->nullable(false)->change();
        });
    }
};