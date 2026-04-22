// nano-rs CRUD App - adapted for actual runtime constraints
//
// BUGS DISCOVERED (documented, not fixed):
//   Bug #1 [src/worker/pool.rs execute_handler_code]: request is JSON string
//     {"method":"GET"} only — URL path, headers, query params, body NOT passed.
//     Filed: WinterCG Request object never constructed before JS call.
//   Bug #2 [src/worker/pool.rs execute_handler_code]: v8::Script::compile used,
//     not Module API — ESM syntax (export/import) = SyntaxError.
//   Bug #3 [src/main.rs run_server_with_config]: --config falls back to
//     run_server() with no-op. Config-based app loading NOT implemented.
//   Bug #4 [src/worker/pool.rs execute_handler_code]: async fetch() returns
//     Promise but call is synchronous — Promises never resolved.
//   Bug #5 [src/http/server.rs run_from_sliver]: port/host config fields
//     ignored — always binds 0.0.0.0:8080.
//   Bug #6 [src/worker/pool.rs execute_handler_code]: entrypoint read from OS
//     filesystem, not from VFS — sliver's packed VFS unused for JS execution.
//
// WORKAROUNDS APPLIED:
//   - Classic script mode (no export/import)
//   - Global function named `fetch` (overrides built-in WinterCG fetch API)
//   - Sync return of plain object {status, headers, body}
//   - Method-only routing (no URL path available)
//   - In-memory store (no VFS/SQLite — note: global state = per-worker, not shared)

var db = { items: [], nextId: 1 };

function jsonResp(data, status) {
  return {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function getItems() {
  return jsonResp({ items: db.items, count: db.items.length });
}

function createItem() {
  // NOTE: Cannot read request body due to Bug #1 — using placeholder data
  var item = {
    id: db.nextId++,
    name: 'Item ' + (db.nextId - 1),
    description: 'Created via POST (body unreadable - Bug #1)',
    createdAt: new Date().toISOString(),
  };
  db.items.push(item);
  return jsonResp(item, 201);
}

function deleteItem() {
  // NOTE: Cannot read item ID from URL due to Bug #1 — deletes last item
  if (db.items.length === 0) return jsonResp({ error: 'No items to delete' }, 404);
  var removed = db.items.pop();
  return jsonResp({ deleted: true, item: removed });
}

function healthCheck() {
  return jsonResp({
    status: 'ok',
    runtime: 'nano-rs',
    version: '1.1.0',
    itemCount: db.items.length,
    knownBugs: ['no-url-in-request', 'no-esm', 'no-async', 'no-body-read'],
  });
}

// Global fetch override — nano-rs worker looks for globalThis.fetch
// WARNING: This shadows the built-in WinterCG fetch() for outgoing HTTP requests
function fetch(requestJson) {
  var req;
  try {
    req = JSON.parse(requestJson);
  } catch (e) {
    req = { method: 'GET' };
  }

  var method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') return getItems();
  if (method === 'POST') return createItem();
  if (method === 'DELETE') return deleteItem();
  if (method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  return jsonResp({ error: 'Method not supported', method: method }, 405);
}
