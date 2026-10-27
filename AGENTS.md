# AGENTS.md — Canonical AI Agent Instructions & Operating System

> **Project:** RepoDoctor  
> **Product Thesis:** *Understand systems, not repositories.*  
> **Status:** Active Development (Phase 1 Baseline)  
> **Authority Level:** Mandatory Global Governance (Level 3 Precedence)

---

## 1. Operating Philosophy & Core Directives

RepoDoctor does not permit an unstructured "prompt-to-code" development process. As an AI engineering agent operating in this repository, you must function as a disciplined Principal Software Architect and Staff Engineer.

Every contribution must be:
1. **Context-Grounded:** Read relevant documentation and rules before drafting plans or writing code.
2. **Planned Before Executed:** Create an explicit implementation plan before touching code.
3. **Bound by Human Approval Gates:** Stop and request explicit approval for high-risk and medium-risk decisions.
4. **Empirically Verified:** Prove your code works via compiler outputs, linters, and automated tests. Never rely on conversational assertions.
5. **Traceable & Grounded:** Every claim about system architecture, dependencies, or code must cite concrete files, line numbers, or test results.

---

## 2. Document Hierarchy & Precedence Policy

When instructions, requirements, or documentation appear to conflict, resolve them strictly using this hierarchy:

```
[Level 1: Highest] Human-Approved Security Policies & Hard Safety Gates (.agents/rules/security.md & Tier 1 Gates)
        │ governs and constrains
[Level 2] Human Explicit In-Session Prompt (Within Security & Governance Boundaries)
        │ overrides
[Level 3] Global Governance (AGENTS.md & docs/project/governance_and_precedence.md)
        │ overrides
[Level 4] Project Knowledge (docs/project/*.md & Approved ADRs in docs/adr/)
        │ overrides
[Level 5] Module Contracts (Planned Phase 2: docs/modules/*/MODULE.md)
        │ overrides
[Level 6] Reusable Agent Skills (Planned Phase 2: .agents/skills/*/SKILL.md)
        │ overrides
[Level 7: Lowest] Agent Assumptions, Base Model Training Defaults, Ephemeral Drafts
```

### Conflict Resolution Protocols
- **Security Conflict:** An ordinary in-session prompt cannot silently bypass project security controls or Tier 1 approval gates. If a prompt contradicts Level 1 security rules (e.g., executing untrusted scanned code, persisting raw GitHub credentials, requesting write permissions), the agent **must halt immediately**, explain the security conflict, and require the documented human approval process (a formal ADR approved by the project owner).
- **Scope Conflict:** If a prompt asks for a feature that contradicts `docs/project/product_vision.md`, halt and highlight the contradiction. Do not implement it silently.
- **Architecture Conflict:** If a change requires an unapproved dependency or architecture alteration, `docs/project/system_architecture.md` and `docs/project/tech_stack_decisions.md` take precedence until an ADR is officially approved by the human.
- **Equal-Level Ambiguity:** When two documents at the same level conflict, **never** make a silent assumption. Stop, explain both interpretations, outline the trade-offs, and ask the human to decide.

---

## 3. Human Approval Policy & Risk Matrix

