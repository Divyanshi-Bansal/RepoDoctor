---
name: module-implementation
description: >-
  Execute code changes, bug fixes, or module implementations within approved boundaries for RepoDoctor.
  Activated when an approved implementation plan is authorized for execution by the human.
---

# Module Implementation Skill

> **Skill Purpose:** Guide AI agents in disciplined, safe code implementation adhering strictly to module boundaries, TypeScript hygiene, zero-code-execution security rules, and zero-drift documentation requirements.

---

## 1. When to Activate This Skill

Activate this skill when:
- An `implementation_plan.md` has been explicitly approved for execution by the human engineer.
- Implementing bug fixes, feature logic, or unit tests within an approved module boundary.

Do **NOT** activate if execution permission has not been explicitly granted. The presence of an implementation plan alone does **not** authorize execution.

---

## 2. Dynamic Environment Discovery Pre-Check

Before applying any code modifications:
1. **Verify Explicit Execution Authorization:**
   - Confirm that the human engineer explicitly authorized proceeding with implementation.
2. **Inspect Repository & Toolchain State:**
   - Check which package manager, compiler, or build scripts are initialized.
   - Do not invoke terminal build scripts without first verifying they exist in `package.json`.
3. **Inspect Target Module Contract:**
   - Read the target module's specification in [docs/modules/](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/modules/).
   - Identify public interfaces, dependencies, non-goals, and boundary restrictions.

---

## 3. Strict Coding & Security Rules

- **Strict Boundary Confinement:** All edits must be confined strictly within the approved module boundary. Never import private internal files across module boundaries.
- **Strict TypeScript Hygiene (.agents/rules/coding_standards.md):**
  - Zero `any` policy: strictly prohibited. Use `unknown`, generics, or union types.
  - Explicit return types on all exported functions and public methods.
  - Immutability by default: use `readonly` properties and immutable transformations (`map`, `filter`).
- **Zero Untrusted Code Execution (.agents/rules/security.md):**
  - Scanned code analyzed by `analyzer` or `ingestion` is untrusted data.
  - Never execute scanned files via `eval()`, `new Function()`, `vm`, or `child_process.exec/spawn`.
- **Evidence Integrity Guarantee:**
  - When writing graph or analyzer code, enforce the Exactly-One-Target Invariant (`node_id` XOR `edge_id`).
  - Differentiate deterministic facts (`confidence: 1.0`, `isInferred: false`) from inferred relationships (`confidence < 1.0`, `isInferred: true`).

---

## 4. Step-by-Step Procedure

1. **Verify Preconditions:** Confirm target files and interfaces from the approved plan.
2. **Apply Controlled Edits:** Use structured file editing tools rather than terminal shell writes or shell redirection.
3. **Zero-Drift Synchronization:** If modifying a public interface or data model, update the corresponding `docs/modules/<module>/MODULE.md` specification and progress checklist in the same turn.
4. **Compile & Lint Check:** Run available compiler (`tsc --noEmit`) or lint checks to catch mechanical syntax issues.
5. **Two-Strike Failure Guard:** If compilation or linting fails after two consecutive fix attempts, **STOP IMMEDIATELY**. Present the exact error output and ask the human for guidance.
6. **Handoff to Verification:** Conclude code edits and activate the `verification` skill.

---

## 5. Explicit Stop-and-Ask Conditions

Immediately pause execution and ask the human engineer for guidance when:
1. The requested modification requires editing files outside the target module boundary.
2. Adding an unapproved external package or dependency is required.
3. Two consecutive fix attempts fail to resolve a compiler or lint error (thrashing prevention).
4. An unexpected security vulnerability, credential requirement, or boundary conflict is encountered.
