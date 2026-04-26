# NANO-RS API Compatibility Reference

Complete reference of supported JavaScript APIs in nano-rs v1.2.4.

## Status Legend
- ✅ **IMPLEMENTED** - Fully functional
- ⚠️ **PARTIAL** - Working with limitations
- ❌ **NOT IMPLEMENTED** - Not available
- 🚫 **WONT_IMPLEMENT** - Not planned

---

## Console API

| Method | Status | Notes |
|--------|--------|-------|
| `console.log()` | ✅ | All parameters supported |
| `console.error()` | ✅ | Outputs to stderr |
| `console.warn()` | ✅ | Same as console.error |
| `console.info()` | ✅ | Same as console.log |
| `console.debug()` | ✅ | Controlled by RUST_LOG |
| `console.table()` | ❌ | Not implemented |
| `console.time()` | ❌ | Not implemented |

---

## Global Objects

### Timers
| Method | Status | Notes |
|--------|--------|-------|
| `setTimeout()` | ✅ | Standard implementation |
| `clearTimeout()` | ✅ | Standard implementation |
| `setInterval()` | ✅ | Standard implementation |
| `clearInterval()` | ✅ | Standard implementation |

### Encoding
| Class | Status | Notes |
|-------|--------|-------|
| `TextEncoder` | ✅ | Standard implementation |
| `TextDecoder` | ✅ | Standard implementation |

### Crypto
| API | Status | Notes |
|-----|--------|-------|
| `crypto.getRandomValues()` | ✅ | Cryptographically secure |
| `crypto.subtle.digest()` | ✅ | SHA-256, SHA-384, SHA-512 |
| `crypto.subtle.encrypt()` | ✅ | AES-GCM |
| `crypto.subtle.decrypt()` | ✅ | AES-GCM |
| `crypto.subtle.sign()` | ❌ | Not implemented |
| `crypto.subtle.verify()` | ❌ | Not implemented |

---

## WinterCG Standards

### fetch API
| Feature | Status | Notes |
|---------|--------|-------|
| `fetch()` | ✅ | Full implementation |
| Request headers | ✅ | Standard Headers API |
| Response streaming | ⚠️ | Limited streaming support |
| AbortController | ❌ | Not implemented |

### Request/Response
| Feature | Status | Notes |
|---------|--------|-------|
| `new Request()` | ✅ | Standard implementation |
| `request.url` | ✅ | Full URL object |
| `request.method` | ✅ | Standard implementation |
| `request.headers` | ✅ | Headers API |
| `request.json()` | ✅ | Async parsing |
| `request.text()` | ✅ | Async reading |
| `new Response()` | ✅ | Standard implementation |
| `response.status` | ✅ | Standard implementation |
| `response.headers` | ✅ | Headers API |
| `Response.redirect()` | ⚠️ | Use manual headers workaround |
| `Response.json()` | ✅ | Static method |

### Headers
| Feature | Status | Notes |
|---------|--------|-------|
| `new Headers()` | ✅ | Standard implementation |
| `headers.get()` | ✅ | Case-insensitive |
| `headers.set()` | ✅ | Standard implementation |
| `headers.append()` | ✅ | Standard implementation |
| `headers.delete()` | ✅ | Standard implementation |
| `headers.has()` | ✅ | Standard implementation |
| `headers.forEach()` | ✅ | Standard implementation |
| `Object.fromEntries(headers)` | ❌ | Use forEach instead |

---

## Node.js Polyfills

### Buffer
| Feature | Status | Notes |
|---------|--------|-------|
| `Buffer.from(string)` | ✅ | UTF-8 encoding |
| `Buffer.from(array)` | ✅ | Standard implementation |
| `Buffer.alloc(size)` | ✅ | Zero-filled |
| `buffer.toString()` | ✅ | UTF-8 default |
| `buffer.length` | ✅ | Standard implementation |
| `Buffer.concat()` | ✅ | Standard implementation |

### URL
| Feature | Status | Notes |
|---------|--------|-------|
| `new URL()` | ✅ | Standard implementation |
| `url.pathname` | ✅ | Standard implementation |
| `url.search` | ✅ | Standard implementation |
| `url.searchParams` | ✅ | URLSearchParams API |
| `url.hash` | ✅ | Standard implementation |
| `url.host` | ✅ | Standard implementation |
| `url.toString()` | ✅ | Returns full URL |

