
# Detailed API Endpoint Test Report
**Generated:** 2025-08-22T18:32:34.408Z
**Total Tests:** 16
**Successful:** 0
**Failed:** 16
**Success Rate:** 0.00%
**Average Response Time:** 25.00ms

## Test Results by Category

### Health and Monitoring Endpoints

- **Health Check**: ❌ (0) - 52ms

- **Status Check**: ❌ (0) - 31ms

- **Metrics Endpoint**: ❌ (0) - 26ms

- **Public Configuration**: ❌ (0) - 20ms

### Authentication Endpoints

- **Login Endpoint**: ❌ (0) - 37ms

- **Check Email Availability**: ❌ (0) - 22ms

- **Check CPF Availability**: ❌ (0) - 47ms

### Registration Endpoints

- **Registration Step 1**: ❌ (0) - 15ms

### Protected Endpoints (Authorization Tests)

- **User Profile (Unauthorized)**: ❌ (0) - 19ms

- **Gamification Progress (Unauthorized)**: ❌ (0) - 21ms

- **Documents List (Unauthorized)**: ❌ (0) - 16ms

### File Upload Endpoints

- **Document Upload V1 (Unauthorized)**: ❌ (0) - 22ms

- **Document Upload V2 (Unauthorized)**: ❌ (0) - 15ms

- **Document Upload V3 (Unauthorized)**: ❌ (0) - 17ms

### CORS Preflight Tests

- **CORS Preflight - Auth Login**: ❌ (0) - 23ms

- **CORS Preflight - Documents**: ❌ (0) - 17ms

## CORS Analysis Summary

- **Endpoints with CORS headers:** 0/16
- **Properly configured CORS:** 0/16
- **Frontend origin allowed:** No ❌
- **Credentials support:** No ❌


## Performance Analysis

- **Average Response Time:** 25.00ms
- **Maximum Response Time:** 52ms (Health Check)
- **Minimum Response Time:** 15ms (Registration Step 1)
- **Slow Endpoints (>1s):** 0



## Security Analysis

- **Protected Endpoints Tested:** 6
- **Properly Protected:** 0/6
- **Security Status:** Issues Detected ❌


## Detailed Test Results

### Health Check
- **Endpoint:** GET /health
- **Status:** 0 ❌
- **Response Time:** 52ms
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
- **Response Time:** 26ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Public Configuration
- **Endpoint:** GET /config/public
- **Status:** 0 ❌
- **Response Time:** 20ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Login Endpoint
- **Endpoint:** POST /auth/login
- **Status:** 0 ❌
- **Response Time:** 37ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check Email Availability
- **Endpoint:** POST /auth/check-email
- **Status:** 0 ❌
- **Response Time:** 22ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Check CPF Availability
- **Endpoint:** POST /auth/check-cpf
- **Status:** 0 ❌
- **Response Time:** 47ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Registration Step 1
- **Endpoint:** POST /register/step1
- **Status:** 0 ❌
- **Response Time:** 15ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### User Profile (Unauthorized)
- **Endpoint:** GET /user
- **Status:** 0 ❌
- **Response Time:** 19ms
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
- **Response Time:** 16ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V1 (Unauthorized)
- **Endpoint:** POST /documents/upload
- **Status:** 0 ❌
- **Response Time:** 22ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V2 (Unauthorized)
- **Endpoint:** POST /v2/documents/upload
- **Status:** 0 ❌
- **Response Time:** 15ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### Document Upload V3 (Unauthorized)
- **Endpoint:** POST /v3/documents/upload
- **Status:** 0 ❌
- **Response Time:** 17ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Auth Login
- **Endpoint:** OPTIONS /auth/login
- **Status:** 0 ❌
- **Response Time:** 23ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**




### CORS Preflight - Documents
- **Endpoint:** OPTIONS /documents
- **Status:** 0 ❌
- **Response Time:** 17ms
- **CORS Headers Present:** No
- **Error:** Network request failed

- **Response Headers:**


