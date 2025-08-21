
# Detailed API Endpoint Test Report
**Generated:** 2025-08-16T09:42:13.711Z
**Total Tests:** 16
**Successful:** 0
**Failed:** 16
**Success Rate:** 0.00%
**Average Response Time:** 25.38ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ❌ (0) - 21ms

- **Status Check**: ❌ (0) - 8ms

- **Metrics Endpoint**: ❌ (0) - 7ms

- **Public Configuration**: ❌ (0) - 9ms

### Authentication Endpoints

- **Login Endpoint**: ❌ (0) - 274ms

- **Check Email Availability**: ❌ (0) - 8ms

- **Check CPF Availability**: ❌ (0) - 7ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 7ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 12ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 8ms

- **Documents List (Unauthorized)**: ❌ (0) - 9ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 6ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 7ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 8ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 6ms

- **CORS Preflight - Documents**: ❌ (0) - 9ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 25.38ms
- **Maximum Response Time:** 274ms (Login Endpoint)
- **Minimum Response Time:** 6ms (Document Upload V1 (Unauthorized))
- **Slow Endpoints (>1s):** 0



## Security Analysis

- **Protected Endpoints Tested:** 6
- **Properly Protected:** 0/6
- **Security Status:** Issues Detected ❌


## Detailed Test Results

### Health Check
- **Endpoint:** GET /health
- **Status:** 0 ❌
- **Response Time:** 21ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Status Check
- **Endpoint:** GET /status
- **Status:** 0 ❌
- **Response Time:** 8ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Metrics Endpoint
- **Endpoint:** GET /metrics
- **Status:** 0 ❌
- **Response Time:** 7ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 9ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Login Endpoint
- **Endpoint:** POST /auth/login
- **Status:** 0 ❌
- **Response Time:** 274ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check Email Availability
- **Endpoint:** POST /auth/check-email
- **Status:** 0 ❌
- **Response Time:** 8ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 7ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 7ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### User Profile (Unauthorized)
- **Endpoint:** GET /user
- **Status:** 0 ❌
- **Response Time:** 12ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Gamification Progress (Unauthorized)
- **Endpoint:** GET /gamification/progress
- **Status:** 0 ❌
- **Response Time:** 8ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Documents List (Unauthorized)
- **Endpoint:** GET /documents
- **Status:** 0 ❌
- **Response Time:** 9ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 6ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 7ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 8ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 6ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 9ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


