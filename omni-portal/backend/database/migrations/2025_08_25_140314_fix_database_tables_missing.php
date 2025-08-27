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
        // Create gamification_badges table if it doesn't exist
        if (!Schema::hasTable('gamification_badges')) {
            Schema::create('gamification_badges', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('icon')->nullable();
                $table->string('category', 50)->default('general'); // Set adequate length
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

        // Add missing columns to existing tables safely
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'lgpd_consent_explicit')) {
                    $table->boolean('lgpd_consent_explicit')->default(false)->after('lgpd_consent');
                }
            });
        }

        // Create performance optimization indexes
        $this->createPerformanceIndexes();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gamification_badges');
        
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'lgpd_consent_explicit')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('lgpd_consent_explicit');
            });
        }
    }

    /**
     * Create performance optimization indexes
     */
    private function createPerformanceIndexes(): void
    {
        try {
            // Users table optimizations for faster auth queries
            if (Schema::hasTable('users')) {
                Schema::table('users', function (Blueprint $table) {
                    // Composite index for email + active status (login optimization)
                    if (!$this->indexExists('users', 'users_email_is_active_index')) {
                        $table->index(['email', 'is_active'], 'users_email_is_active_index');
                    }
                    // Composite index for CPF + active status (login optimization)
                    if (!$this->indexExists('users', 'users_cpf_is_active_index')) {
                        $table->index(['cpf', 'is_active'], 'users_cpf_is_active_index');
                    }
                    // Index for last login tracking
                    if (!$this->indexExists('users', 'users_last_login_at_index')) {
                        $table->index(['last_login_at'], 'users_last_login_at_index');
                    }
                });
            }

            // Personal access tokens optimizations for faster API auth
            if (Schema::hasTable('personal_access_tokens')) {
                Schema::table('personal_access_tokens', function (Blueprint $table) {
                    if (!$this->indexExists('personal_access_tokens', 'personal_access_tokens_tokenable_expires_index')) {
                        $table->index(['tokenable_id', 'tokenable_type', 'expires_at'], 'personal_access_tokens_tokenable_expires_index');
                    }
                });
            }

        } catch (\Exception $e) {
            // Log the error but don't fail the migration
            \Log::warning('Failed to create some performance indexes: ' . $e->getMessage());
        }
    }

    /**
     * Check if index exists to prevent duplicate creation
     */
    private function indexExists(string $table, string $indexName): bool
    {
        try {
            $indexes = Schema::getConnection()->getDoctrineSchemaManager()->listTableIndexes($table);
            return isset($indexes[$indexName]);
        } catch (\Exception $e) {
            return false;
        }
    }
};
