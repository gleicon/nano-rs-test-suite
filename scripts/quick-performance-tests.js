/**
 * Simplified Performance Tests for nano-rs
 * 
 * Quick performance validation without long-running tests
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

async function testPerformance() {
  console.log('⚡ Running Quick Performance Tests\n');

  const workerCode = `
let requestCount = 0;

export default {
  async fetch(request) {
    requestCount++;
    const url = new URL(request.url);
    
    if (url.pathname === '/api/data') {
      return new Response(JSON.stringify({ 
        count: requestCount,
        timestamp: Date.now()
      }), {
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
      limits: { workers: 4, memory_mb: 64, timeout_secs: 10 }
    }]
  }, null, 2));

  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 3000));

  let passed = 0;
  let failed = 0;
  const results = {};

  // Test 1: Basic latency
  try {
    const latencies = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const res = await request({ 
        hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
        method: 'GET', headers: { 'Host': 'localhost' }
      });
      latencies.push(Date.now() - start);
    }
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    
    if (avgLatency < 50) {
      console.log(`✓ Average latency (10 req): ${avgLatency}ms`);
      passed++;
      results.avgLatency = avgLatency;
    } else {
      console.log(`✗ Latency too high: ${avgLatency}ms`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Latency test failed: ${e.message}`);
    failed++;
  }

  // Test 2: Sequential throughput (50 requests)
  try {
    const start = Date.now();
    let successCount = 0;
    for (let i = 0; i < 50; i++) {
      const res = await request({ 
        hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
        method: 'GET', headers: { 'Host': 'localhost' }
      });
      if (res.status === 200) successCount++;
    }
    const totalTime = Date.now() - start;
    const rps = Math.round(50 / (totalTime / 1000));
    
    if (successCount >= 48) {
      console.log(`✓ Throughput (50 req): ${rps} req/s (${totalTime}ms total)`);
      passed++;
      results.throughput = rps;
    } else {
      console.log(`✗ Throughput test failed: ${successCount}/50`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Throughput test failed: ${e.message}`);
    failed++;
  }

  // Test 3: Basic concurrency (10 parallel)
  try {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(request({ 
        hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/data', 
        method: 'GET', headers: { 'Host': 'localhost' }
      }));
    }
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.status === 200).length;
    
    if (successCount === 10) {
      console.log(`✓ Concurrent requests (10 parallel): ${successCount}/10`);
      passed++;
      results.concurrent = successCount;
    } else {
      console.log(`✗ Concurrency test failed: ${successCount}/10`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Concurrency test failed: ${e.message}`);
    failed++;
  }

  // Test 4: Stability (rapid requests)
  try {
    let successCount = 0;
    for (let i = 0; i < 30; i++) {
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
    
    if (successCount >= 28) {
      console.log(`✓ Stability test (30 rapid): ${successCount}/30`);
      passed++;
      results.stability = successCount;
    } else {
      console.log(`✗ Stability test failed: ${successCount}/30`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Stability test failed: ${e.message}`);
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
  console.log('PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Score:   ${score}%`);
  console.log('='.repeat(60));
  
  if (results.avgLatency) console.log(`Avg Latency: ${results.avgLatency}ms`);
  if (results.throughput) console.log(`Throughput: ${results.throughput} req/s`);
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
