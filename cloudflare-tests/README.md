# Cloudflare Worker Compatibility Test Suite for nano-rs

This directory contains tests that verify nano-rs can run Cloudflare Workers with minimal to no changes.

## Test Coverage

### Core Cloudflare APIs
- [x] fetch() - Standard WinterCG fetch
- [x] Request/Response objects
- [x] Headers API
- [x] URL API
- [x] Crypto (WebCrypto)
- [x] TextEncoder/TextDecoder
- [x] Streams (ReadableStream/WritableStream)

### Cloudflare-Specific APIs
- [ ] Environment variables (env)
- [ ] KV Store
- [ ] Durable Objects
- [ ] R2 (object storage)
- [ ] Cache API
- [ ] WebSocket upgrades

### Real-World Worker Patterns
- [ ] API proxy/edge worker
- [ ] Static asset serving
- [ ] JWT authentication
- [ ] Rate limiting
- [ ] Image optimization
- [ ] A/B testing

## Test Structure

```
cloudflare-tests/
├── README.md
├── test-runner.js          # CF Worker test runner
├── workers/
│   ├── basic-fetch.js      # Basic fetch handler
│   ├── env-vars.js         # Environment variables
│   ├── kv-store.js         # KV store operations
│   ├── asset-serving.js     # Static assets with mime types
│   ├── jwt-auth.js         # JWT validation
│   └── image-resize.js     # Image processing
├── tests/
│   ├── fetch.test.js
│   ├── env.test.js
│   ├── kv.test.js
│   └── assets.test.js
└── assets/
    ├── index.html
    ├── styles.css
    ├── script.js
    └── image.png
```

## Running Tests

```bash
# Run all CF Worker compatibility tests
node cloudflare-tests/test-runner.js

# Run specific test
node cloudflare-tests/test-runner.js --test fetch

# With verbose output
node cloudflare-tests/test-runner.js --verbose
```

## Compatibility Report

The test suite generates a detailed compatibility report showing:
- Which Cloudflare APIs work out of the box
- Which require polyfills/shims
- Which are not yet supported
- Migration guide for existing Workers

## Goal

Achieve 100% compatibility with standard Cloudflare Worker patterns so that existing Workers can run on nano-rs with zero or minimal changes.
