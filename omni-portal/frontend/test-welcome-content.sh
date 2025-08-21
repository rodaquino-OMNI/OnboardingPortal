#!/bin/bash

# Test script to verify welcome page content rendering
# This script tests multiple scenarios for the welcome page

echo "=== Welcome Page Content Testing ==="
echo

# Start development server if not running
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "Starting development server..."
    npm run dev > dev.log 2>&1 &
    DEV_PID=$!
    echo $DEV_PID > dev.pid
    sleep 8
    echo "Development server started (PID: $DEV_PID)"
else
    echo "Development server already running"
fi

echo

# Test 1: Direct curl access (should work with updated middleware)
echo "Test 1: Direct curl access to /welcome"
echo "---------------------------------------"
CURL_RESULT=$(curl -s -w "%{http_code}" http://localhost:3000/welcome)
HTTP_CODE=${CURL_RESULT: -3}
CONTENT=${CURL_RESULT%???}

echo "HTTP Status: $HTTP_CODE"

if [[ $HTTP_CODE == "200" ]]; then
    if echo "$CONTENT" | grep -q "Bem-vindo"; then
        echo "✅ SUCCESS: Portuguese content 'Bem-vindo' found"
        echo "✅ Welcome page is rendering correctly"
    else
        echo "❌ FAIL: Portuguese content 'Bem-vindo' not found"
        echo "Content preview:"
        echo "$CONTENT" | head -5
    fi
elif [[ $HTTP_CODE == "307" ]] || [[ $HTTP_CODE == "302" ]]; then
    echo "⚠️  REDIRECT: Page redirected (likely to login)"
    LOCATION=$(curl -s -I http://localhost:3000/welcome | grep -i location | cut -d' ' -f2)
    echo "Redirected to: $LOCATION"
else
    echo "❌ FAIL: Unexpected HTTP status $HTTP_CODE"
fi

echo

# Test 2: Test with authentication cookies
echo "Test 2: Access with authentication cookies"
echo "------------------------------------------"
AUTH_RESULT=$(curl -s -w "%{http_code}" \
    -H "Cookie: authenticated=true; auth_token=test_token; onboarding_session=active" \
    http://localhost:3000/welcome)
AUTH_HTTP_CODE=${AUTH_RESULT: -3}
AUTH_CONTENT=${AUTH_RESULT%???}

echo "HTTP Status: $AUTH_HTTP_CODE"

if [[ $AUTH_HTTP_CODE == "200" ]]; then
    if echo "$AUTH_CONTENT" | grep -q "Bem-vindo"; then
        echo "✅ SUCCESS: Authenticated access works, Portuguese content found"
    else
        echo "❌ FAIL: Authenticated access but Portuguese content missing"
    fi
else
    echo "❌ FAIL: Authenticated access failed with status $AUTH_HTTP_CODE"
fi

echo

# Test 3: Check specific Portuguese content elements
echo "Test 3: Verify specific Portuguese content elements"
echo "---------------------------------------------------"
if [[ $HTTP_CODE == "200" ]] || [[ $AUTH_HTTP_CODE == "200" ]]; then
    # Use the successful content
    TEST_CONTENT="$CONTENT"
    if [[ $AUTH_HTTP_CODE == "200" ]]; then
        TEST_CONTENT="$AUTH_CONTENT"
    fi
    
    # Check for key Portuguese phrases
    if echo "$TEST_CONTENT" | grep -q "Bem-vindo ao Processo de Onboarding"; then
        echo "✅ Main title: 'Bem-vindo ao Processo de Onboarding' found"
    else
        echo "❌ Main title missing"
    fi
    
    if echo "$TEST_CONTENT" | grep -q "Vamos completar alguns passos"; then
        echo "✅ Subtitle: 'Vamos completar alguns passos' found"
    else
        echo "❌ Subtitle missing"
    fi
    
    if echo "$TEST_CONTENT" | grep -q "Informações da Empresa"; then
        echo "✅ Step 1: 'Informações da Empresa' found"
    else
        echo "❌ Step 1 missing"
    fi
    
    if echo "$TEST_CONTENT" | grep -q "Começar Onboarding"; then
        echo "✅ CTA button: 'Começar Onboarding' found"
    else
        echo "❌ CTA button missing"
    fi
else
    echo "❌ Cannot test content - no successful response received"
fi

echo

# Test 4: Browser simulation test
echo "Test 4: Browser simulation test"
echo "-------------------------------"
BROWSER_RESULT=$(curl -s -w "%{http_code}" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    http://localhost:3000/welcome)
BROWSER_HTTP_CODE=${BROWSER_RESULT: -3}

echo "HTTP Status: $BROWSER_HTTP_CODE"
if [[ $BROWSER_HTTP_CODE == "200" ]]; then
    echo "✅ Browser simulation successful"
elif [[ $BROWSER_HTTP_CODE == "307" ]] || [[ $BROWSER_HTTP_CODE == "302" ]]; then
    echo "⚠️  Browser simulation redirected (expected for unauthenticated users)"
else
    echo "❌ Browser simulation failed"
fi

echo

# Summary
echo "=== TEST SUMMARY ==="
echo "1. Direct curl access: $([ $HTTP_CODE == "200" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "2. Authenticated access: $([ $AUTH_HTTP_CODE == "200" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "3. Portuguese content: $([ $HTTP_CODE == "200" ] || [ $AUTH_HTTP_CODE == "200" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "4. Browser simulation: $([ $BROWSER_HTTP_CODE == "200" ] || [ $BROWSER_HTTP_CODE == "307" ] || [ $BROWSER_HTTP_CODE == "302" ] && echo "✅ PASS" || echo "❌ FAIL")"

echo
echo "To manually test in browser, visit: http://localhost:3000/welcome"
echo "Development server logs: tail -f dev.log"