<?php

namespace Tests\Feature\Api;

use Tests\TestCase;
use App\Models\User;
use App\Models\Beneficiary;
use App\Models\GamificationProgress;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test single-step registration
     */
    public function test_single_step_registration(): void
    {
        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '12345678901',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'beneficiary' => [
                        'id',
                        'gamification_progress',
                    ],
                ],
                'token',
                'token_type',
            ])
            ->assertJson([
                'message' => 'Registration successful',
                'token_type' => 'Bearer',
            ]);

        // Verify user was created
        $this->assertDatabaseHas('users', [
            'email' => 'newuser@example.com',
            'cpf' => '12345678901',
            'registration_step' => 'completed',
            'is_active' => true,
            'lgpd_consent' => true,
        ]);

        // Verify beneficiary was created
        $user = User::where('email', 'newuser@example.com')->first();
        $this->assertDatabaseHas('beneficiaries', [
            'user_id' => $user->id,
            'cpf' => '12345678901',
            'full_name' => 'New User',
        ]);

        // Verify gamification was initialized
        $beneficiary = $user->beneficiary;
        $this->assertDatabaseHas('gamification_progress', [
            'beneficiary_id' => $beneficiary->id,
            'total_points' => 100,
            'current_level' => 1,
        ]);
    }

    /**
     * Test registration fails with existing email
     */
    public function test_registration_fails_with_existing_email(): void
    {
        // Arrange
        User::factory()->create(['email' => 'existing@example.com']);

        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New User',
            'email' => 'existing@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '98765432101',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    /**
     * Test registration fails with existing CPF
     */
    public function test_registration_fails_with_existing_cpf(): void
    {
        // Arrange
        User::factory()->create(['cpf' => '12345678901']);

        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '12345678901',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['cpf']);
    }

    /**
     * Test multi-step registration - Step 1
     */
    public function test_multi_step_registration_step1(): void
    {
        // Act
        $response = $this->postJson('/api/register/step1', [
            'name' => 'Test User',
            'email' => 'testuser@example.com',
            'cpf' => '11122233344',
        ]);

        // Assert
        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user_id',
                'registration_step',
                'token',
            ])
            ->assertJson([
                'message' => 'Etapa 1 concluída com sucesso',
                'registration_step' => 'contact',
            ]);

        // Verify user was created with temporary password
        $this->assertDatabaseHas('users', [
            'email' => 'testuser@example.com',
            'cpf' => '11122233344',
            'registration_step' => 'contact',
            'is_active' => false,
            'lgpd_consent' => true,
        ]);

        // Verify beneficiary was created
        $user = User::where('email', 'testuser@example.com')->first();
        $this->assertDatabaseHas('beneficiaries', [
            'user_id' => $user->id,
            'cpf' => '11122233344',
            'onboarding_status' => 'pending',
        ]);
    }

    /**
     * Test multi-step registration - Step 2
     */
    public function test_multi_step_registration_step2(): void
    {
        // Arrange - Create user at step 1
        $user = User::factory()->create([
            'registration_step' => 'contact',
            'is_active' => false,
        ]);
        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->postJson('/api/register/step2', [
            'phone' => '11999999999',
            'department' => 'IT',
            'job_title' => 'Developer',
            'employee_id' => 'EMP001',
            'start_date' => '2024-01-01',
            'birth_date' => '1990-05-15',
            'gender' => 'male',
            'marital_status' => 'single',
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Etapa 2 concluída com sucesso',
                'registration_step' => 'security',
            ]);

        // Verify user was updated
        $user->refresh();
        $this->assertEquals('security', $user->registration_step);
        $this->assertEquals('11999999999', $user->phone);
        $this->assertEquals('IT', $user->department);
        $this->assertEquals('Developer', $user->job_title);

        // Verify beneficiary was updated
        $beneficiary->refresh();
        $this->assertEquals('1990-05-15', $beneficiary->birth_date);
        $this->assertEquals('male', $beneficiary->gender);
        $this->assertEquals('single', $beneficiary->marital_status);
    }

    /**
     * Test multi-step registration - Step 3
     */
    public function test_multi_step_registration_step3(): void
    {
        // Arrange - Create user at step 2
        $user = User::factory()->create([
            'registration_step' => 'security',
            'is_active' => false,
        ]);
        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        $gamification = GamificationProgress::factory()->create([
            'beneficiary_id' => $beneficiary->id,
            'total_points' => 100,
        ]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->postJson('/api/register/step3', [
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
            'security_question' => 'What is your pet name?',
            'security_answer' => 'Fluffy',
            'two_factor_enabled' => true,
        ]);

        // Assert
        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user',
                'token',
                'token_type',
                'gamification' => [
                    'points_earned',
                    'total_points',
                    'level',
                ],
            ])
            ->assertJson([
                'message' => 'Registro concluído com sucesso! Você ganhou 100 pontos!',
                'token_type' => 'Bearer',
                'gamification' => [
                    'points_earned' => 100,
                ],
            ]);

        // Verify user was updated
        $user->refresh();
        $this->assertEquals('completed', $user->registration_step);
        $this->assertTrue($user->is_active);
        $this->assertEquals('active', $user->status);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('SecurePassword123!', $user->password));

        // Verify security preferences
        $preferences = $user->preferences;
        $this->assertEquals('What is your pet name?', $preferences['security_question']);
        $this->assertTrue(Hash::check('fluffy', $preferences['security_answer'])); // lowercase
        $this->assertTrue($preferences['two_factor_enabled']);

        // Verify gamification points were added
        $gamification->refresh();
        $this->assertEquals(200, $gamification->total_points); // 100 + 100
    }

    /**
     * Test step 2 requires correct registration step
     */
    public function test_step2_requires_correct_registration_step(): void
    {
        // Arrange - User at wrong step
        $user = User::factory()->create([
            'registration_step' => 'completed',
        ]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->postJson('/api/register/step2', [
            'phone' => '11999999999',
            'department' => 'IT',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['step']);
    }

    /**
     * Test step 3 requires correct registration step
     */
    public function test_step3_requires_correct_registration_step(): void
    {
        // Arrange - User at wrong step
        $user = User::factory()->create([
            'registration_step' => 'contact',
        ]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->postJson('/api/register/step3', [
            'password' => 'SecurePassword123!',
            'password_confirmation' => 'SecurePassword123!',
        ]);

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['step']);
    }

    /**
     * Test get registration progress
     */
    public function test_get_registration_progress(): void
    {
        // Arrange
        $user = User::factory()->create([
            'registration_step' => 'security',
        ]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->getJson('/api/register/progress');

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'current_step' => 'security',
                'steps' => [
                    'personal' => [
                        'completed' => true,
                        'title' => 'Informações Pessoais',
                    ],
                    'contact' => [
                        'completed' => true,
                        'title' => 'Informações de Contato',
                    ],
                    'security' => [
                        'completed' => true,
                        'title' => 'Segurança',
                    ],
                ],
                'completed' => false,
            ]);
    }

    /**
     * Test cancel registration
     */
    public function test_cancel_registration(): void
    {
        // Arrange
        $user = User::factory()->create([
            'registration_step' => 'contact',
            'is_active' => false,
        ]);
        $beneficiary = Beneficiary::factory()->create(['user_id' => $user->id]);
        $gamification = GamificationProgress::factory()->create(['beneficiary_id' => $beneficiary->id]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->deleteJson('/api/register/cancel');

        // Assert
        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Registro cancelado com sucesso',
            ]);

        // Verify everything was deleted
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('beneficiaries', ['id' => $beneficiary->id]);
        $this->assertDatabaseMissing('gamification_progress', ['id' => $gamification->id]);
    }

    /**
     * Test cannot cancel completed registration
     */
    public function test_cannot_cancel_completed_registration(): void
    {
        // Arrange
        $user = User::factory()->create([
            'registration_step' => 'completed',
            'is_active' => true,
        ]);
        
        Sanctum::actingAs($user);

        // Act
        $response = $this->deleteJson('/api/register/cancel');

        // Assert
        $response->assertStatus(422)
            ->assertJsonValidationErrors(['registration']);
    }

    /**
     * Test registration rolls back on error
     */
    public function test_registration_rolls_back_on_error(): void
    {
        // Force an error by making beneficiary creation fail
        DB::shouldReceive('beginTransaction')->once();
        DB::shouldReceive('commit')->never();
        DB::shouldReceive('rollBack')->once();

        // Act
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test User',
            'email' => 'rollback@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'cpf' => '99988877766',
        ]);

        // Assert
        $response->assertStatus(500)
            ->assertJson([
                'message' => 'Registration failed',
            ]);

        // Verify nothing was created
        $this->assertDatabaseMissing('users', ['email' => 'rollback@example.com']);
    }
}