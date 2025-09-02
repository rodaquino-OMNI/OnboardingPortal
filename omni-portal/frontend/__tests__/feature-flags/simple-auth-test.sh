#!/bin/bash

echo "🧪 Simple Authentication Test"
echo "=============================="

# Step 1: Get CSRF cookie
echo "Step 1: Getting CSRF cookie..."
COOKIE_RESPONSE=$(curl -c cookies.txt -b cookies.txt -s -w "HTTP_STATUS:%{http_code}" -H "Accept: application/json" http://localhost:8000/sanctum/csrf-cookie)
echo "CSRF Response: $COOKIE_RESPONSE"

# Step 2: Login with credentials
echo -e "\nStep 2: Attempting login..."
LOGIN_RESPONSE=$(curl -b cookies.txt -c cookies.txt -s -w "HTTP_STATUS:%{http_code}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"email":"admin.test@example.com","password":"admin123"}' \
  http://localhost:8000/api/auth/login)

echo "Login Response: $LOGIN_RESPONSE"

# Extract just the JSON part
JSON_PART=$(echo "$LOGIN_RESPONSE" | sed 's/HTTP_STATUS:.*$//')
STATUS_PART=$(echo "$LOGIN_RESPONSE" | grep -o "HTTP_STATUS:.*" | cut -d: -f2)

echo "Status Code: $STATUS_PART"
echo "JSON: $JSON_PART"

# Step 3: Try to access admin dashboard
if [ "$STATUS_PART" = "200" ]; then
  echo -e "\nStep 3: Testing admin dashboard access..."
  DASHBOARD_RESPONSE=$(curl -b cookies.txt -s -w "HTTP_STATUS:%{http_code}" \
    -H "Accept: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    http://localhost:8000/api/admin/dashboard)
  
  echo "Dashboard Response: $DASHBOARD_RESPONSE"
  
  JSON_PART=$(echo "$DASHBOARD_RESPONSE" | sed 's/HTTP_STATUS:.*$//')
  STATUS_PART=$(echo "$DASHBOARD_RESPONSE" | grep -o "HTTP_STATUS:.*" | cut -d: -f2)
  
  echo "Dashboard Status: $STATUS_PART"
  if [ "$STATUS_PART" = "200" ]; then
    echo "✅ Admin access successful!"
  else
    echo "❌ Admin access denied"
  fi
else
  echo "❌ Login failed, skipping admin test"
fi

# Cleanup
rm -f cookies.txt

echo -e "\n🏁 Test completed"