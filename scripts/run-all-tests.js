/**
 * Comprehensive Test Suite Runner
 * 
 * Runs all test suites and generates a unified report:
 * 1. Core blackbox tests (27 tests)
 * 2. API compatibility matrix (26 tests)
 * 3. Edge case tests (10 tests)
 * 4. Performance tests (4 tests)
 * 5. Cloudflare Worker tests (7 tests)
 * 6. WASM-JS parity tests (4 tests) - NEW v1.4.0
 * 7. CPU time limit tests (4 tests) - NEW v1.4.0
 * 8. Adversarial security tests (9 tests) - NEW v1.4.0
 * 9. VFS tests (7 tests) - NEW v1.4.0
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG = {
  NANO_BINARY: process.env.NANO_BINARY || path.join(__dirname, '..', 'bin', 'nano-rs'),
  REPORTS_DIR: path.join(__dirname, '..', 'reports'),
  TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-')
};

async function runTestScript(name, scriptPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log('='.repeat(60));
  
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.dirname(__dirname)
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    proc.on('close', (code) => {
      // Parse results from output
      const summaryMatch = stdout.match(/Passed:\s+(\d+)\s+✓/);
      const failedMatch = stdout.match(/Failed:\s+(\d+)\s+✗/);
      const scoreMatch = stdout.match(/Score:\s+(\d+)%/);
      
      const passed = summaryMatch ? parseInt(summaryMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      resolve({
        name,
        passed,
        failed,
        total: passed + failed,
        score,
        code,
        stdout,
        stderr
      });
    });
  });
}

async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  NANO-RS COMPREHENSIVE TEST SUITE v2.0                     ║');
  console.log('║  Core + New Features (WASM, CPU Limits, Security)          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  console.log(`Binary: ${CONFIG.NANO_BINARY}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  // Core tests (v1.2.4)
  results.push(await runTestScript('Core Blackbox Tests', 'scripts/run-tests.js'));
  results.push(await runTestScript('API Compatibility Matrix', 'scripts/fast-compatibility-matrix.js'));
  results.push(await runTestScript('Edge Case Tests', 'scripts/edge-case-tests.js'));
  results.push(await runTestScript('Performance Tests', 'scripts/quick-performance-tests.js'));
  
  // New tests (v1.4.0)
  results.push(await runTestScript('Cloudflare Worker Tests', 'cloudflare-tests/test-fixed-cf-worker.js'));
  results.push(await runTestScript('WASM-JS Parity Tests', 'scripts/wasm-js-parity-tests.js'));
  results.push(await runTestScript('CPU Time Limit Tests', 'scripts/cpu-time-limit-tests.js'));
  results.push(await runTestScript('Adversarial Security Tests', 'scripts/adversarial-security-tests.js'));
  results.push(await runTestScript('VFS Tests', 'scripts/vfs-tests.js'));
  
  // Calculate totals
  const totals = results.reduce((acc, r) => ({
    passed: acc.passed + r.passed,
    failed: acc.failed + r.failed,
    total: acc.total + r.total
  }), { passed: 0, failed: 0, total: 0 });
  
  const overallScore = Math.round((totals.passed / totals.total) * 100);
  
  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE TEST SUITE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Test Suites: ${results.length}`);
  console.log(`Total Tests: ${totals.total}`);
  console.log(`Passed: ${totals.passed} ✓`);
  console.log(`Failed: ${totals.failed} ✗`);
  console.log(`Overall Score: ${overallScore}%`);
  console.log('='.repeat(60));
  
  console.log('\nIndividual Results:');
  results.forEach(r => {
    const status = r.score >= 80 ? '✅' : r.score >= 50 ? '⚠️' : '❌';
    console.log(`  ${status} ${r.name}: ${r.passed}/${r.total} (${r.score}%)`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('FEATURE BREAKDOWN');
  console.log('='.repeat(60));
  
  const coreTests = results.slice(0, 4);
  const corePassed = coreTests.reduce((a, r) => a + r.passed, 0);
  const coreTotal = coreTests.reduce((a, r) => a + r.total, 0);
  console.log(`Core Features (v1.2.4): ${corePassed}/${coreTotal} (${Math.round((corePassed/coreTotal)*100)}%)`);
  
  const newTests = results.slice(4);
  const newPassed = newTests.reduce((a, r) => a + r.passed, 0);
  const newTotal = newTests.reduce((a, r) => a + r.total, 0);
  console.log(`New Features (v1.4.0): ${newPassed}/${newTotal} (${Math.round((newPassed/newTotal)*100)}%)`);
  
  console.log('='.repeat(60));
  
  // Save report
  const report = {
    timestamp: CONFIG.TIMESTAMP,
    binary: CONFIG.NANO_BINARY,
    version: '2.0',
    summary: {
      total: totals.total,
      passed: totals.passed,
      failed: totals.failed,
      score: overallScore
    },
    results: results.map(r => ({
      name: r.name,
      passed: r.passed,
      failed: r.failed,
      total: r.total,
      score: r.score
    }))
  };
  
  fs.mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
  const reportPath = path.join(CONFIG.REPORTS_DIR, `comprehensive-v2-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}\n`);
  
  return { totals, results, overallScore };
}

if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
