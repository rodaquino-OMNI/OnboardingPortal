// Browser Console Test Script for Frontend Authentication
// Copy and paste this into the browser console at http://localhost:3000

console.log('🚀 Starting Frontend Authentication Test...');
console.log('📍 Current URL:', window.location.href);
console.log('🌐 Testing from origin:', window.location.origin);

async function testFrontendLogin() {
    try {
        console.log('\n📋 Step 1: Fetching CSRF Token...');
        
        // Step 1: Get CSRF Token
        const csrfResponse = await fetch('http://localhost:8000/sanctum/csrf-cookie', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });
        
        if (!csrfResponse.ok) {
            throw new Error(`CSRF fetch failed: ${csrfResponse.status}`);
        }
        
        console.log('✅ CSRF response status:', csrfResponse.status);
        console.log('✅ CORS headers:', {
            'Access-Control-Allow-Origin': csrfResponse.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Credentials': csrfResponse.headers.get('Access-Control-Allow-Credentials')
        });
        
        // Extract CSRF token from cookies
        const cookies = document.cookie.split(';');
        let csrfToken = null;
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'XSRF-TOKEN') {
                csrfToken = decodeURIComponent(value);
                break;
            }
        }
        
        if (!csrfToken) {
            throw new Error('CSRF token not found in cookies');
        }
        
        console.log('✅ CSRF token extracted:', csrfToken.substring(0, 20) + '...');
        
        // Step 2: Login
        console.log('\n🔐 Step 2: Attempting login...');
        const loginResponse = await fetch('http://localhost:8000/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'Origin': window.location.origin
            },
            body: JSON.stringify({
                email: 'admin@omnihealth.com',
                password: 'Admin@123'
            })
        });
        
        if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            throw new Error(`Login failed: ${loginResponse.status} - ${errorText}`);
        }
        
        const loginData = await loginResponse.json();
        console.log('✅ Login successful!');
        console.log('👤 User:', loginData.user.name, '(' + loginData.user.email + ')');
        console.log('🎫 Token:', loginData.token.substring(0, 30) + '...');
        
        // Step 3: Store in localStorage (as frontend would do)
        localStorage.setItem('auth_token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));
        console.log('💾 Token stored in localStorage');
        
        // Step 4: Test authenticated API call
        console.log('\n🔒 Step 3: Testing authenticated API call...');
        const authResponse = await fetch('http://localhost:8000/api/health', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${loginData.token}`,
                'Origin': window.location.origin
            }
        });
        
        if (!authResponse.ok) {
            throw new Error(`Authenticated API call failed: ${authResponse.status}`);
        }
        
        const healthData = await authResponse.json();
        console.log('✅ Authenticated API call successful!');
        console.log('🏥 Health Status:', healthData.status);
        
        console.log('\n🎉 ALL TESTS PASSED! Frontend authentication is working correctly.');
        console.log('\n📊 Test Results Summary:');
        console.log('  ✅ CORS headers properly configured');
        console.log('  ✅ CSRF token retrieved and used');
        console.log('  ✅ Login API call successful');
        console.log('  ✅ JWT token received and stored');
        console.log('  ✅ Authenticated API calls working');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Full error:', error);
        return false;
    }
}

// Auto-run the test
testFrontendLogin().then(success => {
    if (success) {
        console.log('\n✨ You can now try logging in normally through the UI with:');
        console.log('   📧 Email: admin@omnihealth.com');
        console.log('   🔑 Password: Admin@123');
    }
});