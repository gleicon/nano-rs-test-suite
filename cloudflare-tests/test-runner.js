/**
 * Real-World Cloudflare Worker Test - FIXED VERSION
 * This mimics a production CF Worker with common patterns
 * Uses current nano-rs config format
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: path.join(__dirname, '..', 'bin', 'nano-rs'),
  BASE_PORT: 9010
};

// Helper: Make HTTP request
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testCloudflareWorker() {
  console.log('🌩️  Testing Real-World Cloudflare Worker Patterns\n');

  // Create a comprehensive CF Worker
  const workerCode = `
// Production Cloudflare Worker Pattern
// This should run on nano-rs with minimal changes

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Pattern 1: Basic routing
    if (url.pathname === '/') {
      return new Response('Cloudflare Worker running on nano-rs!', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Pattern 2: API endpoint with JSON
    if (url.pathname === '/api/data') {
      const data = {
        platform: 'nano-rs',
        cf_compatible: true,
        timestamp: Date.now(),
        request_method: request.method,
        request_headers: Object.fromEntries(request.headers)
      };
      
      return new Response(JSON.stringify(data, null, 2), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // Pattern 3: Echo endpoint with body parsing
    if (url.pathname === '/api/echo') {
      const body = await request.text();
      return new Response(body, {
        headers: { 'Content-Type': request.headers.get('Content-Type') || 'text/plain' }
      });
    }
    
    // Pattern 4: WebCrypto usage (JWT-like pattern)
    if (url.pathname === '/api/token') {
      const encoder = new TextEncoder();
      const data = encoder.encode('payload-' + Date.now());
      
      // Use WebCrypto for hashing (common CF pattern)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return new Response(JSON.stringify({ token: hashHex }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Pattern 5: CORS preflight (common API pattern)
    if (url.pathname === '/api/cors') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }
      
      return new Response(JSON.stringify({ message: 'CORS enabled' }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Pattern 6: Redirect (common edge pattern)
    if (url.pathname === '/redirect') {
      return Response.redirect('https://example.com', 302);
    }
    
    // Default 404
    return new Response('Not Found', { status: 404 });
  }
};
`;

  const workerPath = path.join(__dirname, 'workers', 'cf-production-worker.js');
  fs.mkdirSync(path.dirname(workerPath), { recursive: true });
  fs.writeFileSync(workerPath, workerCode);

  // FIXED: Create config with proper nano-rs 1.2.4 format
  const configPath = path.join(__dirname, 'workers', 'cf-worker-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    server: { 
      host: '0.0.0.0', 
      port: CONFIG.BASE_PORT 
    },
    apps: [{ 
      hostname: 'localhost', 
      entrypoint: workerPath,
      limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
    }]
  }, null, 2));

  console.log('✓ Created Cloudflare Worker test file');
  console.log('  Worker:', workerPath);
  console.log('  Config:', configPath);

  // Start nano-rs
  console.log('\n🚀 Starting nano-rs with CF Worker...');
  console.log('  Binary:', CONFIG.NANO_BINARY);
  console.log('  Config:', configPath);
  
  let nanoOutput = '';
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Capture output for debugging
  nano.stdout.on('data', (data) => {
    nanoOutput += data.toString();
    // Uncomment to see server output: console.log('[nano-rs]', data.toString().trim());
  });
  
  nano.stderr.on('data', (data) => {
    nanoOutput += data.toString();
    // Uncomment to see errors: console.log('[nano-rs error]', data.toString().trim());
  });

  // Wait for server to start
  console.log('  Waiting for server to start (3s)...');
  await new Promise(r => setTimeout(r, 3000));

  let passed = 0;
  let failed = 0;
  let errors = [];

  // Test 1: Basic route
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/',
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    if (res.status === 200 && res.body.includes('Cloudflare Worker')) {
      console.log('✓ Test 1: Basic route works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Body: ${res.body.substring(0, 100)}`);
    }
  } catch (e) {
    console.log('✗ Test 1: Basic route failed:', e.message);
    errors.push({ test: 1, error: e.message });
    failed++;
  }

  // Test 2: API endpoint with JSON
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/api/data',
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.cf_compatible === true) {
      console.log('✓ Test 2: API endpoint with JSON works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, cf_compatible: ${data.cf_compatible}`);
    }
  } catch (e) {
    console.log('✗ Test 2: API endpoint failed:', e.message);
    errors.push({ test: 2, error: e.message });
    failed++;
  }

  // Test 3: Echo endpoint with body
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/api/echo',
      method: 'POST',
      headers: { 
        'Host': 'localhost',
        'Content-Type': 'text/plain'
      }
    }, 'Hello from Cloudflare!');
    if (res.status === 200 && res.body === 'Hello from Cloudflare!') {
      console.log('✓ Test 3: Echo endpoint works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Expected: "Hello from Cloudflare!", Got: "${res.body}"`);
    }
  } catch (e) {
    console.log('✗ Test 3: Echo endpoint failed:', e.message);
    errors.push({ test: 3, error: e.message });
    failed++;
  }

  // Test 4: WebCrypto token generation
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/api/token',
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.token && data.token.length === 64) {
      console.log('✓ Test 4: WebCrypto token generation works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, token: ${data.token ? data.token.substring(0, 20) : 'undefined'}`);
    }
  } catch (e) {
    console.log('✗ Test 4: WebCrypto failed:', e.message);
    errors.push({ test: 4, error: e.message });
    failed++;
  }

  // Test 5: CORS preflight
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/api/cors',
      method: 'OPTIONS',
      headers: { 
        'Host': 'localhost',
        'Origin': 'https://example.com'
      }
    });
    if (res.status === 204 && res.headers['access-control-allow-origin'] === '*') {
      console.log('✓ Test 5: CORS preflight works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, CORS: ${res.headers['access-control-allow-origin']}`);
    }
  } catch (e) {
    console.log('✗ Test 5: CORS failed:', e.message);
    errors.push({ test: 5, error: e.message });
    failed++;
  }

  // Test 6: Redirect
  try {
    const res = await request({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT,
      path: '/redirect',
      method: 'GET',
      headers: { 'Host': 'localhost' }
    });
    if (res.status === 302 && res.headers.location === 'https://example.com') {
      console.log('✓ Test 6: Redirect works');
      passed++;
    } else {
      throw new Error(`Status: ${res.status}, Location: ${res.headers.location}`);
    }
  } catch (e) {
    console.log('✗ Test 6: Redirect failed:', e.message);
    errors.push({ test: 6, error: e.message });
    failed++;
  }

  // Show error details if any failures
  if (failed > 0 && nanoOutput.includes('ERROR')) {
    console.log('\n⚠️  Server errors detected:');
    const errorLines = nanoOutput.split('\n').filter(line => 
      line.includes('ERROR') || line.includes('error') || line.includes('compilation')
    );
    errorLines.slice(-5).forEach(line => console.log('   ' + line.substring(0, 150)));
  }

  // Cleanup
  nano.kill('SIGTERM');
  
  // Cleanup test files
  await new Promise(r => setTimeout(r, 500));
  try {
    fs.unlinkSync(workerPath);
    fs.unlinkSync(configPath);
  } catch (e) {}

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('CLOUDFLARE WORKER COMPATIBILITY TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${passed + failed}`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Score:   ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n🎉 PERFECT! All Cloudflare Worker patterns work!');
    console.log('nano-rs is 100% compatible with standard CF Worker patterns.\n');
    return { passed, failed, score: 100, errors: [] };
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. See details above.\n`);
    return { passed, failed, score: Math.round((passed / (passed + failed)) * 100), errors };
  }
}

// Run if executed directly
if (require.main === module) {
  testCloudflareWorker().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { testCloudflareWorker };
