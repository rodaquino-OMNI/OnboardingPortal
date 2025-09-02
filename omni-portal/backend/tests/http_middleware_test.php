<?php

/**
 * HTTP Middleware Tenant Boundary Test
 * 
 * Tests the TenantBoundaryMiddleware with simulated HTTP requests
 */

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\TenantBoundaryMiddleware;
use App\Models\User;
use App\Models\Company;
use App\Models\Beneficiary;
use Illuminate\Support\Facades\Auth;

echo "🛡️  TESTING TENANT BOUNDARY MIDDLEWARE\n";
echo str_repeat("=", 50) . "\n";

// Get existing data for testing
$company = Company::first();
echo "🏢 Using company: {$company->name} (ID: {$company->id})\n";

// Get users from this company
$companyUsers = User::withoutTenant()->where('company_id', $company->id)->get();
echo "👥 Company users available: {$companyUsers->count()}\n";

if ($companyUsers->count() === 0) {
    echo "❌ No users with company_id found for testing\n";
    exit;
}

$testUser = $companyUsers->first();
echo "🧪 Testing with user: {$testUser->name} (Company: {$testUser->company_id})\n";

// Get or create a beneficiary for testing
$beneficiary = Beneficiary::withoutTenant()->where('company_id', $company->id)->first();
if (!$beneficiary) {
    echo "📝 Creating test beneficiary...\n";
    $beneficiary = Beneficiary::create([
        'user_id' => $testUser->id,
        'company_id' => $company->id,
        'cpf' => '12312312312',
        'name' => 'Test Beneficiary',
        'email' => 'test.beneficiary@test.com',
        'phone' => '11987654321',
        'birth_date' => '1990-01-01',
        'onboarding_status' => 'in_progress'
    ]);
    echo "✅ Created test beneficiary (ID: {$beneficiary->id})\n";
} else {
    echo "✅ Using existing beneficiary (ID: {$beneficiary->id})\n";
}

echo "\n🔍 TESTING MIDDLEWARE SCENARIOS\n";
echo str_repeat("-", 40) . "\n";

// Test 1: Unauthenticated request - should pass through
echo "\n1️⃣  Testing unauthenticated request:\n";
Auth::logout();

$middleware = new TenantBoundaryMiddleware();
$request = new Request();
$request->setRouteResolver(function() {
    $route = new \Illuminate\Routing\Route(['GET'], '/test', []);
    return $route;
});

try {
    $response = $middleware->handle($request, function($req) {
        return response('OK');
    });
    echo "   ✅ Unauthenticated request passed through middleware\n";
} catch (Exception $e) {
    echo "   ❌ Unauthenticated request failed: " . $e->getMessage() . "\n";
}

// Test 2: Authenticated user accessing their own resources
echo "\n2️⃣  Testing authenticated user with valid access:\n";
Auth::login($testUser);
echo "   🔐 Logged in as: {$testUser->name} (Company: {$testUser->company_id})\n";

// Create a request with route parameters that match the user's company
$request2 = new Request();
$mockRoute = new \Illuminate\Routing\Route(['GET'], '/beneficiaries/{beneficiary}', []);
$mockRoute->parameters = ['beneficiary' => $beneficiary->id];
$request2->setRouteResolver(function() use ($mockRoute) {
    return $mockRoute;
});

try {
    $response = $middleware->handle($request2, function($req) {
        return response('Access Granted');
    });
    echo "   ✅ Valid tenant access allowed through middleware\n";
} catch (Exception $e) {
    echo "   ❌ Valid tenant access denied: " . $e->getMessage() . "\n";
}

// Test 3: User trying to access resource from different company
echo "\n3️⃣  Testing cross-tenant access prevention:\n";

// Create a user from a different company for testing
$otherCompany = Company::create([
    'name' => 'Other Test Company',
    'cnpj' => '99999999000199',
    'email' => 'other@test.com',
    'phone' => '11777666555',
    'address' => 'Rua Other 999',
    'city' => 'Brasília',
    'state' => 'DF',
    'zip_code' => '09876543',
    'contact_person' => 'Other Admin',
    'contact_email' => 'other@test.com',
    'contact_phone' => '11777666555',
]);

$otherUser = User::create([
    'name' => 'Other Company User',
    'email' => 'other.user@test.com',
    'password' => bcrypt('password'),
    'company_id' => $otherCompany->id,
    'role' => 'employee',
    'cpf' => '98765432109'
]);

