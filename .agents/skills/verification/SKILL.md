---
name: verification
description: >-
  Empirically verify code correctness, compiler builds, linter checks, test fixtures, and documentation integrity.
  Activated after applying code edits, bug fixes, or documentation updates.
---

# Empirical Verification Skill

> **Skill Purpose:** Guide AI agents in gathering rigorous, empirical proof of correctness across compilers, linters, automated tests, and documentation links without relying on conversational assertions.

---

## 1. When to Activate This Skill

Activate this skill when:
- Concluding any code editing, feature implementation, or bug fix task.
- Validating documentation, YAML frontmatter, or link references.
- Generating the mandatory empirical evidence section in `walkthrough.md`.

---

## 2. Dynamic Environment Discovery Pre-Check

Before running verification commands:
1. **Discover Actual Repository & Toolchain State:**
   - Inspect the workspace to identify which build files exist (`package.json`, `tsconfig.json`, `pnpm-lock.yaml`).
   - Do **NOT** assume `npm test`, `npm run typecheck`, or `tsc` exist before checking `package.json` scripts.
2. **Phase-Aware Fallback Verification:**
   - If application build tools are not yet initialized (e.g. during architecture/documentation phases), execute static validation scripts (e.g. Python YAML/link validators, schema checks) rather than failing on nonexistent package commands.
3. **Check Test Environment Preconditions:**
   - Verify if required test containers (e.g. PostgreSQL, Redis) are running before executing integration tests.

---

## 3. Mandatory Empirical Proof Rules

- **Zero Conversational Assertions:** Never conclude a task with conversational claims like *"The code has been updated and tested."*
- **Verbatim Evidence Mandate:** Always provide verbatim terminal command output and exit codes for:
  - Compiler / Typechecker (`tsc --noEmit` or `npm run typecheck`)
  - Linter / Code Formatter (`npm run lint`)
  - Test Suite (`npm test` with exact test pass/fail counts)
- **Anti-Thrashing Two-Strike Rule:**
  - If a compiler check or test fails after two consecutive fix attempts, **STOP IMMEDIATELY**.
  - Do not loop attempting a third speculative fix. Present the failure output to the human and request guidance.

---

## 4. Step-by-Step Procedure

1. **Detect Tooling:** Inspect workspace configuration to select the appropriate verification tools:
   - TypeScript: Run typechecker (`tsc --noEmit` or project script).
   - Linter: Run linter (`eslint` or project script).
   - Tests: Run test runner (`npm test`, `jest`, or `vitest`).
   - Documentation / Schemas: Run Python/Node static validators for YAML frontmatter and internal links.
2. **Execute Commands in Sandbox:** Run terminal verification commands in sandboxed mode (`BypassSandbox: false`).
3. **Capture Verbatim Output:** Capture the terminal output, exit status, and test counts.
4. **Inspect Results:** Verify exit code 0 and confirm zero compiler errors, zero lint warnings, and 100% test pass rates.
5. **Record in Walkthrough Artifact:** Update `walkthrough.md` with the verbatim output under the Verification Results section.

---

## 5. Explicit Stop-and-Ask Conditions

Immediately pause and request human guidance if:
1. Two consecutive fix attempts fail to resolve a test or compiler error.
2. A required testing dependency, environment variable, or database container is unavailable.
3. A test failure reveals an unhandled architectural conflict or edge case outside the approved plan.
