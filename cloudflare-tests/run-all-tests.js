/**
 * Final Comprehensive Test Report
 * Run all tests and generate detailed report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  NANO-RS COMPREHENSIVE TEST REPORT                       ║');
console.log('║  WinterCG, Cloudflare Workers, Assets, Deep Fetch        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  nano_version: '',
  tests: {}
};

// Get nano-rs version
try {
  results.nano_version = execSync('./bin/nano-rs --version', { encoding: 'utf8' }).trim();
  console.log(`Binary: ${results.nano_version}\n`);
} catch (e) {
  console.error('Failed to get nano-rs version:', e.message);
  process.exit(1);
}

// Run main test suite
console.log('📋 Running Core Test Suite...\n');
try {
  const output = execSync('npm test 2>&1', { encoding: 'utf8', timeout: 120000 });
  
  // Parse results
  const passedMatch = output.match(/Passed:\s*✓\s*(\d+)/);
  const failedMatch = output.match(/Failed:\s*✗\s*(\d+)/);
  const scoreMatch = output.match(/Overall:\s*(\d+)%/);
  
  results.tests.core = {
    passed: passedMatch ? parseInt(passedMatch[1]) : 0,
    failed: failedMatch ? parseInt(failedMatch[1]) : 0,
    score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
    total: 50
  };
  
  console.log(output.slice(-500)); // Show last 500 chars
} catch (e) {
  console.log('Test output:', e.stdout ? e.stdout.slice(-500) : 'No output');
  results.tests.core = { error: e.message };
}

console.log('\n📊 Test Results Summary:');
console.log('='.repeat(60));

if (results.tests.core && results.tests.core.passed !== undefined) {
  console.log(`Core Tests:    ${results.tests.core.passed}/${results.tests.core.total} passed (${results.tests.core.score}%)`);
} else {
  console.log('Core Tests:    Unable to determine results');
}

console.log('='.repeat(60));

// Save report
const reportPath = path.join(__dirname, 'reports', `cf-compatibility-report-${Date.now()}.json`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

console.log(`\n📄 Full report saved to: ${reportPath}\n`);

// Final assessment
if (results.tests.core && results.tests.core.score >= 98) {
  console.log('🎉 EXCELLENT! nano-rs is highly compatible with Cloudflare Workers!');
  console.log('   Core WinterCG APIs are fully functional.\n');
} else if (results.tests.core && results.tests.core.score >= 90) {
  console.log('✅ GOOD! nano-rs has strong CF Worker compatibility.');
  console.log('   Most patterns work, minor issues remain.\n');
} else {
  console.log('⚠️  NEEDS WORK. Compatibility issues detected.\n');
}
