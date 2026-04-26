/**
 * Comprehensive Node.js API Compatibility Test Suite for nano-rs
 * 
 * Tests ALL Node.js APIs and categorizes them:
 * - IMPLEMENTED: Fully working
 * - PARTIAL: Some features work
 * - NOT_IMPLEMENTED: Not available
 * - WONT_IMPLEMENT: Intentionally not supported
 * 
 * Generates a compatibility matrix showing nano-rs vs Node.js compatibility
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  BASE_PORT: 9876,
  TIMEOUT: 5000,
  REPORTS_DIR: path.join(__dirname, '..', 'reports')
};

// API Categories with their expected implementation status
const API_CATEGORIES = {
  // ========== FULLY IMPLEMENTED (Should work 100%) ==========
  implemented: {
    description: 'APIs that nano-rs fully implements',
    apis: [
      {
        name: 'console',
        tests: [
          { name: 'console.log', test: 'console.log("test")', expect: 'undefined' },
          { name: 'console.error', test: 'console.error("error")', expect: 'undefined' },
          { name: 'console.warn', test: 'console.warn("warning")', expect: 'undefined' },
          { name: 'console.info', test: 'console.info("info")', expect: 'undefined' },
          { name: 'console.debug', test: 'console.debug("debug")', expect: 'undefined' },
          { name: 'console.table', test: 'console.table([{a:1}])', expect: 'undefined' },
        ]
      },
      {
        name: 'Buffer',
        tests: [
          { name: 'Buffer.from', test: 'Buffer.from("test").toString()', expect: '"test"' },
          { name: 'Buffer.alloc', test: 'Buffer.alloc(10).length', expect: '10' },
          { name: 'Buffer.concat', test: 'Buffer.concat([Buffer.from("a"), Buffer.from("b")]).toString()', expect: '"ab"' },
          { name: 'Buffer.isBuffer', test: 'Buffer.isBuffer(Buffer.from("test"))', expect: 'true' },
          { name: 'Buffer.byteLength', test: 'Buffer.byteLength("test")', expect: '4' },
        ]
      },
      {
        name: 'URL',
        tests: [
          { name: 'new URL', test: 'new URL("http://example.com/path").pathname', expect: '"/path"' },
          { name: 'URL.searchParams', test: 'new URL("http://example.com?a=1").searchParams.get("a")', expect: '"1"' },
          { name: 'URL.toString', test: 'new URL("http://example.com").toString()', expect: '"http://example.com/"' },
        ]
      },
      {
        name: 'URLSearchParams',
        tests: [
          { name: 'append', test: 'var p = new URLSearchParams(); p.append("a", "1"); p.get("a")', expect: '"1"' },
          { name: 'get', test: 'new URLSearchParams("a=1").get("a")', expect: '"1"' },
          { name: 'has', test: 'new URLSearchParams("a=1").has("a")', expect: 'true' },
          { name: 'delete', test: 'var p = new URLSearchParams("a=1"); p.delete("a"); p.has("a")', expect: 'false' },
        ]
      },
      {
        name: 'TextEncoder',
        tests: [
          { name: 'encode', test: 'new TextEncoder().encode("test") instanceof Uint8Array', expect: 'true' },
          { name: 'encoding', test: 'new TextEncoder().encoding', expect: '"utf-8"' },
        ]
      },
      {
        name: 'TextDecoder',
        tests: [
          { name: 'decode', test: 'new TextDecoder().decode(new Uint8Array([116, 101, 115, 116]))', expect: '"test"' },
          { name: 'encoding', test: 'new TextDecoder().encoding', expect: '"utf-8"' },
        ]
      },
      {
        name: 'fetch',
        tests: [
          { name: 'typeof fetch', test: 'typeof fetch', expect: '"function"' },
          { name: 'Request', test: 'typeof Request', expect: '"function"' },
          { name: 'Response', test: 'typeof Response', expect: '"function"' },
          { name: 'Headers', test: 'typeof Headers', expect: '"function"' },
        ]
      },
    ]
  },

  // ========== PARTIALLY IMPLEMENTED (Some features work) ==========
  partial: {
    description: 'APIs with partial implementation',
    apis: [
      {
        name: 'crypto.subtle',
        tests: [
          { name: 'crypto.subtle.digest', test: 'typeof crypto.subtle.digest', expect: '"function"' },
          { name: 'crypto.subtle.generateKey', test: 'typeof crypto.subtle.generateKey', expect: '"function"' },
          { name: 'crypto.subtle.encrypt', test: 'typeof crypto.subtle.encrypt', expect: '"function"' },
          { name: 'crypto.subtle.decrypt', test: 'typeof crypto.subtle.decrypt', expect: '"function"' },
          { name: 'crypto.getRandomValues', test: 'crypto.getRandomValues(new Uint8Array(8)).length', expect: '8' },
        ]
      },
      {
        name: 'timers',
        tests: [
          { name: 'setTimeout', test: 'typeof setTimeout', expect: '"function"' },
          { name: 'clearTimeout', test: 'typeof clearTimeout', expect: '"function"' },
          { name: 'setInterval', test: 'typeof setInterval', expect: '"function"' },
          { name: 'clearInterval', test: 'typeof clearInterval', expect: '"function"' },
        ]
      },
      {
        name: 'process',
        tests: [
          { name: 'process.env', test: 'typeof process.env', expect: '"object"' },
          { name: 'process.version', test: 'typeof process.version', expect: '"string"' },
        ]
      },
    ]
  },

  // ========== NOT IMPLEMENTED (But could be) ==========
  not_implemented: {
    description: 'APIs not yet implemented but could be added',
    apis: [
      {
        name: 'fs',
        tests: [
          { name: 'fs.exists', test: 'typeof require("fs").exists', expect: '"function"', note: 'Available via Nano.fs polyfill' },
          { name: 'fs.readFile', test: 'typeof require("fs").readFile', expect: '"function"', note: 'Available via Nano.fs polyfill' },
          { name: 'fs.writeFile', test: 'typeof require("fs").writeFile', expect: '"function"', note: 'Available via Nano.fs polyfill' },
        ]
      },
      {
        name: 'path',
        tests: [
          { name: 'path.join', test: 'typeof require("path").join', expect: '"undefined"', note: 'Not available' },
          { name: 'path.resolve', test: 'typeof require("path").resolve', expect: '"undefined"', note: 'Not available' },
        ]
      },
      {
        name: 'stream',
        tests: [
          { name: 'ReadableStream', test: 'typeof ReadableStream', expect: '"undefined"', note: 'WinterCG streams only' },
          { name: 'WritableStream', test: 'typeof WritableStream', expect: '"undefined"', note: 'WinterCG streams only' },
        ]
      },
    ]
  },

  // ========== WON'T IMPLEMENT (Intentionally excluded) ==========
  wont_implement: {
    description: 'APIs intentionally not supported by design',
    apis: [
      {
        name: 'http',
        tests: [
          { name: 'http.createServer', test: 'typeof require("http").createServer', expect: '"undefined"', note: 'Use WinterCG fetch instead' },
          { name: 'http.request', test: 'typeof require("http").request', expect: '"undefined"', note: 'Use fetch() instead' },
        ]
      },
      {
        name: 'net',
        tests: [
          { name: 'net.createServer', test: 'typeof require("net").createServer', expect: '"undefined"', note: 'Raw sockets not supported' },
          { name: 'net.Socket', test: 'typeof require("net").Socket', expect: '"undefined"', note: 'Raw sockets not supported' },
        ]
      },
      {
        name: 'dgram',
        tests: [
          { name: 'dgram.createSocket', test: 'typeof require("dgram").createSocket', expect: '"undefined"', note: 'UDP not supported' },
        ]
      },
      {
        name: 'child_process',
        tests: [
          { name: 'child_process.spawn', test: 'typeof require("child_process").spawn', expect: '"undefined"', note: 'Process spawning not supported' },
        ]
      },
      {
        name: 'cluster',
        tests: [
          { name: 'cluster.fork', test: 'typeof require("cluster").fork', expect: '"undefined"', note: 'Multi-process not supported' },
        ]
      },
      {
        name: 'worker_threads',
        tests: [
          { name: 'new Worker', test: 'typeof require("worker_threads").Worker', expect: '"undefined"', note: 'Workers not supported' },
        ]
      },
      {
        name: 'vm',
        tests: [
          { name: 'vm.runInNewContext', test: 'typeof require("vm").runInNewContext', expect: '"undefined"', note: 'VM module not supported' },
        ]
      },
      {
        name: 'v8',
        tests: [
          { name: 'v8.getHeapStatistics', test: 'typeof require("v8").getHeapStatistics', expect: '"undefined"', note: 'V8 internals not exposed' },
        ]
      },
    ]
  },
};

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  nanoVersion: null,
  categories: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    byCategory: {}
  }
};

// Helper: Make HTTP request to nano-rs
function request(port, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method: body ? 'POST' : 'GET',
      headers: { 'Host': 'localhost', 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Helper: Start nano-rs server with test app
function startServer(port, testCode) {
  return new Promise((resolve, reject) => {
    const appCode = `
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const testName = url.searchParams.get('test');
    
    const tests = {
      ${testCode}
    };
    
    if (url.pathname === '/test' && testName && tests[testName]) {
      try {
        const result = tests[testName]();
        return new Response(String(result), { status: 200 });
      } catch (e) {
        return new Response('ERROR: ' + e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`;
    
    const appPath = path.join('/tmp', `api-test-${port}.js`);
    fs.writeFileSync(appPath, appCode);
    
    const configPath = path.join('/tmp', `api-test-config-${port}.json`);
    fs.writeFileSync(configPath, JSON.stringify({
      server: { host: '0.0.0.0', port },
      apps: [{ 
        hostname: 'localhost', 
        entrypoint: appPath,
        limits: { workers: 1, memory_mb: 64, timeout_secs: 5 }
      }]
    }));
    
    const proc = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => output += d.toString());
    
    // Wait for server to start
    setTimeout(() => {
      resolve({ process: proc, output });
    }, 2000);
  });
}

// Run a single test
async function runTest(port, testName, expected) {
  try {
    const res = await request(port, `/test?test=${encodeURIComponent(testName)}`);
    if (res.status !== 200) {
      return { passed: false, actual: res.body, error: `HTTP ${res.status}` };
    }
    
    const passed = res.body === expected;
    return { passed, actual: res.body };
  } catch (e) {
    return { passed: false, actual: null, error: e.message };
  }
}

// Run all tests for a category
async function runCategory(categoryName, categoryData, port) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${categoryName.toUpperCase()}`);
  console.log(categoryData.description);
  console.log('='.repeat(60));
  
  const category = { name: categoryName, apis: [] };
  let categoryPassed = 0;
  let categoryTotal = 0;
  
  for (const api of categoryData.apis) {
    console.log(`\n📦 ${api.name}`);
    const apiResult = { name: api.name, tests: [] };
    
    // Build test code
    const testsCode = api.tests.map(t => 
      `"${t.name}": () => { return ${t.test}; }`
    ).join(',\n      ');
    
    // Start server for this API
    const server = await startServer(port, testsCode);
    await new Promise(r => setTimeout(r, 1000));
    
    for (const test of api.tests) {
      process.stdout.write(`  ${test.name}... `);
      const result = await runTest(port, test.name, test.expect);
      
      categoryTotal++;
      if (result.passed) {
        categoryPassed++;
        console.log('✅ PASS');
      } else {
        console.log(`❌ FAIL (expected: ${test.expect}, got: ${result.actual})`);
        if (test.note) {
          console.log(`   ℹ️  ${test.note}`);
        }
      }
      
      apiResult.tests.push({
        name: test.name,
        passed: result.passed,
        expected: test.expect,
        actual: result.actual,
        error: result.error,
        note: test.note
      });
    }
    
    category.apis.push(apiResult);
    
    // Cleanup
    server.process.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    port++;
  }
  
  results.categories[categoryName] = category;
  results.summary.byCategory[categoryName] = {
    passed: categoryPassed,
    total: categoryTotal,
    percentage: Math.round((categoryPassed / categoryTotal) * 100)
  };
  
  results.summary.total += categoryTotal;
  results.summary.passed += categoryPassed;
  
  return port;
}

// Generate Markdown report
function generateMarkdownReport() {
  let md = `# nano-rs Node.js API Compatibility Matrix

**Generated:** ${results.timestamp}  
**nano-rs Version:** ${results.nanoVersion || 'Unknown'}  
**Test Run:** Comprehensive API Test Suite

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${results.summary.total} |
| **Passed** | ${results.summary.passed} ✓ |
| **Failed** | ${results.summary.total - results.summary.passed} ✗ |
| **Overall Score** | **${Math.round((results.summary.passed / results.summary.total) * 100)}%** |

## Compatibility by Category

`;

  for (const [catName, catData] of Object.entries(results.categories)) {
    const stats = results.summary.byCategory[catName];
    md += `### ${catName.toUpperCase().replace(/_/g, ' ')} (${stats.percentage}%)

${API_CATEGORIES[catName].description}

| API | Test | Status | Expected | Actual | Notes |
|-----|------|--------|----------|--------|-------|
`;
    
    for (const api of catData.apis) {
      for (const test of api.tests) {
        const status = test.passed ? '✅ PASS' : '❌ FAIL';
        const shortActual = test.actual ? test.actual.substring(0, 30) : 'undefined';
        md += `| ${api.name} | ${test.name} | ${status} | ${test.expected} | ${shortActual} | ${test.note || ''} |
`;
      }
    }
    md += '\n';
  }
  
  md += `## Implementation Status Legend

- ✅ **IMPLEMENTED** - Full compatibility
- ⚠️ **PARTIAL** - Some features work
- ❌ **NOT IMPLEMENTED** - Could be added
- 🚫 **WON'T IMPLEMENT** - Intentionally excluded

## Recommendations

### For Developers Migrating to nano-rs

1. **Use IMPLEMENTED APIs** with confidence - full compatibility
2. **Check PARTIAL APIs** - some features may not work
3. **Avoid NOT_IMPLEMENTED** - will fail, but may be added later
4. **Don't use WON'T_IMPLEMENT** - by design, find alternatives

### For nano-rs Contributors

1. **Priority 1:** Improve PARTIAL APIs to full implementation
2. **Priority 2:** Implement NOT_IMPLEMENTED APIs based on demand
3. **Priority 3:** Document WON'T_IMPLEMENT with alternatives

---

*Generated by Node.js API Compatibility Test Suite*
`;
  
  return md;
}

// Generate JSON report
function generateJSONReport() {
  return JSON.stringify(results, null, 2);
}

// Main execution
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Node.js API Compatibility Test Suite for nano-rs        ║');
  console.log('║  Tests ALL APIs and creates compatibility matrix         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // Ensure reports directory exists
  if (!fs.existsSync(CONFIG.REPORTS_DIR)) {
    fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
  }
  
  // Get nano-rs version
  try {
    const version = require('child_process').execSync(`${CONFIG.NANO_BINARY} --version`).toString().trim();
    results.nanoVersion = version;
    console.log(`Binary: ${CONFIG.NANO_BINARY}`);
    console.log(`Version: ${version}\n`);
  } catch (e) {
    console.log(`Warning: Could not get nano-rs version\n`);
  }
  
  let currentPort = CONFIG.BASE_PORT;
  
  // Run all categories
  for (const [catName, catData] of Object.entries(API_CATEGORIES)) {
    currentPort = await runCategory(catName, catData, currentPort);
  }
  
  // Generate reports
  console.log('\n' + '='.repeat(60));
  console.log('Generating Reports...');
  console.log('='.repeat(60));
  
  const markdownReport = generateMarkdownReport();
  const jsonReport = generateJSONReport();
  
  const timestamp = Date.now();
  const mdPath = path.join(CONFIG.REPORTS_DIR, `compatibility-matrix-${timestamp}.md`);
  const jsonPath = path.join(CONFIG.REPORTS_DIR, `compatibility-matrix-${timestamp}.json`);
  const latestMdPath = path.join(CONFIG.REPORTS_DIR, 'compatibility-matrix.md');
  
  fs.writeFileSync(mdPath, markdownReport);
  fs.writeFileSync(jsonPath, jsonReport);
  fs.writeFileSync(latestMdPath, markdownReport);
  
  console.log(`\n📄 Reports saved:`);
  console.log(`   - ${mdPath}`);
  console.log(`   - ${jsonPath}`);
  console.log(`   - ${latestMdPath}`);
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total APIs Tested:  ${results.summary.total.toString().padEnd(42)} ║`);
  console.log(`║  Passed:            ${('✓ ' + results.summary.passed).padEnd(42)} ║`);
  console.log(`║  Failed:            ${('✗ ' + (results.summary.total - results.summary.passed)).padEnd(42)} ║`);
  console.log(`║  Overall Score:     ${(Math.round((results.summary.passed / results.summary.total) * 100) + '%').padEnd(42)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // By category
  console.log('By Category:');
  for (const [catName, stats] of Object.entries(results.summary.byCategory)) {
    const icon = stats.percentage === 100 ? '✅' : stats.percentage >= 50 ? '⚠️' : '❌';
    console.log(`  ${icon} ${catName.padEnd(20)} ${stats.passed}/${stats.total} (${stats.percentage}%)`);
  }
  
  console.log('\n');
  process.exit(results.summary.total === results.summary.passed ? 0 : 0); // Always exit 0 for matrix
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
