/**
 * Performance & Stress Tests for nano-rs
 * 
 * Tests load handling, concurrent requests, and memory stability
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  TEST_APPS_DIR: path.join(__dirname, '..', 'test-apps'),
  BASE_PORT: 9030
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

async function makeConcurrentRequests(count, delay = 0) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const res = await request({
              hostname: 'localhost',
              port: CONFIG.BASE_PORT,
              path: '/api/data',
              method: 'GET',
              headers: { 'Host': 'localhost' }
            });
            resolve({ success: res.status === 200, latency: Date.now() });
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        }, i * delay);
      })
    );
  }
  return Promise.all(promises);
}

async function testPerformance() {
  console.log('⚡ Running Performance & Stress Tests\n');

  // Create performance test worker
  const workerCode = `
let requestCount = 0;

export default {
  async fetch(request) {
    requestCount++;
    const url = new URL(request.url);
    
    // Simple data endpoint
    if (url.pathname === '/api/data') {
      return new Response(JSON.stringify({ 
        count: requestCount,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Slow endpoint (simulates processing)
    if (url.pathname === '/slow') {
      const delay = parseInt(url.searchParams.get('delay') || '100');
      await new Promise(r => setTimeout(r, delay));
      return new Response(JSON.stringify({ delayed: delay }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Memory test endpoint
    if (url.pathname === '/memory') {
      const size = parseInt(url.searchParams.get('size') || '1000');
      const data = 'x'.repeat(size);
      return new Response(JSON.stringify({ size: data.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Large response
    if (url.pathname === '/large-response') {
      const size = parseInt(url.searchParams.get('size') || '10000');
      const data = { payload: 'x'.repeat(size) };
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
`;

  const workerPath = path.join(CONFIG.TEST_APPS_DIR, 'perf-test.js');
  fs.mkdirSync(CONFIG.TEST_APPS_DIR, { recursive: true });
  fs.writeFileSync(workerPath, workerCode);

  const configPath = path.join(CONFIG.TEST_APPS_DIR, 'perf-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    server: { host: '0.0.0.0', port: CONFIG.BASE_PORT },
    apps: [{ 
      hostname: 'localhost', 
      entrypoint: workerPath,
      limits: { workers: 4, memory_mb: 128, timeout_secs: 30 }
    }]
  }, null, 2));

  // Start server
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 3000));

  let passed = 0;
  let failed = 0;
  const results = {};

  // Test 1: Basic latency
  try {
    const start = Date.now();
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const latency = Date.now() - start;
    
    if (res.status === 200 && latency < 100) {
      console.log(`✓ Basic latency: ${latency}ms`);
      passed++;
      results.basicLatency = latency;
    } else {
      console.log(`✗ Basic latency too high: ${latency}ms`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Basic latency test failed: ${e.message}`);
    failed++;
  }

  // Test 2: Sequential requests (100)
  try {
    const start = Date.now();
    let successCount = 0;
    for (let i = 0; i < 100; i++) {
      const res = await request({ 
        hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
        method: 'GET', headers: { 'Host': 'localhost' }
      });
      if (res.status === 200) successCount++;
    }
    const totalTime = Date.now() - start;
    const rps = Math.round(100 / (totalTime / 1000));
    
    if (successCount === 100) {
      console.log(`✓ 100 sequential requests: ${totalTime}ms (${rps} req/s)`);
      passed++;
      results.sequentialRPS = rps;
    } else {
      console.log(`✗ Sequential requests failed: ${successCount}/100`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Sequential requests test failed: ${e.message}`);
    failed++;
  }

  // Test 3: Concurrent requests (20 parallel)
  try {
    const start = Date.now();
    const responses = await makeConcurrentRequests(20);
    const successCount = responses.filter(r => r.success).length;
    const totalTime = Date.now() - start;
    
    if (successCount >= 19) { // Allow 1 failure
      console.log(`✓ 20 concurrent requests: ${successCount}/20 success in ${totalTime}ms`);
      passed++;
      results.concurrentSuccess = successCount;
    } else {
      console.log(`✗ Concurrent requests failed: ${successCount}/20`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Concurrent requests test failed: ${e.message}`);
    failed++;
  }

  // Test 4: Bursty traffic (50 requests with 10ms spacing)
  try {
    const start = Date.now();
    const responses = await makeConcurrentRequests(50, 10);
    const successCount = responses.filter(r => r.success).length;
    const totalTime = Date.now() - start;
    
    if (successCount >= 48) { // Allow 2 failures
      console.log(`✓ Bursty traffic (50@10ms): ${successCount}/50 success in ${totalTime}ms`);
      passed++;
      results.burstSuccess = successCount;
    } else {
      console.log(`✗ Bursty traffic failed: ${successCount}/50`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Bursty traffic test failed: ${e.message}`);
    failed++;
  }

  // Test 5: Slow endpoint (300ms delay)
  try {
    const start = Date.now();
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/slow?delay=300', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const latency = Date.now() - start;
    
    if (res.status === 200 && latency >= 250 && latency <= 500) {
      console.log(`✓ Slow endpoint (300ms delay): ${latency}ms`);
      passed++;
      results.slowEndpoint = latency;
    } else {
      console.log(`✗ Slow endpoint timing off: ${latency}ms`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Slow endpoint test failed: ${e.message}`);
    failed++;
  }

  // Test 6: Memory test (1MB payload)
  try {
    const start = Date.now();
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/memory?size=1000000', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const latency = Date.now() - start;
    const data = JSON.parse(res.body);
    
    if (res.status === 200 && data.size === 1000000) {
      console.log(`✓ Memory test (1MB): ${latency}ms`);
      passed++;
      results.memory1MB = latency;
    } else {
      console.log(`✗ Memory test failed: ${data.size} bytes`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Memory test failed: ${e.message}`);
    failed++;
  }

  // Test 7: Large response (10KB)
  try {
    const start = Date.now();
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/large-response?size=10000', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const latency = Date.now() - start;
    
    if (res.status === 200 && res.body.length > 10000) {
      console.log(`✓ Large response (10KB): ${latency}ms, ${res.body.length} bytes`);
      passed++;
      results.largeResponse = latency;
    } else {
      console.log(`✗ Large response failed: ${res.body.length} bytes`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Large response test failed: ${e.message}`);
    failed++;
  }

  // Test 8: Connection stability (100 requests, check for crashes)
  try {
    let successCount = 0;
    for (let i = 0; i < 100; i++) {
      try {
        const res = await request({ 
          hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
          method: 'GET', headers: { 'Host': 'localhost' }
        });
        if (res.status === 200) successCount++;
      } catch (e) {
        // Continue
      }
    }
    
    if (successCount >= 95) {
      console.log(`✓ Connection stability: ${successCount}/100`);
      passed++;
      results.stability = successCount;
    } else {
      console.log(`✗ Connection stability poor: ${successCount}/100`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Connection stability test failed: ${e.message}`);
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
  console.log('PERFORMANCE & STRESS TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Score:   ${score}%`);
  console.log('='.repeat(60));
  
  if (results.basicLatency) console.log(`Latency: ${results.basicLatency}ms`);
  if (results.sequentialRPS) console.log(`Throughput: ${results.sequentialRPS} req/s`);
  if (results.concurrentSuccess) console.log(`Concurrency: ${results.concurrentSuccess}/20 successful`);
  console.log('='.repeat(60));

  return { passed, failed, score, results };
}

if (require.main === module) {
  testPerformance().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { testPerformance };
