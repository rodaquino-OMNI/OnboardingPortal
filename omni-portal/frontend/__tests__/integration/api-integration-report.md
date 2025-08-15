
# Detailed API Endpoint Test Report
**Generated:** 2025-08-13T01:23:29.761Z
**Total Tests:** 16
**Successful:** 0
**Failed:** 16
**Success Rate:** 0.00%
**Average Response Time:** 63.13ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ❌ (0) - 301ms

- **Status Check**: ❌ (0) - 31ms

- **Metrics Endpoint**: ❌ (0) - 80ms

- **Public Configuration**: ❌ (0) - 29ms

### Authentication Endpoints

- **Login Endpoint**: ❌ (0) - 117ms

- **Check Email Availability**: ❌ (0) - 42ms

- **Check CPF Availability**: ❌ (0) - 22ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 22ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 34ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 23ms

- **Documents List (Unauthorized)**: ❌ (0) - 183ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 32ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 26ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 53ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 11ms

- **CORS Preflight - Documents**: ❌ (0) - 4ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 63.13ms
- **Maximum Response Time:** 301ms (Health Check)
- **Minimum Response Time:** 4ms (CORS Preflight - Documents)
- **Slow Endpoints (>1s):** 0



## Security Analysis

- **Protected Endpoints Tested:** 6
- **Properly Protected:** 0/6
- **Security Status:** Issues Detected ❌


## Detailed Test Results

### Health Check
- **Endpoint:** GET /health
- **Status:** 0 ❌
- **Response Time:** 301ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Status Check
- **Endpoint:** GET /status
- **Status:** 0 ❌
- **Response Time:** 31ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Metrics Endpoint
- **Endpoint:** GET /metrics
- **Status:** 0 ❌
- **Response Time:** 80ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 29ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Login Endpoint
- **Endpoint:** POST /auth/login
- **Status:** 0 ❌
- **Response Time:** 117ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check Email Availability
- **Endpoint:** POST /auth/check-email
- **Status:** 0 ❌
- **Response Time:** 42ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 22ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 22ms
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
- **Response Time:** 23ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Documents List (Unauthorized)
- **Endpoint:** GET /documents
- **Status:** 0 ❌
- **Response Time:** 183ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 32ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 26ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 53ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 11ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 4ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


