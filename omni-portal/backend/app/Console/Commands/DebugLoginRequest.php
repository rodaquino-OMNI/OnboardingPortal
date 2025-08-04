<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\AuthController;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DebugLoginRequest extends Command
{
    protected $signature = 'debug:login {email=demo@example.com} {password=password123}';
    protected $description = 'Debug login request to identify 422 issue';

    public function handle()
    {
        $email = $this->argument('email');
        $password = $this->argument('password');

        $this->info("🔍 Debugging login request for: {$email}");

        // Create a test user if it doesn't exist
        $user = User::where('email', $email)->first();
        if (!$user) {
            $this->info("Creating test user...");
            $user = User::create([
                'name' => 'Test User',
                'email' => $email,
                'password' => Hash::make($password),
                'cpf' => '12345678901',
                'registration_step' => 'completed',
                'is_active' => true,
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'beneficiary',
            ]);
        }

        // Test 1: Create a mock request like the frontend would send
        $this->info("\n1. Testing request data format...");
        $requestData = [
            'email' => $email,
            'password' => $password,
        ];
        $this->line("Request data: " . json_encode($requestData, JSON_PRETTY_PRINT));

        // Test 2: Create a mock LoginRequest
        $this->info("\n2. Testing LoginRequest validation...");
        try {
            // Create a mock HTTP request with JSON content
            $jsonContent = json_encode($requestData);
            $request = Request::create('/api/auth/login', 'POST', [], [], [], [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
            ], $jsonContent);

            // Apply the request to a LoginRequest instance
            $loginRequest = LoginRequest::createFrom($request);
            
            // Manually merge the JSON data (simulating ForceJsonResponse middleware)
            $loginRequest->merge($requestData);
            
            // Check if validation would pass
            $validator = \Validator::make($requestData, $loginRequest->rules());
            
            if ($validator->fails()) {
                $this->error("❌ Validation failed:");
                foreach ($validator->errors()->all() as $error) {
                    $this->line("  - {$error}");
                }
            } else {
                $this->info("✅ Validation passed!");
                
                // Test the helper methods
                $this->line("Login field detected: " . $loginRequest->getLoginField());
                $credentials = $loginRequest->getCredentials();
                $this->line("Credentials: " . json_encode($credentials, JSON_PRETTY_PRINT));
                
                // Test input values
                $this->line("Email input: " . ($loginRequest->input('email') ?? 'NULL'));
                $this->line("Password input: " . ($loginRequest->input('password') ? '[PRESENT]' : 'NULL'));
            }

        } catch (\Exception $e) {
            $this->error("❌ Exception during validation: " . $e->getMessage());
            $this->line("Stack trace: " . $e->getTraceAsString());
        }

        // Test 3: Check if user would be found
        $this->info("\n3. Testing user lookup...");
        $field = filter_var($email, FILTER_VALIDATE_EMAIL) ? 'email' : 'cpf';
        $foundUser = User::where($field, $email)->first();
        
        if ($foundUser) {
            $this->info("✅ User found:");
            $this->line("  - ID: {$foundUser->id}");
            $this->line("  - Email: {$foundUser->email}");
            $this->line("  - CPF: {$foundUser->cpf}");
            $this->line("  - Active: " . ($foundUser->is_active ? 'Yes' : 'No'));
            $this->line("  - Registration: {$foundUser->registration_step}");
            $this->line("  - Locked: " . ($foundUser->isLocked() ? 'Yes' : 'No'));
        } else {
            $this->error("❌ User not found");
        }

        // Test 4: Check password
        if ($foundUser && Hash::check($password, $foundUser->password)) {
            $this->info("✅ Password check passed");
        } else {
            $this->error("❌ Password check failed");
        }

        $this->info("\n✅ Debug complete!");
    }
}