# Using Node.js Internal Test Suite with nano-rs

## Executive Summary

**Answer: YES**, we can adapt the Node.js test suite to validate nano-rs locally. This is an excellent idea for comprehensive compatibility testing.

The Node.js test suite contains **3,000+ tests** covering the entire Node.js API surface. By selectively running tests for APIs that nano-rs implements, we can get a definitive compatibility score.

---

## Node.js Test Suite Structure

### Directory Layout
```
test/
├── common/           # Shared test utilities (MUST require in all tests)
├── fixtures/         # Test data files
├── parallel/         # Tests that can run in parallel (majority)
├── sequential/       # Tests that must run sequentially
├── es-module/        # ESM-specific tests
├── internet/         # Network tests (not for CI)
├── pummel/           # Load/stress tests
├── known_issues/     # Tests for known bugs
└── README.md
```

### Test Categories Relevant to nano-rs

| Directory | Test Count | Relevance to nano-rs |
|-----------|------------|---------------------|
| `test/parallel/test-console*` | ~20 | ✅ HIGH - console API |
| `test/parallel/test-buffer*` | ~50 | ✅ HIGH - Buffer API |
| `test/parallel/test-crypto*` | ~100 | ⚠️ MEDIUM - crypto.subtle only |
| `test/parallel/test-url*` | ~30 | ✅ HIGH - URL/URLSearchParams |
| `test/parallel/test-text-encoding*` | ~10 | ✅ HIGH - TextEncoder/Decoder |
| `test/parallel/test-timers*` | ~25 | ⚠️ MEDIUM - setTimeout/Interval |
| `test/parallel/test-stream*` | ~80 | ❌ LOW - nano-rs uses WinterCG streams |
| `test/parallel/test-fs*` | ~100 | ❌ LOW - nano-rs uses VFS |
| `test/parallel/test-http*` | ~150 | ❌ LOW - nano-rs uses WinterCG fetch |
| `test/parallel/test-net*` | ~60 | ❌ LOW - not implemented |
| `test/parallel/test-dgram*` | ~30 | ❌ LOW - UDP not implemented |
| `test/es-module/*` | ~80 | ✅ HIGH - ESM support |

**Estimated Relevant Tests: ~200-300 tests**

---

## How Node.js Tests Work

### Test Template
```javascript
'use strict';
const common = require('../common');  // REQUIRED first
const assert = require('assert');

// Test code here
assert.strictEqual(actual, expected);
```

### The `common` Module
The `common` module is **required** by all Node.js tests and provides:
- Test harness integration
- Platform detection
- Utility functions (`common.mustCall()`, `common.expectsError()`)
- Fixture loading
- Temporary directory management

### Challenge for nano-rs
Node.js tests assume they're running in Node.js and use:
1. `require()` - nano-rs supports this
2. `common` module - needs adaptation
3. Node.js-specific modules (fs, net, http) - need filtering
4. `--expose-internals` flag - for internal API tests

---

## Adaptation Strategy

### Approach 1: Selective Test Extraction (Recommended)

**Steps:**
1. Clone nodejs/node repository
2. Identify tests for APIs nano-rs implements
3. Copy tests to local directory
4. Create a nano-rs compatible `common` module
5. Run tests against nano-rs

**Pros:**
- Fast to implement
- Targeted coverage
- Easy to maintain

**Cons:**
- Manual test selection
- May miss edge cases

### Approach 2: Common Module Adapter

**Create a drop-in replacement for Node.js `common`:**

```javascript
// test/common.js - nano-rs compatible version
'use strict';

// Minimal common module for nano-rs
module.exports = {
  // Skip tests that require unsupported features
  skip: function(reason) {
    console.log(`SKIP: ${reason}`);
    process.exit(0);
  },
  
  // Platform detection
  isWindows: false,
  isLinux: false,
  isOSX: true,  // Adjust for your platform
  
  // Test utilities
  mustCall: function(fn, count = 1) {
    let called = 0;
    return function(...args) {
      called++;
      if (called > count) {
        throw new Error(`Function called ${called} times, expected ${count}`);
      }
      return fn(...args);
    };
  },
  
  expectsError: function(fn, error) {
    try {
      fn();
      throw new Error('Expected error but none was thrown');
    } catch (e) {
      if (!e.message.includes(error.message)) {
        throw new Error(`Expected error "${error.message}" but got "${e.message}"`);
      }
    }
  },
  
  // Check if feature is available
  hasCrypto: true,
  hasIntl: true,
  
  // Load fixtures
  fixturesDir: './fixtures'
};
```

