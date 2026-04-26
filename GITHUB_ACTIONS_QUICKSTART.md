# GitHub Actions Quickstart - Add Test Suite to nano-rs

## TL;DR - 3 Steps

```bash
# 1. Go to nano-rs repository
cd /path/to/nano-rs

# 2. Create workflow directory and copy file
mkdir -p .github/workflows
cp /path/to/nano-rs-test-suite/.github/workflows/test-suite.yml .github/workflows/

# 3. Commit and push
git add .github/workflows/test-suite.yml
git commit -m "Add automated test suite workflow"
git push origin main
```

Done! Tests will run on every commit.

---

## What Happens After?

### On Every Commit:
1. GitHub builds nano-rs
2. Runs 50 comprehensive tests
3. Reports results

### On Pull Requests:
- Tests must pass to merge ✅
- Results posted as PR comments
- Download detailed reports

---

## Verify It's Working

Go to your nano-rs repo on GitHub:

```
https://github.com/gleicon/nano-rs/actions
```

You should see the "Test Suite" workflow running.

---

## Required Changes (if needed)

### 1. Repository Name Mismatch?

If your test suite repo has a different name, edit:

```yaml
# In .github/workflows/test-suite.yml
- name: Checkout test suite
  uses: actions/checkout@v4
  with:
    repository: gleicon/nano-rs-test-suit  # <-- Update this
    path: test-suite
```

### 2. Different Default Branch?

If main branch is not `main`:

```yaml
on:
  push:
    branches: [ main, master, develop ]  # <-- Add your branch
```

---

## Test Results Location

After each run, check:

1. **GitHub Actions tab** - Real-time logs
2. **Artifacts** - Download full reports
3. **PR Status** - Pass/fail indicator

---

## Badge for README

Add to nano-rs README.md:

```markdown
[![Test Suite](https://github.com/gleicon/nano-rs/actions/workflows/test-suite.yml/badge.svg)](https://github.com/gleicon/nano-rs/actions/workflows/test-suite.yml)
```

---

## Need Help?

Full documentation: [docs/GITHUB_ACTIONS_INTEGRATION.md](docs/GITHUB_ACTIONS_INTEGRATION.md)
