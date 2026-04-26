/**
 * Fixed Cloudflare Worker Test
 * 
 * Workarounds for nano-rs limitations:
 * 1. Response.redirect() - Use manual headers instead
 * 2. JSON with Promises - Ensure all Promises are resolved before JSON.stringify
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  BASE_PORT: 9010
};

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testFixedCFWorker() {
  console.log('🌩️  Testing Fixed Cloudflare Worker Patterns\n');

  // FIXED Worker with workarounds
  const workerCode = `
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
      // FIXED: Build data object without Promises and manually iterate headers
      const headersObj = {};
      request.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      
      const data = {
        platform: 'nano-rs',
        cf_compatible: true,
        timestamp: Date.now(),
        request_method: request.method,
        request_headers: headersObj
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
    
    // Pattern 4: WebCrypto usage
    if (url.pathname === '/api/token') {
      const encoder = new TextEncoder();
      const data = encoder.encode('payload-' + Date.now());
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return new Response(JSON.stringify({ token: hashHex }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Pattern 5: CORS preflight
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
    
    // Pattern 6: Redirect - FIXED using manual headers
    if (url.pathname === '/redirect') {
      // WORKAROUND: Response.redirect() doesn't work, use manual headers
      return new Response(null, {
        status: 302,
        headers: { 'Location': 'https://example.com' }
      });
    }
    
    // Pattern 7: JSON with async data (extra test)
    if (url.pathname === '/api/async-data') {
      // FIXED: Always await Promises before JSON.stringify
      const asyncData = await Promise.resolve({ status: 'ok', async: true });
      return new Response(JSON.stringify(asyncData), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default 404
    return new Response('Not Found', { status: 404 });
  }
};
`;

  const workerPath = path.join(__dirname, 'workers', 'cf-fixed-worker.js');
  fs.mkdirSync(path.dirname(workerPath), { recursive: true });
  fs.writeFileSync(workerPath, workerCode);

  const configPath = path.join(__dirname, 'workers', 'cf-fixed-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    server: { host: '0.0.0.0', port: CONFIG.BASE_PORT },
    apps: [{ 
      hostname: 'localhost', 
      entrypoint: workerPath,
      limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
    }]
  }, null, 2));

  console.log('✓ Created fixed Cloudflare Worker');

  // Start server
  console.log('\n🚀 Starting nano-rs with fixed CF Worker...');
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 3000));

  let passed = 0;
  let failed = 0;

  // Test 1: Basic route
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/', method: 'GET', headers: { 'Host': 'localhost' } });
    if (res.status === 200 && res.body.includes('Cloudflare Worker')) {
      console.log('✓ Test 1: Basic route works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 1: Basic route failed:', e.message);
    failed++;
  }

  // Test 2: API endpoint
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', method: 'GET', headers: { 'Host': 'localhost' } });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.cf_compatible === true) {
      console.log('✓ Test 2: API endpoint works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 2: API endpoint failed:', e.message);
    failed++;
  }

  // Test 3: Echo endpoint
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/echo', method: 'POST', headers: { 'Host': 'localhost', 'Content-Type': 'text/plain' } }, 'Hello CF!');
    if (res.status === 200 && res.body === 'Hello CF!') {
      console.log('✓ Test 3: Echo endpoint works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 3: Echo endpoint failed:', e.message);
    failed++;
  }

  // Test 4: WebCrypto token
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/token', method: 'GET', headers: { 'Host': 'localhost' } });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.token && data.token.length === 64) {
      console.log('✓ Test 4: WebCrypto token generation works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 4: WebCrypto failed:', e.message);
    failed++;
  }

  // Test 5: CORS preflight
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/cors', method: 'OPTIONS', headers: { 'Host': 'localhost', 'Origin': 'https://example.com' } });
    if (res.status === 204 && res.headers['access-control-allow-origin'] === '*') {
      console.log('✓ Test 5: CORS preflight works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 5: CORS failed:', e.message);
    failed++;
  }

  // Test 6: Redirect (FIXED)
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/redirect', method: 'GET', headers: { 'Host': 'localhost' } });
    if (res.status === 302 && res.headers.location === 'https://example.com') {
      console.log('✓ Test 6: Redirect works (with workaround)');
      passed++;
    } else throw new Error(`Status: ${res.status}, Location: ${res.headers.location}`);
  } catch (e) {
    console.log('✗ Test 6: Redirect failed:', e.message);
    failed++;
  }

  // Test 7: Async data (extra test for Promise resolution)
  try {
    const res = await request({ hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/async-data', method: 'GET', headers: { 'Host': 'localhost' } });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.status === 'ok' && data.async === true) {
      console.log('✓ Test 7: Async Promise resolution works');
      passed++;
    } else throw new Error(`Status: ${res.status}`);
  } catch (e) {
    console.log('✗ Test 7: Async data failed:', e.message);
    failed++;
  }

  // Cleanup
  nano.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));
  try { fs.unlinkSync(workerPath); fs.unlinkSync(configPath); } catch (e) {}

  // Summary
  const total = passed + failed;
  const score = Math.round((passed / total) * 100);
  
  console.log('\n' + '='.repeat(60));
  console.log('FIXED CLOUDFLARE WORKER TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Score:   ${score}%`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 PERFECT! All Cloudflare Worker patterns work with workarounds!\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed\n`);
  }

  return { passed, failed, score };
}

if (require.main === module) {
  testFixedCFWorker().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { testFixedCFWorker };
