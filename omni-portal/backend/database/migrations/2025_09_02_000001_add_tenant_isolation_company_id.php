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
        // Add company_id to users table for tenant isolation
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('id');
            $table->index('company_id');
        });

        // Add company_id to health_questionnaires table for tenant isolation
        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('beneficiary_id');
            $table->index('company_id');
        });

        // Add company_id to documents table for tenant isolation
        Schema::table('documents', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('beneficiary_id');
            $table->index('company_id');
        });

        // Add company_id to interviews table for tenant isolation
        Schema::table('interviews', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('beneficiary_id');
            $table->index('company_id');
        });

        // Add company_id to audit_logs table for tenant isolation
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('id');
            $table->index('company_id');
        });

        // Add company_id to gamification_progress table for tenant isolation
        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('beneficiary_id');
            $table->index('company_id');
        });

        // Add company_id to notifications table for tenant isolation
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained()->after('id');
            $table->index('company_id');
        });

        // Add compound indexes for better query performance
        Schema::table('users', function (Blueprint $table) {
            $table->index(['company_id', 'email']);
            $table->index(['company_id', 'role']);
        });

        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->index(['company_id', 'beneficiary_id']);
            $table->index(['company_id', 'status']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->index(['company_id', 'beneficiary_id']);
            $table->index(['company_id', 'status']);
        });

        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->index(['company_id', 'user_id']);
            $table->index(['company_id', 'onboarding_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove compound indexes first
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'user_id']);
            $table->dropIndex(['company_id', 'onboarding_status']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'beneficiary_id']);
            $table->dropIndex(['company_id', 'status']);
        });

        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'beneficiary_id']);
            $table->dropIndex(['company_id', 'status']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'email']);
            $table->dropIndex(['company_id', 'role']);
        });

        // Remove company_id columns
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('gamification_progress', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('interviews', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('health_questionnaires', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};