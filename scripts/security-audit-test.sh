#!/bin/bash

echo "=== OnboardingPortal Security Audit Test Suite ==="
echo "Date: $(date)"
echo "=========================================="

API_BASE="http://localhost:8000/api"

echo ""
echo "1. SECURITY HEADERS TEST"
echo "========================"
echo "Testing API health endpoint headers:"
curl -I $API_BASE/health 2>/dev/null | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection|Referrer-Policy|Content-Security-Policy)"

echo ""
echo "2. CSRF PROTECTION TEST"
echo "======================="
echo "Testing CSRF without token (should fail):"
CSRF_TEST=$(curl -X POST $API_BASE/auth/logout -H "Content-Type: application/json" -w "HTTP Status: %{http_code}" -s)
echo "$CSRF_TEST" | grep -E "(HTTP Status|CSRF|token)"

echo ""
echo "3. RATE LIMITING TEST"
echo "===================="
echo "Testing rate limiting on login endpoint:"
for i in {1..3}; do
  echo "Request $i:"
  curl -X POST $API_BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent@test.com","password":"wrongpass"}' \
    -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|error)"
  sleep 0.5
done

echo ""
echo "4. SQL INJECTION PROTECTION TEST"
echo "================================"
echo "Testing SQL injection attempts:"

# Test 1: SQL injection in email field
echo "Test 1 - Email field injection:"
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com'\'' OR 1=1 --","password":"test"}' \
  -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|error)"

# Test 2: SQL injection in password field
echo "Test 2 - Password field injection:"
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"'\'' UNION SELECT * FROM users --"}' \
  -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|error)"

echo ""
echo "5. XSS PROTECTION TEST"
echo "====================="
echo "Testing XSS prevention:"
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","device_name":"<script>alert(\"XSS\")</script>"}' \
  -w "HTTP Status: %{http_code}" -s | grep -E "(script|alert|XSS|HTTP Status)"

echo ""
echo "6. AUTHENTICATION MIDDLEWARE TEST"
echo "================================="
echo "Testing protected endpoint without token:"
curl -X GET $API_BASE/user \
  -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|Unauthenticated)"

echo "Testing protected endpoint with invalid token:"
curl -X GET $API_BASE/user \
  -H "Authorization: Bearer invalid_token_here" \
  -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|Unauthenticated)"

echo ""
echo "7. INPUT VALIDATION TEST"
echo "======================="
echo "Testing invalid JSON payload:"
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":}' \
  -w "HTTP Status: %{http_code}" -s | grep -E "(JSON|message|HTTP Status)"

echo ""
echo "8. SENSITIVE DATA EXPOSURE TEST"
echo "==============================="
echo "Testing if password appears in responses:"
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -s | grep -i password | head -1

echo ""
echo "9. LARGE PAYLOAD PROTECTION TEST"
echo "================================"
echo "Testing large payload rejection:"
LARGE_PAYLOAD=$(python3 -c "print('a' * 10000)")
curl -X POST $API_BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$LARGE_PAYLOAD@example.com\",\"password\":\"test\"}" \
  -w "HTTP Status: %{http_code}" -s | grep -E "(Payload|large|HTTP Status)"

echo ""
echo "10. DIRECTORY TRAVERSAL TEST"
echo "============================"
echo "Testing directory traversal attempts:"
curl -X GET "$API_BASE/../../etc/passwd" \
  -w "HTTP Status: %{http_code}" -s | grep -E "(message|HTTP Status|traversal|Forbidden)"

echo ""
echo "=========================================="
echo "Security Audit Test Complete"
echo "Date: $(date)"
echo "=========================================="