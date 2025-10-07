<?php

namespace Tests\Unit\Modules\Health\Guards;

use App\Modules\Health\Guards\ResponseAPIGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

/**
 * Test suite for Response API Guard Middleware
 *
 * Validates that PHI is stripped from API responses
 */
class ResponseAPIGuardTest extends TestCase
{
    private ResponseAPIGuard $guard;

    protected function setUp(): void
    {
        parent::setUp();
        $this->guard = new ResponseAPIGuard();
    }

    /**
     * Test that guard strips PHI fields from JSON response
     */
    public function test_strips_phi_fields_from_json_response(): void
    {
        $request = Request::create('/api/questionnaires', 'GET');

        $originalData = [
            'id' => 1,
            'status' => 'completed',
            'answers_encrypted_json' => 'encrypted:data',
            'answers_hash' => 'hash123',
            'email' => 'user@example.com'
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        $this->assertArrayHasKey('id', $data);
        $this->assertArrayHasKey('status', $data);
        $this->assertArrayNotHasKey('answers_encrypted_json', $data);
        $this->assertArrayNotHasKey('answers_hash', $data);
        $this->assertArrayNotHasKey('email', $data);
    }

    /**
     * Test that guard adds X-PHI-Stripped header
     */
    public function test_adds_phi_stripped_header(): void
    {
        $request = Request::create('/api/questionnaires', 'GET');
        $response = new JsonResponse(['id' => 1, 'email' => 'test@example.com']);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $this->assertEquals('true', $result->headers->get('X-PHI-Stripped'));
    }

    /**
     * Test that guard handles nested PHI fields
     */
    public function test_handles_nested_phi_fields(): void
    {
        $request = Request::create('/api/questionnaires', 'GET');

        $originalData = [
            'id' => 1,
            'user' => [
                'id' => 123,
                'name' => 'John Doe',
                'email' => 'john@example.com',
                'phone' => '+1234567890'
            ]
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('id', $data['user']);
        $this->assertArrayNotHasKey('email', $data['user']);
        $this->assertArrayNotHasKey('phone', $data['user']);
    }

    /**
     * Test that guard bypasses PHI stripping for admin routes
     */
    public function test_bypasses_phi_stripping_for_admin_routes(): void
    {
        $request = Request::create('/api/admin/health/questionnaires', 'GET');

        $originalData = [
            'id' => 1,
            'email' => 'user@example.com',
            'phone' => '+1234567890'
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        // PHI should NOT be stripped for admin routes
        $this->assertArrayHasKey('email', $data);
        $this->assertArrayHasKey('phone', $data);
    }

    /**
     * Test that guard bypasses PHI stripping for provider routes
     */
    public function test_bypasses_phi_stripping_for_provider_routes(): void
    {
        $request = Request::create('/api/provider/patient/123', 'GET');

        $originalData = [
            'id' => 123,
            'patient_name' => 'John Doe',
            'email' => 'john@example.com'
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        // PHI should NOT be stripped for provider routes
        $this->assertArrayHasKey('patient_name', $data);
        $this->assertArrayHasKey('email', $data);
    }

    /**
     * Test that guard does not modify non-JSON responses
     */
    public function test_does_not_modify_non_json_responses(): void
    {
        $request = Request::create('/api/test', 'GET');

        $htmlResponse = response('<html><body>Test</body></html>', 200)
            ->header('Content-Type', 'text/html');

        $result = $this->guard->handle($request, function () use ($htmlResponse) {
            return $htmlResponse;
        });

        $this->assertNotInstanceOf(JsonResponse::class, $result);
        $this->assertEquals('<html><body>Test</body></html>', $result->getContent());
    }

    /**
     * Test that guard strips password fields
     */
    public function test_strips_password_fields(): void
    {
        $request = Request::create('/api/users', 'GET');

        $originalData = [
            'id' => 1,
            'username' => 'johndoe',
            'password' => 'hashed_password',
            'password_hash' => 'bcrypt_hash',
            'api_token' => 'secret_token'
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        $this->assertArrayHasKey('username', $data);
        $this->assertArrayNotHasKey('password', $data);
        $this->assertArrayNotHasKey('password_hash', $data);
        $this->assertArrayNotHasKey('api_token', $data);
    }

    /**
     * Test that guard strips medical information
     */
    public function test_strips_medical_information(): void
    {
        $request = Request::create('/api/questionnaires', 'GET');

        $originalData = [
            'id' => 1,
            'status' => 'completed',
            'diagnosis' => 'hypertension',
            'medications' => ['lisinopril'],
            'symptoms' => ['headache', 'dizziness']
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        $this->assertArrayHasKey('status', $data);
        $this->assertArrayNotHasKey('diagnosis', $data);
        $this->assertArrayNotHasKey('medications', $data);
        $this->assertArrayNotHasKey('symptoms', $data);
    }

    /**
     * Test getPHIFields returns correct field list
     */
    public function test_get_phi_fields_returns_correct_list(): void
    {
        $fields = ResponseAPIGuard::getPHIFields();

        $this->assertIsArray($fields);
        $this->assertContains('email', $fields);
        $this->assertContains('phone', $fields);
        $this->assertContains('answers_encrypted_json', $fields);
        $this->assertContains('password', $fields);
    }

    /**
     * Test getBypassRoutes returns correct route patterns
     */
    public function test_get_bypass_routes_returns_correct_patterns(): void
    {
        $routes = ResponseAPIGuard::getBypassRoutes();

        $this->assertIsArray($routes);
        $this->assertContains('api/admin/health/*', $routes);
        $this->assertContains('api/provider/patient/*', $routes);
    }

    /**
     * Test that guard handles array of objects
     */
    public function test_handles_array_of_objects(): void
    {
        $request = Request::create('/api/questionnaires', 'GET');

        $originalData = [
            'data' => [
                [
                    'id' => 1,
                    'email' => 'user1@example.com',
                    'status' => 'completed'
                ],
                [
                    'id' => 2,
                    'email' => 'user2@example.com',
                    'status' => 'pending'
                ]
            ]
        ];

        $response = new JsonResponse($originalData);

        $result = $this->guard->handle($request, function () use ($response) {
            return $response;
        });

        $data = $result->getData(true);

        $this->assertArrayHasKey('data', $data);
        $this->assertCount(2, $data['data']);
        $this->assertArrayNotHasKey('email', $data['data'][0]);
        $this->assertArrayNotHasKey('email', $data['data'][1]);
        $this->assertArrayHasKey('status', $data['data'][0]);
    }
}
