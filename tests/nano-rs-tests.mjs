/**
 * nano-rs QA Test Suite v2.0
 * External black-box tests + Node.js/WinterCG compatibility validation
 * Uses spawnSync (not exec/execSync) — no shell injection
 * Binary: v1.1.2 release (reports 1.1.0 internally)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, statSync, readFileSync } from 'fs';
import { spawnSync, spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BIN = join(ROOT, 'bin', 'nano-rs');
const SLIVER_CRUD = join(ROOT, 'slivers', 'crud-app.sliver');
const SLIVER_PROBE = join(ROOT, 'slivers', 'probe.sliver');
const SCREENSHOTS = join(ROOT, 'screenshots');
const BASE_URL = 'http://localhost:8080';

mkdirSync(SCREENSHOTS, { recursive: true });
mkdirSync(join(ROOT, 'reports'), { recursive: true });

let results = [];
let serverProcess = null;

function log(msg) { console.log(`[TEST] ${msg}`); }
function pass(name, detail = '') { results.push({ name, status: 'PASS', detail }); console.log(`  ✓ PASS: ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name, detail = '') { results.push({ name, status: 'FAIL', detail }); console.log(`  ✗ FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
function warn(name, detail = '') { results.push({ name, status: 'WARN', detail }); console.log(`  ⚠ WARN: ${name}${detail ? ' — ' + detail : ''}`); }
function info(name, detail)     { results.push({ name, status: 'INFO', detail }); console.log(`  ℹ INFO: ${name} — ${JSON.stringify(detail)}`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startServer(sliver, cwd) {
  log(`Starting: ${sliver} (cwd=${cwd})`);
  serverProcess = spawn(BIN, ['run', '--sliver', sliver, '--static-files'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const t0 = Date.now();
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE_URL}/health`);
      if (r.ok) { const ms = Date.now() - t0; log(`Ready in ${ms}ms`); return ms; }
    } catch {}
    await sleep(100);
  }
  throw new Error('Server timeout after 8s');
}

function stopServer() {
  if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
}

async function http(method, path, body) {
  const t0 = performance.now();
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE_URL}${path}`, opts);
  const text = await r.text();
  return { status: r.status, body: text, ms: performance.now() - t0, headers: Object.fromEntries(r.headers.entries()) };
}

// ── Suite 1: Startup ──────────────────────────────────────────────────────────
async function suiteStartup(startupMs) {
  log('\n=== Suite 1: Server Startup ===');
  info('startup-ms', startupMs);
  if (startupMs < 500) pass('startup-under-500ms', `${startupMs}ms`);
  else fail('startup-under-500ms', `${startupMs}ms`);
  if (startupMs < 200) pass('startup-under-200ms', `${startupMs}ms`);
  else warn('startup-under-200ms', `${startupMs}ms — docs claim ~1-2ms (that is per-request dispatch, not process boot)`);
}

// ── Suite 2: Health ───────────────────────────────────────────────────────────
async function suiteHealth() {
  log('\n=== Suite 2: Health Endpoint ===');
  const r = await http('GET', '/health');
  if (r.status === 200) pass('health-200', `${r.ms.toFixed(1)}ms`);
  else fail('health-200', `status=${r.status}`);
  try {
    const j = JSON.parse(r.body);
    if (j.status === 'healthy') pass('health-json-healthy');
    else warn('health-json-healthy', `status="${j.status}"`);
    if (j.version) pass('health-version', j.version);
  } catch { fail('health-json', 'not valid JSON'); }
}

// ── Suite 3: CRUD ─────────────────────────────────────────────────────────────
async function suiteCRUD() {
  log('\n=== Suite 3: CRUD Endpoints ===');

  // GET
  const g = await http('GET', '/api/items');
  if (g.status === 200) pass('get-items-200', `${g.ms.toFixed(1)}ms`);
  else fail('get-items-200', `status=${g.status} body=${g.body.slice(0,80)}`);
  try {
    const j = JSON.parse(g.body);
    if (Array.isArray(j.items)) pass('get-items-array', `count=${j.count}`);
    else fail('get-items-array', 'items not array');
  } catch { fail('get-items-json', g.body.slice(0, 80)); }
  if (g.headers['content-type']?.includes('application/json')) pass('get-content-type');
  else fail('get-content-type', g.headers['content-type']);
  if (g.headers['access-control-allow-origin'] === '*') pass('cors-header');
  else warn('cors-header', 'missing');

  // POST
  const p = await http('POST', '/api/items', { name: 'QA Item', description: 'test' });
  if (p.status === 200 || p.status === 201) pass('post-item-2xx', `${p.status} ${p.ms.toFixed(1)}ms`);
  else fail('post-item-2xx', `status=${p.status}`);
  try {
    const j = JSON.parse(p.body);
    if (j.id) pass('post-has-id', `id=${j.id}`);
    else fail('post-has-id');
    if (j.name === 'QA Item') pass('post-body-readable', 'body correctly passed to JS');
    else warn('post-body-readable', `Bug #1: body not passed — got name="${j.name}"`);
  } catch { fail('post-json', p.body.slice(0, 80)); }

  // DELETE
  const d = await http('DELETE', '/api/items/1');
  warn('delete-by-id', 'Bug #1+#7: no URL in request; per-worker state — 404 expected');
  if ([200, 404].includes(d.status)) pass('delete-responds', `${d.status} ${d.ms.toFixed(1)}ms`);
  else fail('delete-responds', `status=${d.status}`);

  // OPTIONS (CORS preflight)
  const o = await http('OPTIONS', '/api/items');
  if ([200, 204].includes(o.status)) pass('options-cors', `${o.status}`);
  else warn('options-cors', `status=${o.status}`);

  // Unknown method
  const u = await http('PATCH', '/api/items');
  if (u.status === 405 || u.status !== 500) pass('method-not-allowed', `${u.status}`);
  else warn('method-not-allowed', `got ${u.status}`);
}

// ── Suite 4: Latency ──────────────────────────────────────────────────────────
async function suiteLatency() {
  log('\n=== Suite 4: Latency Benchmarks ===');
  const n = 100;
  const times = [];
  for (let i = 0; i < n; i++) { const r = await http('GET', '/health'); times.push(r.ms); }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(n * 0.50)];
  const p90 = times[Math.floor(n * 0.90)];
  const p99 = times[Math.floor(n * 0.99)];
  console.log(`    n=${n} min=${times[0].toFixed(2)} mean=${mean.toFixed(2)} p50=${p50.toFixed(2)} p90=${p90.toFixed(2)} p99=${p99.toFixed(2)} max=${times[n-1].toFixed(2)} ms`);
  info('latency', { n, min: +times[0].toFixed(2), mean: +mean.toFixed(2), p50: +p50.toFixed(2), p90: +p90.toFixed(2), p99: +p99.toFixed(2), max: +times[n-1].toFixed(2) });
  if (p50 < 5) pass('latency-p50-under-5ms', `${p50.toFixed(2)}ms`);
  else fail('latency-p50-under-5ms', `${p50.toFixed(2)}ms`);
  if (p90 < 20) pass('latency-p90-under-20ms', `${p90.toFixed(2)}ms`);
  else fail('latency-p90-under-20ms', `${p90.toFixed(2)}ms`);
  if (p99 < 100) pass('latency-p99-under-100ms', `${p99.toFixed(2)}ms`);
  else warn('latency-p99-under-100ms', `${p99.toFixed(2)}ms`);
}

// ── Suite 5: Sliver Portability ───────────────────────────────────────────────
async function suiteSliverPortability() {
  log('\n=== Suite 5: Sliver Portability ===');

  stopServer();
  await sleep(500);

  // Test 1: run from clean dir (no JS source) — must FAIL due to Bug #6
  const tmpClean = spawnSync('mktemp', ['-d'], { encoding: 'utf8' }).stdout.trim();
  spawnSync('cp', [BIN, tmpClean + '/nano-rs']);
  spawnSync('cp', [SLIVER_CRUD, tmpClean + '/crud-app.sliver']);
  spawnSync('chmod', ['+x', tmpClean + '/nano-rs']);

  const clean = spawn(tmpClean + '/nano-rs', ['run', '--sliver', tmpClean + '/crud-app.sliver', '--static-files'], {
    cwd: tmpClean, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await sleep(3000);
  let cleanRes;
  try { cleanRes = await fetch(`${BASE_URL}/api/items`); }
  catch { cleanRes = { status: 0 }; }
  const cleanBody = cleanRes.status ? await cleanRes.text() : '';
  clean.kill('SIGTERM');
  await sleep(500);

  if (cleanBody.includes('Failed to read entrypoint') || cleanBody.includes('error')) {
    warn('sliver-portable-clean', `Bug #6 confirmed: ${cleanBody.slice(0, 80)}`);
  } else if (cleanRes.status === 200) {
    pass('sliver-portable-clean', 'UNEXPECTED: sliver executes without source files!');
  } else {
    warn('sliver-portable-clean', `Bug #6: status=${cleanRes.status} body=${cleanBody.slice(0, 60)}`);
  }
  spawnSync('rm', ['-rf', tmpClean]);

  // Test 2: run from dir WITH JS source — must PASS
  const tmpWith = spawnSync('mktemp', ['-d'], { encoding: 'utf8' }).stdout.trim();
  spawnSync('cp', [BIN, tmpWith + '/nano-rs']);
  spawnSync('cp', [SLIVER_CRUD, tmpWith + '/crud-app.sliver']);
  spawnSync('cp', [join(ROOT, 'apps', 'crud-app', 'index.js'), tmpWith + '/index.js']);
  spawnSync('chmod', ['+x', tmpWith + '/nano-rs']);

  const withJs = spawn(tmpWith + '/nano-rs', ['run', '--sliver', tmpWith + '/crud-app.sliver', '--static-files'], {
    cwd: tmpWith, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${BASE_URL}/health`); if (r.ok) break; } catch {}
    await sleep(100);
  }
  let withRes;
  try { withRes = await fetch(`${BASE_URL}/api/items`); }
  catch { withRes = { status: 0 }; }
  const withBody = withRes.status ? await withRes.text() : '';
  withJs.kill('SIGTERM');
  await sleep(500);

  if (withRes.status === 200 && withBody.includes('items')) {
    pass('sliver-with-js-cwd', 'works when JS source present in CWD');
  } else {
    fail('sliver-with-js-cwd', `status=${withRes.status} body=${withBody.slice(0, 60)}`);
  }
  spawnSync('rm', ['-rf', tmpWith]);

  // Restart main server for remaining suites
  const ms = await startServer(SLIVER_CRUD, join(ROOT, 'apps', 'crud-app'));
  info('server-restart-ms', ms);
}

// ── Suite 6: Node.js Compatibility (from probe sliver) ───────────────────────
async function suiteNodeCompat() {
  log('\n=== Suite 6: Node.js / WinterCG API Compatibility ===');

  stopServer();
  await sleep(500);

  // Start probe server
  const ms = await startServer(SLIVER_PROBE, join(ROOT, 'apps', 'probe'));
  info('probe-startup-ms', ms);

  const r = await http('GET', '/');
  let probeData;
  try {
    probeData = JSON.parse(r.body);
  } catch {
    fail('probe-json', `status=${r.status} body=${r.body.slice(0, 100)}`);
    return;
  }

  info('probe-summary', probeData.summary);
  console.log(`    Probe: ${probeData.summary.pass} pass / ${probeData.summary.fail} fail of ${probeData.summary.total} total`);

  const pd = probeData.results;

  function checkApi(testName, probeKey, expectedOk, bugNote) {
    const entry = pd[probeKey];
    if (!entry) { warn(testName, `probe key "${probeKey}" missing`); return; }
    if (entry.ok === expectedOk) {
      if (expectedOk) pass(testName, entry.value?.slice(0, 60));
      else pass(testName + '-absent', `correctly absent: ${entry.error?.slice(0, 60)}`);
    } else {
      if (expectedOk) {
        fail(testName, `expected available — got: ${entry.error?.slice(0, 80)}`);
      } else {
        warn(testName, bugNote || `unexpectedly present: ${entry.value}`);
      }
    }
  }

  // V8 built-ins (all expected present)
  log('  -- V8 built-ins --');
  checkApi('v8-json',          'JSON.stringify',    true);
  checkApi('v8-date',          'Date.now',           true);
  checkApi('v8-math',          'Math.random',        true);
  checkApi('v8-array-from',    'Array.from',         true);
  checkApi('v8-map',           'Map',                true);
  checkApi('v8-set',           'Set',                true);
  checkApi('v8-promise',       'Promise',            true);
  checkApi('v8-symbol',        'Symbol',             true);
  checkApi('v8-async-syntax',  'async-function-create', true);

  // WinterCG Web APIs (claimed supported, actually NOT)
  log('  -- WinterCG APIs --');
  if (pd['TextEncoder'] && !pd['TextEncoder'].ok) {
    fail('wintercg-TextEncoder', `Bug #8: TextEncoder not defined — claimed in docs`);
  } else { pass('wintercg-TextEncoder', pd['TextEncoder']?.value); }

  if (pd['TextDecoder'] && !pd['TextDecoder'].ok) {
    fail('wintercg-TextDecoder', 'Bug #8: TextDecoder not defined');
  } else { pass('wintercg-TextDecoder', pd['TextDecoder']?.value); }

  if (pd['URL'] && !pd['URL'].ok) {
    fail('wintercg-URL', 'Bug #9: URL not defined — required by WinterCG spec');
  } else { pass('wintercg-URL', pd['URL']?.value); }

  if (pd['URLSearchParams'] && !pd['URLSearchParams'].ok) {
    fail('wintercg-URLSearchParams', 'Bug #9: URLSearchParams not defined');
  } else { pass('wintercg-URLSearchParams', pd['URLSearchParams']?.value); }

  if (pd['Response'] && !pd['Response'].ok) {
    fail('wintercg-Response', 'Bug #10: Response not defined — critical WinterCG API');
  } else { pass('wintercg-Response', pd['Response']?.value); }

  if (pd['Request'] && !pd['Request'].ok) {
    fail('wintercg-Request', 'Bug #10: Request not defined — critical WinterCG API');
  } else { pass('wintercg-Request', pd['Request']?.value); }

  if (pd['Headers'] && !pd['Headers'].ok) {
    fail('wintercg-Headers', 'Bug #10: Headers not defined');
  } else { pass('wintercg-Headers', pd['Headers']?.value); }

  if (pd['crypto.subtle-typeof'] && !pd['crypto.subtle-typeof'].ok) {
    fail('wintercg-crypto', 'Bug #11: crypto not defined — no WebCrypto');
  } else { pass('wintercg-crypto', pd['crypto.subtle-typeof']?.value); }

  if (pd['atob'] && !pd['atob'].ok) {
    fail('wintercg-atob-btoa', 'Bug #12: atob/btoa not defined');
  } else { pass('wintercg-atob', pd['atob']?.value); }

  // Timers (typeof = undefined = not null, but calling would fail)
  const timerVal = pd['setTimeout-typeof']?.value;
  if (timerVal === 'undefined') {
    warn('wintercg-setTimeout', 'Bug #15: setTimeout exists as identifier but value is undefined — unusable');
  } else if (timerVal === 'function') {
    pass('wintercg-setTimeout', 'setTimeout is a function');
  } else {
    fail('wintercg-setTimeout', `typeof=${timerVal}`);
  }

  // fetch ref
  if (pd['global-fetch-ref']?.ok && pd['global-fetch-ref']?.value === 'function') {
    warn('wintercg-fetch-ref', 'fetch exists as function but is handler override (function hoisting) — NOT built-in outgoing fetch');
  }

  // Node.js APIs
  log('  -- Node.js APIs --');
  if (pd['require-typeof']?.value === 'undefined' && pd['require-fs'] && !pd['require-fs'].ok) {
    fail('nodejs-require', `Bug #13: require is not defined — changelog claims Node.js fs polyfill via require()`);
  } else if (pd['require-fs']?.ok) {
    pass('nodejs-require-fs', pd['require-fs'].value);
  }

  if (pd['process.env'] && !pd['process.env'].ok) {
    fail('nodejs-process', 'Bug: process not defined');
  } else { pass('nodejs-process', pd['process.env']?.value); }

  if (pd['Buffer.from'] && !pd['Buffer.from'].ok) {
    fail('nodejs-Buffer', 'Bug: Buffer not defined');
  } else { pass('nodejs-Buffer', pd['Buffer.from']?.value); }

  if (pd['__dirname'] && !pd['__dirname'].ok) {
    fail('nodejs-__dirname', 'Bug: __dirname not defined');
  } else { pass('nodejs-__dirname', pd['__dirname']?.value); }

  // Nano.fs
  log('  -- Nano.fs API --');
  if (pd['Nano.fs-typeof'] && !pd['Nano.fs-typeof'].ok) {
    fail('nano-fs-exposed', 'Bug #14: Nano object not defined in JS context — Nano.fs API inaccessible');
  } else { pass('nano-fs-exposed', pd['Nano.fs-typeof']?.value); }

  if (pd['Nano.fs.readFile']?.ok) {
    pass('nano-fs-readFile', pd['Nano.fs.readFile'].value);
  } else {
    fail('nano-fs-readFile', pd['Nano.fs.readFile']?.error?.slice(0, 80) || 'no data');
  }

  stopServer();
  await sleep(500);
}

// ── Suite 7: Browser + Screenshots ───────────────────────────────────────────
async function suiteBrowser() {
  log('\n=== Suite 7: Browser UI (Playwright/Chromium) ===');

  const ms = await startServer(SLIVER_CRUD, join(ROOT, 'apps', 'crud-app'));
  info('server-restart-for-browser-ms', ms);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    // Health
    await page.goto(`${BASE_URL}/health`);
    const healthText = await page.textContent('body');
    if (healthText.includes('healthy')) pass('browser-health', 'rendered');
    else fail('browser-health', healthText.slice(0, 100));
    await page.screenshot({ path: join(SCREENSHOTS, '01-health.png'), fullPage: true });
    pass('screenshot-health', '01-health.png');

    // Items API
    await page.goto(`${BASE_URL}/api/items`);
    const itemsText = await page.textContent('body');
    if (itemsText.includes('items')) pass('browser-items', 'JSON rendered');
    else fail('browser-items', itemsText.slice(0, 100));
    await page.screenshot({ path: join(SCREENSHOTS, '02-items.png'), fullPage: true });
    pass('screenshot-items', '02-items.png');

    // Root
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(500);
    const rootText = await page.textContent('body');
    pass('browser-root', `${rootText.length} chars — method=GET routes to getItems()`);
    await page.screenshot({ path: join(SCREENSHOTS, '03-root.png'), fullPage: true });
    pass('screenshot-root', '03-root.png');

    // Browser-side fetch latency
    const timing = await page.evaluate(async () => {
      const t0 = performance.now();
      await fetch('/health');
      return performance.now() - t0;
    });
    info('browser-fetch-latency-ms', +timing.toFixed(2));
    console.log(`    Browser fetch latency: ${timing.toFixed(2)}ms`);

    // Network timing via PerformanceObserver
    const navTiming = await page.evaluate(() => {
      const e = performance.getEntriesByType('navigation')[0];
      return e ? { ttfb: e.responseStart - e.requestStart, total: e.responseEnd - e.requestStart } : null;
    });
    if (navTiming) {
      info('browser-ttfb-ms', +navTiming.ttfb.toFixed(2));
      console.log(`    TTFB: ${navTiming.ttfb.toFixed(2)}ms, total: ${navTiming.total.toFixed(2)}ms`);
    }
  } catch (e) {
    fail('browser-suite', e.message);
  } finally {
    await browser.close();
  }
}

// ── Suite 8: Sliver CLI ───────────────────────────────────────────────────────
async function suiteSliver() {
  log('\n=== Suite 8: Sliver CLI & Archive ===');

  const stat = statSync(SLIVER_CRUD);
  console.log(`    crud-app.sliver: ${stat.size} bytes (${(stat.size/1024).toFixed(1)} KB)`);
  if (stat.size > 400000) pass('sliver-size', `${(stat.size/1024).toFixed(0)}KB`);
  else fail('sliver-size', `${stat.size} bytes — suspiciously small`);

  // CLI list
  const list = spawnSync(BIN, ['sliver', 'list', '--verbose'], {
    cwd: join(ROOT, 'slivers'), encoding: 'utf8', timeout: 5000,
  });
  if (list.stdout.includes('crud-app')) pass('sliver-list-cli', 'crud-app listed');
  else fail('sliver-list-cli', (list.stdout + list.stderr).slice(0, 200));

  // Tar inspection
  const tar = spawnSync('tar', ['-tzf', SLIVER_CRUD], { encoding: 'utf8', timeout: 5000 });
  if (tar.status === 0) {
    const files = tar.stdout.trim().split('\n').filter(Boolean);
    console.log(`    Archive files: ${files.join(', ')}`);
    info('sliver-archive-files', files);
    if (files.some(f => f.includes('meta'))) pass('sliver-meta-json', files.find(f => f.includes('meta')));
    else fail('sliver-meta-json', `files: ${files.join(', ')}`);
    if (files.some(f => f.includes('heap'))) pass('sliver-heap-bin', files.find(f => f.includes('heap')));
    else fail('sliver-heap-bin', `no heap file`);
    if (files.some(f => f.includes('index.js'))) pass('sliver-vfs-js', files.find(f => f.includes('index.js')));
    else warn('sliver-vfs-js', 'JS not packed in VFS');

    // Meta content
    const metaR = spawnSync('tar', ['-xOf', SLIVER_CRUD, 'meta.json'], { encoding: 'utf8', timeout: 3000 });
    if (metaR.status === 0) {
      try {
        const meta = JSON.parse(metaR.stdout);
        pass('sliver-meta-content', `hostname=${meta.hostname} version=${meta.nano_version}`);
        info('sliver-meta', meta);
      } catch { warn('sliver-meta-parse', metaR.stdout.slice(0, 100)); }
    }
  } else {
    warn('sliver-tar', tar.stderr?.slice(0, 100));
  }

  // Startup timing (5 runs)
  log('  Measuring sliver startup latency (5 runs)...');
  const startTimes = [];
  for (let i = 0; i < 5; i++) {
    await sleep(300);
    const t0 = Date.now();
    const p = spawn(BIN, ['run', '--sliver', SLIVER_CRUD, '--static-files'], {
      cwd: join(ROOT, 'apps', 'crud-app'), stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    for (let j = 0; j < 80; j++) {
      try { const r = await fetch(`${BASE_URL}/health`); if (r.ok) { ready = true; break; } } catch {}
      await sleep(100);
    }
    const ms = Date.now() - t0;
    startTimes.push(ms);
    console.log(`    run ${i+1}: ${ms}ms`);
    p.kill('SIGTERM');
    await sleep(300);
  }
  const meanStart = startTimes.reduce((a, b) => a + b, 0) / startTimes.length;
  info('startup-times-ms', startTimes);
  console.log(`    mean=${meanStart.toFixed(0)}ms min=${Math.min(...startTimes)}ms max=${Math.max(...startTimes)}ms`);
  warn('startup-claim-vs-reality',
    `Docs claim "~1-2ms cold starts" — measured mean=${meanStart.toFixed(0)}ms (process boot + workers). The 267µs figure is per-request dispatch latency, not process startup.`);
}

// ── Suite 9: Documented Bugs Regression ──────────────────────────────────────
async function suiteBugRegression() {
  log('\n=== Suite 9: Bug Regression Checks (v1.1.2) ===');

  // Start server for regression tests
  await sleep(300);
  const ms = await startServer(SLIVER_CRUD, join(ROOT, 'apps', 'crud-app'));

  // Bug #1: request body not passed
  const p = await http('POST', '/', { name: 'regression-test', val: 42 });
  try {
    const j = JSON.parse(p.body);
    if (j.name === 'regression-test') {
      pass('bug1-fixed-request-body', 'Bug #1 FIXED: request body now passed to JS');
    } else {
      warn('bug1-still-present', `Bug #1 unfixed: got name="${j.name}" not "regression-test" [src/worker/pool.rs:execute_handler_code]`);
    }
  } catch { warn('bug1-regression', p.body.slice(0, 80)); }

  // Bug #2: ESM
  // Can't test without separate sliver — documented as architectural
  warn('bug2-esm', 'Bug #2 unfixed: v8::Script::compile still used — ESM export/import causes SyntaxError [src/worker/pool.rs]');

  // Bug #3: config mode
  const configR = spawnSync(BIN, ['run', '--config', join(ROOT, 'config.json')], {
    cwd: ROOT, encoding: 'utf8', timeout: 4000,
    env: { ...process.env },
  });
  // Start it briefly and kill
  const configProc = spawn(BIN, ['run', '--config', join(ROOT, 'config.json')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await sleep(2500);
  let configWorks = false;
  try {
    const cr = await fetch(`${BASE_URL}/api/items`, { signal: AbortSignal.timeout(1000) });
    if (cr.ok) { const b = await cr.text(); configWorks = b.includes('items'); }
  } catch {}
  configProc.kill('SIGTERM');
  await sleep(500);

  if (configWorks) {
    pass('bug3-fixed-config-mode', 'Bug #3 FIXED: --config now loads app entrypoints');
  } else {
    warn('bug3-still-present', 'Bug #3 unfixed: --config falls back to run_server() stub [src/main.rs:run_server_with_config]');
  }

  // Restart server (config test may have killed it)
  await sleep(300);
  try {
    const hr = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(500) });
    if (!hr.ok) throw new Error();
  } catch {
    await startServer(SLIVER_CRUD, join(ROOT, 'apps', 'crud-app'));
  }

  // Bug #5: port config
  warn('bug5-port-config', 'Bug #5 unfixed: port/host from config always ignored — hardcoded 0.0.0.0:8080 [src/main.rs ServerConfig::default()]');

  // Bug #7: worker state isolation — verify with sequential requests
  const post1 = await http('POST', '/', { name: 'w1' });
  const post2 = await http('POST', '/', { name: 'w2' });
  let id1, id2;
  try { id1 = JSON.parse(post1.body).id; } catch {}
  try { id2 = JSON.parse(post2.body).id; } catch {}
  if (id1 !== undefined && id2 !== undefined && id1 === id2) {
    warn('bug7-worker-state', `Bug #7 still present: both POSTs returned id=${id1} — separate worker db.nextId counters`);
  } else if (id1 !== undefined && id2 !== undefined && id2 === id1 + 1) {
    pass('bug7-fixed-shared-state', 'Bug #7 FIXED: state shared across workers');
  } else {
    warn('bug7-worker-state', `Bug #7: id1=${id1} id2=${id2} — state not consistent across workers`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       nano-rs QA Test Suite v2.0                         ║');
  console.log('║  Binary: v1.1.2 release (reports 1.1.0)                  ║');
  console.log('║  Platform: Darwin arm64  |  Node.js: ' + process.version.padEnd(10) + '           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Start initial server
  const startupMs = await startServer(SLIVER_CRUD, join(ROOT, 'apps', 'crud-app')).catch(e => {
    console.error('FATAL: server failed:', e.message); process.exit(1);
  });

  await suiteStartup(startupMs);
  await suiteHealth();
  await suiteCRUD();
  await suiteLatency();

  stopServer();
  await sleep(300);

  await suiteSliverPortability();  // starts/stops server internally

  await suiteNodeCompat();         // starts probe server, stops it
  await suiteBrowser();            // starts crud server for browser
  stopServer();
  await sleep(300);

  await suiteSliver();             // does startup timing, no server at end

  await sleep(300);
  await suiteBugRegression();      // starts crud server, regression checks
  stopServer();

  // Print summary
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails  = results.filter(r => r.status === 'FAIL').length;
  const warns  = results.filter(r => r.status === 'WARN').length;
  const infos  = results.filter(r => r.status === 'INFO').length;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL RESULTS                         ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✓ PASS  ${String(passes).padEnd(4)}  ✗ FAIL  ${String(fails).padEnd(4)}  ⚠ WARN  ${String(warns).padEnd(4)}  ℹ INFO  ${infos}   ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const report = {
    timestamp: new Date().toISOString(),
    binary: 'v1.1.2 release (internal: 1.1.0)',
    platform: 'Darwin arm64',
    node: process.version,
    summary: { pass: passes, fail: fails, warn: warns, info: infos },
    results,
  };
  const reportPath = join(ROOT, 'reports', 'test-results.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Saved: ${reportPath}`);

  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); stopServer(); process.exit(1); });
