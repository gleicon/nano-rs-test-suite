# NANO-RS Blackbox Test Report

**Generated:** 2026-04-22T20:48:18.557Z  
**NANO Version:** nano-rs 1.2.0  
**Test Duration:** 14754ms

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 27 |
| Passed | ✓ 22 |
| Failed | ✗ 5 |
| **Overall Score** | **81%** |

## Results by Category

### cli (3/3 - 100%)

| Test | Status |
|------|--------|
| nano-rs binary exists | ✓ passed |
| nano-rs --version works | ✓ passed |
| nano-rs --help works | ✓ passed |

### basic-http (3/3 - 100%)

| Test | Status |
|------|--------|
| Basic HTTP server starts | ✓ passed |
| Basic HTTP GET request | ✓ passed |
| HTTP POST with body | ✓ passed |

### wintercg (2/2 - 100%)

| Test | Status |
|------|--------|
| WinterCG: fetch() API available | ✓ passed |
| WinterCG: Request/Response objects | ✓ passed |

### nodejs (2/2 - 100%)

| Test | Status |
|------|--------|
| Node.js: console methods | ✓ passed |
| Node.js: Buffer | ✓ passed |

### webcrypto (2/2 - 100%)

| Test | Status |
|------|--------|
| WebCrypto: crypto.subtle available | ✓ passed |
| WebCrypto: AES-GCM encryption | ✓ passed |

### crud (1/6 - 17%)

| Test | Status |
|------|--------|
| CRUD: Server starts | ✓ passed |
| CRUD: CREATE (POST) | ✗ failed |
| CRUD: READ ALL (GET) | ✗ failed |
| CRUD: READ ONE (GET) | ✗ failed |
| CRUD: UPDATE (PUT) | ✗ failed |
| CRUD: DELETE (DELETE) | ✗ failed |

### http-verbs (7/7 - 100%)

| Test | Status |
|------|--------|
| HTTP: GET request | ✓ passed |
| HTTP: POST request | ✓ passed |
| HTTP: PUT request | ✓ passed |
| HTTP: PATCH request | ✓ passed |
| HTTP: DELETE request | ✓ passed |
| HTTP: HEAD request | ✓ passed |
| HTTP: OPTIONS request | ✓ passed |

### multi-tenancy (2/2 - 100%)

| Test | Status |
|------|--------|
| Multi-tenancy: Server with multiple apps starts | ✓ passed |
| Multi-tenancy: Routes to correct app by Host header | ✓ passed |

