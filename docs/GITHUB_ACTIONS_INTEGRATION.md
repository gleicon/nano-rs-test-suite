# GitHub Actions Integration Guide

This guide explains how to add automated testing to the nano-rs repository using nano-rs-test-suite.

## Overview

The GitHub Actions workflow will:
1. Build nano-rs on every commit
2. Run the comprehensive test suite
3. Report results as PR comments and artifacts
4. Block merges if tests fail

## Installation

### Step 1: Add the Workflow File

Copy `.github/workflows/test-suite.yml` to your nano-rs repository:

```bash
# From nano-rs repository root
cp /path/to/nano-rs-test-suite/.github/workflows/test-suite.yml .github/workflows/
```

### Step 2: Verify Test Suite Repository

The workflow references your test suite at `gleicon/nano-rs-test-suit`. 

**Important:** Verify the repository name is correct:
- Current: `gleicon/nano-rs-test-suit`
- Make sure this matches your actual repository name

If needed, update the workflow:
```yaml
- name: Checkout test suite
  uses: actions/checkout@v4
  with:
    repository: YOUR_USERNAME/nano-rs-test-suite  # Update this
    path: test-suite
```

### Step 3: Commit and Push

```bash
git add .github/workflows/test-suite.yml
git commit -m "Add automated test suite workflow"
git push origin main
```

## What the Workflow Does

### Triggers
- Runs on every push to `main`, `master`, or `develop`
- Runs on every pull request to these branches
- Ignores markdown and documentation-only changes

### Jobs

#### 1. Test Suite (Full)
**Runs on:** Ubuntu and macOS

**Steps:**
1. Builds nano-rs in release mode
2. Caches Rust dependencies for speed
3. Clones nano-rs-test-suite
4. Runs full test suite (50 tests)
5. Uploads reports as artifacts
6. Validates score is above 80%

#### 2. Smoke Test (Quick)
**Runs on:** Ubuntu only

**Steps:**
1. Builds nano-rs in debug mode
2. Runs quick tests (core features only)
3. Fast feedback for developers

## Test Results

### Viewing Results

Results appear in three places:

1. **GitHub Actions Logs** - Real-time test output
2. **PR Status Check** - Pass/fail indicator
3. **Artifacts** - Download full reports

### Artifacts

After each run, download:
- `test-reports-ubuntu-latest` - Linux test results
- `test-reports-macos-latest` - macOS test results

Each contains:
- `report-{timestamp}.json` - Machine-readable data
- `report-{timestamp}.md` - Human-readable report
- `latest-report.md` - Always the latest
- `test-run-*.log` - Full test log

## PR Integration

### Status Checks

The workflow adds a required status check to pull requests:

- ✅ **Test Suite / Run Test Suite** - Must pass to merge
- ✅ **Test Suite / Quick Smoke Test** - Must pass to merge

### Failing Tests

If tests fail:
1. PR shows ❌ status
2. Click "Details" to see logs
3. Download artifacts for full report
4. Fix issues and push again

## Customization

### Change Test Score Threshold

Edit the threshold in the workflow:
```yaml
- name: Validate test results
  run: |
    SCORE=$(cat test-results/report-*.json | grep -o '"overallScore": "[0-9]*%' | grep -o '[0-9]*')
    if [ -n "$SCORE" ] && [ "$SCORE" -lt 90 ]; then  # Change 80 to 90
      echo "❌ Test score ${SCORE}% is below 90% threshold"
      exit 1
    fi
```

### Add Windows Testing

Add Windows to the matrix:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
```

**Note:** You may need to adjust the build steps for Windows.

### Pin Test Suite Version

Use a specific tag/branch for stability:
```yaml
- name: Checkout test suite
  uses: actions/checkout@v4
  with:
    repository: gleicon/nano-rs-test-suit
    ref: v1.0.0  # Pin to specific release
    path: test-suite
```

### Skip Tests on Draft PRs

Add condition to skip:
```yaml
jobs:
  test-suite:
    if: github.event.pull_request.draft == false
```

## Troubleshooting

### Workflow Not Running

Check:
1. YAML syntax is valid (use online validator)
2. File is in `.github/workflows/` directory
3. Branch name matches (main/master/develop)

### Slow Builds

The workflow already enables caching. First run will be slow (builds everything), subsequent runs will be faster.

### Test Suite Not Found

Verify the repository URL:
```bash
# Check if repository exists
curl -s https://api.github.com/repos/YOUR_USERNAME/nano-rs-test-suite | grep "Not Found"
```

### Permission Denied

Ensure Actions are enabled in repository settings:
- Go to Settings → Actions → General
- Select "Allow all actions and reusable workflows"

## Example Output

### Successful Run
```
✅ Test Suite / Run Test Suite (ubuntu-latest) - Passed
✅ Test Suite / Run Test Suite (macos-latest) - Passed
✅ Test Suite / Quick Smoke Test - Passed

Overall Score: 100% (50/50 tests)
```

### Failed Run
```
❌ Test Suite / Run Test Suite (ubuntu-latest) - Failed

Test Score: 75%
Error: Test score 75% is below 80% threshold

Failed Tests:
- CRUD: UPDATE (PUT)
- VFS: Nano.fs.readFile
```

## Next Steps

1. **Monitor first run** - Check it works correctly
2. **Set as required check** - In Settings → Branches → Protection rules
3. **Add badge to README** - Show test status

## Badge for README

Add this to your nano-rs README.md:

```markdown
[![Test Suite](https://github.com/YOUR_USERNAME/nano-rs/actions/workflows/test-suite.yml/badge.svg)](https://github.com/YOUR_USERNAME/nano-rs/actions/workflows/test-suite.yml)
```

Replace `YOUR_USERNAME` with your GitHub username.

## Support

- [nano-rs Repository](https://github.com/gleicon/nano-rs)
- [nano-rs-test-suite](https://github.com/gleicon/nano-rs-test-suit)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
