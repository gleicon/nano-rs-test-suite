// nano-rs API probe — tests all runtime API surfaces
// Returns JSON report of what is/isn't available
// Classic script mode (no ESM) — by necessity

var results = {};

function probe(name, fn) {
  try {
    var val = fn();
    results[name] = { ok: true, value: String(val).slice(0, 120) };
  } catch (e) {
    results[name] = { ok: false, error: String(e).slice(0, 200) };
  }
}

// ── V8 built-ins ──────────────────────────────────────────────────────────────
probe('JSON.stringify', function() { return JSON.stringify({a:1}); });
probe('Date.now', function() { return Date.now(); });
probe('Math.random', function() { return typeof Math.random(); });
probe('Array.from', function() { return Array.from([1,2,3]).join(','); });
probe('Map', function() { var m = new Map(); m.set('k','v'); return m.get('k'); });
probe('Set', function() { var s = new Set([1,2,1]); return s.size; });
probe('Promise', function() { return typeof Promise; });
probe('Symbol', function() { return typeof Symbol('x'); });

// ── WinterCG / Web APIs ───────────────────────────────────────────────────────
probe('TextEncoder', function() {
  var enc = new TextEncoder();
  return enc.encode('hello').length;
});
probe('TextDecoder', function() {
  var dec = new TextDecoder();
  return dec.decode(new Uint8Array([72,105]));
});
probe('URL', function() {
  var u = new URL('https://example.com/path?q=1');
  return u.pathname + '?' + u.searchParams.get('q');
});
probe('URLSearchParams', function() {
  var p = new URLSearchParams('a=1&b=2');
  return p.get('a') + p.get('b');
});
probe('Response', function() {
  var r = new Response('body', {status: 201});
  return r.status;
});
probe('Request', function() {
  var r = new Request('https://example.com/', {method: 'POST'});
  return r.method + ' ' + r.url;
});
probe('Headers', function() {
  var h = new Headers({'X-Test': 'yes'});
  return h.get('X-Test');
});
probe('fetch-typeof', function() { return typeof fetch; });
probe('crypto.subtle-typeof', function() { return typeof crypto.subtle; });
probe('crypto.randomUUID', function() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID().length : 'missing';
});
probe('atob', function() { return atob('SGVsbG8='); });
probe('btoa', function() { return btoa('Hello'); });
probe('setTimeout-typeof', function() { return typeof setTimeout; });
probe('clearTimeout-typeof', function() { return typeof clearTimeout; });
probe('setInterval-typeof', function() { return typeof setInterval; });
probe('queueMicrotask-typeof', function() { return typeof queueMicrotask; });

// ── Node.js APIs ──────────────────────────────────────────────────────────────
probe('require-typeof', function() { return typeof require; });
probe('require-fs', function() {
  var fs = require('fs');
  return typeof fs.readFileSync;
});
probe('require-path', function() {
  var path = require('path');
  return path.join('a', 'b');
});
probe('require-os', function() {
  var os = require('os');
  return os.platform();
});
probe('process-typeof', function() { return typeof process; });
probe('process.env', function() { return typeof process.env; });
probe('process.version', function() { return process.version; });
probe('Buffer-typeof', function() { return typeof Buffer; });
probe('Buffer.from', function() { return Buffer.from('hello').toString('hex'); });
probe('__dirname', function() { return typeof __dirname + ':' + __dirname; });
probe('__filename', function() { return typeof __filename + ':' + __filename; });

// ── Nano.fs API ───────────────────────────────────────────────────────────────
probe('Nano-typeof', function() { return typeof Nano; });
probe('Nano.fs-typeof', function() { return typeof Nano.fs; });
probe('Nano.fs.writeFile', function() {
  Nano.fs.writeFile('/test/hello.txt', 'world');
  return 'write-ok';
});
probe('Nano.fs.readFile', function() {
  Nano.fs.writeFile('/test/hello.txt', 'world');
  return Nano.fs.readFile('/test/hello.txt');
});
probe('Nano.fs.exists', function() {
  return Nano.fs.exists('/test/hello.txt');
});

// ── async / Promise ───────────────────────────────────────────────────────────
probe('async-function-create', function() {
  var fn = async function() { return 42; };
  return typeof fn;
});
// Can't test actual promise resolution — worker is sync

// ── Fetch outgoing (real HTTP) ─────────────────────────────────────────────
// Can't do async, so just test the reference
probe('global-fetch-ref', function() {
  // We override fetch below — check the original first
  return typeof globalThis.fetch;
});

// ── Summary handler ───────────────────────────────────────────────────────────
function fetch(requestJson) {
  var req;
  try { req = JSON.parse(requestJson); } catch(e) { req = {method:'GET'}; }

  var pass = Object.keys(results).filter(function(k) { return results[k].ok; });
  var fail = Object.keys(results).filter(function(k) { return !results[k].ok; });

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: { pass: pass.length, fail: fail.length, total: Object.keys(results).length },
      results: results,
    }, null, 2),
  };
}
