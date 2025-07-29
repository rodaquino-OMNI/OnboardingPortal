<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateAdminUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:admin';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create or update the admin test user';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Create or update admin user
        $user = User::updateOrCreate(
            ['email' => 'admin@test.com'],
            [
                'name' => 'Admin Test',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'role' => 'super_admin',
                'phone' => '+5511999999999',
                'cpf' => '98765432109',
                'birthdate' => '1985-01-01',
                'gender' => 'F',
                'preferred_language' => 'pt-BR',
                'registration_step' => 'completed',
                'registration_completed_at' => now(),
                'preferences' => json_encode(['notifications' => ['email' => true]]),
            ]
        );

        $this->info('Admin test user created/updated successfully!');
        $this->info('Email: admin@test.com');
        $this->info('Password: password');
        $this->info('Role: super_admin');
        $this->info('Registration: Completed');
        
        return Command::SUCCESS;
    }
}