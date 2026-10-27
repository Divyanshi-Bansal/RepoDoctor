---
name: testing-rules
description: Testing philosophy, golden-file fixtures, test-first requirements, and empirical verification proof standards.
trigger: glob
globs: "**/*.spec.ts, **/*.test.ts, **/*.spec.tsx, **/*.test.tsx, **/test/**"
---

# Testing Standards & Verification Rules

> **Scope:** Unit, integration, golden-file, and end-to-end testing standards.  
> **Precedence:** Level 2 (Verification Constraints — Subordinate to Level 1 Security & Approval Gates)

---

## 1. Testing Philosophy & Test-First Development

- **No Implementation Without Tests:**
  - Every new feature, service method, or bug fix must include automated test coverage.
  - For bug fixes, follow the bug-fix lifecycle: author a failing test reproducing the bug *before* modifying production code.
- **Test Pyramids & Scope:**
  - **Unit Tests (70%):** Fast, isolated, in-memory tests for parsers, graph algorithms, and utility functions.
  - **Integration Tests (25%):** Module integration tests verifying NestJS services with real PostgreSQL (Docker container) and Redis instances.
  - **End-to-End Tests (5%):** Critical user flows (e.g. ingesting a mock repo, viewing graph in Web UI).

---

## 2. Test Fixtures & Golden Files

- **Static Analysis & Parser Fixtures:**
  - Parsers in the `analyzer` module must be tested using synthetic, reproducible multi-repo test fixtures stored under `test/fixtures/` (e.g. `test/fixtures/microservices-demo/`).
  - Use **Golden-File Testing:** Assert that `analyzer.extractTopology(fixtureDir)` matches an approved snapshot JSON (`topology.golden.json`).
- **External API Mocking:**
  - External GitHub API calls must be mocked using recorded HTTP fixtures (Nock / Polly.js). Tests must run fully offline without hitting the live internet or GitHub rate limits.
  - LLM API inference must be mocked in automated CI runs with deterministic mocked responses.

---

## 3. Verification Evidence Requirements

- **Empirical Proof is Mandatory:**
  - An agent may never declare a task complete based on conversation or inspection alone.
  - Every completed implementation plan and walkthrough must include captured terminal output proving:
    1. TypeScript compilation passes cleanly (`tsc --noEmit` returns exit code 0).
    2. Linter passes cleanly (`npm run lint` returns 0 warnings and 0 errors).
    3. Test suite passes with explicit counts (e.g. `Tests: 18 passed, 18 total`).
- **Regression Detection:**
  - When modifying any shared interface or utility, execute the entire test suite across all modules, not just the isolated unit test for the changed file.