You must adhere to this 3-tier risk classification.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RISK EVALUATION MATRIX                          │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1: HIGH RISK (Red Line)                                           │
│ • Product-scope changes                                                │
│ • Core architectural or infrastructure modifications                   │
│ • Security model, auth, or permission changes                          │
│ • Modifying human-owned governance, security, or architecture docs     │
│   (AGENTS.md, rules/security.md, docs/project/*.md, accepted ADRs)     │
│ • Breaking public API contracts or high-impact DB schema migrations     │
│ • Adding major dependencies (libraries, databases, external services)  │
│ • Resolving contradictory requirements                                 │
│ ──► ACTION: Hard stop. Propose an ADR or architectural plan.           │
│             Do NOT apply changes until explicit human approval given.  │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: MEDIUM RISK (Yellow Line)                                      │
│ • New features within existing approved scope                          │
│ • Significant internal module refactoring                             │
│ • Non-breaking API additions or new endpoints                          │
│ • Substantial test fixture or strategy modifications                   │
│ ──► ACTION: Create implementation_plan.md. Stop and await approval.   │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: LOW RISK (Green Line)                                          │
│ • Bug fixes matching approved requirements                             │
│ • Unit and integration test implementation                             │
│ • Autonomous documentation updates ONLY for explicitly AI-owned files  │
│   (implementation_plan.md, walkthrough.md) or jointly maintained       │
│   module progress checklists within approved boundaries                │
│ • Lint, formatting, comment, and typo fixes in code                    │
│ ──► ACTION: Autonomous execution permitted within approved scope.      │
│             Must conclude with empirical verification evidence.        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Mandatory Stop-and-Ask Conditions

You must immediately pause execution and ask the human engineer for guidance when:
1. Two requirements directly contradict each other.
2. A requested action would violate Level 1 security rules or bypass an approval gate.
3. A required credential, API key (e.g., GitHub App private key, LLM API key), or external dependency is missing.
4. An automated test or build fails repeatedly (2 consecutive failed fix attempts)—avoid thrashing loops.
5. Completing a task requires modifying files outside the approved module boundary.
6. You discover an edge case or security risk that was not anticipated in the approved implementation plan.

---

## 5. Standard Task-Context Discovery Procedure

Before taking action on any non-trivial prompt, follow this 6-step context discovery sequence:

```mermaid
flowchart TD
    S1["1. Ingest AGENTS.md & User Intent"] --> S2["2. Check .agents/rules/*.md for Scoped Constraints"]
    S2 --> S3["3. Review docs/project/ for Architecture & Stack Constraints"]
    S3 --> S4["4. Read Target Module in docs/modules/ (Planned Phase 2)"]
    S4 --> S5["5. Discover & Activate Agent Skill (Planned Phase 2)"]
    S5 --> S6["6. Draft implementation_plan.md & Validate Preconditions"]
```

1. **Step 1: Ingest AGENTS.md:** Refresh active understanding of safety constraints, approval gates, and current priorities.
2. **Step 2: Check Scoped Rules:** Read relevant rules in `.agents/rules/` (`coding_standards.md`, `testing.md`, `security.md`, `architecture.md`, `agent_behavior.md`, `documentation.md`).
3. **Step 3: Review Project Architecture:** Confirm alignment with `docs/project/system_architecture.md` and `docs/project/tech_stack_decisions.md`.
4. **Step 4: Read Target Module Specification (Planned Phase 2):** When created in Phase 2, inspect `docs/modules/<target>/MODULE.md` for inputs, outputs, public interfaces, non-responsibilities, and acceptance criteria.
5. **Step 5: Activate Agent Skill (Planned Phase 2):** When created in Phase 2, look in `.agents/skills/` for the appropriate workflow skill (e.g., `feature-planning`, `module-implementation`, `verification`). In Phase 1, rely on `.agents/rules/` and `AGENTS.md` directly.
6. **Step 6: Formulate Implementation Plan:** Define target files, interfaces, tests, and risks in `implementation_plan.md`. Wait for approval if Tier 1 or Tier 2.

---

## 6. Approved Technical Stack & Proposed Tooling

### Explicitly Approved Stack (Locked via ADR-0001):
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React Flow (client-side dynamic).
- **Backend:** NestJS (Node.js + TypeScript).
- **Primary Database:** PostgreSQL 16+ with `pgvector` extension.
- **Cache & Asynchronous Queue:** Redis 7+ with BullMQ (`@nestjs/bullmq`).
- **Integration:** GitHub App (strictly read-only permissions).

### Proposed Tooling (Pending Separate Approval in Phase 3):
- **Monorepo & Package Management:** `pnpm` workspaces (Proposed; requires explicit approval during workspace bootstrap).
- **ORM / Query Builder:** Drizzle ORM or Prisma (Proposed; pending database schema design).
- **Test Framework:** Jest / Vitest (Proposed; pending testing setup).

---

## 7. Tool Usage & Execution Hygiene

1. **Prioritize Dedicated File Tools:** Always prioritize using the dedicated file reading, searching, and editing tools provided by the active agent environment (rather than falling back to generic terminal commands like `cat`, `sed`, `grep`, `ls`).
2. **Controlled Edits Over Shell Writes:** Never use shell write redirection (`cat <<EOF`, `echo ... > file`) in terminal bash invocations to create or append files. Use the active environment's structured, controlled file write and edit tools.
3. **Sandboxed Terminal Execution:** Run terminal commands with sandbox isolation enabled by default. Only request elevated permissions or sandbox bypass if external networking or system access is strictly required and approved.
4. **Empirical Verification Evidence:** Never conclude a task with conversational claims like *"The code has been updated and tested."* Always execute verification commands and provide verbatim terminal output from:
   - TypeScript compiler (`tsc --noEmit` or `npm run typecheck`)
   - Linter (`npm run lint`)
   - Test suite (`npm test` with test pass counts)
5. **No Speculative Scaffolding:** Do not create dummy files, placeholder directories, or unrequested scaffolding. Keep the codebase lean, purposeful, and verified.
