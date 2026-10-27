---
name: documentation-rules
description: Documentation ownership boundaries, zero-drift maintenance policy, and Architecture Decision Record (ADR) protocols.
trigger: glob
globs: "docs/**, **/*.md"
---

# Documentation Maintenance & Architecture Decision Rules

> **Scope:** Repository documentation, ownership boundaries, and Architecture Decision Records (ADRs).  
> **Precedence:** Level 3 (Documentation & Record Keeping Standards — Subordinate to Level 1 Security and Level 2 In-Session Prompts)

---

## 1. Documentation Ownership & Integrity

- **Strict Ownership Boundaries:**
  - **Human-Owned (Immutable by AI without explicit approval):**
    - `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`
    - `.agents/rules/security.md` and `.agents/rules/agent_behavior.md`
    - `docs/project/product_vision.md`
    - `docs/project/system_architecture.md`
    - `docs/project/tech_stack_decisions.md`
    - `docs/project/governance_and_precedence.md`
    - Approved Architecture Decision Records (`docs/adr/XXXX-*.md`)
    - *Policy:* AI agents may propose revisions, drafts, or diffs for human-owned files, but **must never apply modifications autonomously**. All edits to human-owned files require explicit human review and sign-off.
  - **Jointly-Maintained (Planned for Phase 2):**
    - `docs/modules/*/MODULE.md` (Planned for Phase 2: AI may autonomously update progress checklists, test counts, and internal notes within approved scope; human approves contract changes).
    - `docs/project/roadmap.md` (Planned for Phase 2: AI marks verified items done; human adds scope).
  - **AI-Owned (Ephemeral / Per-Task):**
    - `implementation_plan.md`
    - `walkthrough.md`
    - *Policy:* Autonomous low-risk documentation maintenance is permitted exclusively for explicitly AI-owned files or within approved module progress sections.
- **Zero-Drift Policy:**
  - If a code change alters a module's public interface, parameters, or data model, the corresponding module documentation file must be updated in the exact same task.
  - An implementation is considered incomplete if code and documentation diverge.

---

## 2. Architecture Decision Records (ADR) Protocol

- **When an ADR is Mandatory:**
  - An ADR must be drafted in `docs/adr/` whenever:
    1. A new external dependency, library, or infrastructure service is proposed.
    2. A fundamental architectural pattern is changed (e.g., changing state management or graph traversal strategy).
    3. An approved technical stack component is altered.
- **ADR Format & Lifecycle:**
  - Every ADR must follow `docs/adr/template.md`:
    - Title, Status (`PROPOSED`, `ACCEPTED`, `SUPERSEDED`, `REJECTED`), Date.
    - Context & Problem Statement.
    - Decision Drivers & Options Considered.
    - Chosen Decision & Rationale.
    - Consequences (Positive, Negative, Risks).
  - **Approval Requirement:** An ADR remains in `PROPOSED` status until a human explicitly reviews and changes the status to `ACCEPTED`. AI agents may draft ADRs, but never approve them autonomously.
