
# Detailed API Endpoint Test Report
**Generated:** 2025-08-28T13:58:23.571Z
**Total Tests:** 16
**Successful:** 3
**Failed:** 13
**Success Rate:** 18.75%
**Average Response Time:** 44.75ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ✅ (200) - 15ms

- **Status Check**: ✅ (200) - 8ms

- **Metrics Endpoint**: ❌ (0) - 190ms

- **Public Configuration**: ❌ (0) - 66ms

### Authentication Endpoints

- **Login Endpoint**: ✅ (401) - 4ms

- **Check Email Availability**: ❌ (0) - 33ms

- **Check CPF Availability**: ❌ (0) - 36ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 51ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 33ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 36ms

- **Documents List (Unauthorized)**: ❌ (0) - 40ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 53ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 31ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 30ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 49ms

- **CORS Preflight - Documents**: ❌ (0) - 41ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 44.75ms
- **Maximum Response Time:** 190ms (Metrics Endpoint)
- **Minimum Response Time:** 4ms (Login Endpoint)
- **Slow Endpoints (>1s):** 0



## Security Analysis

- **Protected Endpoints Tested:** 6
- **Properly Protected:** 0/6
- **Security Status:** Issues Detected ❌


## Detailed Test Results

### Health Check
- **Endpoint:** GET /health
- **Status:** 200 ✅
- **Response Time:** 15ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "status": "healthy",
  "timestamp": "2025-08-28T13:58:21.241Z",
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
- **Response Time:** 8ms
- **CORS Headers Present:** No

- **Response Sample:** {
  "status": "healthy",
  "timestamp": "2025-08-28T13:58:21.353Z",
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
- **Response Time:** 190ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 66ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Login Endpoint
- **Endpoint:** POST /auth/login
- **Status:** 401 ✅
- **Response Time:** 4ms
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
- **Response Time:** 33ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 36ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 51ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### User Profile (Unauthorized)
- **Endpoint:** GET /user
- **Status:** 0 ❌
- **Response Time:** 33ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Gamification Progress (Unauthorized)
- **Endpoint:** GET /gamification/progress
- **Status:** 0 ❌
- **Response Time:** 36ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Documents List (Unauthorized)
- **Endpoint:** GET /documents
- **Status:** 0 ❌
- **Response Time:** 40ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 53ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 31ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 30ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 49ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 41ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


