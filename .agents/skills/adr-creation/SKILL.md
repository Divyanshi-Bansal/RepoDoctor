---
name: adr-creation
description: >-
  Draft, propose, and document Architecture Decision Records (ADRs) for RepoDoctor.
  Activated when proposing new dependencies, database schema migrations, or architecture pattern changes.
---

# Architecture Decision Record (ADR) Creation Skill

> **Skill Purpose:** Guide AI agents in authoring rigorous, objective Architecture Decision Records (ADRs) adhering to the standard template, evaluating trade-offs, and halting for mandatory human review.

---

## 1. When to Activate This Skill

Activate this skill whenever a proposed task involves:
- Adding a new external library, dependency, or third-party service.
- Changing an approved technology stack component (e.g. evaluating ORMs, test runners, or embedding models).
- Altering a fundamental architectural pattern (e.g. state management, graph traversal algorithm, ingestion pipeline).
- Performing high-impact database schema changes or migrations.

---

## 2. Dynamic Environment Discovery Pre-Check

Before authoring a new ADR:
1. **Inspect Existing ADR Directory (`docs/adr/`):**
   - List files in `docs/adr/` to identify the next sequential 4-digit number (e.g. `0002`).
   - Read [docs/adr/template.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/adr/template.md) for required structure.
   - Read accepted [docs/adr/0001-record-architecture-decisions.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/adr/0001-record-architecture-decisions.md) as a reference baseline.
2. **Review Governing Architecture:**
   - Read [docs/project/system_architecture.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/project/system_architecture.md) and [docs/project/tech_stack_decisions.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/project/tech_stack_decisions.md).

---

## 3. Human Approval Gate Policy

> [!IMPORTANT]
> **AI Proposes — Human Approves:**  
> AI agents are strictly forbidden from unilaterally setting an ADR status to `ACCEPTED`.  
> Every newly drafted ADR must begin in `PROPOSED` status and remain there until the human project owner explicitly reviews, decides, and marks it `ACCEPTED`.

---

## 4. Step-by-Step Procedure

1. **Allocate Filename:** Determine next sequential filename: `docs/adr/XXXX-<short-descriptive-slug>.md` (e.g. `docs/adr/0002-select-orm-query-builder.md`).
2. **Draft Content Using Template:**
   - **Header:** Title, Status (`PROPOSED`), Date, Author (Agent role), Deciders (Human Project Owner).
   - **Context & Problem Statement:** Objective description of the engineering challenge.
   - **Decision Drivers:** Concrete evaluation criteria (e.g. velocity, type safety, performance, operational complexity).
   - **Considered Options:** Detail at least 2 viable options with explicit pros and cons.
   - **Proposed Decision & Rationale:** Clear, defensible recommendation grounded in RepoDoctor's constraints.
   - **Consequences:** Positive consequences, negative trade-offs, and mitigation strategies.
3. **Verify Neutrality & Grounding:** Ensure alternatives are fairly evaluated without speculative or exaggerated claims.
4. **Halt for Human Review:** Present the draft ADR to the human engineer and wait for explicit approval before implementing any code dependent on the decision.

---

## 5. Explicit Stop-and-Ask Conditions

Immediately pause and request human guidance if:
1. A proposed ADR conflicts with Level 1 hard security constraints in `.agents/rules/security.md`.
2. The decision driver requires proprietary external API access or unapproved third-party commercial services.
3. The human engineer requests changes or rejects the proposed ADR.
