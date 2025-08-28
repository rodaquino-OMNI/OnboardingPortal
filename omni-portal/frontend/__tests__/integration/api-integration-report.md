
# Detailed API Endpoint Test Report
**Generated:** 2025-08-28T18:17:57.759Z
**Total Tests:** 16
**Successful:** 4
**Failed:** 12
**Success Rate:** 25.00%
**Average Response Time:** 28.88ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ✅ (200) - 11ms

- **Status Check**: ✅ (200) - 4ms

- **Metrics Endpoint**: ❌ (0) - 84ms

- **Public Configuration**: ❌ (0) - 55ms

### Authentication Endpoints

- **Login Endpoint**: ✅ (401) - 1ms

- **Check Email Availability**: ✅ (200) - 1ms

- **Check CPF Availability**: ❌ (0) - 34ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 30ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 34ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 30ms

- **Documents List (Unauthorized)**: ❌ (0) - 33ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 29ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 34ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 28ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 25ms

- **CORS Preflight - Documents**: ❌ (0) - 29ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 28.88ms
- **Maximum Response Time:** 84ms (Metrics Endpoint)
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
- **Response Time:** 11ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "status": "healthy",
  "timestamp": "2025-08-28T18:17:55.672Z",
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
- **Status:** 200 ✅
- **Response Time:** 4ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "status": "healthy",
  "timestamp": "2025-08-28T18:17:55.780Z",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}...
- **Response Headers:**
  - content-type: application/json
  - content-length: 115



### Metrics Endpoint
- **Endpoint:** GET /metrics
- **Status:** 0 ❌
- **Response Time:** 84ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 55ms
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
- **Status:** 200 ✅
- **Response Time:** 1ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "exists": false,
  "available": true,
  "email": "test@example.com"
}...
- **Response Headers:**
  - content-type: application/json
  - content-length: 60



### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 34ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 30ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### User Profile (Unauthorized)
- **Endpoint:** GET /user
- **Status:** 0 ❌
- **Response Time:** 34ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Gamification Progress (Unauthorized)
- **Endpoint:** GET /gamification/progress
- **Status:** 0 ❌
- **Response Time:** 30ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Documents List (Unauthorized)
- **Endpoint:** GET /documents
- **Status:** 0 ❌
- **Response Time:** 33ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 29ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 34ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 28ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 25ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 29ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


