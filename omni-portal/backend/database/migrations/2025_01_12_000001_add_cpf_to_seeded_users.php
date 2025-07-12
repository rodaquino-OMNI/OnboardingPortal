<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update seeded users with CPF values
        DB::table('users')->where('email', 'admin@omnihealth.com')->update(['cpf' => '111.111.111-11']);
        DB::table('users')->where('email', 'maria.silva@omnihealth.com')->update(['cpf' => '222.222.222-22']);
        DB::table('users')->where('email', 'joao.santos@example.com')->update(['cpf' => '333.333.333-33']);
        DB::table('users')->where('email', 'ana.costa@techcorp.com')->update(['cpf' => '444.444.444-44']);
        
        // Update test users
        for ($i = 1; $i <= 10; $i++) {
            $cpf = str_pad($i, 3, '0', STR_PAD_LEFT) . '.' . str_pad($i, 3, '0', STR_PAD_LEFT) . '.' . str_pad($i, 3, '0', STR_PAD_LEFT) . '-' . str_pad($i, 2, '0', STR_PAD_LEFT);
            DB::table('users')->where('email', "testuser$i@example.com")->update(['cpf' => $cpf]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Set CPF to null for all users
        DB::table('users')->update(['cpf' => null]);
    }
};