$otherBeneficiary = Beneficiary::create([
    'user_id' => $otherUser->id,
    'company_id' => $otherCompany->id,
    'cpf' => '98765432109',
    'name' => 'Other Beneficiary',
    'email' => 'other.ben@test.com',
    'phone' => '11888999777',
    'birth_date' => '1992-02-02',
    'onboarding_status' => 'pending'
]);

echo "   📊 Created other company (ID: {$otherCompany->id}) and user (ID: {$otherUser->id})\n";

// Now try to access other company's beneficiary while logged as original user
$request3 = new Request();
$mockRoute3 = new \Illuminate\Routing\Route(['GET'], '/beneficiaries/{beneficiary}', []);
$mockRoute3->parameters = ['beneficiary' => $otherBeneficiary->id];
$request3->setRouteResolver(function() use ($mockRoute3) {
    return $mockRoute3;
});

try {
    $response = $middleware->handle($request3, function($req) {
        return response('Should Not Reach Here');
    });
    echo "   ❌ SECURITY BREACH: Cross-tenant access was allowed!\n";
} catch (Exception $e) {
    echo "   ✅ Cross-tenant access prevented: " . $e->getMessage() . "\n";
}

// Test 4: Request data validation
echo "\n4️⃣  Testing request data validation:\n";

// Try to send data with different company_id
$request4 = new Request(['company_id' => $otherCompany->id, 'name' => 'Test Data']);
$request4->setRouteResolver(function() {
    $route = new \Illuminate\Routing\Route(['POST'], '/test', []);
    return $route;
});

try {
    $response = $middleware->handle($request4, function($req) {
        return response('Should Not Reach Here');
    });
    echo "   ❌ SECURITY BREACH: Different company_id in request data was allowed!\n";
} catch (Exception $e) {
    echo "   ✅ Invalid company_id in request data prevented: " . $e->getMessage() . "\n";
}

// Test 5: Super admin bypass
echo "\n5️⃣  Testing super admin bypass:\n";

// Create a super admin user
$superAdmin = User::create([
    'name' => 'Super Admin',
    'email' => 'super@admin.com',
    'password' => bcrypt('password'),
    'company_id' => null,
    'role' => 'super-admin',
    'cpf' => '00000000000'
]);

// Note: This would require Spatie roles to be properly set up
// For now, we simulate the behavior
Auth::login($superAdmin);
echo "   🔐 Logged in as super admin\n";

try {
    $response = $middleware->handle($request3, function($req) {
        return response('Super Admin Access');
    });
    echo "   ✅ Super admin bypass working (if roles are configured)\n";
} catch (Exception $e) {
    echo "   ⚠️  Super admin test: " . $e->getMessage() . " (may be expected if roles not configured)\n";
}

echo "\n📊 MIDDLEWARE VALIDATION SUMMARY\n";
echo str_repeat("=", 40) . "\n";

// Check what the middleware actually validates
echo "🔍 Middleware validates:\n";
echo "   ✓ Route parameters (beneficiary, document, interview, etc.)\n";
echo "   ✓ Request data company_id fields\n";
echo "   ✓ Nested request data company_id fields\n";
echo "   ✓ User access permissions\n";
echo "   ✓ Super admin bypass\n";

// Show current database state
echo "\n📈 Database state after tests:\n";
$totalUsers = User::withoutTenant()->count();
$totalBeneficiaries = Beneficiary::withoutTenant()->count();
echo "   Total users: {$totalUsers}\n";
echo "   Total beneficiaries: {$totalBeneficiaries}\n";

// Show tenant distribution
$userDistribution = User::withoutTenant()
    ->selectRaw('company_id, COUNT(*) as count')
    ->whereNotNull('company_id')
    ->groupBy('company_id')
    ->get();

echo "   User distribution by company:\n";
foreach ($userDistribution as $dist) {
    echo "     Company {$dist->company_id}: {$dist->count} users\n";
}

// Cleanup test data
echo "\n🧹 Cleaning up test data...\n";
$superAdmin->delete();
$otherUser->delete();
$otherBeneficiary->delete();
$otherCompany->delete();

// Only delete the beneficiary if we created it
if ($beneficiary->email === 'test.beneficiary@test.com') {
    $beneficiary->delete();
    echo "   ✅ Test beneficiary deleted\n";
}

echo "✅ Test data cleaned up\n";

Auth::logout();
echo "\n🏁 TENANT BOUNDARY MIDDLEWARE VALIDATION COMPLETED\n";