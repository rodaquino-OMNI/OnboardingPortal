
# Detailed API Endpoint Test Report
**Generated:** 2025-08-28T01:42:10.410Z
**Total Tests:** 16
**Successful:** 2
**Failed:** 14
**Success Rate:** 12.50%
**Average Response Time:** 25.56ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ✅ (200) - 2ms

- **Status Check**: ❌ (0) - 18ms

- **Metrics Endpoint**: ❌ (0) - 20ms

- **Public Configuration**: ❌ (0) - 21ms

### Authentication Endpoints

- **Login Endpoint**: ✅ (401) - 1ms

- **Check Email Availability**: ❌ (0) - 30ms

- **Check CPF Availability**: ❌ (0) - 44ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 26ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 25ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 21ms

- **Documents List (Unauthorized)**: ❌ (0) - 28ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 27ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 24ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 25ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 60ms

- **CORS Preflight - Documents**: ❌ (0) - 37ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 25.56ms
- **Maximum Response Time:** 60ms (CORS Preflight - Auth Login)
- **Minimum Response Time:** 1ms (Login Endpoint)
- **Slow Endpoints (>1s):** 0



## Security Analysis

- **Protected Endpoints Tested:** 6
- **Properly Protected:** 0/6
- **Security Status:** Issues Detected ❌


## Detailed Test Results

### Health Check
- **Endpoint:** GET /health
- **Status:** 200 ✅
- **Response Time:** 2ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "status": "healthy",
  "timestamp": "2025-08-28T01:42:08.363Z",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}...
- **Response Headers:**
  - content-type: application/json
  - content-length: 115



### Status Check
- **Endpoint:** GET /status
- **Status:** 0 ❌
- **Response Time:** 18ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Metrics Endpoint
- **Endpoint:** GET /metrics
- **Status:** 0 ❌
- **Response Time:** 20ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 21ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Login Endpoint
- **Endpoint:** POST /auth/login
- **Status:** 401 ✅
- **Response Time:** 1ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "success": false,
  "error": "Credenciais inválidas",
  "message": "Email ou senha incorretos"
}...
- **Response Headers:**
  - content-type: application/json
  - content-length: 88



### Check Email Availability
- **Endpoint:** POST /auth/check-email
- **Status:** 0 ❌
- **Response Time:** 30ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 44ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 26ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### User Profile (Unauthorized)
- **Endpoint:** GET /user
- **Status:** 0 ❌
- **Response Time:** 25ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Gamification Progress (Unauthorized)
- **Endpoint:** GET /gamification/progress
- **Status:** 0 ❌
- **Response Time:** 21ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Documents List (Unauthorized)
- **Endpoint:** GET /documents
- **Status:** 0 ❌
- **Response Time:** 28ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 27ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 24ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 25ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 60ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 37ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