### URLSearchParams
| Feature | Status | Notes |
|---------|--------|-------|
| `new URLSearchParams()` | ✅ | Standard implementation |
| `params.get()` | ✅ | Standard implementation |
| `params.set()` | ✅ | Standard implementation |
| `params.append()` | ✅ | Standard implementation |
| `params.delete()` | ✅ | Standard implementation |
| `params.has()` | ✅ | Standard implementation |
| `Object.fromEntries(params)` | ⚠️ | Limited support |

### Process
| Feature | Status | Notes |
|---------|--------|-------|
| `process.env` | ⚠️ | Limited environment access |
| `process.version` | ❌ | Not Node.js version |

---

## ES6+ Features

| Feature | Status | Notes |
|---------|--------|-------|
| Arrow functions | ✅ | Full support |
| Async/await | ✅ | Full support |
| Promises | ✅ | Full support |
| Template literals | ✅ | Full support |
| Destructuring | ✅ | Full support |
| Spread operator | ✅ | Full support |
| Default parameters | ✅ | Full support |
| Classes | ✅ | Full support |
| Modules (import/export) | ✅ | ES6 modules supported |
| Map | ✅ | Full support |
| Set | ✅ | Full support |
| WeakMap | ❌ | Not implemented |
| WeakSet | ❌ | Not implemented |
| Symbol | ✅ | Full support |
| Proxy | ❌ | Not implemented |
| Reflect | ❌ | Not implemented |

---

## Cloudflare Worker Compatibility

### Core Patterns
| Pattern | Status | Notes |
|---------|--------|-------|
| `export default { fetch }` | ✅ | Standard pattern |
| `request` object | ✅ | Full WinterCG compliance |
| `env` bindings | ⚠️ | Limited support |
| `ctx.waitUntil()` | ❌ | Not implemented |
| `ctx.passThroughOnException()` | ❌ | Not implemented |

### Common Patterns
| Pattern | Status | Notes |
|---------|--------|-------|
| JSON API endpoints | ✅ | Use `headers.forEach()` |
| CORS handling | ✅ | Full preflight support |
| WebCrypto hashing | ✅ | SHA-256/384/512 |
| WebCrypto encryption | ✅ | AES-GCM |
| Redirects | ⚠️ | Use manual headers |
| Static assets | ⚠️ | Via sliver module |

---

## Notable Limitations

### 1. Headers Object
```javascript
// ❌ Doesn't work
const headersObj = Object.fromEntries(request.headers);

// ✅ Use this instead
const headersObj = {};
request.headers.forEach((value, key) => {
  headersObj[key] = value;
});
```

### 2. Response.redirect()
```javascript
// ❌ Doesn't work
return Response.redirect('https://example.com', 302);

// ✅ Use this instead
return new Response(null, {
  status: 302,
  headers: { 'Location': 'https://example.com' }
});
```

### 3. Promise in JSON.stringify
```javascript
// ❌ May cause issues
return new Response(JSON.stringify({
  data: someAsyncFunction() // Returns Promise
}));

// ✅ Always await
const data = await someAsyncFunction();
return new Response(JSON.stringify({ data }));
```

---

## Migration from Node.js

### Express → nano-rs

```javascript
// Express
app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello' });
});

// nano-rs
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/data') {
      return new Response(JSON.stringify({ message: 'Hello' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

### Cloudflare Worker → nano-rs

Most CF Workers run with minimal changes:

1. Replace `Response.redirect()` with manual headers
2. Replace `Object.fromEntries(headers)` with `headers.forEach()`
3. Ensure all Promises are resolved before `JSON.stringify()`

---

## Testing Compatibility

Run the compatibility matrix:

```bash
node scripts/fast-compatibility-matrix.js
```

Results show which APIs are available and working in your deployment.

---

## Feature Requests

To request new features:
1. Check this matrix for current status
2. Open an issue at https://github.com/nano-rs/nano-rs/issues
3. Include use case and expected API

---

*Last updated: 2026-04-26 for nano-rs v1.2.4*