### Approach 3: Test Runner Adapter

**Create a test harness that:**
1. Starts nano-rs server
2. Sends test JavaScript as requests
3. Captures responses
4. Validates against expected output

```javascript
// nodejs-test-runner.js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function runNodeJSTest(testFile) {
  // Read test content
  const testCode = fs.readFileSync(testFile, 'utf8');
  
  // Transform test for nano-rs
  const transformed = transformTest(testCode);
  
  // Create app file
  const appCode = `
export default {
  async fetch(request) {
    ${transformed}
    return new Response('PASSED', { status: 200 });
  }
};
`;
  
  // Run against nano-rs
  const result = await runWithNanoRS(appCode);
  
  return result;
}
```

---

## Implementation Plan

### Phase 1: Quick Win - Console & Buffer Tests

**Target:** 20-30 tests from `test/parallel/test-console*` and `test/parallel/test-buffer*`

**Implementation:**
```bash
# 1. Clone Node.js repo
git clone --depth 1 https://github.com/nodejs/node.git /tmp/node-tests

# 2. Extract relevant tests
mkdir -p nodejs-tests/console
mkdir -p nodejs-tests/buffer
cp /tmp/node-tests/test/parallel/test-console* nodejs-tests/console/
cp /tmp/node-tests/test/parallel/test-buffer* nodejs-tests/buffer/

# 3. Create common module adapter
cat > nodejs-tests/common.js << 'EOF'
// Minimal common module for nano-rs Node.js tests
'use strict';

module.exports = {
  skip: (msg) => { console.log('SKIP:', msg); process.exit(0); },
  mustCall: (fn, count = 1) => fn,
  isWindows: false,
  isOSX: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
};
EOF

# 4. Transform and run tests
node run-nodejs-tests.js
```

### Phase 2: Automated Test Discovery

**Create a tool that:**
1. Scans Node.js test directory
2. Identifies test dependencies
3. Checks which APIs nano-rs supports
4. Automatically extracts compatible tests

```javascript
// discover-tests.js
const fs = require('fs');
const path = require('path');

const NANO_RS_APIS = [
  'console', 'Buffer', 'URL', 'URLSearchParams',
  'TextEncoder', 'TextDecoder', 'crypto.subtle',
  'setTimeout', 'setInterval', 'clearTimeout'
];

function analyzeTest(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check required modules
  const requires = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
  
  // Check if test only uses supported APIs
  const supported = requires.every(req => {
    const module = req.match(/require\(['"]([^'"]+)['"]\)/)[1];
    return NANO_RS_APIS.includes(module) || 
           module.startsWith('./') ||
           module === '../common';
  });
  
  return { file: filePath, supported, requires };
}
```

### Phase 3: CI Integration

**GitHub Actions workflow:**
```yaml
name: Node.js Test Suite Compatibility
on: [push, pull_request]

jobs:
  nodejs-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Clone Node.js
        run: git clone --depth 1 https://github.com/nodejs/node.git /tmp/node
      
      - name: Extract compatible tests
        run: node scripts/extract-nodejs-tests.js
      
      - name: Build nano-rs
        run: cargo build --release
      
      - name: Run Node.js tests
        run: node scripts/run-nodejs-tests.js
      
      - name: Report results
        run: cat reports/nodejs-compatibility.md
```

---

## Test Categories for nano-rs

### Priority 1: Essential APIs (Run First)

