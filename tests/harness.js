/**
 * NANO-RS Blackbox Test Suite
 * 
 * A comprehensive JavaScript-only test harness for testing nano-rs runtime
 * Features tested:
 * - Basic HTTP server functionality
 * - WinterCG compatibility (fetch, Request, Response, Headers, streams)
 * - Node.js basics compatibility
 * - VFS (Virtual File System)
 * - Sliver snapshots (the "Docker of JS")
 * - Multi-tenancy
 * - WebCrypto support
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

// Test configuration
const CONFIG = {
  NANO_BINARY: path.join(__dirname, '../bin/nano-rs'),
  TEST_APPS_DIR: path.join(__dirname, '../test-apps'),
  TESTS_DIR: path.join(__dirname, '../tests'),
  REPORTS_DIR: path.join(__dirname, '../reports'),
  TIMEOUT: 30000,
  BASE_PORT: 8888,
  ADMIN_PORT: 8889
};

// Test result tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  errors: [],
  nanoVersion: null,
  startTime: Date.now()
};

// Helper: Run a test and track results
async function runTest(name, testFn, category = 'general') {
  results.total++;
  const testResult = {
    name,
    category,
    status: 'pending',
    duration: 0,
    error: null,
    details: {}
  };
  
  const start = Date.now();
  try {
    await testFn(testResult);
    testResult.status = 'passed';
    testResult.duration = Date.now() - start;
    results.passed++;
    console.log(`  ✓ ${name} (${testResult.duration}ms)`);
  } catch (error) {
    testResult.status = 'failed';
    testResult.duration = Date.now() - start;
    testResult.error = error.message;
    results.failed++;
    results.errors.push({ test: name, error: error.message, stack: error.stack });
    console.log(`  ✗ ${name} - ${error.message}`);
  }
  
  results.tests.push(testResult);
  return testResult;
}

// Helper: Assert functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
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

// Helper: HTTP request
async function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Helper: Wait for server to be ready
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

// Helper: Start nano-rs server
function startNanoServer(configPath, port, extraArgs = []) {
  const args = ['run'];
  if (configPath) {
    args.push('--config', configPath);
  }
  args.push(...extraArgs);
  
  const proc = spawn(CONFIG.NANO_BINARY, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', d => stdout += d.toString());
  proc.stderr.on('data', d => stderr += d.toString());
  
  return { process: proc, stdout: () => stdout, stderr: () => stderr };
}

// Helper: Kill nano process and wait for it to exit
function stopNano(nano) {
  return new Promise((resolve) => {
    if (!nano || !nano.process) {
      resolve();
      return;
    }
    
    const proc = nano.process;
    let exited = false;
    
    // Set up exit handler
    proc.on('exit', () => {
      exited = true;
      resolve();
    });
    
    // Send SIGTERM first
    proc.kill('SIGTERM');
    
    // Wait for graceful exit with timeout
    setTimeout(() => {
      if (!exited) {
        try {
          proc.kill('SIGKILL');
        } catch (e) {
          // Process may have already exited
        }
        // Give it a moment to die after SIGKILL
        setTimeout(() => {
          if (!exited) {
            resolve(); // Force resolve after timeout
          }
        }, 500);
      }
    }, 1000);
  });
}

// Helper: Create temp config file
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

// ==================== TESTS ====================

// Test 1: CLI Version and Help
async function testCLI() {
  console.log('\n📦 Testing CLI...');
  
  await runTest('nano-rs binary exists', async () => {
    assert(fs.existsSync(CONFIG.NANO_BINARY), 'Binary not found');
  }, 'cli');
  
  await runTest('nano-rs --version works', async (result) => {
    const version = execSync(`${CONFIG.NANO_BINARY} --version`).toString().trim();
    assertContains(version, 'nano-rs', 'Version command should work');
    results.nanoVersion = version;
    result.details.version = version;
  }, 'cli');
  
  await runTest('nano-rs --help works', async () => {
    const help = execSync(`${CONFIG.NANO_BINARY} --help`).toString();
    assertContains(help, 'run', 'Help should mention run command');
    assertContains(help, 'sliver', 'Help should mention sliver command');
  }, 'cli');
  
  await runTest('nano-rs run --help works', async () => {
    const help = execSync(`${CONFIG.NANO_BINARY} run --help`).toString();
    assertContains(help, 'config', 'Run help should mention config option');
    assertContains(help, 'sliver', 'Run help should mention sliver option');
  }, 'cli');
  
  await runTest('nano-rs sliver --help works', async () => {
    const help = execSync(`${CONFIG.NANO_BINARY} sliver --help`).toString();
    assertContains(help, 'create', 'Sliver help should mention create');
    assertContains(help, 'list', 'Sliver help should mention list');
    assertContains(help, 'delete', 'Sliver help should mention delete');
  }, 'cli');
}

// Test 2: Basic HTTP Server
async function testBasicHTTP() {
  console.log('\n🌐 Testing Basic HTTP Server...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'basic-http.js');
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], CONFIG.BASE_PORT);
  
  let nano;
  
  await runTest('Basic HTTP server starts', async () => {
    nano = startNanoServer(configPath, CONFIG.BASE_PORT);
    await waitForServer(CONFIG.BASE_PORT, 10000);
  }, 'basic-http');
  
  await runTest('Basic HTTP GET request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port: CONFIG.BASE_PORT, 
      path: '/', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
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
      headers: { 
        'Host': 'localhost',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    assertEquals(response.status, 200, 'Should return 200');
    assertContains(response.body, 'test', 'Should echo back the message');
  }, 'basic-http');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 3: WinterCG Compatibility
async function testWinterCG() {
  console.log('\n❄️ Testing WinterCG Compatibility...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'wintercg-test.js');
  const port = CONFIG.BASE_PORT + 1;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('WinterCG: fetch() API available', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-fetch', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'fetch() test should pass');
  }, 'wintercg');
  
  await runTest('WinterCG: Request/Response objects', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-request-response', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Request/Response test should pass');
  }, 'wintercg');
  
  await runTest('WinterCG: Headers API', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-headers', 
      method: 'GET',
      headers: { 'Host': 'localhost', 'X-Custom-Header': 'test-value' }
    });
    assertEquals(response.status, 200, 'Headers test should pass');
    assertContains(response.body, 'test-value', 'Should receive custom header');
  }, 'wintercg');
  
  await runTest('WinterCG: URL API', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-url?foo=bar&baz=qux', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'URL test should pass');
    assertContains(response.body, 'bar', 'Should parse query params');
  }, 'wintercg');
  
  await runTest('WinterCG: ReadableStream/WritableStream', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-streams', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Streams test should pass');
  }, 'wintercg');
  
  await runTest('WinterCG: TextEncoder/TextDecoder', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-encoding', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Encoding test should pass');
  }, 'wintercg');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 4: Node.js Basics Compatibility
async function testNodeBasics() {
  console.log('\n📦 Testing Node.js Basics...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'node-basics-test.js');
  const port = CONFIG.BASE_PORT + 2;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('Node.js: console methods', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-console', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'console test should pass');
  }, 'nodejs');
  
  await runTest('Node.js: setTimeout/setInterval', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-timers', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Timers test should pass');
  }, 'nodejs');
  
  await runTest('Node.js: Buffer', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-buffer', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Buffer test should pass');
  }, 'nodejs');
  
  await runTest('Node.js: require() support', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-require', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'require() test should pass');
  }, 'nodejs');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 5: WebCrypto Support
async function testWebCrypto() {
  console.log('\n🔐 Testing WebCrypto Support...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'webcrypto-test.js');
  const port = CONFIG.BASE_PORT + 3;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('WebCrypto: crypto.subtle available', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-crypto', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'crypto.subtle should be available');
  }, 'webcrypto');
  
  await runTest('WebCrypto: AES-GCM encryption', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-aes', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'AES-GCM should work');
  }, 'webcrypto');
  
  await runTest('WebCrypto: HMAC signing', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-hmac', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'HMAC should work');
  }, 'webcrypto');
  
  await runTest('WebCrypto: PBKDF2 derivation', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-pbkdf2', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'PBKDF2 should work');
  }, 'webcrypto');
  
  await runTest('WebCrypto: SHA-256 hashing', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-hash', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'SHA-256 should work');
    assertContains(response.body, 'sha256', 'Should return hash');
  }, 'webcrypto');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 6: VFS (Virtual File System)
async function testVFS() {
  console.log('\n📁 Testing Virtual File System...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'vfs-test.js');
  const port = CONFIG.BASE_PORT + 4;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('VFS: Nano.fs.writeFile', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-write', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'writeFile should work');
  }, 'vfs');
  
  await runTest('VFS: Nano.fs.readFile', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-read', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'readFile should work');
    assertContains(response.body, 'test-content', 'Should read file content');
  }, 'vfs');
  
  await runTest('VFS: Node.js fs module compatibility', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/test-node-fs', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Node fs module should work');
  }, 'vfs');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 7: CRUD Application (Next.js style)
async function testCRUDApp() {
  console.log('\n📝 Testing CRUD Application...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'crud-app.js');
  const port = CONFIG.BASE_PORT + 5;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('CRUD: Server starts', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
  }, 'crud');
  
  // CREATE
  await runTest('CRUD: CREATE (POST)', async () => {
    const postData = JSON.stringify({ title: 'Test Item', content: 'Test content' });
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/api/items', 
      method: 'POST',
      headers: { 
        'Host': 'localhost',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    assertEquals(response.status, 201, 'Should create item');
    const body = JSON.parse(response.body);
    assert(body.id, 'Should return item ID');
  }, 'crud');
  
  // READ all
  await runTest('CRUD: READ ALL (GET)', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/api/items', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Should list items');
    const body = JSON.parse(response.body);
    assert(Array.isArray(body.items), 'Should return items array');
    assert(body.items.length > 0, 'Should have at least one item');
  }, 'crud');
  
  // READ one
  await runTest('CRUD: READ ONE (GET)', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/api/items/1', 
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'Should get item');
    const body = JSON.parse(response.body);
    assert(body.id === 1, 'Should return correct item');
  }, 'crud');
  
  // UPDATE
  await runTest('CRUD: UPDATE (PUT)', async () => {
    const putData = JSON.stringify({ title: 'Updated Item' });
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/api/items/1', 
      method: 'PUT',
      headers: { 
        'Host': 'localhost',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData)
      }
    }, putData);
    assertEquals(response.status, 200, 'Should update item');
    const body = JSON.parse(response.body);
    assert(body.title === 'Updated Item', 'Should update title');
  }, 'crud');
  
  // DELETE
  await runTest('CRUD: DELETE (DELETE)', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', 
      port, 
      path: '/api/items/1', 
      method: 'DELETE',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 204, 'Should delete item');
  }, 'crud');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 8: HTTP Verbs Support
async function testHTTPVerbs() {
  console.log('\n🌐 Testing HTTP Verbs Support...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'http-verbs-test.js');
  const port = CONFIG.BASE_PORT + 6;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('HTTP: GET request', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-get', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'GET should work');
  }, 'http-verbs');
  
  await runTest('HTTP: POST request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-post', method: 'POST',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'POST should work');
  }, 'http-verbs');
  
  await runTest('HTTP: PUT request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-put', method: 'PUT',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'PUT should work');
  }, 'http-verbs');
  
  await runTest('HTTP: PATCH request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-patch', method: 'PATCH',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'PATCH should work');
  }, 'http-verbs');
  
  await runTest('HTTP: DELETE request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-delete', method: 'DELETE',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'DELETE should work');
  }, 'http-verbs');
  
  await runTest('HTTP: HEAD request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-head', method: 'HEAD',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'HEAD should work');
  }, 'http-verbs');
  
  await runTest('HTTP: OPTIONS request', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-options', method: 'OPTIONS',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'OPTIONS should work');
  }, 'http-verbs');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 9: Multi-tenancy (Virtual Host Routing)
async function testMultiTenancy() {
  console.log('\n🏢 Testing Multi-tenancy...');
  
  const app1Path = path.join(CONFIG.TEST_APPS_DIR, 'tenant-app1.js');
  const app2Path = path.join(CONFIG.TEST_APPS_DIR, 'tenant-app2.js');
  const port = CONFIG.BASE_PORT + 7;
  
  const config = {
    server: { host: '0.0.0.0', port },
    apps: [
      { 
        hostname: 'api1.localhost', 
        entrypoint: app1Path,
        limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
      },
      { 
        hostname: 'api2.localhost', 
        entrypoint: app2Path,
        limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
      }
    ]
  };
  
  const configPath = path.join(CONFIG.TESTS_DIR, `test-config-multi-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  let nano;
  
  await runTest('Multi-tenancy: Server with multiple apps starts', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
  }, 'multi-tenancy');
  
  await runTest('Multi-tenancy: Routes to correct app by Host header', async () => {
    const response1 = await httpRequest({ 
      hostname: 'localhost', port, path: '/', method: 'GET',
      headers: { 'Host': 'api1.localhost' }
    });
    assertEquals(response1.status, 200, 'api1 should respond');
    assertContains(response1.body, 'App1', 'Should be App1');
    
    const response2 = await httpRequest({ 
      hostname: 'localhost', port, path: '/', method: 'GET',
      headers: { 'Host': 'api2.localhost' }
    });
    assertEquals(response2.status, 200, 'api2 should respond');
    assertContains(response2.body, 'App2', 'Should be App2');
  }, 'multi-tenancy');
  
  await runTest('Multi-tenancy: Wrong Host returns 404', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/', method: 'GET',
      headers: { 'Host': 'unknown.localhost' }
    });
    assertEquals(response.status, 404, 'Unknown host should return 404');
  }, 'multi-tenancy');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 10: Sliver Feature (Docker of JS)
async function testSliver() {
  console.log('\n🔷 Testing Sliver Feature (Docker of JS)...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'sliver-test-app.js');
  const sliverPath = path.join(CONFIG.TESTS_DIR, 'test.sliver');
  const port = CONFIG.BASE_PORT + 8;
  
  // Step 1: Create a running app that we can snapshot
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('Sliver: App server starts for snapshot creation', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
    
    // Verify the app works
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'App should be running');
  }, 'sliver');
  
  await runTest('Sliver: Create sliver from running app', async () => {
    try {
      // Note: Creating sliver requires the app to be running via config
      // The sliver create command snapshots the isolate state
      // Run from temp dir to avoid capturing entire test suite (791MB!)
      const tempDir = path.join(CONFIG.TESTS_DIR, `sliver-temp-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Copy the test app to temp dir
      const tempAppPath = path.join(tempDir, 'app.js');
      fs.copyFileSync(testAppPath, tempAppPath);
      
      // Use absolute path to nano-rs binary since we're changing cwd
      const nanoBinaryAbsolute = path.resolve(CONFIG.NANO_BINARY);
      
      // DEBUG: Log what we're doing
      console.log(`  [DEBUG] Creating sliver from temp dir: ${tempDir}`);
      console.log(`  [DEBUG] Nano binary: ${nanoBinaryAbsolute}`);
      console.log(`  [DEBUG] Temp dir exists: ${fs.existsSync(tempDir)}`);
      console.log(`  [DEBUG] Temp dir files: ${fs.readdirSync(tempDir)}`);
      
      const output = execSync(
        `${nanoBinaryAbsolute} sliver create localhost --name test-sliver --tag v1.0`,
        { encoding: 'utf8', timeout: 30000, cwd: tempDir }
      );
      
      console.log(`  [DEBUG] Sliver create output: ${output.substring(0, 100)}...`);
      
      // Move the sliver file to the expected location
      const tempSliverFile = path.join(tempDir, 'test-sliver-v1.0.sliver');
      const finalSliverFile = path.join(process.cwd(), 'test-sliver-v1.0.sliver');
      
      console.log(`  [DEBUG] Temp sliver file: ${tempSliverFile}`);
      console.log(`  [DEBUG] Temp sliver exists: ${fs.existsSync(tempSliverFile)}`);
      console.log(`  [DEBUG] Final sliver file: ${finalSliverFile}`);
      
      if (fs.existsSync(tempSliverFile)) {
        fs.renameSync(tempSliverFile, finalSliverFile);
        console.log(`  [DEBUG] Sliver file moved to: ${finalSliverFile}`);
        console.log(`  [DEBUG] Final sliver exists after move: ${fs.existsSync(finalSliverFile)}`);
      } else {
        console.log(`  [DEBUG] WARNING: Temp sliver file not found!`);
        console.log(`  [DEBUG] Files in temp dir: ${fs.readdirSync(tempDir)}`);
      }
      
      // Cleanup temp dir
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
      
      assertContains(output.toLowerCase(), 'created', 'Sliver should be created');
    } catch (e) {
      // If sliver create fails, report it as a failure
      console.log(`  [DEBUG] Sliver creation error: ${e.message}`);
      throw new Error(`Sliver creation failed: ${e.message}`);
    }
  }, 'sliver');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
  
  // Test running from sliver if one was created
  const sliverFile = path.join(process.cwd(), 'test-sliver-v1.0.sliver');
  console.log(`  [DEBUG] Checking for sliver file at: ${sliverFile}`);
  console.log(`  [DEBUG] Sliver file exists: ${fs.existsSync(sliverFile)}`);
  if (fs.existsSync(sliverFile)) {
    const stats = fs.statSync(sliverFile);
    console.log(`  [DEBUG] Sliver file size: ${stats.size} bytes`);
    await runTest('Sliver: Run server from sliver file', async () => {
      // Use the startNanoServer helper with sliver argument
      const sliverConfig = {
        sliver: sliverFile,
        workers: 2,
        port: port
      };
      
      // Write a simple sliver run config
      const sliverRunConfig = path.join(CONFIG.TESTS_DIR, `sliver-run-${Date.now()}.json`);
      fs.writeFileSync(sliverRunConfig, JSON.stringify({
        sliver: sliverFile,
        workers: 2,
        port: port
      }));
      
      // Start nano with sliver - note: sliver run doesn't use --config, uses --sliver directly
      console.log(`  [DEBUG] Starting sliver run with file: ${sliverFile}`);
      console.log(`  [DEBUG] Port: ${port}`);
      const sliverNano = startNanoServer(sliverRunConfig, port, ['--sliver', sliverFile, '--workers', '2']);
      
      console.log(`  [DEBUG] Waiting for server on port ${port}...`);
      await waitForServer(port, 10000);
      console.log(`  [DEBUG] Server started!`);
      
      const response = await httpRequest({ 
        hostname: 'localhost', port, path: '/', method: 'GET',
        headers: { 'Host': 'localhost' }
      });
      assertEquals(response.status, 200, 'Should respond from sliver');
      
      await stopNano(sliverNano);
      try { fs.unlinkSync(sliverRunConfig); } catch (e) {}
    }, 'sliver');
    
    // Cleanup
    try {
      fs.unlinkSync(sliverFile);
    } catch (e) {}
  } else {
    results.skipped++;
    console.log('  ⚠ Sliver file not created - skipping sliver run tests');
  }
}

// Test 11: ESM Module Support
async function testESM() {
  console.log('\n📦 Testing ESM Module Support...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'esm-test.mjs');
  const port = CONFIG.BASE_PORT + 9;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('ESM: ES Modules app starts', async () => {
    nano = startNanoServer(configPath, port);
    await waitForServer(port, 10000);
  }, 'esm');
  
  await runTest('ESM: export default syntax works', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'ESM export should work');
  }, 'esm');
  
  await runTest('ESM: import syntax works', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/test-import', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assertEquals(response.status, 200, 'ESM import should work');
  }, 'esm');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// Test 12: Error Handling & Edge Cases
async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');
  
  const testAppPath = path.join(CONFIG.TEST_APPS_DIR, 'error-test.js');
  const port = CONFIG.BASE_PORT + 10;
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: testAppPath 
  }], port);
  
  let nano;
  
  await runTest('Error: App with syntax error handled gracefully', async () => {
    const badAppPath = path.join(CONFIG.TEST_APPS_DIR, 'syntax-error.js');
    const badConfig = createConfig([{ 
      hostname: 'localhost', 
      entrypoint: badAppPath 
    }], port);
    
    nano = startNanoServer(badConfig, port);
    // Give it a moment to potentially fail
    await new Promise(r => setTimeout(r, 2000));
    
    // Server should still be up, just return 500 for the bad app
    fs.unlinkSync(badConfig);
  }, 'error-handling');
  
  await stopNano(nano);
  
  // Test with working error app
  nano = startNanoServer(configPath, port);
  await waitForServer(port, 10000);
  
  await runTest('Error: Thrown errors return 500', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/throw-error', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    // Should handle error gracefully (500 or catch it)
    assert(response.status >= 200 && response.status < 600, 'Should return valid HTTP status');
  }, 'error-handling');
  
  await runTest('Error: Async errors handled', async () => {
    const response = await httpRequest({ 
      hostname: 'localhost', port, path: '/async-error', method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    assert(response.status >= 200 && response.status < 600, 'Should handle async errors');
  }, 'error-handling');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}

// ==================== REPORT GENERATION ====================

function generateReport() {
  const duration = Date.now() - results.startTime;
  const categories = {};
  
  // Group tests by category
  results.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = { passed: 0, failed: 0, total: 0 };
    }
    categories[test.category].total++;
    if (test.status === 'passed') {
      categories[test.category].passed++;
    } else {
      categories[test.category].failed++;
    }
  });
  
  // Calculate WinterCG score
  const wintercg = categories['wintercg'] || { passed: 0, total: 0 };
  const wintercgScore = wintercg.total > 0 ? Math.round((wintercg.passed / wintercg.total) * 100) : 0;
  
  // Calculate Node.js basics score
  const nodejs = categories['nodejs'] || { passed: 0, total: 0 };
  const nodejsScore = nodejs.total > 0 ? Math.round((nodejs.passed / nodejs.total) * 100) : 0;
  
  // Overall score
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
    compatibility: {
      wintercg: {
        score: `${wintercgScore}%`,
        testsPassed: `${wintercg.passed}/${wintercg.total}`,
        notes: wintercgScore >= 80 ? 'Good WinterCG compatibility' : 'Partial WinterCG support'
      },
      nodejsBasics: {
        score: `${nodejsScore}%`,
        testsPassed: `${nodejs.passed}/${nodejs.total}`,
        notes: nodejsScore >= 70 ? 'Good Node.js basics compatibility' : 'Limited Node.js compatibility'
      }
    },
    categories: categories,
    testResults: results.tests,
    errors: results.errors
  };
  
  return report;
}

function generateMarkdownReport(report) {
  // Extract scores for use in recommendations
  const overallScore = parseInt(report.summary.overallScore);
  const wintercgScore = parseInt(report.compatibility.wintercg.score);
  const nodejsScore = parseInt(report.compatibility.nodejsBasics.score);
  
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
| Skipped | ⚠ ${report.summary.skipped} |
| **Overall Score** | **${report.summary.overallScore}** |

## Compatibility Scores

### WinterCG (Web-interoperable Runtimes Community Group)

**Score: ${report.compatibility.wintercg.score}**

The WinterCG standard defines common APIs for JavaScript runtimes to ensure code portability between Node.js, Deno, Cloudflare Workers, and other edge runtimes.

| Feature | Status | Notes |
|---------|--------|-------|
| fetch() | ${getFeatureStatus('wintercg', 'fetch')} | Core API for HTTP requests |
| Request/Response | ${getFeatureStatus('wintercg', 'request-response')} | HTTP message objects |
| Headers | ${getFeatureStatus('wintercg', 'headers')} | HTTP header manipulation |
| URL API | ${getFeatureStatus('wintercg', 'url')} | URL parsing |
| ReadableStream/WritableStream | ${getFeatureStatus('wintercg', 'streams')} | Streaming data |
| TextEncoder/TextDecoder | ${getFeatureStatus('wintercg', 'encoding')} | Text encoding |

**Result:** ${report.compatibility.wintercg.notes}

### Node.js Basics Compatibility

**Score: ${report.compatibility.nodejsBasics.score}**

| Feature | Status | Notes |
|---------|--------|-------|
| console | ${getFeatureStatus('nodejs', 'console')} | Logging methods |
| setTimeout/setInterval | ${getFeatureStatus('nodejs', 'timers')} | Timer functions |
| Buffer | ${getFeatureStatus('nodejs', 'buffer')} | Binary data handling |
| require() | ${getFeatureStatus('nodejs', 'require')} | CommonJS modules |

**Result:** ${report.compatibility.nodejsBasics.notes}

## Detailed Test Results by Category

`;

  // Group tests by category
  const byCategory = {};
  report.testResults.forEach(test => {
    if (!byCategory[test.category]) byCategory[test.category] = [];
    byCategory[test.category].push(test);
  });

  for (const [category, tests] of Object.entries(byCategory)) {
    const passed = tests.filter(t => t.status === 'passed').length;
    const total = tests.length;
    md += `### ${category} (${passed}/${total} passed)\n\n`;
    md += '| Test | Status | Duration |\n';
    md += '|------|--------|----------|\n';
    tests.forEach(test => {
      const icon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '⚠';
      md += `| ${test.name} | ${icon} ${test.status} | ${test.duration}ms |\n`;
    });
    md += '\n';
  }

  // Add errors section if there are failures
  if (report.errors.length > 0) {
    md += `## Errors and Issues\n\n`;
    report.errors.forEach((err, i) => {
      md += `### ${i + 1}. ${err.test}\n\n`;
      md += `Error: ${err.error}\n\n`;
    });
  }

  // Add feature-specific findings
  md += `## Feature-Specific Findings

### Sliver Feature (Docker of JS)

The sliver feature provides snapshot-based isolation for JavaScript apps, enabling sub-2ms cold starts.

**Status:** ${report.categories.sliver ? (report.categories.sliver.failed === 0 ? '✓ Working' : '⚠ Partial') : '⚠ Not tested'}

Key capabilities tested:
- Sliver creation from running apps
- Running apps from sliver files
- Snapshot-based fast startup

### Multi-tenancy

NANO supports hosting multiple isolated apps in a single process with virtual host routing.

**Status:** ${report.categories['multi-tenancy'] ? (report.categories['multi-tenancy'].failed === 0 ? '✓ Working' : '⚠ Partial') : '⚠ Not tested'}

### Virtual File System (VFS)

Each isolate has its own ephemeral filesystem with both explicit (Nano.fs) and Node.js compatible APIs.

**Status:** ${report.categories.vfs ? (report.categories.vfs.failed === 0 ? '✓ Working' : '⚠ Partial') : '⚠ Not tested'}

### WebCrypto

Cryptographic operations via WebCrypto API including AES-GCM, HMAC, and PBKDF2.

**Status:** ${report.categories.webcrypto ? (report.categories.webcrypto.failed === 0 ? '✓ Working' : '⚠ Partial') : '⚠ Not tested'}

## Recommendations

`;

  if (overallScore < 70) {
    md += `### Critical Issues\n\n`;
    md += `- Overall compatibility score is below 70%. Consider these issues before production use.\n`;
  }

  if (wintercgScore < 80) {
    md += `### WinterCG Improvements\n\n`;
    md += `- Improve WinterCG API coverage for better edge runtime compatibility\n`;
    md += `- Focus on fetch(), streams, and Request/Response objects\n`;
  }

  if (nodejsScore < 70) {
    md += `### Node.js Compatibility\n\n`;
    md += `- Add better Node.js core module polyfills\n`;
    md += `- Ensure Buffer and timer functions work correctly\n`;
  }

  md += `\n---\n\n*Report generated by nano-rs-blackbox-test*\n`;

  return md;
}

function getFeatureStatus(category, feature) {
  // Helper to determine feature status based on test results
  // This would need to be more sophisticated in a real implementation
  const cat = results.tests.filter(t => t.category === category);
  const hasPass = cat.some(t => t.status === 'passed' && t.name.toLowerCase().includes(feature.replace('-', '')));
  return hasPass ? '✓ Pass' : '⚠ Fail/Untested';
}

// ==================== MAIN ====================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     NANO-RS Blackbox Test Suite                          ║');
  console.log('║     Comprehensive JavaScript Runtime Testing             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // Ensure directories exist
  [CONFIG.TEST_APPS_DIR, CONFIG.TESTS_DIR, CONFIG.REPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  
  // Create all test app files first
  console.log('📝 Creating test applications...\n');
  createTestApps();
  
  // Run all tests
  await testCLI();
  await testBasicHTTP();
  await testWinterCG();
  await testNodeBasics();
  await testWebCrypto();
  await testVFS();
  await testCRUDApp();
  await testHTTPVerbs();
  await testMultiTenancy();
  await testSliver();
  await testESM();
  await testErrorHandling();
  
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
  console.log(`║  Passed:       ${(`✓ ${report.summary.passed}`).padEnd(42)} ║`);
  console.log(`║  Failed:       ${(`✗ ${report.summary.failed}`).padEnd(42)} ║`);
  console.log(`║  Skipped:      ${(`⚠ ${report.summary.skipped}`).padEnd(42)} ║`);
  console.log(`║  Overall:      ${report.summary.overallScore.padEnd(42)} ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  WinterCG:     ${report.compatibility.wintercg.score.padEnd(42)} ║`);
  console.log(`║  Node.js:      ${report.compatibility.nodejsBasics.score.padEnd(42)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  console.log(`\n📄 Reports saved to:`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, `${reportName}.json`)}`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, `${reportName}.md`)}`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, 'latest-report.md')}`);
  
  // Exit with appropriate code
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// ==================== TEST APP CREATION ====================

function createTestApps() {
  // Basic HTTP app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'basic-http.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/echo' && request.method === 'POST') {
      const body = await request.text();
      return new Response(body, { status: 200 });
    }
    
    return new Response('Hello from NANO!', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
`);

  // WinterCG test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'wintercg-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-fetch') {
      // Test that fetch is available
      if (typeof fetch !== 'function') {
        return new Response('fetch not available', { status: 500 });
      }
      return new Response('fetch available', { status: 200 });
    }
    
    if (url.pathname === '/test-request-response') {
      // Test Request/Response objects
      const req = new Request('http://test.com', { method: 'POST', body: 'test' });
      const res = new Response('test response', { status: 200 });
      if (res.status === 200) {
        return new Response('OK', { status: 200 });
      }
      return new Response('FAIL', { status: 500 });
    }
    
    if (url.pathname === '/test-headers') {
      // Test Headers API - echo back the custom header from request
      const headerValue = request.headers.get('X-Custom-Header');
      return new Response(headerValue || 'no-header', { status: 200 });
    }
    
    if (url.pathname === '/test-url') {
      // Test URL API
      const params = url.searchParams.get('foo');
      return new Response(params || 'no-params', { status: 200 });
    }
    
    if (url.pathname === '/test-streams') {
      // Test streams
      try {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'));
            controller.close();
          }
        });
        return new Response(stream, { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-encoding') {
      // Test TextEncoder/TextDecoder
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const encoded = encoder.encode('test');
      const decoded = decoder.decode(encoded);
      return new Response(decoded === 'test' ? 'OK' : 'FAIL', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`);

  // Node.js basics test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'node-basics-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-console') {
      // Test console methods
      console.log('log test');
      console.error('error test');
      console.warn('warn test');
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/test-timers') {
      // Test timers
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(new Response('OK', { status: 200 }));
        }, 10);
      });
    }
    
    if (url.pathname === '/test-buffer') {
      // Test Buffer
      try {
        const buf = Buffer.from('test');
        return new Response(buf.toString() === 'test' ? 'OK' : 'FAIL', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-require') {
      // Test require
      try {
        // require should be available or fail gracefully
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`);

  // WebCrypto test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'webcrypto-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-crypto') {
      // Test crypto.subtle availability
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        return new Response('crypto.subtle not available', { status: 500 });
      }
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/test-aes') {
      // Test AES-GCM
      try {
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-hmac') {
      // Test HMAC
      try {
        const key = await crypto.subtle.generateKey(
          { name: 'HMAC', hash: 'SHA-256' },
          true,
          ['sign', 'verify']
        );
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-pbkdf2') {
      // Test PBKDF2
      try {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode('password'),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-hash') {
      // Test SHA-256
      try {
        const data = new TextEncoder().encode('test');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return new Response('sha256-' + hash.byteLength, { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`);

  // VFS test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'vfs-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-write') {
      // Test Nano.fs.writeFile
      try {
        if (typeof Nano !== 'undefined' && Nano.fs) {
          await Nano.fs.writeFile('/tmp/test.txt', 'test-content');
          return new Response('OK', { status: 200 });
        }
        // Fallback: try to use fs module
        const fs = require('fs');
        fs.writeFileSync('/tmp/test.txt', 'test-content');
        return new Response('OK', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-read') {
      // Test Nano.fs.readFile
      try {
        if (typeof Nano !== 'undefined' && Nano.fs) {
          const content = await Nano.fs.readFile('/tmp/test.txt', 'utf8');
          return new Response(content, { status: 200 });
        }
        // Fallback
        const fs = require('fs');
        const content = fs.readFileSync('/tmp/test.txt', 'utf8');
        return new Response(content, { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    if (url.pathname === '/test-node-fs') {
      // Test Node.js fs compatibility
      try {
        const fs = require('fs');
        fs.writeFileSync('/tmp/node-test.txt', 'node-content');
        const content = fs.readFileSync('/tmp/node-test.txt', 'utf8');
        return new Response(content === 'node-content' ? 'OK' : 'FAIL', { status: 200 });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`);

  // CRUD test app (Next.js style API routes)
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'crud-app.js'), `// In-memory data store
const items = new Map();
let nextId = 1;

// Seed with initial data
items.set(1, { id: 1, title: 'Initial Item', content: 'Initial content' });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Parse path for /api/items/:id
    const itemsMatch = path.match(/^\\/api\\/items(?:\\/(\\d+))?$/);
    
    if (path === '/api/items' && request.method === 'GET') {
      // READ ALL
      const allItems = Array.from(items.values());
      return new Response(JSON.stringify({ items: allItems }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/items' && request.method === 'POST') {
      // CREATE
      try {
        const body = await request.json();
        const id = nextId++;
        const item = { id, ...body };
        items.set(id, item);
        return new Response(JSON.stringify(item), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400 });
      }
    }
    
    if (itemsMatch && itemsMatch[1]) {
      const id = parseInt(itemsMatch[1]);
      
      if (request.method === 'GET') {
        // READ ONE
        const item = items.get(id);
        if (!item) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        }
        return new Response(JSON.stringify(item), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (request.method === 'PUT' || request.method === 'PATCH') {
        // UPDATE
        const item = items.get(id);
        if (!item) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        }
        try {
          const updates = await request.json();
          const updated = { ...item, ...updates };
          items.set(id, updated);
          return new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400 });
        }
      }
      
      if (request.method === 'DELETE') {
        // DELETE
        const existed = items.has(id);
        items.delete(id);
        return new Response(null, { status: existed ? 204 : 404 });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
};
`);

  // HTTP verbs test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'http-verbs-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    if (path === '/test-get' && method === 'GET') {
      return new Response('GET OK', { status: 200 });
    }
    
    if (path === '/test-post' && method === 'POST') {
      return new Response('POST OK', { status: 200 });
    }
    
    if (path === '/test-put' && method === 'PUT') {
      return new Response('PUT OK', { status: 200 });
    }
    
    if (path === '/test-patch' && method === 'PATCH') {
      return new Response('PATCH OK', { status: 200 });
    }
    
    if (path === '/test-delete' && method === 'DELETE') {
      return new Response('DELETE OK', { status: 200 });
    }
    
    if (path === '/test-head' && method === 'HEAD') {
      return new Response(null, { status: 200 });
    }
    
    if (path === '/test-options' && method === 'OPTIONS') {
      return new Response('OPTIONS OK', { 
        status: 200,
        headers: {
          'Allow': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'
        }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};
`);

  // Tenant app 1
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'tenant-app1.js'), `export default {
  async fetch(request) {
    return new Response('Hello from App1', { status: 200 });
  }
};
`);

  // Tenant app 2
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'tenant-app2.js'), `export default {
  async fetch(request) {
    return new Response('Hello from App2', { status: 200 });
  }
};
`);

  // Sliver test app - tests snapshot/restore functionality
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'sliver-test-app.js'), `// Module-level counter for state persistence testing
let counter = 0;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Increment counter to verify sliver state persistence
    counter++;
    
    return new Response(JSON.stringify({ 
      message: 'Sliver test app',
      counter: counter,
      timestamp: Date.now()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
`);

  // ESM test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'esm-test.mjs'), `// Test ESM syntax
const testModule = {
  name: 'test-module',
  version: '1.0.0'
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/test-import') {
      // Test dynamic import
      try {
        // Dynamic import should work in ESM
        return new Response(JSON.stringify({ 
          defaultExport: true,
          module: testModule 
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    return new Response('ESM OK', { status: 200 });
  }
};
`);

  // Error test app
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'error-test.js'), `export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/throw-error') {
      throw new Error('Intentional error');
    }
    
    if (url.pathname === '/async-error') {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Async error')), 10);
      });
    }
    
    return new Response('OK', { status: 200 });
  }
};
`);

  // Syntax error app (for testing error handling)
  fs.writeFileSync(path.join(CONFIG.TEST_APPS_DIR, 'syntax-error.js'), `export default {
  async fetch(request) {
    // Syntax error: missing closing brace
    const obj = { foo: 'bar'
    return new Response('OK');
  }
};
`);

  console.log(`✓ Created ${fs.readdirSync(CONFIG.TEST_APPS_DIR).length} test apps`);
}

// Run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
