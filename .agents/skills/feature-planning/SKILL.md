---
name: feature-planning
description: >-
  Plan new features, architectural modifications, or module enhancements for RepoDoctor.
  Activated when a task requires design evaluation, multi-file changes, or risk assessment.
---

# Feature Planning Skill

> **Skill Purpose:** Guide AI agents in systematically discovering context, formulating structured implementation plans, evaluating risk tiers, and securing explicit human approval before touching code.

---

## 1. When to Activate This Skill

Activate this skill when:
- Designing a new feature or capability across any of RepoDoctor's modules.
- Proposing significant refactoring or internal structural changes.
- Preparing for any Tier 1 (High Risk) or Tier 2 (Medium Risk) engineering activity.

Do **NOT** activate for simple localized bug fixes or low-risk typos within an already approved plan (use `module-implementation` directly).

---

## 2. Dynamic Environment Discovery Pre-Check

Before drafting any plan, discover the actual repository state:
1. **Inspect Active Phase & Scaffolding State:**
   - Check if package manifests (`package.json`), workspace definitions, or build tools exist in the workspace.
   - Do **NOT** assume frameworks, scripts (`npm test`, `npm run build`), or databases are active unless verified via file tools.
2. **Review Governing Documents:**
   - Read [AGENTS.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/AGENTS.md).
   - Read applicable rules in [.agents/rules/](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/.agents/rules/).
   - Read the target module specification in [docs/modules/](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/modules/).
   - Check [docs/project/system_architecture.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/project/system_architecture.md) and [docs/project/tech_stack_decisions.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/project/tech_stack_decisions.md).

---

## 3. Plan-vs-Execution Approval Protocol

> [!CAUTION]
> **Plan Approval is NOT Execution Permission:**  
> The mere existence or creation of an `implementation_plan.md` file does **NEVER** grant autonomous permission to apply changes.  
> You must distinguish between:
> 1. **Plan Review:** Presenting the plan for human feedback and refinement.
> 2. **Explicit Execution Approval Gate:** Waiting for the human engineer to explicitly command execution (e.g. *"Approved — proceed to implementation"*).

### Risk Tier Evaluation:
- **Tier 1 (High Risk - Red Line):** Product scope changes, core architectural changes, security or auth modifications, modifying human-owned files (`AGENTS.md`, `rules/security.md`, `docs/project/*.md`, accepted ADRs), breaking API/DB schema changes, adding major dependencies.  
  *Action:* **Hard stop.** Propose an ADR or architectural plan. Do NOT apply changes without explicit human approval.
- **Tier 2 (Medium Risk - Yellow Line):** New features within approved scope, significant internal refactoring, non-breaking API additions.  
  *Action:* Formulate `implementation_plan.md`. **Stop and await explicit execution approval.**
- **Tier 3 (Low Risk - Green Line):** Bug fixes matching approved requirements, test writing, formatting, typo fixes, or AI-owned doc updates (`implementation_plan.md`, `walkthrough.md`, module progress checklists).  
  *Action:* Autonomous execution permitted within approved scope.

---

## 4. Step-by-Step Procedure

1. **Context Ingestion:** Execute the standard 6-step context discovery sequence defined in `AGENTS.md` Section 5.
2. **Draft `implementation_plan.md`:**
   - Structure with: User Review Required, Open Questions, Proposed Changes by Component, and Verification Plan.
   - Highlight any security, boundary, or data-integrity invariants affected (e.g., Exactly-One-Target Evidence Invariant).
3. **Audit Against Non-Goals:** Verify that proposed changes do not violate module non-goals or introduce unapproved external dependencies.
4. **Publish Plan Artifact:** Save to the artifact directory and set `RequestFeedback: true` and `UserFacing: true`.
5. **Halt Execution:** Stop and invite human review. Do **NOT** proceed to code changes.

---

## 5. Explicit Stop-and-Ask Conditions

Immediately pause and request human guidance if:
1. Requirements contradict existing project architecture or product vision.
2. The change proposes modifying human-owned files without an explicit instruction.
3. The change requires an unapproved dependency, ORM, package manager, or external service.
4. An edge case or security risk is discovered that was not anticipated in the initial plan.
