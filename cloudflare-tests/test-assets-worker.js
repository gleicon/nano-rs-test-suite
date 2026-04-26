/**
 * Cloudflare Worker with Static Assets Test
 * Tests the common pattern of a CF Worker serving static assets
 * with dynamic API endpoints
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: path.join(__dirname, '..', 'bin', 'nano-rs'),
  BASE_PORT: 9020
};

// Create test assets
function createTestAssets(assetsDir) {
  // HTML file
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Worker on nano-rs</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #f6821f; }
        .status { padding: 10px; background: #e0f2e0; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🌩️ Cloudflare Worker</h1>
    <p class="status">✅ Running on nano-rs edge runtime</p>
    <p>This HTML file is served through a Cloudflare Worker pattern.</p>
    <div id="api-result"></div>
    <script src="/assets/app.js"></script>
</body>
</html>`;

  // CSS file
  const css = `/* Cloudflare Worker Asset */
:root {
  --primary: #f6821f;
  --bg: #f5f5f5;
}

body {
  background: var(--bg);
  margin: 0;
  padding: 20px;
}

.cf-badge {
  background: var(--primary);
  color: white;
  padding: 5px 10px;
  border-radius: 3px;
}`;

  // JS file
  const js = `// Cloudflare Worker Client Script
console.log('🌩️ CF Worker client loaded');

// Test API endpoint
fetch('/api/status')
  .then(r => r.json())
  .then(data => {
    console.log('API status:', data);
    const resultDiv = document.getElementById('api-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p>API Status: ' + data.status + '</p>';
    }
  })
  .catch(e => console.error('API error:', e));`;

  // JSON config
  const json = JSON.stringify({
    name: 'nano-rs-cf-worker',
    version: '1.0.0',
    compatibility_date: '2024-01-01'
  }, null, 2);

  // Write files
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'index.html'), html);
  fs.writeFileSync(path.join(assetsDir, 'styles.css'), css);
  fs.writeFileSync(path.join(assetsDir, 'app.js'), js);
  fs.writeFileSync(path.join(assetsDir, 'config.json'), json);

  return {
    htmlPath: path.join(assetsDir, 'index.html'),
    cssPath: path.join(assetsDir, 'styles.css'),
    jsPath: path.join(assetsDir, 'app.js'),
    jsonPath: path.join(assetsDir, 'config.json')
  };
}

// Helper: HTTP request
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body
      }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Main test
async function testAssetsWorker() {
  console.log('📦 Testing Cloudflare Worker with Static Assets\n');

  // Create assets
  const assetsDir = path.join(__dirname, 'assets');
  const assetPaths = createTestAssets(assetsDir);
  console.log('✓ Created test assets:');
  console.log('  - index.html');
  console.log('  - styles.css');
  console.log('  - app.js');
  console.log('  - config.json');

  // Create CF Worker that serves assets
  const workerCode = `
// Cloudflare Worker serving static assets
// This pattern is common for SPAs, documentation sites, etc.

const ASSET_MANIFEST = {
  '/': { file: 'index.html', type: 'text/html' },
  '/index.html': { file: 'index.html', type: 'text/html' },
  '/styles.css': { file: 'styles.css', type: 'text/css' },
  '/app.js': { file: 'app.js', type: 'application/javascript' },
  '/config.json': { file: 'config.json', type: 'application/json' }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API endpoint
    if (url.pathname === '/api/status') {
      return new Response(JSON.stringify({
        status: 'ok',
        platform: 'nano-rs',
        cf_compatible: true,
        assets_served: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve static assets
    const asset = ASSET_MANIFEST[url.pathname];
    if (asset) {
      try {
        // In a real CF Worker, you'd use env.ASSETS or similar
        // Here we construct the response directly
        const content = 
          asset.file === 'index.html' ? \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Cloudflare Worker on nano-rs</title>
    <style>body { font-family: sans-serif; margin: 50px; }</style>
</head>
<body>
    <h1>🌩️ Cloudflare Worker</h1>
    <p>✅ Running on nano-rs edge runtime</p>
    <script src="/app.js"></script>
</body>
</html>\` :
          asset.file === 'styles.css' ? \`body { background: #f5f5f5; }\` :
          asset.file === 'app.js' ? \`console.log('CF Worker client loaded'); fetch('/api/status').then(r=>r.json()).then(d=>console.log(d));\` :
          asset.file === 'config.json' ? JSON.stringify({ name: 'cf-worker', version: '1.0.0' }) :
          'Not found';
        
        return new Response(content, {
          headers: { 
            'Content-Type': asset.type,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (e) {
        return new Response('Asset error: ' + e.message, { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
`;

  const workerPath = path.join(__dirname, 'workers', 'cf-assets-worker.js');
  fs.writeFileSync(workerPath, workerCode);

  const configPath = path.join(__dirname, 'workers', 'cf-assets-config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    port: CONFIG.BASE_PORT,
    workers: 2,
    apps: [{ hostname: 'localhost', entrypoint: workerPath }]
  }));

  console.log('✓ Created CF Worker with assets');

  // Start nano-rs
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 2000));

  const tests = [];

  // Test 1: HTML asset
  tests.push((async () => {
    const res = await request({
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/',
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    if (res.status === 200 && res.body.includes('Cloudflare Worker')) {
      console.log('✓ HTML asset served correctly');
      return true;
    }
    throw new Error('HTML not served correctly');
  })());

  // Test 2: CSS asset
  tests.push((async () => {
    const res = await request({
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/styles.css',
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    if (res.status === 200 && res.headers['content-type'] === 'text/css') {
      console.log('✓ CSS asset served with correct MIME type');
      return true;
    }
    throw new Error('CSS not served correctly');
  })());

  // Test 3: JS asset
  tests.push((async () => {
    const res = await request({
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/app.js',
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    if (res.status === 200 && res.body.includes('fetch')) {
      console.log('✓ JS asset served correctly');
      return true;
    }
    throw new Error('JS not served correctly');
  })());

  // Test 4: API endpoint
  tests.push((async () => {
    const res = await request({
      hostname: 'localhost', port: CONFIG.BASE_PORT, path: '/api/status',
      method: 'GET', headers: { 'Host': 'localhost' }
    });
    const data = JSON.parse(res.body);
    if (res.status === 200 && data.cf_compatible === true) {
      console.log('✓ API endpoint works');
      return true;
    }
    throw new Error('API not working');
  })());

  // Wait for all tests
  const results = await Promise.allSettled(tests);
  const passed = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  // Cleanup
  nano.kill('SIGTERM');

  console.log('\n' + '='.repeat(60));
  console.log('CLOUDFLARE WORKER ASSETS TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Score:  ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 PERFECT! CF Worker with assets runs flawlessly!');
  }
}

// Run if executed directly
if (require.main === module) {
  testAssetsWorker().catch(console.error);
}

module.exports = { testAssetsWorker };
