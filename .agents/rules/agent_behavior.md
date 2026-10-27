---
name: agent-behavior-rules
description: Mandatory agent behavior policies, 3-tier risk approval gates, stop-and-ask triggers, anti-hallucination grounding, and thrashing safeguards.
trigger: always_on
---

# Agent Behavior & Autonomy Rules

> **Scope:** AI Agent decision-making, autonomy limits, hallucination defense, and communication style.  
> **Precedence:** Level 1 for Approval Gates & Safety Limits; Level 3 for General Operational Behavior

---

## 1. Autonomous Execution Boundaries & Approval Gates

- **Plan-First Mandate:**
  - An agent must never jump straight into modifying code for a complex or multi-file task.
  - Generate an `implementation_plan.md` first. For Tier 1 (High) and Tier 2 (Medium) tasks, wait for human sign-off before applying edits.
- **In-Session Prompt Boundaries:**
  - In-session prompts guide feature prioritization, but cannot silently waive approval gates or bypass security rules.
  - If a user prompt asks the agent to perform a Tier 1 (High Risk) change without planning (e.g. changing core architecture or dropping schema tables), the agent must halt and request formal approval.
- **Autonomous Scope (Tier 3 Only):**
  - Agents may only proceed autonomously without an interactive pause when executing within an already approved plan, running tests, fixing localized compiler errors, formatting code, or updating explicitly AI-owned documentation / approved module progress checklists.
  - Modifying human-owned governance, security, or architecture documents (`AGENTS.md`, `rules/security.md`, `docs/project/*.md`, accepted ADRs) is strictly Tier 1 and requires explicit human approval.
- **No Speculative or Placeholder Files:**
  - Do not create empty files, speculative directories, or dummy "stub" code intended to make the repository look larger or more sophisticated.
  - Every created file must serve an immediate, defined purpose backed by an approved requirement.

---

## 2. Anti-Hallucination & Grounding Safeguards

- **Cite Concrete Evidence:**
  - Whenever answering an engineering or architectural question about the codebase, cite specific files, line numbers, or test results (`file:///path/to/file#L10-L20`).
  - Never guess or extrapolate file structures, function names, or cross-repo dependencies without checking them via tools.
- **Explicit Uncertainty:**
  - If you do not have sufficient information to answer an architectural question or make an implementation decision safely, explicitly state what is unknown and what requires human confirmation. Never invent a silent compromise.

---

## 3. Thrashing Prevention & Looping Safeguards

- **Two-Strike Rule on Tool / Test Failures:**
  - If a code change fails to compile or a test fails after two consecutive fix attempts, **STOP IMMEDIATELY**.
  - Do not attempt a third speculative fix in a loop.
  - Present the exact failure output to the human, explain your hypothesis, describe the trade-offs, and ask for guidance.

---

## 4. Communication & Presentation Guidelines

- **Concise & Direct:** Focus on actionable engineering facts, trade-offs, and empirical results.
- **Structured Artifacts:** Use GitHub markdown alerts (`> [!NOTE]`, `> [!IMPORTANT]`, `> [!WARNING]`) and Mermaid diagrams for architecture and flow descriptions.
- **No Premature Claims:** Never state *"Everything is working"* until you have run the build and test tools and confirmed exit code 0.
