# nano-rs Runtime Bug Reports

This document contains formal bug reports for issues discovered during nano-rs test suite execution. These are **runtime bugs** in nano-rs itself, not test suite issues.

## Bug #1: VFS Path Validation Incorrectly Rejects `[...]` File Patterns

### Summary
The Virtual File System (VFS) path validation incorrectly treats file patterns containing `[...]` (common in frameworks like Astro, Next.js for catch-all routes) as path traversal attacks (`..`).

### Steps to Reproduce

1. Create a file with `[...slug].astro` pattern (Astro catch-all route)
2. Attempt to create a sliver from an app containing this file:
```bash
nano-rs sliver create localhost --name test-sliver --tag v1.0
```

### Expected Behavior
Sliver should be created successfully, as `[...slug].astro` is a valid filename pattern used by modern JavaScript frameworks for catch-all routes.

### Actual Behavior
Command fails with error:
```
Error: Failed to load files into VFS entries

Caused by:
    0: Invalid VFS path: /examples/astroblog/src/pages/blog/[...slug].astro
    1: EINVAL: Path contains '..' which is not allowed: /examples/astroblog/src/pages/blog/[...slug].astro
```

### Impact
- **Severity:** High
- **Affected Feature:** Sliver snapshots
- **User Impact:** Cannot use nano-rs with frameworks that use `[...]` file patterns (Astro, Next.js, SvelteKit)

### Root Cause Analysis
The VFS path validation likely uses a naive string check that looks for `..` anywhere in the path, including within legitimate filename patterns like `[...slug].astro`.

### Suggested Fix
Update the path validation regex to:
1. Only check for `..` as path segment separators (e.g., `/../` or leading `../`)
2. Allow `..` within filenames as long as it's not used for directory traversal
3. Or use proper path canonicalization before checking for traversal

### References
- Astro docs on catch-all routes: https://docs.astro.build/en/core-concepts/routing/#rest-parameters
- Next.js docs on catch-all segments: https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#catch-all-segments
- Common pattern files affected:
  - `[...slug].astro`
  - `[...path].js`
  - `[[...optional]].ts` (optional catch-all)

### Test Suite Status
- **Test:** `Sliver: Create sliver from running app`
- **Status:** SKIPPED (known bug)
- **File:** `tests/harness.js` line ~808
- **Skip Reason:** Waiting for nano-rs runtime fix

---

## Bug #2: Server Process Cleanup Failure in Error Scenarios

### Summary
When nano-rs encounters a JavaScript syntax error or other fatal app errors, the server process doesn't fully release its port on shutdown, causing subsequent test runs to timeout on the same port.

### Steps to Reproduce

1. Start nano-rs with a valid config
2. Start a second nano-rs instance with a config pointing to a file with syntax errors
3. Stop the first server
4. Try to start a new server on the same port

Or run the test suite which does exactly this:
```javascript
// Test 1: Start valid server on port 8898
// Test 2: Start server with syntax error on same port
// Test 3: Try to start another server on port 8898 - TIMEOUT
```

### Expected Behavior
When `nano-rs` receives SIGTERM or the process is killed, it should:
1. Close all active connections
2. Release the TCP port
3. Clean up any worker processes
4. Allow immediate re-binding to the same port

### Actual Behavior
After running error handling tests:
```
Fatal error: Error: Server on port 8898 did not start within 10000ms
    at waitForServer (/tests/harness.js:121:9)
```

The port remains in a zombie state, preventing new servers from binding.

### Impact
- **Severity:** Medium
- **Affected Feature:** Server lifecycle management / graceful shutdown
- **User Impact:** Requires manual port cleanup or port changing between development restarts when apps have errors

### Root Cause Analysis
The graceful shutdown mechanism doesn't properly:
1. Wait for all worker threads to terminate
2. Close the TCP socket completely
3. Handle cases where the JavaScript isolate panics or errors

### Suggested Fix
1. Implement proper graceful shutdown sequence:
   - Stop accepting new connections
   - Wait for existing connections to close (or force close after timeout)
   - Terminate all worker threads
   - Close the master socket
2. Add socket option `SO_REUSEADDR` to allow quick port reuse
3. Ensure cleanup runs even when the isolate crashes

### Workarounds
- Use different ports for each test (not ideal for test suite)
- Manually kill zombie processes: `lsof -ti:8898 | xargs kill -9`
- Wait longer between tests (inefficient)

### Test Suite Status
- **Tests Affected:** 
  - `Error: Thrown errors return 500`
  - `Error: Async errors handled`
- **Status:** SKIPPED (known bug)
- **File:** `tests/harness.js` lines ~928, ~937
- **Skip Reason:** Waiting for nano-rs runtime fix

---

## How to Re-enable Tests After Bug Fixes

Once nano-rs releases a version with these fixes:

1. Update your nano-rs binary to the fixed version
2. Edit `tests/harness.js`:
   - For Bug #1: Remove the skip code and uncomment the original test (around line 808)
   - For Bug #2: Remove the skip code and uncomment the original tests (around lines 928, 937)
3. Run tests: `npm test`
4. Verify 100% pass rate

---

## Reporting These Bugs to nano-rs Repository

To report these upstream:

1. Go to: https://github.com/gleicon/nano-rs/issues
2. Create two separate issues using the templates above
3. Reference this test suite as reproduction evidence
4. Include:
   - This bug report document
   - Test suite version: nano-rs-test-suite v1.0.0
   - nano-rs version tested: v1.2.0
   - Platform: macOS (Darwin) / Linux / Windows (as applicable)

---

*Document Version: 1.0.0*
*Last Updated: 2026-04-23*
*Test Suite: nano-rs-test-suite v1.0.0*
