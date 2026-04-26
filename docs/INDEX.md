# Test Suite Documentation Index

## Quick Reference

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Main documentation |
| [run-tests.js](../scripts/run-tests.js) | Standalone test runner |
| [BUG_REPORTS.md](BUG_REPORTS.md) | Known nano-rs runtime bugs |

## Example Results

### Perfect Score (100%)
- **Local Build:** 50/50 tests passing
- **Report:** `reports/latest-report.md`
- **Summary:** All features working including VFS, Sliver, full CRUD

### GitHub Release v1.2.0 (81%)
- **Public Release:** 22/27 core tests passing
- **Report:** `examples/v1.2.0-results/latest-report.md`
- **Summary:** Solid core features, some gaps in advanced features

## Running Tests

### Quick Start
```bash
# Auto-detect binary
node scripts/run-tests.js

# Specify binary
node scripts/run-tests.js --binary ./bin/nano-rs

# Verbose output
node scripts/run-tests.js --verbose
```

### Testing GitHub Releases
```bash
# Download and test latest release
curl -L -o nano-rs.tar.gz \
  https://github.com/gleicon/nano-rs/releases/latest/download/nano-rs_Darwin_arm64.tar.gz
tar -xzf nano-rs.tar.gz
node scripts/run-tests.js --binary ./nano-rs
```

## Test Categories

### Current Test Count
- **Total Tests:** 50 tests
- **Passing:** 47 tests (94%)
- **Failing:** 1 test (Bug #1 - VFS path validation)
- **Incomplete:** 2 tests (Bug #2 - Server cleanup timeout)

### Categories
1. **CLI** (5 tests) - Command-line interface ✅ 100%
2. **Basic HTTP** (3 tests) - Server startup and requests ✅ 100%
3. **WinterCG** (6 tests) - Web standard APIs ✅ 100%
4. **Node.js** (4 tests) - Node.js compatibility ✅ 100%
5. **WebCrypto** (5 tests) - Cryptographic operations ✅ 100%
6. **VFS** (3 tests) - Virtual file system ✅ 100%
7. **CRUD** (6 tests) - REST API operations ✅ 100%
8. **HTTP Verbs** (7 tests) - HTTP method support ✅ 100%
9. **Multi-tenancy** (3 tests) - Virtual host routing ✅ 100%
10. **Sliver** (2 tests) - Snapshot feature ⚠️ 1 failing (Bug #1)
11. **ESM** (3 tests) - ES Module support ✅ 100%
12. **Error Handling** (3 tests) - Error scenarios ⚠️ 2 incomplete (Bug #2)

### Known Runtime Bugs (See [BUG_REPORTS.md](BUG_REPORTS.md))
- **Bug #1:** VFS path validation rejects `[...]` file patterns
- **Bug #2:** Server process cleanup fails in error scenarios

> 💡 All tests are executed. Failures accurately report nano-rs runtime bugs with full reproduction steps in BUG_REPORTS.md.

## Interpreting Results

### Score Guide
- **95-100%**: Production ready
- **85-94%**: Good, minor issues
- **70-84%**: Fair, core features work
- **< 70%**: Not production ready

### Report Files
- `report-{timestamp}.json` - Machine-readable results
- `report-{timestamp}.md` - Human-readable report
- `latest-report.md` - Always links to latest

## CI/CD Examples

See README.md for GitHub Actions workflow examples.

## Support

- [nano-rs Repository](https://github.com/gleicon/nano-rs)
- [WinterCG Standards](https://wintertc.org/)
