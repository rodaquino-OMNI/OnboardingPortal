<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create a default company if none exists
        $defaultCompanyId = $this->ensureDefaultCompany();

        // Use SQLite-compatible UPDATE statements with subqueries
        
        // Populate company_id for existing users based on beneficiary relationships
        DB::statement("
            UPDATE users 
            SET company_id = (
                SELECT b.company_id 
                FROM beneficiaries b 
                WHERE b.user_id = users.id 
                AND b.company_id IS NOT NULL
            )
            WHERE users.company_id IS NULL
            AND EXISTS (
                SELECT 1 FROM beneficiaries b 
                WHERE b.user_id = users.id AND b.company_id IS NOT NULL
            )
        ");

        // Set remaining users to default company
        DB::table('users')
            ->whereNull('company_id')
            ->update(['company_id' => $defaultCompanyId]);

        // Populate health_questionnaires company_id based on beneficiary
        DB::statement("
            UPDATE health_questionnaires 
            SET company_id = (
                SELECT b.company_id 
                FROM beneficiaries b 
                WHERE b.id = health_questionnaires.beneficiary_id 
                AND b.company_id IS NOT NULL
            )
            WHERE health_questionnaires.company_id IS NULL
            AND EXISTS (
                SELECT 1 FROM beneficiaries b 
                WHERE b.id = health_questionnaires.beneficiary_id AND b.company_id IS NOT NULL
            )
        ");

        // Populate documents company_id based on beneficiary
        DB::statement("
            UPDATE documents 
            SET company_id = (
                SELECT b.company_id 
                FROM beneficiaries b 
                WHERE b.id = documents.beneficiary_id 
                AND b.company_id IS NOT NULL
            )
            WHERE documents.company_id IS NULL
            AND EXISTS (
                SELECT 1 FROM beneficiaries b 
                WHERE b.id = documents.beneficiary_id AND b.company_id IS NOT NULL
            )
        ");

        // Populate interviews company_id based on beneficiary
        if (Schema::hasTable('interviews')) {
            DB::statement("
                UPDATE interviews 
                SET company_id = (
                    SELECT b.company_id 
                    FROM beneficiaries b 
                    WHERE b.id = interviews.beneficiary_id 
                    AND b.company_id IS NOT NULL
                )
                WHERE interviews.company_id IS NULL
                AND EXISTS (
                    SELECT 1 FROM beneficiaries b 
                    WHERE b.id = interviews.beneficiary_id AND b.company_id IS NOT NULL
                )
            ");
        }

        // Populate gamification_progress company_id based on beneficiary
        if (Schema::hasTable('gamification_progress')) {
            DB::statement("
                UPDATE gamification_progress 
                SET company_id = (
                    SELECT b.company_id 
                    FROM beneficiaries b 
                    WHERE b.id = gamification_progress.beneficiary_id 
                    AND b.company_id IS NOT NULL
                )
                WHERE gamification_progress.company_id IS NULL
                AND EXISTS (
                    SELECT 1 FROM beneficiaries b 
                    WHERE b.id = gamification_progress.beneficiary_id AND b.company_id IS NOT NULL
                )
            ");
        }

        // Populate audit_logs company_id based on user relationships
        if (Schema::hasTable('audit_logs') && Schema::hasColumn('audit_logs', 'user_id')) {
            DB::statement("
                UPDATE audit_logs 
                SET company_id = (
                    SELECT u.company_id 
                    FROM users u 
                    WHERE u.id = audit_logs.user_id 
                    AND u.company_id IS NOT NULL
                )
                WHERE audit_logs.company_id IS NULL
                AND EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = audit_logs.user_id AND u.company_id IS NOT NULL
                )
            ");
        }

        // Populate notifications company_id based on user relationships
        if (Schema::hasTable('notifications') && Schema::hasColumn('notifications', 'notifiable_id')) {
            DB::statement("
                UPDATE notifications 
                SET company_id = (
                    SELECT u.company_id 
                    FROM users u 
                    WHERE u.id = notifications.notifiable_id 
                    AND notifications.notifiable_type = 'App\\\\Models\\\\User'
                    AND u.company_id IS NOT NULL
                )
                WHERE notifications.company_id IS NULL
                AND notifications.notifiable_type = 'App\\\\Models\\\\User'
                AND EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = notifications.notifiable_id AND u.company_id IS NOT NULL
                )
            ");
        }
    }

    /**
     * Ensure a default company exists and return its ID.
     */
    private function ensureDefaultCompany(): int
    {
        $defaultCompany = DB::table('companies')
            ->where('name', 'Default Company')
            ->first();

        if (!$defaultCompany) {
            $companyId = DB::table('companies')->insertGetId([
                'name' => 'Default Company',
                'cnpj' => '00000000000000',
                'trading_name' => 'Default Company',
                'email' => 'admin@defaultcompany.com',
                'phone' => '(00) 0000-0000',
                'address' => 'Default Address',
                'city' => 'Default City',
                'state' => 'SP',
                'zip_code' => '00000-000',
                'country' => 'BR',
                'contact_person' => 'System Administrator',
                'contact_email' => 'admin@defaultcompany.com',
                'contact_phone' => '(00) 0000-0000',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            
            return $companyId;
        }

        return $defaultCompany->id;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove the populated company_id values
        DB::table('users')->update(['company_id' => null]);
        DB::table('health_questionnaires')->update(['company_id' => null]);
        DB::table('documents')->update(['company_id' => null]);
        
        if (Schema::hasTable('interviews')) {
            DB::table('interviews')->update(['company_id' => null]);
        }
        
        if (Schema::hasTable('gamification_progress')) {
            DB::table('gamification_progress')->update(['company_id' => null]);
        }
        
        if (Schema::hasTable('audit_logs')) {
            DB::table('audit_logs')->update(['company_id' => null]);
        }
        
        if (Schema::hasTable('notifications')) {
            DB::table('notifications')->update(['company_id' => null]);
        }

        // Remove the default company if it was created
        DB::table('companies')
            ->where('name', 'Default Company')
            ->where('cnpj', '00000000000000')
            ->delete();
    }
};