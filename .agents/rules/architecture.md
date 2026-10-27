---
name: architecture-rules
description: System modularity, 5-module boundaries, layer separation, unidirectional data flows, and React Flow frontend architecture.
trigger: model_decision
---

# Architecture Rules & System Boundaries

> **Scope:** Repository-wide architectural patterns, boundaries, and dependencies.  
> **Precedence:** Level 2 (Architectural Constraints — Subordinate to Level 1 Security & Approval Gates)

---

## 1. Modular Boundary Enforcement

RepoDoctor is divided into five strictly bounded logical modules (to be formally specified in `docs/modules/` during Phase 2):
1. `ingestion` — GitHub App connection, repo cloning, file streaming, SHA hashing.
2. `analyzer` — Manifest parsing, deterministic relationship extraction, AST analysis, evidence citation generation.
3. `graph-engine` — PostgreSQL storage, schema migrations, Recursive CTE traversals, vector indexing.
4. `intelligence-api` — Hybrid retrieval, LLM query orchestration, change-impact calculation, citation grounding.
5. `web-client` — Next.js frontend, React Flow canvas, node inspectors, and chat UI.

### Boundary Constraints:
- **No Direct Cross-Module Database Access:** Only `graph-engine` writes to and directly queries the system graph tables. Other modules must interact via `GraphService` interfaces or clean API contracts.
- **Zero Circular Dependencies:** The dependency graph flows unidirectionally:
  ```
  web-client ──► intelligence-api ──► graph-engine ◄── analyzer ◄── ingestion
  ```
  Circular imports between modules or packages are forbidden and will fail CI.
- **Public Interface Encapsulation:** Modules must expose their capabilities through explicit TypeScript interfaces and DTOs. Internal helper functions, private repositories, and utilities must never be imported across package boundaries.

---

## 2. Backend Architecture (NestJS)

- **Layered Architecture:** Follow the standard NestJS layered pattern:
  - **Controllers:** Request routing, input validation (Pipes), HTTP status codes, and Swagger decorators only. No business logic.
  - **Services:** Pure domain logic, orchestration, and business rules.
  - **Repositories / Data Access:** Database persistence, query building, and transactions.
- **Dependency Injection:** All services and repositories must be registered via NestJS modules and injected through constructors. Do not instantiate service singletons manually with `new`.
- **Asynchronous Processing (BullMQ):**
  - Any task that involves cloning a repository, scanning more than 10 files, parsing ASTs, or calling external LLM APIs must be dispatched as a background job via BullMQ.
  - HTTP request-response cycles must return a job identifier (`jobId`) and status endpoint immediately rather than blocking.

---

## 3. Graph & Data Modeling Principles

- **Immutability of Evidence:**
  - Nodes, edges, and evidence are tied to a specific Git commit SHA.
  - Once extracted for a given commit SHA, graph nodes and evidence records are immutable. Re-indexing a newer commit produces a new graph version or delta.
- **Every Node and Edge Requires Evidence:**
  - Both detected system nodes (service definitions, database instances, queue topics, endpoints) and system edges (calls, reads, writes, produces, consumes) must be backed by verifiable Evidence records (file path, line start, line end, snippet, commit SHA).
  - Ungrounded nodes or edges cannot be rendered as verified system components.
- **Evidence Target Invariant (Exactly-One-Target):**
  - Every `evidence` record must reference exactly one target: either a system node (`node_id`) or a system edge (`edge_id`), never both and never neither (`(node_id IS NOT NULL AND edge_id IS NULL) OR (node_id IS NULL AND edge_id IS NOT NULL)`).
- **Separation of Deterministic vs. Inferred Edges:**
  - `confidence = 1.0`: Deterministic relationships (explicit imports, package manifests, Docker Compose links, env var bindings).
  - `confidence < 1.0`: Inferred or probabilistic relationships (semantic naming matches, LLM heuristics). Inferred edges must be explicitly flagged with `isInferred = true`.

---

## 4. Frontend Architecture (Next.js + React Flow)

- **Client vs. Server Components:**
  - React Flow nodes, edge renderers, canvas zoom/pan controllers, and chat drawers must be marked with `'use client'`.
  - Wrap React Flow components with dynamic client-only imports (`next/dynamic` with `ssr: false`) to eliminate SSR hydration mismatches.
  - Page layouts, initial metadata, and outer layout containers should remain Server Components where practical.
- **State Management:**
  - URL state is the source of truth for navigation (selected node, active view, search query).
  - Use lightweight client state (Zustand or React Context) only for canvas viewport state, side-drawer toggles, and active drag operations.
