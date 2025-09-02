#!/bin/bash

# Simple curl-based auth loop testing
# Tests auth behavior using curl commands

echo "🚀 Starting Curl-based Auth Loop Testing"
echo "Target: http://localhost:3001"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNINGS=0
FINDINGS=()

# Test 1: Dashboard access and redirect behavior
echo "🔍 Test 1: Dashboard Access & Redirect Behavior"
DASHBOARD_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url};TIME:%{time_total}" \
  -H "User-Agent: Auth-Loop-Tester/1.0" \
  "http://localhost:3001/dashboard" 2>/dev/null)

if [ $? -eq 0 ]; then
  HTTP_STATUS=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
  REDIRECT_URL=$(echo "$DASHBOARD_RESPONSE" | grep -o "REDIRECT:[^;]*" | cut -d: -f2-)
  TIME_TOTAL=$(echo "$DASHBOARD_RESPONSE" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
  
  echo "  Status: $HTTP_STATUS"
  echo "  Time: ${TIME_TOTAL}s"
  echo "  Redirect: $REDIRECT_URL"
  
  if [[ "$HTTP_STATUS" =~ ^(200|302|401)$ ]]; then
    echo -e "  ${GREEN}✅ Dashboard access working${NC}"
    FINDINGS+=("✅ Dashboard responds appropriately ($HTTP_STATUS)")
    ((TESTS_PASSED++))
  else
    echo -e "  ${YELLOW}⚠️  Unexpected status: $HTTP_STATUS${NC}"
    FINDINGS+=("⚠️ Dashboard returned unexpected status: $HTTP_STATUS")
    ((TESTS_WARNINGS++))
  fi
else
  echo -e "  ${RED}❌ Dashboard request failed${NC}"
  FINDINGS+=("❌ Dashboard request failed")
  ((TESTS_FAILED++))
fi

echo

# Test 2: Rapid auth requests (Circuit breaker test)
echo "🔄 Test 2: Rapid Auth Requests (Circuit Breaker)"
echo "  Making 10 rapid requests..."

RAPID_RESULTS=()
RATE_LIMITED=0
ERRORS=0
SUCCESSFUL=0

for i in {1..10}; do
  RESULT=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
    -H "User-Agent: Auth-Loop-Tester-$i/1.0" \
    -H "X-Test-Request: $i" \
    --connect-timeout 5 \
    --max-time 10 \
    "http://localhost:3001/api/auth/check" 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    STATUS=$(echo "$RESULT" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    TIME=$(echo "$RESULT" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    
    RAPID_RESULTS+=("Request $i: $STATUS (${TIME}s)")
    
    if [ "$STATUS" == "429" ]; then
      ((RATE_LIMITED++))
    elif [ "$STATUS" == "200" ] || [ "$STATUS" == "401" ]; then
      ((SUCCESSFUL++))
    else
      ((ERRORS++))
    fi
  else
    RAPID_RESULTS+=("Request $i: FAILED")
    ((ERRORS++))
  fi
  
  # Small delay between requests
  sleep 0.1
done

echo "  Total requests: 10"
echo "  Successful: $SUCCESSFUL"
echo "  Rate limited (429): $RATE_LIMITED"
echo "  Errors: $ERRORS"

if [ "$RATE_LIMITED" -gt 0 ]; then
  echo -e "  ${GREEN}✅ Rate limiting/circuit breaker working${NC}"
  FINDINGS+=("✅ Rate limiting detected - circuit breaker functional")
  ((TESTS_PASSED++))
elif [ "$ERRORS" -gt 5 ]; then
  echo -e "  ${YELLOW}⚠️  High error rate detected${NC}"
  FINDINGS+=("⚠️ High error rate in auth requests")
  ((TESTS_WARNINGS++))
else
  echo -e "  ${GREEN}✅ Auth requests handled normally${NC}"
  FINDINGS+=("✅ Auth requests processed normally")
  ((TESTS_PASSED++))
fi

echo

# Test 3: Malformed cookie handling
echo "🍪 Test 3: Malformed Cookie Handling"
MALFORMED_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" \
  -H "User-Agent: Auth-Loop-Tester-Malformed/1.0" \
  -H "Cookie: auth_token=invalid-format; session_id={malformed:json}; user_data=not-json" \
  "http://localhost:3001/dashboard" 2>/dev/null)

if [ $? -eq 0 ]; then
  MALFORMED_STATUS=$(echo "$MALFORMED_RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
  MALFORMED_REDIRECT=$(echo "$MALFORMED_RESPONSE" | grep -o "REDIRECT:[^;]*" | cut -d: -f2-)
  
  echo "  Status: $MALFORMED_STATUS"
  echo "  Redirect: $MALFORMED_REDIRECT"
  
  if [[ "$MALFORMED_STATUS" =~ ^(401|302)$ ]]; then
    echo -e "  ${GREEN}✅ Malformed cookies properly rejected${NC}"
    FINDINGS+=("✅ Malformed cookies handled properly")
    ((TESTS_PASSED++))
  else
    echo -e "  ${YELLOW}⚠️  Malformed cookies may not be validated${NC}"
    FINDINGS+=("⚠️ Malformed cookie validation unclear")
    ((TESTS_WARNINGS++))
  fi
else
  echo -e "  ${RED}❌ Malformed cookie test failed${NC}"
  FINDINGS+=("❌ Malformed cookie test failed")
  ((TESTS_FAILED++))
fi

echo

# Test 4: Redirect loop detection
echo "🔄 Test 4: Redirect Loop Detection"
echo "  Following redirects (max 10)..."

CURRENT_URL="http://localhost:3001/dashboard"
REDIRECT_COUNT=0
REDIRECT_URLS=()

while [ $REDIRECT_COUNT -lt 10 ]; do
  REDIRECT_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" \
    -H "User-Agent: Auth-Loop-Tester-Redirect-$REDIRECT_COUNT/1.0" \
    --max-redirs 0 \
    "$CURRENT_URL" 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    REDIRECT_STATUS=$(echo "$REDIRECT_RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    REDIRECT_LOCATION=$(echo "$REDIRECT_RESPONSE" | grep -o "REDIRECT:[^;]*" | cut -d: -f2-)
    
    REDIRECT_URLS+=("Step $((REDIRECT_COUNT+1)): $CURRENT_URL -> $REDIRECT_STATUS")
    
    # Check if it's a redirect
    if [[ "$REDIRECT_STATUS" =~ ^(301|302|303|307|308)$ ]] && [ -n "$REDIRECT_LOCATION" ]; then
      # Check for loop (same URL appearing again)
      for prev_url in "${REDIRECT_URLS[@]}"; do
        if [[ "$prev_url" == *"$REDIRECT_LOCATION"* ]]; then
          echo -e "  ${YELLOW}⚠️  Redirect loop detected!${NC}"
          FINDINGS+=("⚠️ Redirect loop detected at step $((REDIRECT_COUNT+1))")
          ((TESTS_WARNINGS++))
          break 2
        fi
      done
      
      # Update current URL for next iteration
      if [[ "$REDIRECT_LOCATION" == http* ]]; then
        CURRENT_URL="$REDIRECT_LOCATION"
      else
        CURRENT_URL="http://localhost:3001$REDIRECT_LOCATION"
      fi
      
      ((REDIRECT_COUNT++))
    else
      # Not a redirect, stop here
      break
    fi
  else
    echo -e "  ${RED}❌ Redirect test failed${NC}"
    FINDINGS+=("❌ Redirect test failed")
    ((TESTS_FAILED++))
    break
  fi
done

echo "  Total redirects: $REDIRECT_COUNT"

if [ $REDIRECT_COUNT -lt 3 ]; then
  echo -e "  ${GREEN}✅ No excessive redirects detected${NC}"
  FINDINGS+=("✅ Redirect behavior is normal")
  ((TESTS_PASSED++))
elif [ $REDIRECT_COUNT -lt 5 ]; then
  echo -e "  ${YELLOW}⚠️  Moderate redirect count${NC}"
  FINDINGS+=("⚠️ Moderate number of redirects detected")
  ((TESTS_WARNINGS++))
else
  echo -e "  ${YELLOW}⚠️  High redirect count - potential loop${NC}"
  FINDINGS+=("⚠️ High number of redirects - potential loop issue")
  ((TESTS_WARNINGS++))
fi

echo

# Test 5: Health check endpoint
echo "🏥 Test 5: Health Check Endpoint"
HEALTH_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  "http://localhost:3001/api/health" 2>/dev/null)

if [ $? -eq 0 ]; then
  HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
  HEALTH_TIME=$(echo "$HEALTH_RESPONSE" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
  
  echo "  Status: $HEALTH_STATUS"
  echo "  Time: ${HEALTH_TIME}s"
  
  if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "  ${GREEN}✅ Health check OK${NC}"
    FINDINGS+=("✅ Health endpoint responding normally")
    ((TESTS_PASSED++))
  else
    echo -e "  ${YELLOW}⚠️  Health check returned $HEALTH_STATUS${NC}"
    FINDINGS+=("⚠️ Health endpoint returned $HEALTH_STATUS")
    ((TESTS_WARNINGS++))
  fi
else
  echo -e "  ${RED}❌ Health check failed${NC}"
  FINDINGS+=("❌ Health endpoint not responding")
  ((TESTS_FAILED++))
fi

echo

# Summary
echo "📊 Test Results Summary:"
echo -e "✅ Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$TESTS_WARNINGS${NC}"
echo -e "❌ Failed: ${RED}$TESTS_FAILED${NC}"

echo
echo "🔍 Key Findings:"
for finding in "${FINDINGS[@]}"; do
  echo "  $finding"
done

echo
# Overall assessment
TOTAL_ISSUES=$((TESTS_FAILED + TESTS_WARNINGS))

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}💥 Critical issues detected - auth system needs attention${NC}"
  exit 1
elif [ $TESTS_WARNINGS -gt 2 ]; then
  echo -e "${YELLOW}⚠️  Some concerns detected - review recommended${NC}"
  exit 1
else
  echo -e "${GREEN}🎉 No major auth loop issues detected${NC}"
  exit 0
fi