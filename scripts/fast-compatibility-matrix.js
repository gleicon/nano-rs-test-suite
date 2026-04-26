/**
 * Fast Node.js API Compatibility Matrix for nano-rs
 * 
 * Tests ALL Node.js APIs and categorizes them:
 * - IMPLEMENTED: Fully working
 * - PARTIAL: Some features work  
 * - NOT_IMPLEMENTED: Not available
 * - WONT_IMPLEMENT: Intentionally not supported
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  PORT: 9876,
  REPORTS_DIR: path.join(__dirname, '..', 'reports')
};

// Test all APIs in a single app for efficiency
const TEST_APP = `
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const test = url.searchParams.get('test');
    
    try {
      switch (category + ':' + test) {
        // ========== IMPLEMENTED APIs ==========
        case 'console:log': return new Response(String(console.log('test')), {status: 200});
        case 'console:error': return new Response(String(console.error('test')), {status: 200});
        case 'console:warn': return new Response(String(console.warn('test')), {status: 200});
        
        case 'Buffer:from': return new Response(Buffer.from('test').toString(), {status: 200});
        case 'Buffer:alloc': return new Response(String(Buffer.alloc(10).length), {status: 200});
        
        case 'URL:pathname': return new Response(new URL('http://example.com/path').pathname, {status: 200});
        case 'URL:toString': return new Response(new URL('http://example.com/').toString(), {status: 200});
        
        case 'URLSearchParams:get': return new Response(new URLSearchParams('a=1').get('a'), {status: 200});
        case 'URLSearchParams:has': return new Response(String(new URLSearchParams('a=1').has('a')), {status: 200});
        
        case 'TextEncoder:encode': return new Response(String(new TextEncoder().encode('test') instanceof Uint8Array), {status: 200});
        
        case 'TextDecoder:decode': return new Response(new TextDecoder().decode(new Uint8Array([116,101,115,116])), {status: 200});
        
        case 'fetch:typeof': return new Response(typeof fetch, {status: 200});
        case 'fetch:Request': return new Response(typeof Request, {status: 200});
        case 'fetch:Response': return new Response(typeof Response, {status: 200});
        case 'fetch:Headers': return new Response(typeof Headers, {status: 200});
        
        // ========== PARTIAL APIs ==========
        case 'crypto.subtle:digest': return new Response(typeof crypto.subtle.digest, {status: 200});
        case 'crypto.subtle:generateKey': return new Response(typeof crypto.subtle.generateKey, {status: 200});
        case 'crypto:getRandomValues': return new Response(String(crypto.getRandomValues(new Uint8Array(8)).length), {status: 200});
        
        case 'timers:setTimeout': return new Response(typeof setTimeout, {status: 200});
        case 'timers:clearTimeout': return new Response(typeof clearTimeout, {status: 200});
        case 'timers:setInterval': return new Response(typeof setInterval, {status: 200});
        
        // ========== NOT IMPLEMENTED (test availability) ==========
        // fs module is provided via polyfill - test that it works
        case 'fs:exists': 
          try { 
            const fs = require('fs');
            return new Response(typeof fs.existsSync === 'function' ? 'function' : 'ERROR: existsSync not found', {status: 200}); 
          }
          catch(e) { return new Response('ERROR: ' + e.message, {status: 500}); }
        
        case 'path:join':
          try { return new Response(typeof require('path').join, {status: 200}); }
          catch(e) { return new Response('ERROR: ' + e.message, {status: 500}); }
          
        // ========== WONT IMPLEMENT (test they don't exist) ==========
        case 'http:createServer':
          try { return new Response(String(typeof require('http').createServer), {status: 200}); }
          catch(e) { return new Response('ERROR: ' + e.message, {status: 500}); }
          
        case 'net:createServer':
          try { return new Response(String(typeof require('net').createServer), {status: 200}); }
          catch(e) { return new Response('ERROR: ' + e.message, {status: 500}); }
          
        case 'process:env':
          try { return new Response(typeof process.env, {status: 200}); }
          catch(e) { return new Response('ERROR: ' + e.message, {status: 500}); }
        
        default:
          return new Response('Unknown test: ' + category + ':' + test, {status: 404});
      }
    } catch (e) {
      return new Response('ERROR: ' + e.message, {status: 500});
    }
  }
};
`;

// Test definitions
const TESTS = [
  // IMPLEMENTED
  { category: 'IMPLEMENTED', api: 'console', name: 'log', expect: 'undefined', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'console', name: 'error', expect: 'undefined', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'console', name: 'warn', expect: 'undefined', type: 'implemented' },
  
  { category: 'IMPLEMENTED', api: 'Buffer', name: 'from', expect: 'test', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'Buffer', name: 'alloc', expect: '10', type: 'implemented' },
  
  { category: 'IMPLEMENTED', api: 'URL', name: 'pathname', expect: '/path', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'URL', name: 'toString', expect: 'http://example.com/', type: 'implemented' },
  
  { category: 'IMPLEMENTED', api: 'URLSearchParams', name: 'get', expect: '1', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'URLSearchParams', name: 'has', expect: 'true', type: 'implemented' },
  
  { category: 'IMPLEMENTED', api: 'TextEncoder', name: 'encode', expect: 'true', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'TextDecoder', name: 'decode', expect: 'test', type: 'implemented' },
  
  { category: 'IMPLEMENTED', api: 'fetch', name: 'typeof', expect: 'function', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'fetch', name: 'Request', expect: 'function', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'fetch', name: 'Response', expect: 'function', type: 'implemented' },
  { category: 'IMPLEMENTED', api: 'fetch', name: 'Headers', expect: 'function', type: 'implemented' },
  
  // PARTIAL
  { category: 'PARTIAL', api: 'crypto.subtle', name: 'digest', expect: 'function', type: 'partial' },
  { category: 'PARTIAL', api: 'crypto.subtle', name: 'generateKey', expect: 'function', type: 'partial' },
  { category: 'PARTIAL', api: 'crypto', name: 'getRandomValues', expect: '8', type: 'partial' },
  
  { category: 'PARTIAL', api: 'timers', name: 'setTimeout', expect: 'function', type: 'partial' },
  { category: 'PARTIAL', api: 'timers', name: 'clearTimeout', expect: 'function', type: 'partial' },
  { category: 'PARTIAL', api: 'timers', name: 'setInterval', expect: 'function', type: 'partial' },
  
  // NOT IMPLEMENTED (expect errors or undefined)
  // fs is actually available via polyfill, so it should pass
  { category: 'NOT_IMPLEMENTED', api: 'fs', name: 'exists', expect: 'function', type: 'not_implemented', note: 'Available via fs polyfill' },
  { category: 'NOT_IMPLEMENTED', api: 'path', name: 'join', expect: 'ERROR', type: 'not_implemented', note: 'Not available' },
  
  // WONT IMPLEMENT (expect module not found errors)
  { category: 'WONT_IMPLEMENT', api: 'http', name: 'createServer', expect: 'ERROR', type: 'wont_implement', note: 'Use WinterCG fetch instead' },
  { category: 'WONT_IMPLEMENT', api: 'net', name: 'createServer', expect: 'ERROR', type: 'wont_implement', note: 'Raw sockets not supported' },
  { category: 'WONT_IMPLEMENT', api: 'process', name: 'env', expect: 'ERROR', type: 'wont_implement', note: 'No process global in WinterCG' },
];

// Results storage
const results = {
  timestamp: new Date().toISOString(),
  nanoVersion: null,
  tests: [],
  summary: {
    total: TESTS.length,
    byCategory: {
      IMPLEMENTED: { total: 0, passed: 0 },
      PARTIAL: { total: 0, passed: 0 },
      NOT_IMPLEMENTED: { total: 0, passed: 0 },
      WONT_IMPLEMENT: { total: 0, passed: 0 }
    }
  }
};

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: CONFIG.PORT,
      path,
      method: 'GET',
      headers: { 'Host': 'localhost' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Node.js API Compatibility Matrix for nano-rs              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  // Create test app
  const appPath = '/tmp/compat-test-app.js';
  fs.writeFileSync(appPath, TEST_APP);
  
  const configPath = '/tmp/compat-test-config.json';
  fs.writeFileSync(configPath, JSON.stringify({
    server: { host: '0.0.0.0', port: CONFIG.PORT },
    apps: [{ 
      hostname: 'localhost', 
      entrypoint: appPath,
      limits: { workers: 2, memory_mb: 64, timeout_secs: 30 }
    }]
  }));
  
  // Start nano-rs
  console.log('Starting nano-rs...');
  const nano = spawn(CONFIG.NANO_BINARY, ['run', '--config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Run all tests
  console.log('\nRunning tests...\n');
  
  for (const test of TESTS) {
    const url = `/test?category=${test.api}&test=${test.name}`;
    
    try {
      const res = await request(url);
      
      let passed;
      if (test.expect === 'ERROR') {
        passed = res.status !== 200 || res.body.includes('ERROR');
      } else {
        passed = res.status === 200 && res.body === test.expect;
      }
      
      results.tests.push({
        ...test,
        status: res.status,
        actual: res.body,
        passed
      });
      
      results.summary.byCategory[test.category].total++;
      if (passed) results.summary.byCategory[test.category].passed++;
      
      const icon = passed ? '✅' : '❌';
      const status = passed ? 'PASS' : 'FAIL';
      console.log(`${icon} ${test.category.padEnd(16)} ${test.api.padEnd(16)} ${test.name.padEnd(16)} ${status}`);
      
    } catch (e) {
      results.tests.push({ ...test, error: e.message, passed: false });
      results.summary.byCategory[test.category].total++;
      console.log(`❌ ${test.category.padEnd(16)} ${test.api.padEnd(16)} ${test.name.padEnd(16)} ERROR: ${e.message}`);
    }
  }
  
  // Cleanup
  nano.kill('SIGTERM');
  
  // Generate reports
  await generateReports();
  
  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                               ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  
  for (const [cat, stats] of Object.entries(results.summary.byCategory)) {
    if (stats.total > 0) {
      const pct = Math.round((stats.passed / stats.total) * 100);
      const icon = pct === 100 ? '✅' : pct >= 50 ? '⚠️' : '❌';
      console.log(`║ ${icon} ${cat.padEnd(14)} ${stats.passed}/${stats.total} (${pct}%)${''.padEnd(31 - cat.length)}║`);
    }
  }
  
  const totalPassed = results.tests.filter(t => t.passed).length;
  const totalPct = Math.round((totalPassed / results.tests.length) * 100);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║ Total: ${totalPassed}/${results.tests.length} tests passed (${totalPct}%)${''.padEnd(43)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

async function generateReports() {
  // Markdown report
  let md = `# nano-rs Node.js API Compatibility Matrix

**Generated:** ${results.timestamp}  
**nano-rs Version:** 1.2.4

## Summary

| Category | Passed | Total | Percentage |
|----------|--------|-------|------------|
`;
  
  for (const [cat, stats] of Object.entries(results.summary.byCategory)) {
    if (stats.total > 0) {
      const pct = Math.round((stats.passed / stats.total) * 100);
      md += `| ${cat} | ${stats.passed} | ${stats.total} | ${pct}% |\n`;
    }
  }
  
  const totalPassed = results.tests.filter(t => t.passed).length;
  const totalPct = Math.round((totalPassed / results.tests.length) * 100);
  md += `| **TOTAL** | **${totalPassed}** | **${results.tests.length}** | **${totalPct}%** |\n`;
  
  md += `\n## Detailed Results\n\n`;
  
  // Group by category
  const byCat = {};
  for (const t of results.tests) {
    if (!byCat[t.category]) byCat[t.category] = [];
    byCat[t.category].push(t);
  }
  
  for (const [cat, tests] of Object.entries(byCat)) {
    md += `### ${cat}\n\n`;
    md += `| API | Test | Status | Expected | Actual | Notes |\n`;
    md += `|-----|------|--------|----------|--------|-------|\n`;
    
    for (const t of tests) {
      const status = t.passed ? '✅' : '❌';
      md += `| ${t.api} | ${t.name} | ${status} | ${t.expect} | ${(t.actual || 'ERROR').substring(0, 30)} | ${t.note || ''} |\n`;
    }
    md += '\n';
  }
  
  md += `## Legend

- **IMPLEMENTED**: Fully supported APIs - should all pass
- **PARTIAL**: Partially implemented - some tests may fail
- **NOT_IMPLEMENTED**: Not yet available - expected to fail
- **WONT_IMPLEMENT**: Intentionally excluded - expected to fail

---

*Generated by fast-compatibility-matrix.js*
`;
  
  // Save reports
  if (!fs.existsSync(CONFIG.REPORTS_DIR)) {
    fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
  }
  
  const ts = Date.now();
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `compatibility-matrix-${ts}.md`), md);
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `compatibility-matrix-${ts}.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, 'compatibility-matrix.md'), md);
  
  console.log(`\n📄 Reports saved to:`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, `compatibility-matrix-${ts}.md`)}`);
  console.log(`   - ${path.join(CONFIG.REPORTS_DIR, 'compatibility-matrix.md')}`);
}

runTests().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
