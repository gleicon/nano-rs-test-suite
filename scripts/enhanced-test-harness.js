/**
 * Enhanced NANO-RS Test Harness with Proper Validation
 * 
 * Improvements:
 * 1. Proper regex escaping in template literals
 * 2. End-to-end CRUD validation (state persistence)
 * 3. Response body validation, not just status codes
 * 4. Clear error messages on failure
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  TEST_APPS_DIR: path.join(__dirname, '..', 'test-apps'),
  TESTS_DIR: path.join(__dirname, '..', 'tests'),
  REPORTS_DIR: path.join(__dirname, '..', 'reports'),
  BASE_PORT: 8888
};

// Results storage
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Assertion helpers
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
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    if (postData) req.write(postData);
    req.end();
  });
}

// Create config file with proper escaping
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

// Start nano-rs server
function startNanoServer(configPath, port) {
  const proc = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: 'pipe'
  });
  return { process: proc, port };
}

// Wait for server to be ready
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
  throw new Error(`Server did not start within ${timeout}ms`);
}

// Stop nano-rs server
async function stopNano(nano) {
  if (!nano || !nano.process) return;
  nano.process.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 2000));
}

// Run a single test
async function runTest(name, testFn, category = 'general') {
  results.total++;
  const start = Date.now();
  
  try {
    await testFn();
    results.passed++;
    results.tests.push({ name, category, status: 'passed', duration: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, category, status: 'failed', error: error.message, duration: Date.now() - start });
    console.log(`  ✗ ${name} - ${error.message}`);
  }
}

// ========== ENHANCED CRUD TESTS WITH PROPER VALIDATION ==========

async function testCRUDProper() {
  console.log('\n📝 Testing CRUD with End-to-End Validation...');
  
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'crud-app.js') 
  }], CONFIG.BASE_PORT + 1);
  
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 1);
  let createdId = null;
  
  try {
    // Wait for server
    await runTest('CRUD: Server starts', async () => {
      await waitForServer(CONFIG.BASE_PORT + 1);
    }, 'crud');
    
    // CREATE with validation
    await runTest('CRUD: CREATE (POST)', async () => {
      const data = JSON.stringify({ title: 'Test Item', content: 'Test Content' });
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: '/api/items',
        method: 'POST',
        headers: { 
          'Host': 'localhost', 
          'Content-Type': 'application/json', 
          'Content-Length': Buffer.byteLength(data) 
        }
      }, data);
      
      assertEquals(response.status, 201, 'Should return 201 Created');
      
      const body = JSON.parse(response.body);
      assert(body.id, 'Response should have an ID');
      assertEquals(body.title, 'Test Item', 'Title should match');
      assertEquals(body.content, 'Test Content', 'Content should match');
      
      createdId = body.id;
    }, 'crud');
    
    // READ ALL with validation
    await runTest('CRUD: READ ALL (GET)', async () => {
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: '/api/items',
        method: 'GET',
        headers: { 'Host': 'localhost' }
      });
      
      assertEquals(response.status, 200, 'Should return 200 OK');
      
      const body = JSON.parse(response.body);
      assert(Array.isArray(body.items), 'Items should be an array');
      assert(body.items.length > 0, 'Array should not be empty');
      
      const found = body.items.find(i => i.id === createdId);
      assert(found, `Should find item with ID ${createdId}`);
      assertEquals(found.title, 'Test Item', 'Item in list should have correct title');
    }, 'crud');
    
    // READ ONE with validation
    await runTest('CRUD: READ ONE (GET)', async () => {
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: `/api/items/${createdId}`,
        method: 'GET',
        headers: { 'Host': 'localhost' }
      });
      
      assertEquals(response.status, 200, 'Should return 200 OK');
      
      const body = JSON.parse(response.body);
      assertEquals(body.id, createdId, 'ID should match');
      assertEquals(body.title, 'Test Item', 'Title should match');
      assertEquals(body.content, 'Test Content', 'Content should match');
    }, 'crud');
    
    // UPDATE with validation
    await runTest('CRUD: UPDATE (PUT)', async () => {
      const data = JSON.stringify({ title: 'Updated Item' });
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: `/api/items/${createdId}`,
        method: 'PUT',
        headers: { 
          'Host': 'localhost', 
          'Content-Type': 'application/json', 
          'Content-Length': Buffer.byteLength(data) 
        }
      }, data);
      
      assertEquals(response.status, 200, 'Should return 200 OK');
      
      // Verify update persisted
      const verifyRes = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: `/api/items/${createdId}`,
        method: 'GET',
        headers: { 'Host': 'localhost' }
      });
      
      const body = JSON.parse(verifyRes.body);
      assertEquals(body.title, 'Updated Item', 'Title should be updated');
      assertEquals(body.content, 'Test Content', 'Content should be preserved');
    }, 'crud');
    
    // DELETE with validation
    await runTest('CRUD: DELETE (DELETE)', async () => {
      const response = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: `/api/items/${createdId}`,
        method: 'DELETE',
        headers: { 'Host': 'localhost' }
      });
      
      assertEquals(response.status, 204, 'Should return 204 No Content');
      
      // Verify item was deleted
      const verifyRes = await httpRequest({
        hostname: 'localhost',
        port: CONFIG.BASE_PORT + 1,
        path: `/api/items/${createdId}`,
        method: 'GET',
        headers: { 'Host': 'localhost' }
      });
      
      assertEquals(verifyRes.status, 404, 'Should return 404 after delete');
    }, 'crud');
    
  } finally {
    await stopNano(nano);
    try { fs.unlinkSync(configPath); } catch (e) {}
  }
}

// ========== MAIN ==========

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  NANO-RS Enhanced Test Harness                           ║');
  console.log('║  With Proper End-to-End Validation                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // Run CRUD tests with proper validation
  await testCRUDProper();
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Total:  ${results.total.toString().padEnd(46)} ║`);
  console.log(`║  Passed: ${('✓ ' + results.passed).padEnd(46)} ║`);
  console.log(`║  Failed: ${('✗ ' + results.failed).padEnd(46)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
