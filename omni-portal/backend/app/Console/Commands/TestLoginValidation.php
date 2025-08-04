<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TestLoginValidation extends Command
{
    protected $signature = 'test:login-validation {email?} {password?}';
    protected $description = 'Test login validation to debug 422 error';

    public function handle()
    {
        $email = $this->argument('email') ?? 'test@example.com';
        $password = $this->argument('password') ?? 'password123';

        $this->info("Testing login validation for: {$email}");

        // Test 1: Direct LoginRequest validation
        $this->info("\n1. Testing LoginRequest validation rules...");
        $loginRequest = new LoginRequest();
        $rules = $loginRequest->rules();
        $this->line("Rules: " . json_encode($rules, JSON_PRETTY_PRINT));

        // Test 2: Validator with test data
        $this->info("\n2. Testing with valid data...");
        $testData = [
            'email' => $email,
            'password' => $password,
        ];
        
        $validator = Validator::make($testData, $rules);
        if ($validator->fails()) {
            $this->error("VALIDATION FAILED:");
            foreach ($validator->errors()->all() as $error) {
                $this->line("  - {$error}");
            }
        } else {
            $this->info("✅ Validation passed!");
        }

        // Test 3: Test with missing email
        $this->info("\n3. Testing with missing email...");
        $invalidData = ['password' => $password];
        $validator = Validator::make($invalidData, $rules);
        if ($validator->fails()) {
            $this->line("Expected validation errors:");
            foreach ($validator->errors()->all() as $error) {
                $this->line("  - {$error}");
            }
        }

        // Test 4: Test with missing password
        $this->info("\n4. Testing with missing password...");
        $invalidData = ['email' => $email];
        $validator = Validator::make($invalidData, $rules);
        if ($validator->fails()) {
            $this->line("Expected validation errors:");
            foreach ($validator->errors()->all() as $error) {
                $this->line("  - {$error}");
            }
        }

        // Test 5: Test getLoginField method
        $this->info("\n5. Testing getLoginField method...");
        $request = new class extends LoginRequest {
            private $input = [];
            
            public function setInput($data) {
                $this->input = $data;
            }
            
            public function input($key = null, $default = null) {
                if ($key === null) return $this->input;
                return $this->input[$key] ?? $default;
            }
        };
        
        // Test with email
        $request->setInput(['email' => 'test@example.com']);
        $this->line("Email 'test@example.com' -> field: " . $request->getLoginField());
        
        // Test with CPF
        $request->setInput(['email' => '12345678901']);
        $this->line("CPF '12345678901' -> field: " . $request->getLoginField());

        $this->info("\n✅ Login validation test completed!");
    }
}