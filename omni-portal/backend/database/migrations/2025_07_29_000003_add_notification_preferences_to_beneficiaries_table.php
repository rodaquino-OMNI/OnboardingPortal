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
        Schema::table('beneficiaries', function (Blueprint $table) {
            // Add notification preferences field
            $table->json('notification_preferences')->nullable()->after('lgpd_consent_version');
            
            // Add timezone field if not exists
            if (!Schema::hasColumn('beneficiaries', 'timezone')) {
                $table->string('timezone')->default('America/Sao_Paulo')->after('notification_preferences');
            }
            
            // Add preferred language if not exists
            if (!Schema::hasColumn('beneficiaries', 'preferred_language')) {
                $table->string('preferred_language', 5)->default('pt')->after('timezone');
            }
            
            // Add index for timezone
            $table->index('timezone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
            
            if (Schema::hasColumn('beneficiaries', 'timezone')) {
                $table->dropIndex(['timezone']);
                $table->dropColumn('timezone');
            }
            
            if (Schema::hasColumn('beneficiaries', 'preferred_language')) {
                $table->dropColumn('preferred_language');
            }
        });
    }
};