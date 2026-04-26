# Known Issues & Workarounds

Documented limitations and their solutions for nano-rs v1.2.4.

## Critical Issues

None identified. All core functionality works as expected.

## Minor Issues

### 1. Response.redirect() Static Method

**Status:** ⚠️ Partial - Use workaround

**Issue:**
```javascript
// This doesn't work
return Response.redirect('https://example.com', 302);
// Returns: Status 500, Location: undefined
```

**Workaround:**
```javascript
// Use manual headers instead
return new Response(null, {
  status: 302,
  headers: { 'Location': 'https://example.com' }
});

// For permanent redirect (301)
return new Response(null, {
  status: 301,
  headers: { 'Location': 'https://example.com' }
});
```

**Why:** Response.redirect() is a static method that nano-rs doesn't fully implement. The workaround achieves the same HTTP semantics.

---

### 2. Object.fromEntries() with Headers

**Status:** ⚠️ Partial - Use workaround

**Issue:**
```javascript
// This may return unexpected results
const headersObj = Object.fromEntries(request.headers);
// May result in: "Unexpected token 'P', 'Promise re...'"
```

**Workaround:**
```javascript
// Use forEach instead
const headersObj = {};
request.headers.forEach((value, key) => {
  headersObj[key] = value;
});

// Or use iteration
for (const [key, value] of request.headers.entries()) {
  headersObj[key] = value;
}
```

**Why:** The Headers object iterator may not be fully compatible with Object.fromEntries().

---

### 3. JSON.stringify() with Unresolved Promises

**Status:** ⚠️ Partial - Ensure resolution

**Issue:**
```javascript
// This can cause JSON parse errors
const data = {
  async: someAsyncFunction(), // Returns Promise
  sync: 'value'
};
return new Response(JSON.stringify(data));
// Error: "Unexpected token 'P', 'Promise re...'"
```

**Workaround:**
```javascript
// Always await Promises before JSON.stringify
const asyncData = await someAsyncFunction();
const data = {
  async: asyncData,
  sync: 'value'
};
return new Response(JSON.stringify(data));

// Or for parallel async operations
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
return new Response(JSON.stringify({ users, posts }));
```

**Why:** nano-rs's JSON serialization doesn't automatically resolve Promises.

---

### 4. URLSearchParams with Object.fromEntries()

**Status:** ⚠️ Partial - Use workaround

**Issue:**
```javascript
const url = new URL(request.url);
const params = Object.fromEntries(url.searchParams);
// May not work as expected
```

**Workaround:**
```javascript
// Manual iteration
const params = {};
url.searchParams.forEach((value, key) => {
  params[key] = value;
});

// Or get individual params
const id = url.searchParams.get('id');
const name = url.searchParams.get('name');
```

---

### 5. crypto.subtle.sign() / verify()

**Status:** ❌ Not Implemented

**Issue:** Digital signature operations not available.

**Workaround:**
```javascript
// For JWT verification, use HMAC with digest
async function verifyJWT(token, secret) {
  const [header, payload, signature] = token.split('.');
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);
  const key = encoder.encode(secret);
  
  // Use HMAC-SHA256 via digest (limited workaround)
  const hash = await crypto.subtle.digest('SHA-256', data);
  // Compare with signature...
}

// For full JWT support, verify in upstream service
// or use external authentication provider
```

**Alternative:** Use external authentication service (Auth0, Clerk, etc.) or verify JWTs at your API gateway.

---

### 6. AbortController / AbortSignal

**Status:** ❌ Not Implemented

**Issue:** Cannot cancel in-flight requests.

**Workaround:**
```javascript
// Implement timeout manually
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}

// Usage
const response = await fetchWithTimeout('https://api.example.com/data', {}, 3000);
```

---

### 7. process.env Limited

**Status:** ⚠️ Partial

**Issue:** Node.js-style environment variable access is limited.

**Workaround:**
```javascript
// Use request context or hardcode config
export default {
  async fetch(request, env) {
    // Pass config via nano-rs config or request context
    const apiKey = env.API_KEY || 'default-key';
    // ...
  }
};

// In nano-rs config (if supported by future versions)
{
  "apps": [{
    "hostname": "example.com",
    "entrypoint": "index.js",
    "env": {
      "API_KEY": "secret-key"
    }
  }]
}
```

