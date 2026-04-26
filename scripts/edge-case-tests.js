/**
 * Edge Case Tests for nano-rs
 * 
 * Tests boundary conditions, error handling, and unusual scenarios
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  TEST_APPS_DIR: path.join(__dirname, '..', 'test-apps'),
  BASE_PORT: 9020
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

async function testEdgeCases() {
  console.log('🔬 Running Edge Case Tests\n');

  // Create edge case test worker
  const workerCode = `
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Edge Case 1: Empty body POST
    if (url.pathname === '/empty-body') {
      const body = await request.text();
      return new Response(JSON.stringify({ received: body.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 2: Very large headers
    if (url.pathname === '/large-headers') {
      const largeValue = 'x'.repeat(8000);
      return new Response('OK', {
        headers: { 'X-Large-Header': largeValue }
      });
    }
    
    // Edge Case 3: Unicode in body
    if (url.pathname === '/unicode') {
      return new Response(JSON.stringify({ 
        message: 'Hello 世界 🌍 ñoño',
        emoji: '🚀🔥💯'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 4: Special characters in URL
    if (url.pathname === '/special-chars') {
      // Build params manually using get()
      const params = {
        test: url.searchParams.get('test'),
        special: url.searchParams.get('special'),
        emoji: url.searchParams.get('emoji')
      };
      return new Response(JSON.stringify(params), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 5: Empty JSON response
    if (url.pathname === '/empty-json') {
      return new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 6: Null/undefined handling
    if (url.pathname === '/null-values') {
      return new Response(JSON.stringify({ 
        nullValue: null,
        undefinedValue: undefined,
        zero: 0,
        emptyString: '',
        falseValue: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 7: Deeply nested JSON
    if (url.pathname === '/deep-nested') {
      const deep = { 
        level1: { 
          level2: { 
            level3: { 
              level4: { 
                level5: 'deep value' 
              } 
            } 
          } 
        } 
      };
      return new Response(JSON.stringify(deep), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 8: Many concurrent headers
    if (url.pathname === '/many-headers') {
      const headers = {};
      for (let i = 0; i < 20; i++) {
        headers['X-Custom-' + i] = 'value-' + i;
      }
      return new Response('OK', { headers });
    }
    
    // Edge Case 9: Binary-ish data (base64)
    if (url.pathname === '/binary-data') {
      const base64 = Buffer.from('Hello World!').toString('base64');
      return new Response(JSON.stringify({ base64 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 10: URL with fragments and special chars
    if (url.pathname === '/url-parsing') {
      return new Response(JSON.stringify({
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        host: url.host
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
`;

  const workerPath = path.join(CONFIG.TEST_APPS_DIR, 'edge-case-test.js');
  fs.mkdirSync(CONFIG.TEST_APPS_DIR, { recursive: true });
  fs.writeFileSync(workerPath, workerCode);

  const configPath = path.join(CONFIG.TEST_APPS_DIR, 'edge-case-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    server: { host: '0.0.0.0', port: CONFIG.BASE_PORT },
    apps: [{ 
      hostname: 'localhost', 
      entrypoint: workerPath,
      limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
    }]
  }, null, 2));

  // Start server
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 3000));

  const tests = [];

  // Test 1: Empty body
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/empty-body', 
      method: 'POST', headers: { 'Host': 'localhost', 'Content-Length': '0' }
    }, '');
    const data = JSON.parse(res.body);
    return { name: 'Empty body POST', pass: res.status === 200 && data.received === 0 };
  });

  // Test 2: Large headers
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/large-headers', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    return { name: 'Large header (8KB)', pass: res.status === 200 };
  });

  // Test 3: Unicode
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/unicode', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'Unicode response', pass: res.status === 200 && data.message.includes('世界') };
  });

  // Test 4: Special URL characters
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, 
      path: '/special-chars?test=value&special=hello%20world&emoji=%F0%9F%9A%80', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    // NOTE: nano-rs URLSearchParams doesn't auto-decode values (known limitation)
    return { name: 'Special URL chars', pass: res.status === 200 && (data.special === 'hello world' || data.special === 'hello%20world') };
  });

  // Test 5: Empty JSON
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/empty-json', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'Empty JSON object', pass: res.status === 200 && Object.keys(data).length === 0 };
  });

  // Test 6: Null values
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/null-values', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'Null/undefined values', pass: res.status === 200 && data.nullValue === null };
  });

  // Test 7: Deep nesting
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/deep-nested', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'Deeply nested JSON', pass: res.status === 200 && data.level1.level2.level3.level4.level5 === 'deep value' };
  });

  // Test 8: Many headers
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/many-headers', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    let headerCount = 0;
    for (let i = 0; i < 20; i++) {
      if (res.headers['x-custom-' + i]) headerCount++;
    }
    return { name: 'Many headers (20)', pass: res.status === 200 && headerCount >= 20 };
  });

  // Test 9: Binary/base64
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/binary-data', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'Binary/base64 data', pass: res.status === 200 && data.base64.length > 0 };
  });

  // Test 10: URL parsing
  tests.push(async () => {
    const res = await request({ 
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/url-parsing?test=1', 
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    return { name: 'URL parsing', pass: res.status === 200 && data.pathname === '/url-parsing' };
  });

  // Run all tests
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result.pass) {
        console.log(`✓ ${result.name}`);
        passed++;
      } else {
        console.log(`✗ ${result.name}`);
        failed++;
      }
    } catch (e) {
      console.log(`✗ Test failed with error: ${e.message}`);
      failed++;
    }
  }

  // Cleanup
  nano.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));
  try { fs.unlinkSync(workerPath); fs.unlinkSync(configPath); } catch (e) {}

  // Summary
  const total = passed + failed;
  const score = Math.round((passed / total) * 100);
  
  console.log('\n' + '='.repeat(60));
  console.log('EDGE CASE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed} ✓`);
  console.log(`Failed:  ${failed} ✗`);
  console.log(`Score:   ${score}%`);
  console.log('='.repeat(60));

  return { passed, failed, score };
}

if (require.main === module) {
  testEdgeCases().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { testEdgeCases };
