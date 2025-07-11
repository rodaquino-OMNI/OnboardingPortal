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
            // CPF (Brazilian tax ID) - unique identifier
            $table->string('cpf', 14)->nullable()->unique()->after('email');
            
            // Multi-step registration tracking
            $table->enum('registration_step', ['personal', 'contact', 'security', 'completed'])
                ->default('personal')
                ->after('role');
            
            // LGPD (Brazilian GDPR) compliance
            $table->boolean('lgpd_consent')->default(false)->after('registration_step');
            $table->timestamp('lgpd_consent_at')->nullable()->after('lgpd_consent');
            $table->string('lgpd_consent_ip', 45)->nullable()->after('lgpd_consent_at');
            
            // Additional fields for HR requirements
            $table->string('department')->nullable()->after('phone');
            $table->string('job_title')->nullable()->after('department');
            $table->string('employee_id')->nullable()->unique()->after('job_title');
            $table->date('start_date')->nullable()->after('employee_id');
            $table->enum('status', ['pending', 'active', 'suspended', 'inactive'])
                ->default('pending')
                ->after('start_date');
            
            // Authentication tracking
            $table->timestamp('last_login_at')->nullable()->after('email_verified_at');
            $table->string('last_login_ip', 45)->nullable()->after('last_login_at');
            $table->integer('failed_login_attempts')->default(0)->after('last_login_ip');
            $table->timestamp('locked_until')->nullable()->after('failed_login_attempts');
            
            // Indexes
            $table->index('cpf');
            $table->index('employee_id');
            $table->index('status');
            $table->index('registration_step');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'cpf',
                'registration_step',
                'lgpd_consent',
                'lgpd_consent_at',
                'lgpd_consent_ip',
                'department',
                'job_title',
                'employee_id',
                'start_date',
                'status',
                'last_login_at',
                'last_login_ip',
                'failed_login_attempts',
                'locked_until'
            ]);
        });
    }
};