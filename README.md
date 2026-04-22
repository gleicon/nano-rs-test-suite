# NANO-RS Blackbox Test Suite

A comprehensive JavaScript-only test harness for testing [nano-rs](https://github.com/gleicon/nano-rs), a multi-tenant JavaScript edge runtime.

## Features

- ✅ **Standalone Operation** - Run without any AI agent
- ✅ **Comprehensive Testing** - 50 tests covering all major features
- ✅ **Automated Reporting** - JSON and Markdown reports generated
- ✅ **WinterCG Compliance** - Tests web standard APIs
- ✅ **Production Ready** - Validates runtime for production use

## Quick Start

```bash
# Clone or navigate to the test suite
cd nano-rs-test-suite

# Run with auto-detected binary
node scripts/run-tests.js

# Or specify the binary path
node scripts/run-tests.js --binary /path/to/nano-rs

# Run with verbose output
node scripts/run-tests.js --verbose

# Run quick tests only (core features)
node scripts/run-tests.js --quick
```

## Installation

No installation required! Just Node.js (v16+).

```bash
# Verify Node.js version
node --version  # Should be v16.0.0 or higher

# The test suite will auto-detect the nano-rs binary
# Or you can specify it with --binary
```

## Usage

### Basic Usage

```bash
# Auto-detect nano-rs binary
node scripts/run-tests.js

# Specify binary location
node scripts/run-tests.js --binary ./bin/nano-rs

# Custom output directory
node scripts/run-tests.js --output ./my-reports
```

### Command Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--binary` | `-b` | Path to nano-rs binary | Auto-detected |
| `--output` | `-o` | Output directory for reports | `./reports` |
| `--verbose` | `-v` | Show detailed test output | `false` |
| `--quick` | | Run only core tests | `false` |
| `--help` | `-h` | Show help message | |

### Examples

```bash
# Full test with verbose output
node scripts/run-tests.js --verbose

# Quick test (CLI + Basic HTTP only)
node scripts/run-tests.js --quick

# Custom binary and output location
node scripts/run-tests.js --binary ~/bin/nano-rs --output ~/test-results

# Help
node scripts/run-tests.js --help
```

## Test Coverage

The test suite covers:

### 1. CLI (5 tests)
- Binary exists
- Version command
- Help commands
- Sliver help

### 2. Basic HTTP (3 tests)
- Server startup
- GET requests
- POST with body

### 3. WinterCG Compatibility (6 tests)
- `fetch()` API
- `Request`/`Response` objects
- `Headers` API
- `URL` API
- `ReadableStream`/`WritableStream`
- `TextEncoder`/`TextDecoder`

### 4. Node.js Basics (4 tests)
- `console` methods
- `setTimeout`/`setInterval`
- `Buffer`
- `require()` support

### 5. WebCrypto (5 tests)
- `crypto.subtle` availability
- AES-GCM encryption
- HMAC signing
- PBKDF2 derivation
- SHA-256 hashing

### 6. Virtual File System (3 tests)
- `Nano.fs.writeFile`
- `Nano.fs.readFile`
- Node.js `fs` compatibility

### 7. CRUD Application (6 tests)
- CREATE (POST)
- READ ALL (GET)
- READ ONE (GET)
- UPDATE (PUT)
- DELETE (DELETE)
- Server startup

### 8. HTTP Verbs (7 tests)
- GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS

### 9. Multi-tenancy (3 tests)
- Multiple apps startup
- Virtual host routing
- 404 for unknown hosts

### 10. Sliver Feature (2 tests)
- Sliver creation
- App server from sliver

### 11. ESM Support (3 tests)
- ES Module syntax
- `export default`
- `import`/`export`

### 12. Error Handling (3 tests)
- Syntax errors
- Runtime errors
- Async errors

## Reports

After running tests, reports are generated in the `reports/` directory:

### JSON Report (`report-{timestamp}.json`)

```json
{
  "meta": {
    "generatedAt": "2026-04-21T20:46:00.000Z",
    "nanoVersion": "nano-rs 1.1.0",
    "duration": "15000ms"
  },
  "summary": {
    "total": 50,
    "passed": 50,
    "failed": 0,
    "overallScore": "100%"
  },
  "categories": {
    "cli": { "passed": 5, "failed": 0, "total": 5 },
    "crud": { "passed": 6, "failed": 0, "total": 6 }
  },
  "testResults": [
    { "name": "nano-rs binary exists", "status": "passed", "category": "cli" }
  ]
}
```

### Markdown Report (`report-{timestamp}.md`)

A human-readable report with tables showing test results by category.

## Interpreting Results

### Score Guidelines

| Score | Status | Interpretation |
|-------|--------|----------------|
| 95-100% | 🏆 Excellent | Production ready |
| 85-94% | ✅ Good | Minor issues, mostly production ready |
| 70-84% | ⚠️ Fair | Core features work, some limitations |
| < 70% | ❌ Poor | Not ready for production |

### Example Perfect Score Output

```
╔══════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                          ║
╠══════════════════════════════════════════════════════════╣
║  Total Tests:  50                                         ║
║  Passed:       ✓ 50                                       ║
║  Failed:       ✗ 0                                        ║
║  Overall:      100%                                       ║
╚══════════════════════════════════════════════════════════╝

📄 Reports saved to:
   - reports/report-1234567890.json
   - reports/report-1234567890.md
   - reports/latest-report.md
```

## Testing Against GitHub Releases

To test against the latest GitHub release:

```bash
# Download latest release
curl -L -o bin/nano-rs-latest.tar.gz \
  https://github.com/gleicon/nano-rs/releases/download/v1.1.4/nano-rs_Darwin_arm64.tar.gz

# Extract
tar -xzf bin/nano-rs-latest.tar.gz -C bin/

# Run tests
node scripts/run-tests.js --binary bin/nano-rs
```

## Troubleshooting

### Binary Not Found

```
❌ Could not find nano-rs binary. Please specify with --binary
```

**Solution:**
```bash
node scripts/run-tests.js --binary /path/to/nano-rs
```

### Server Timeout

If tests fail with timeout errors, the runtime may not be starting properly.

**Check:**
- Binary permissions (`chmod +x nano-rs`)
- Port conflicts (tests use ports 8888-8898)
- Runtime errors in nano-rs

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use
```

**Solution:**
```bash
# Kill processes using test ports
lsof -ti:8888-8898 | xargs kill -9
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Test nano-rs

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Download nano-rs
        run: |
          curl -L -o nano-rs.tar.gz \
            https://github.com/gleicon/nano-rs/releases/latest/download/nano-rs_Linux_x86_64.tar.gz
          tar -xzf nano-rs.tar.gz
          chmod +x nano-rs
      
      - name: Run tests
        run: node scripts/run-tests.js --binary ./nano-rs
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: reports/
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

Use in CI pipelines:

```bash
node scripts/run-tests.js || exit 1
```

## Architecture

### How It Works

1. **Test App Generation** - Creates JavaScript test applications
2. **Server Management** - Starts/stops nano-rs servers for each test
3. **HTTP Testing** - Sends requests and validates responses
4. **Report Generation** - Produces JSON and Markdown reports

### Test Flow

```
Create Test Apps
    ↓
Start nano-rs Server
    ↓
Send HTTP Requests
    ↓
Validate Responses
    ↓
Stop Server
    ↓
Generate Report
```

## Contributing

To add new tests:

1. Create test app in `createTestApps()`
2. Add test function (e.g., `testFeature()`)
3. Call function in `main()`
4. Update this README

Example:

```javascript
async function testNewFeature() {
  console.log('\n🆕 Testing New Feature...');
  
  const configPath = createConfig([{ 
    hostname: 'localhost', 
    entrypoint: path.join(CONFIG.TEST_APPS_DIR, 'new-feature.js') 
  }], CONFIG.BASE_PORT + 10);
  
  const nano = startNanoServer(configPath, CONFIG.BASE_PORT + 10);
  
  await runTest('New feature works', async () => {
    await waitForServer(CONFIG.BASE_PORT + 10);
    const response = await httpRequest({
      hostname: 'localhost',
      port: CONFIG.BASE_PORT + 10,
      path: '/test',
      method: 'GET'
    });
    assertEquals(response.status, 200);
  }, 'new-feature');
  
  await stopNano(nano);
  fs.unlinkSync(configPath);
}
```

## License

MIT

## Links

- [nano-rs Repository](https://github.com/gleicon/nano-rs)
- [WinterCG Standards](https://wintertc.org/)
- [Test Reports](./reports/latest-report.md)
