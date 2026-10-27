# RepoDoctor

> **Product Thesis:** *Understand systems, not repositories.*

RepoDoctor is an AI-native engineering intelligence platform that ingests multi-repository software systems, detects services, databases, queues, and APIs, reconstructs a verified system dependency graph, and provides natural-language architecture intelligence and change-impact analysis.

---

## 🏛️ Development Environment & AI Agent Governance

RepoDoctor uses a structured, AI-native engineering process to guarantee architectural integrity, security, and empirical verification.

- **Global Agent Instructions:** [AGENTS.md](./AGENTS.md)
- **Scoped Agent Rules:** [.agents/rules/](./.agents/rules/)
  - [Architecture Rules](./.agents/rules/architecture.md)
  - [Coding Standards](./.agents/rules/coding_standards.md)
  - [Security Rules](./.agents/rules/security.md)
  - [Testing Rules](./.agents/rules/testing.md)
  - [Documentation Rules](./.agents/rules/documentation.md)
  - [Agent Behavior Rules](./.agents/rules/agent_behavior.md)
- **Project Knowledge Base:** [docs/project/](./docs/project/)
  - [Product Vision & Scope](./docs/project/product_vision.md)
  - [Approved Tech Stack Decisions](./docs/project/tech_stack_decisions.md)
  - [System Architecture Specification](./docs/project/system_architecture.md)
  - [Governance & Precedence Matrix](./docs/project/governance_and_precedence.md)
- **Architecture Decision Records:** [docs/adr/](./docs/adr/)
  - [ADR-0001: Core Technology Stack Selection](./docs/adr/0001-record-architecture-decisions.md)

---

## 🛠️ Confirmed Technical Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React Flow
- **Backend:** NestJS (Node.js, TypeScript)
- **Database:** PostgreSQL 16+ with `pgvector`
- **Cache & Queue:** Redis 7+ with BullMQ
- **VCS Integration:** GitHub App (Read-Only)

---

## 🚦 Human Approval Policy

All agent operations are governed by a **3-Tier Risk Model**:
- **Tier 1 (High Risk):** Architecture, product scope, security model, and infrastructure changes require **explicit human approval** before code is written.
- **Tier 2 (Medium Risk):** New features and internal refactorings require an approved `implementation_plan.md` before execution.
- **Tier 3 (Low Risk):** Bug fixes and test implementations proceed autonomously within approved scope and conclude with empirical verification evidence.