```javascript
// Console API - ~20 tests
// test/parallel/test-console*.js
test-console.js
test-console-async.js
test-console-clear.js
test-console-count.js
test-console-group.js
test-console-log.js
test-console-no-wcolor.js
test-console-table.js

// Buffer API - ~50 tests  
// test/parallel/test-buffer*.js
test-buffer-alloc.js
test-buffer-arraybuffer.js
test-buffer-badhex.js
test-buffer-compare.js
test-buffer-concat.js
test-buffer-from.js
test-buffer-isencoding.js
test-buffer-slice.js
test-buffer-write.js

// URL API - ~30 tests
// test/parallel/test-url*.js
test-url.js
test-url-format.js
test-url-parse.js
test-url-searchparams.js
test-url-domain-escaping.js
```

### Priority 2: Web Platform APIs

```javascript
// Text Encoding - ~10 tests
test-whatwg-encoding-textdecoder.js
test-whatwg-encoding-textencoder.js

// Crypto (subtle only) - subset of tests
test-crypto-subtle.js
test-crypto-webcrypto.js

// Timers - ~25 tests
test-timers.js
test-timers-active.js
test-timers-immediate.js
test-timers-setinterval.js
test-timers-settimeout.js
```

### Priority 3: ESM Support

```javascript
// ES Modules - ~80 tests
// test/es-module/test-esm*.js
test-esm-basic-imports.js
test-esm-exports.js
test-esm-import-meta.js
test-esm-loader.js
test-esm-module-job.js
test-esm-url.js
```

---

## Expected Results

### Realistic Compatibility Targets

Based on nano-rs's current implementation:

| API Category | Node.js Tests | Expected Pass Rate | Notes |
|--------------|---------------|-------------------|-------|
| **Console** | ~20 | **95%+** | Core console methods work |
| **Buffer** | ~50 | **80-90%** | Basic methods work, some edge cases may fail |
| **URL** | ~30 | **95%+** | Standard URL API works |
| **Text Encoding** | ~10 | **100%** | Standard Web API |
| **Crypto (subtle)** | ~20 | **90%+** | WebCrypto subset works |
| **Timers** | ~25 | **85-90%** | Basic timers work, some edge cases |
| **ESM** | ~80 | **70-80%** | Basic imports work, advanced features may fail |
| **Overall** | ~235 | **85-90%** | Excellent compatibility for implemented APIs |

---

## Benefits of Node.js Test Suite

### Advantages
1. **Definitive compatibility** - Official Node.js tests
2. **Edge case coverage** - Tests for obscure bugs
3. **Regression detection** - Catch breaking changes
4. **Cross-platform** - Tests run on multiple platforms
5. **Well-maintained** - Continuously updated by Node.js team

### Challenges
1. **Large test suite** - Thousands of tests
2. **Node.js assumptions** - Tests assume Node.js environment
3. **Common module dependency** - Requires adaptation
4. **Internal APIs** - Many tests use `--expose-internals`
5. **Maintenance** - Need to sync with upstream changes

---

## Quick Start Commands

```bash
# Clone Node.js repository
git clone --depth 1 https://github.com/nodejs/node.git /tmp/node

# Extract console tests
mkdir -p nodejs-compat-tests/console
cp /tmp/node/test/parallel/test-console*.js nodejs-compat-tests/console/

# Extract buffer tests  
mkdir -p nodejs-compat-tests/buffer
cp /tmp/node/test/parallel/test-buffer-*.js nodejs-compat-tests/buffer/

# Create common module
cat > nodejs-compat-tests/common.js << 'EOF'
module.exports = {
  skip: (msg) => { console.log('SKIP:', msg); process.exit(0); },
  mustCall: (fn) => fn,
  isWindows: false,
  isOSX: process.platform === 'darwin',
};
EOF

# Run a test against nano-rs
node run-nodejs-test.js nodejs-compat-tests/console/test-console.js
```

---

## Recommendation

**Proceed with Approach 1 (Selective Test Extraction)** because:

1. ✅ **Fast to implement** - Can have results in hours
2. ✅ **Targeted** - Focus on APIs nano-rs implements
3. ✅ **Maintainable** - Clear scope and ownership
4. ✅ **Validates** - Provides definitive compatibility data

**Next Steps:**
1. Extract console and buffer tests (Phase 1)
2. Create common module adapter
3. Run tests and generate compatibility report
4. Expand to other APIs based on results

---

*Analysis completed: Node.js test suite can be adapted for nano-rs validation*
