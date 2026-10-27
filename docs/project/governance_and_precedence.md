# Governance, Ownership & Document Precedence — RepoDoctor

> **Authority:** Canonical Governance Standard  
> **Precedence:** Level 3 (Global Governance Policy)

---

## 1. Document Ownership Matrix

To maintain alignment and avoid instruction degradation, documentation ownership is strictly divided between Human Engineers and AI Agents:

```
┌────────────────────────────────────────┬───────────────┬─────────────────┬─────────────────┐
│ Document Category                      │ Primary Owner │ AI Can Propose? │ AI Autonomous?  │
├────────────────────────────────────────┼───────────────┼─────────────────┼─────────────────┤
│ AGENTS.md, GEMINI.md, CLAUDE.md        │ Human         │ Yes (via diff)  │ NO              │
│ .agents/rules/*.md                     │ Human         │ Yes             │ NO              │
│ docs/project/product_vision.md         │ Human         │ Yes             │ NO              │
│ docs/project/system_architecture.md    │ Human         │ Yes (via ADR)   │ NO              │
│ docs/project/tech_stack_decisions.md   │ Human         │ Yes (via ADR)   │ NO              │
│ docs/adr/XXXX-*.md (Accepted)          │ Human         │ Yes (as DRAFT)  │ NO              │
│ docs/project/roadmap.md (Phase 2)      │ Joint         │ Yes             │ YES (Check-off) │
│ docs/modules/*/MODULE.md (Phase 2)     │ Joint         │ Yes             │ YES (Progress)  │
│ implementation_plan.md                 │ AI Agent      │ Yes             │ NO (Wait Gate)  │
│ walkthrough.md                         │ AI Agent      │ Yes             │ YES (With logs) │
└────────────────────────────────────────┴───────────────┴─────────────────┴─────────────────┘
```

> [!IMPORTANT]
> **Human-Owned Files Modification Invariant:**  
> Human-owned governance files, security rules, architecture baselines, and accepted ADRs (`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.agents/rules/security.md`, `.agents/rules/agent_behavior.md`, `docs/project/*.md`, accepted `docs/adr/*.md`) **cannot be modified autonomously**.  
> The AI agent may propose changes, draft revisions, or generate diffs, but **must halt and wait for explicit human approval before applying any changes**. Autonomous documentation maintenance is permitted exclusively for explicitly AI-owned files (`implementation_plan.md`, `walkthrough.md`) or jointly maintained files (`roadmap.md`, `docs/modules/*/MODULE.md`) within approved boundaries.

---

## 2. 7-Level Precedence Hierarchy & Conflict Resolution

In the event of ambiguity, conflicting statements, or outdated files, agents must resolve disputes by adhering strictly to this 7-level hierarchy:

1. **Level 1 (Highest): Human-Approved Security Policies & Hard Safety Gates** — Defined in `.agents/rules/security.md` and Tier 1 Approval Gates. Cannot be bypassed or weakened by ordinary in-session prompts. Modifying security policies requires the documented human approval process (a formal ADR approved by the project owner).
2. **Level 2: Human Explicit In-Session Prompt (Within Security & Governance Boundaries)** — Direct real-time human instruction for feature prioritization and scope. Governs all non-security execution choices.
3. **Level 3: Global Governance** — `AGENTS.md` and this governance document.
4. **Level 4: Project Knowledge** — `docs/project/*.md` and approved ADRs in `docs/adr/`.
5. **Level 5: Module Contracts (Planned Phase 2)** — `docs/modules/*/MODULE.md`.
6. **Level 6: Reusable Agent Skills (Planned Phase 2)** — `.agents/skills/*/SKILL.md`.
7. **Level 7 (Lowest): Ephemeral State & Defaults** — Agent assumptions, base model defaults, or draft implementation plans.

### Conflict Resolution Protocols
- **Security Conflict:** An ordinary in-session prompt cannot silently bypass project security controls or Tier 1 approval gates. If a prompt contradicts Level 1 security rules, the agent **must halt immediately**, explain the conflict, and require the documented human approval process (a formal ADR approved by the project owner).
- **Scope Conflict:** If a prompt asks for a feature that contradicts `docs/project/product_vision.md`, halt and highlight the contradiction. Do not implement it silently.
- **Architecture Conflict:** If a change requires an unapproved dependency or architecture alteration, `docs/project/system_architecture.md` and `docs/project/tech_stack_decisions.md` take precedence until an ADR is officially approved by the human.
- **Equal-Level Ambiguity:** When two documents at the same level conflict, **never** make a silent assumption. Stop, explain both interpretations, outline the trade-offs, and ask the human to decide.

---

## 3. Mandatory Context Discovery Procedure

When beginning any non-trivial development activity, the agent must execute the following 6-step discovery traversal before drafting plans or writing code:

1. **Read `AGENTS.md`:** Review global directives, active focus areas, and safety constraints.
2. **Check `.agents/rules/`:** Identify path-scoped rules relevant to the task (e.g. `coding_standards.md`, `testing.md`, `security.md`, `architecture.md`, `agent_behavior.md`, `documentation.md`).
3. **Check `docs/project/`:** Verify that the proposed work aligns with `product_vision.md` and `system_architecture.md`.
4. **Locate Target Module in `docs/modules/` (Planned Phase 2):** When created in Phase 2, read the corresponding `MODULE.md` to identify public interfaces, dependencies, and boundary restrictions.
5. **Activate Matching Skill in `.agents/skills/` (Planned Phase 2):** When created in Phase 2, load the specific skill runbook into active context. In Phase 1, rely on `.agents/rules/` directly.
6. **Draft `implementation_plan.md`:** Formulate the plan, check for risks, and determine the appropriate risk tier gate.

---

## 4. Human Approval Matrix & Autonomous Boundaries

```
┌──────────────────┬──────────────────────────────────────────┬─────────────────────────────────┐
│ Risk Tier        │ Examples                                 │ Required Action                 │
├──────────────────┼──────────────────────────────────────────┼─────────────────────────────────┤
│ Tier 1: HIGH     │ • Product scope alterations              │ HARD STOP. Propose ADR or plan. │
│ (Red Line)       │ • Modifying core architecture or stack   │ Do NOT apply edits without      │
│                  │ • Security or token handling changes     │ explicit human sign-off.        │
│                  │ • Modifying human-owned governance,      │                                 │
│                  │   security, or architecture documents    │                                 │
│                  │ • Breaking DB migrations or API breaks   │                                 │
├──────────────────┼──────────────────────────────────────────┼─────────────────────────────────┤
│ Tier 2: MEDIUM   │ • New features within approved scope     │ Plan-First Stop. Create         │
│ (Yellow Line)    │ • Internal module refactoring            │ implementation_plan.md and      │
│                  │ • Adding new non-breaking endpoints      │ await approval before coding.   │
├──────────────────┼──────────────────────────────────────────┼─────────────────────────────────┤
│ Tier 3: LOW      │ • Bug fixes matching approved specs      │ Autonomous execution permitted. │
│ (Green Line)     │ • Writing unit/integration tests         │ Must provide empirical proof    │
│                  │ • Autonomous docs updates ONLY for AI-   │ in walkthrough.md.              │
│                  │   owned files or module progress tasks   │                                 │
│                  │ • Typo, comment, or lint fixes in code   │                                 │
└──────────────────┴──────────────────────────────────────────┴─────────────────────────────────┘
```