**Alternative:** Store configuration in the worker code or fetch from external config service.

---

### 8. URLSearchParams Doesn't Decode URL-Encoded Values

**Status:** ⚠️ Partial - Manual decoding required

**Issue:**
```javascript
const url = new URL('http://example.com/?name=hello%20world');
const name = url.searchParams.get('name');
// Returns: "hello%20world" instead of "hello world"
```

**Workaround:**
```javascript
// Manual decode
const value = url.searchParams.get('name');
const decoded = decodeURIComponent(value); // "hello world"

// Or use a helper function
function getDecodedParam(url, key) {
  const value = url.searchParams.get(key);
  return value ? decodeURIComponent(value) : null;
}
```

---

### 9. WebSocket Support

**Status:** ❌ Not Implemented

**Issue:** WebSocket connections not supported.

**Workaround:**
```javascript
// Use Server-Sent Events for push notifications
if (url.pathname === '/events') {
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        controller.enqueue(`data: ${Date.now()}\n\n`);
      }, 1000);
      
      // Cleanup on close
      request.signal?.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Alternative:** Use external WebSocket service (Pusher, Ably, etc.) for real-time features.

---

### 9. File System Access

**Status:** ❌ Not Implemented

**Issue:** No `fs` module available.

**Workaround:**
```javascript
// Use in-memory storage or external services
const cache = new Map();

export default {
  async fetch(request) {
    // Store in memory (ephemeral)
    cache.set('key', value);
    
    // Or use external storage
    await fetch('https://storage.example.com/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
```

**Alternative:** Use external storage (S3, Redis, Database) for persistence.

---

### 10. setImmediate / process.nextTick

**Status:** ❌ Not Implemented

**Issue:** Node.js-specific timing functions not available.

**Workaround:**
```javascript
// Use setTimeout with 0 delay
setTimeout(() => {
  // Your code here
}, 0);

// Or use Promise.resolve for microtask
Promise.resolve().then(() => {
  // Your code here
});
```

---

## Performance Considerations

### Memory Leaks

**Symptom:** Increasing memory usage over time.

**Cause:** Global variables accumulating state.

**Fix:**
```javascript
// ❌ Bad - leaks memory
const cache = [];
export default {
  async fetch(request) {
    cache.push(Date.now()); // Grows forever
  }
};

// ✅ Good - bounded cache
const MAX_CACHE_SIZE = 1000;
const cache = new Map();

export default {
  async fetch(request) {
    // Add with TTL
    cache.set(key, { value, timestamp: Date.now() });
    
    // Cleanup old entries periodically
    if (cache.size > MAX_CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }
};
```

### CPU-Intensive Operations

**Symptom:** Requests timeout or slow down.

**Cause:** Blocking the event loop.

**Fix:**
```javascript
// ❌ Bad - blocks event loop
function fibonacci(n) {
  return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
}

// ✅ Good - use iterative approach
function fibonacci(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
}

// For heavy computation, consider worker threads
// or offload to external service
```

---

## Debugging Tips

### Enable Debug Logging

```bash
RUST_LOG=debug nano-rs run --config config.json
```

### Add Request Logging

```javascript
export default {
  async fetch(request) {
    console.log(`${request.method} ${request.url}`);
    const start = Date.now();
    
    try {
      const response = await handleRequest(request);
      console.log(`  → ${response.status} in ${Date.now() - start}ms`);
      return response;
    } catch (err) {
      console.error(`  → Error: ${err.message}`);
      throw err;
    }
  }
};
```

### Test Locally First

```bash
# Use the test suite
node scripts/run-tests.js --binary /path/to/nano-rs

# Test specific functionality
node scripts/edge-case-tests.js
```

---

## Reporting Issues

If you find an issue not listed here:

1. Check this document for workarounds
2. Search existing issues: https://github.com/nano-rs/nano-rs/issues
3. Create a minimal reproduction:
   ```javascript
   export default {
     async fetch(request) {
       // Minimal code showing the issue
       return new Response('test');
     }
   };
   ```
4. Include nano-rs version and platform

---

*Last updated: 2026-04-26 for nano-rs v1.2.4*
