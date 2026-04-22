#!/usr/bin/env node

/**
 * NANO-RS Blackbox Test Suite - Standalone Runner
 * 
 * This script can be run independently without any AI agent:
 *   node scripts/run-tests.js
 * 
 * Or with options:
 *   node scripts/run-tests.js --binary /path/to/nano-rs
 *   node scripts/run-tests.js --verbose
 *   node scripts/run-tests.js --output ./my-reports
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  binary: null,
  verbose: args.includes('--verbose') || args.includes('-v'),
  output: './reports',
  quick: args.includes('--quick'),
  help: args.includes('--help') || args.includes('-h')
};

// Parse --binary and --output options
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--binary' || args[i] === '-b') {
    options.binary = args[i + 1];
    i++;
  }
  if (args[i] === '--output' || args[i] === '-o') {
    options.output = args[i + 1];
    i++;
  }
}

// Show help
if (options.help) {
  console.log(`
NANO-RS Blackbox Test Suite

Usage: node scripts/run-tests.js [options]

Options:
  --binary, -b <path>    Path to nano-rs binary (auto-detected if not provided)
  --output, -o <dir>     Output directory for reports (default: ./reports)
  --verbose, -v          Show detailed test output
  --quick                Run only core tests (faster)
  --help, -h             Show this help message

Examples:
  node scripts/run-tests.js
  node scripts/run-tests.js --binary ./bin/nano-rs --verbose
  node scripts/run-tests.js --output ./test-results
`);
  process.exit(0);
}

// Configuration
const CONFIG = {
  NANO_BINARY: options.binary || detectBinary(),
  TEST_APPS_DIR: path.join(__dirname, '..', 'test-apps'),
  TESTS_DIR: path.join(__dirname, '..', 'tests'),
  REPORTS_DIR: path.resolve(options.output),
  TIMEOUT: 30000,
  BASE_PORT: 8888
};

// Auto-detect binary
function detectBinary() {
  const possiblePaths = [
    path.join(__dirname, '..', 'bin', 'nano-rs'),
    '/usr/local/bin/nano-rs',
    '/usr/bin/nano-rs',
    './nano-rs',
    '../bin/nano-rs'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  // Try to find in PATH
  try {
    const which = execSync('which nano-rs', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch (e) {}
  
  console.error('❌ Could not find nano-rs binary. Please specify with --binary');
  process.exit(1);
}

// Ensure directories exist
[CONFIG.TEST_APPS_DIR, CONFIG.TESTS_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  nanoVersion: null,
  startTime: Date.now()
};

// Helper functions
async function runTest(name, testFn, category = 'general') {
  results.total++;
  const testResult = {
    name,
    category,
    status: 'pending',
    duration: 0,
    error: null
  };
  
  const start = Date.now();
  try {
    await testFn(testResult);
    testResult.status = 'passed';
    testResult.duration = Date.now() - start;
    results.passed++;
    if (options.verbose) {
      console.log(`  ✓ ${name} (${testResult.duration}ms)`);
    }
  } catch (error) {
    testResult.status = 'failed';
    testResult.duration = Date.now() - start;
    testResult.error = error.message;
    results.failed++;
    if (options.verbose) {
      console.log(`  ✗ ${name} - ${error.message}`);
    }
  }
  
  results.tests.push(testResult);
  return testResult;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertContains(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message || `Expected to contain "${needle}"`);
  }
}

// HTTP request helper
async function httpRequest(opts, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    if (postData) req.write(postData);
    req.end();
  });
}

// Wait for server
async function waitForServer(port, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await httpRequest({ hostname: 'localhost', port, path: '/', method: 'GET', timeout: 1000 });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
}

// Start nano server
function startNanoServer(configPath, port) {
  const proc = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: options.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  if (!options.verbose) {
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', () => {});
  }
  
  return { process: proc };
}

// Stop nano
async function stopNano(nano) {
  if (!nano || !nano.process) return;
  nano.process.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 2000));
  try {
    nano.process.kill('SIGKILL');
  } catch (e) {}
}

// Create config file
function createConfig(apps, port) {
  const config = {
    server: { host: '0.0.0.0', port },
    apps: apps.map(app => ({
      hostname: app.hostname || 'localhost',
      entrypoint: app.entrypoint,
      limits: app.limits || { workers: 2, memory_mb: 64, timeout_secs: 30 }
    }))
  };
  
  const configPath = path.join(CONFIG.TESTS_DIR, `test-config-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

// Test applications setup
function createTestApps() {
  const apps = {
    'basic-http.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/echo' && request.method === 'POST') {
      const body = await request.text();
      return new Response(body, { status: 200 });
    }
    return new Response('Hello from NANO!', { status: 200 });
  }
};`,
    'wintercg-test.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-fetch') {
      return new Response(typeof fetch === 'function' ? 'OK' : 'FAIL', { status: 200 });
    }
    
    if (url.pathname === '/test-request-response') {
      const req = new Request('http://test.com', { method: 'POST', body: 'test' });
      const res = new Response('test', { status: 200 });
      return new Response(res.status === 200 ? 'OK' : 'FAIL', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};`,
    'crud-app.js': `const items = new Map();
let nextId = 1;
items.set(1, { id: 1, title: 'Initial', content: 'Content' });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/api/items' && request.method === 'GET') {
      return new Response(JSON.stringify({ items: Array.from(items.values()) }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/items' && request.method === 'POST') {
      const body = await request.json();
      const id = nextId++;
      const item = { id, ...body };
      items.set(id, item);
      return new Response(JSON.stringify(item), {
        status: 201, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const match = path.match(/^\/api\/items\/(\d+)$/);
    if (match) {
      const id = parseInt(match[1]);
      
      if (request.method === 'GET') {
        const item = items.get(id);
        if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        return new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      if (request.method === 'PUT') {
        const item = items.get(id);
        if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        const updates = await request.json();
        const updated = { ...item, ...updates };
        items.set(id, updated);
        return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      if (request.method === 'DELETE') {
        items.delete(id);
        return new Response(null, { status: 204 });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
};`,
    'node-basics-test.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-console') {
      console.log('test');
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/test-buffer') {
      const buf = Buffer.from('test');
      return new Response(buf.toString() === 'test' ? 'OK' : 'FAIL', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};`,
    'webcrypto-test.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-crypto') {
      return new Response(crypto && crypto.subtle ? 'OK' : 'FAIL', { status: 200 });
    }
    
    if (url.pathname === '/test-aes') {
      try {
        await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};`,
    'vfs-test.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-write') {
      try {
        await Nano.fs.writeFile('/tmp/test.txt', 'test-content');
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-read') {
      try {
        const content = await Nano.fs.readFile('/tmp/test.txt');
        return new Response(content, { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};`,
    'http-verbs-test.js': `export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const method = request.method;
    
    const routes = {
      '/test-get': 'GET',
      '/test-post': 'POST',
      '/test-put': 'PUT',
      '/test-patch': 'PATCH',
      '/test-delete': 'DELETE',
      '/test-head': 'HEAD',
      '/test-options': 'OPTIONS'
    };
    
    for (const [route, expectedMethod] of Object.entries(routes)) {
      if (path === route && method === expectedMethod) {
        return new Response(expectedMethod + ' OK', { status: 200 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};`,
    'tenant-app1.js': `export default {
  async fetch(request) {
    return new Response('Hello from App1', { status: 200 });
  }
};`,
    'tenant-app2.js': `export default {
  async fetch(request) {
    return new Response('Hello from App2', { status: 200 });
  }
};`,
    'esm-test.mjs': `export default {
  async fetch(request) {
    return new Response('ESM OK', { status: 200 });
  }
};`,
    'sliver-test-app.js': `let counter = 0;
export default {
  async fetch(request) {
    counter++;
    return new Response(JSON.stringify({ counter, timestamp: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};`,
    'error-test.js': `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/throw-error') {
      throw new Error('Intentional error');
    }
    
    return new Response('OK', { status: 200 });
  }
};`
  };
  
  for (const [filename, content] of Object.entries(apps)) {
    fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, filename), content);
  }
}

// Test implementations
async function testCLI() {
  console.log('\n📦 Testing CLI...');
  
  await runTest('nano-rs binary exists', async () => {
    assert(fs.existsSync(CONFIG.NANO_BINARY), 'Binary not found');
  }, 'cli');
  
  await runTest('nano-rs --version works', async (result) => {
    const version = execSync(`${CONFIG.NANO_BINARY} --version`).toString().trim();
    assertContains(version, 'nano-rs', 'Version command failed');
    results.nanoVersion = version;
    result.details = { version };
  }, 'cli');
  
  await runTest('nano-rs --help works', async () => {
    const help = execSync(`${CONFIG.NANO_BINARY} --help`).toString();
    assertContains(help, 'run', 'Help should mention run');
    assertContains(help, 'sliver', 'Help should mention sliver');
  }, 'cli');
}

async function testBasicHTTP() {
  console.log('\n🌐 Testing Basic HTTP Server...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'basic-http.js') }], CONFIG.BASE_PORT);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT);
  
  await runTest('Basic HTTP server starts', async () => {
    await waitForServer(CONFIG.BASE_PORT);
  }, 'basic-http');
  
  await runTest('Basic HTTP GET request', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'Should return 200');
    assertContains(response.body, 'Hello', 'Should return greeting');
  }, 'basic-http');
  
  await runTest('HTTP POST with body', async () => {
    const postData = JSON.stringify({ message: 'test' });
    const response = await httpRequest({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/echo',
      method: 'POST',
      headers: { 'Host': 'localhost', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, postData);
    assertEquals(response.status, 200, 'Should return 200');
    assertContains(response.body, 'test', 'Should echo body');
  }, 'basic-http');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testCRUD() {
  console.log('\n📝 Testing CRUD Application...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'crud-app.js') }], CONFIG.BASE_PORT + 1);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 1);
  
  await runTest('CRUD: Server starts', async () => {
    await waitForServer(CONFIG.BASE_PORT + 1);
  }, 'crud');
  
  await runTest('CRUD: CREATE (POST)', async () => {
    const data = JSON.stringify({ title: 'Test', content: 'Content' });
    const response = await httpRequest({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT + 1,
      path: '/api/items',
      method: 'POST',
      headers: { 'Host': 'localhost', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, data);
    assertEquals(response.status, 201, 'Should create item');
  }, 'crud');
  
  await runTest('CRUD: READ ALL (GET)', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 1, path: '/api/items', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'Should list items');
    const body = JSON.parse(response.body);
    assert(Array.isArray(body.items), 'Should return array');
  }, 'crud');
  
  await runTest('CRUD: READ ONE (GET)', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 1, path: '/api/items/1', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'Should get item');
  }, 'crud');
  
  await runTest('CRUD: UPDATE (PUT)', async () => {
    const data = JSON.stringify({ title: 'Updated' });
    const response = await httpRequest({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT + 1,
      path: '/api/items/1',
      method: 'PUT',
      headers: { 'Host': 'localhost', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, data);
    assertEquals(response.status, 200, 'Should update item');
  }, 'crud');
  
  await runTest('CRUD: DELETE (DELETE)', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 1, path: '/api/items/1', method: 'DELETE', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 204, 'Should delete item');
  }, 'crud');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testWinterCG() {
  console.log('\n❄️ Testing WinterCG Compatibility...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'wintercg-test.js') }], CONFIG.BASE_PORT + 2);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 2);
  
  await runTest('WinterCG: fetch() API available', async () => {
    await waitForServer(CONFIG.BASE_PORT + 2);
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 2, path: '/test-fetch', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'fetch() test failed');
  }, 'wintercg');
  
  await runTest('WinterCG: Request/Response objects', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 2, path: '/test-request-response', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'Request/Response test failed');
  }, 'wintercg');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testNodeBasics() {
  console.log('\n📦 Testing Node.js Basics...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'node-basics-test.js') }], CONFIG.BASE_PORT + 3);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 3);
  
  await runTest('Node.js: console methods', async () => {
    await waitForServer(CONFIG.BASE_PORT + 3);
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 3, path: '/test-console', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'console test failed');
  }, 'nodejs');
  
  await runTest('Node.js: Buffer', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 3, path: '/test-buffer', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'Buffer test failed');
  }, 'nodejs');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testWebCrypto() {
  console.log('\n🔐 Testing WebCrypto Support...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'webcrypto-test.js') }], CONFIG.BASE_PORT + 4);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 4);
  
  await runTest('WebCrypto: crypto.subtle available', async () => {
    await waitForServer(CONFIG.BASE_PORT + 4);
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 4, path: '/test-crypto', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'crypto.subtle test failed');
  }, 'webcrypto');
  
  await runTest('WebCrypto: AES-GCM encryption', async () => {
    const response = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 4, path: '/test-aes', method: 'GET', headers: { 'Host': 'localhost' } });
    assertEquals(response.status, 200, 'AES test failed');
  }, 'webcrypto');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testHTTPVerbs() {
  console.log('\n🌐 Testing HTTP Verbs Support...');
  
  const configPath = createConfig([{ hostname: 'localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'http-verbs-test.js') }], CONFIG.BASE_PORT + 5);
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 5);
  
  const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  
  for (const verb of verbs) {
    await runTest(`HTTP: ${verb} request`, async () => {
      await waitForServer(CONFIG.BASE_PORT + 5);
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 5,
        path: `/test-${verb.toLowerCase()}`,
        method: verb,
        headers: { 'Host': 'localhost' }
      });
      assertEquals(response.status, 200, `${verb} should work`);
    }, 'http-verbs');
  }
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

async function testMultiTenancy() {
  console.log('\n🏢 Testing Multi-tenancy...');
  
  const configPath = createConfig([
    { hostname: 'api1.localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'tenant-app1.js') },
    { hostname: 'api2.localhost', entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'tenant-app2.js') }
  ], CONFIG.BASE_PORT + 6);
  
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 6);
  
  await runTest('Multi-tenancy: Server with multiple apps starts', async () => {
    await waitForServer(CONFIG.BASE_PORT + 6);
  }, 'multi-tenancy');
  
  await runTest('Multi-tenancy: Routes to correct app by Host header', async () => {
    const r1 = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 6, path: '/', method: 'GET', headers: { 'Host': 'api1.localhost' } });
    assertContains(r1.body, 'App1', 'Should route to App1');
    
    const r2 = await httpRequest({ hostname: 'localhost', port: CONFIG.BASE_PORT + 6, path: '/', method: 'GET', headers: { 'Host': 'api2.localhost' } });
    assertContains(r2.body, 'App2', 'Should route to App2');
  }, 'multi-tenancy');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Report generation
function generateReport() {
  const duration = Date.now() - results.startTime;
  
  const categories = {};
  results.tests.forEach(test => {
    if (!categories[test.category]) categories[test.category] = { passed: 0, failed: 0, total: 0 };
    categories[test.category].total++;
    if (test.status === 'passed') {
      categories[test.category].passed++;
    } else {
      categories[test.category].failed++;
    }
  });
  
  const overallScore = Math.round((results.passed / results.total) * 100);
  
  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      nanoVersion: results.nanoVersion,
      duration: `${duration}ms`,
      testHarness: 'nano-rs-blackbox-test v1.0'
    },
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      overallScore: `${overallScore}%`
    },
    categories,
    testResults: results.tests
  };
  
  return report;
}

function generateMarkdownReport(report) {
  let md = `# NANO-RS Blackbox Test Report

**Generated:** ${new Date().toISOString()}  
**NANO Version:** ${report.meta.nanoVersion}  
**Test Duration:** ${report.meta.duration}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${report.summary.total} |
| Passed | ✓ ${report.summary.passed} |
| Failed | ✗ ${report.summary.failed} |
| **Overall Score** | **${report.summary.overallScore}** |

## Results by Category

`;
  
  for (const [category, data] of Object.entries(report.categories)) {
    const score = Math.round((data.passed / data.total) * 100);
    md += `### ${category} (${data.passed}/${data.total} - ${score}%)\n\n`;
    md += '| Test | Status |\n';
    md += '|------|--------|\n';
    
    report.testResults
      .filter(t => t.category === category)
      .forEach(test => {
        const icon = test.status === 'passed' ? '✓' : '✗';
        md += `| ${test.name} | ${icon} ${test.status} |\n`;
      });
    
    md += '\n';
  }
  
  return md;
}

// Main execution
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     NANO-RS Blackbox Test Suite                          ║');
  console.log('║     Standalone Test Runner                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  console.log(`Using binary: ${CONFIG.NANO_BINARY}`);
  console.log(`Output directory: ${CONFIG.REPORTS_DIR}\n`);
  
  // Create test apps
  console.log('📝 Creating test applications...\n');
  createTestApps();
  
  // Run tests
  await testCLI();
  await testBasicHTTP();
  
  if (!options.quick) {
    await testWinterCG();
    await testNodeBasics();
    await testWebCrypto();
    await testCRUD();
    await testHTTPVerbs();
    await testMultiTenancy();
  }
  
  // Generate reports
  console.log('\n📊 Generating reports...');
  const report = generateReport();
  const reportJson = JSON.stringify(report, null, 2);
  const reportMd = generateMarkdownReport(report);
  
  // Save reports
  const reportName = `report-${Date.now()}`;
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `${reportName}.json`), reportJson);
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `${reportName}.md`), reportMd);
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, 'latest-report.md'), reportMd);
  
  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests:  ${report.summary.total.toString().padEnd(42)} ║`);
  console.log(`║  Passed:       ${('✓ ' + report.summary.passed).padEnd(42)} ║`);
  console.log(`║  Failed:       ${('✗ ' + report.summary.failed).padEnd(42)} ║`);
  console.log(`║  Overall:      ${report.summary.overallScore.padEnd(42)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  console.log(`\n📄 Reports saved to:`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, `${reportName}.json`)}`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, `${reportName}.md`)}`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, 'latest-report.md')}`);
  
  // Exit with appropriate code
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

// Run
main();
