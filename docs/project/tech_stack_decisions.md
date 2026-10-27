# Approved Technology Stack Decisions — RepoDoctor

> **Approval Status:** **Core Stack APPROVED by Human on 2026-10-12**  
> **Authority:** Canonical Architectural Baseline  
> **Modification Policy:** Immutable without formal ADR and explicit human approval.

---

## 1. Confirmed Technology Matrix

### 1.1 Explicitly Approved Core Stack (Locked via ADR-0001)
```
┌──────────────────────────────┬──────────────────────────────┬────────────────────────────────────────────────┐
│ Layer                        │ Technology Choice            │ Approval Status                                │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Frontend UI                  │ Next.js (App Router),        │ APPROVED (2026-10-12)                          │
│                              │ TypeScript, Tailwind CSS,    │                                                │
│                              │ React Flow                   │                                                │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Backend API & Core Logic     │ NestJS (Node.js, TypeScript) │ APPROVED (2026-10-12)                          │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Primary Database             │ PostgreSQL 16+               │ APPROVED (2026-10-12)                          │
│                              │ with pgvector extension      │                                                │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Asynchronous Queue & Caching │ Redis 7+                     │ APPROVED (2026-10-12)                          │
│                              │ with BullMQ                  │                                                │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ External VCS Integration     │ GitHub App (Read-Only)       │ APPROVED (2026-10-12)                          │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────────────────────┘
```

### 1.2 Proposed Tooling & Implementation Choices (Pending Approval in Phase 3)
```
┌──────────────────────────────┬──────────────────────────────┬────────────────────────────────────────────────┐
│ Component                    │ Proposed Technology          │ Current Status                                 │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Monorepo Workspace Tooling   │ pnpm Workspaces              │ PROPOSED (Pending separate review in Phase 3)  │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ ORM / Database Client        │ Drizzle ORM or Prisma        │ PROPOSED (Pending schema design in Phase 3)    │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Test Framework               │ Jest or Vitest               │ PROPOSED (Pending testing setup in Phase 3)    │
├──────────────────────────────┼──────────────────────────────┼────────────────────────────────────────────────┤
│ Embedding Model              │ TBD (768-dim or 1536-dim)    │ PROPOSED (Pending model selection in Phase 3)  │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────────────────────┘
```

---

## 2. Technical Rationales & Evaluated Alternatives

### 2.1 Frontend: Next.js + React Flow
- **Decision:** Next.js with App Router, TypeScript, Tailwind CSS, and React Flow.
- **Why Chosen:**
  - Provides unified routing, server-rendered shells, and Backend-for-Frontend (BFF) API route proxying.
  - React Flow is the gold standard for node-edge DAG canvases, supporting custom node rendering (service cards, queue badges) and interactive edge tracing.
- **Alternative Evaluated & Rejected:**
  - *Pure React (Vite SPA):* Lacks built-in BFF capabilities and server-side layout management; requires separate routing and proxy configuration.

### 2.2 Backend: NestJS
- **Decision:** NestJS framework with TypeScript.
- **Why Chosen:**
  - Opinionated enterprise structure (`@Module`, `@Injectable`, `@Controller`) enforces clean boundaries between our 5 modules.
  - Native dependency injection simplifies mocking for tests.
  - Official, robust `@nestjs/bullmq` integration for asynchronous repository processing.
  - Built-in Swagger/OpenAPI documentation generation keeps frontend and backend contracts synchronized during rapid hackathon iteration.
- **Alternative Evaluated & Rejected:**
  - *Raw Express/Fastify:* Lacks dependency injection and architectural structure, leading to inconsistent module boundaries during multi-agent development.

### 2.3 Primary Database: PostgreSQL + `pgvector`
- **Decision:** PostgreSQL with `pgvector` for graph topology, evidence, and embeddings.
- **Why Chosen:**
  - **Recursive CTEs:** Graph traversal and blast-radius path calculation (`WITH RECURSIVE downstream AS (...)`) execute natively without requiring a separate graph database engine.
  - **Performance Target:** Sub-50ms graph traversal latency for 1,000-node graphs (hypothesis to be empirically benchmarked during implementation).
  - **Relational Evidence Integrity:** Foreign key constraints prevent orphaned edges or dangling code citations.
  - **Unified Vector Search:** Vector embeddings for code and doc chunks live in the same PostgreSQL database via `pgvector` (embedding dimension to be determined upon embedding model selection).
  - **JSONB Flexibility:** Flexible storage of arbitrary manifest and AST metadata without losing relational structure.
- **Alternatives Evaluated & Rejected:**
  - *MongoDB:* Lacks native recursive CTEs; `$graphLookup` has strict 100MB memory limits and poor cycle detection; Atlas Vector Search cannot be run offline in local Docker.
  - *Neo4j:* Adds heavy operational overhead, dual-database transaction management, and complex local Docker requirements for a hackathon.

### 2.4 Caching & Queuing: Redis + BullMQ
- **Decision:** Redis paired with BullMQ.
- **Why Chosen:**
  - Ingesting multi-repo trees, parsing ASTs, and computing embeddings are heavy async tasks that must never block HTTP requests.
  - BullMQ provides reliable retry logic, concurrency limits, and live job progress tracking (e.g., `Progress: 60%`).
  - Redis provides fast response caching for full graph topology payloads and GitHub API E-Tags.
- **Alternative Evaluated & Rejected:**
  - *Typesense:* Introduces a dual-write sync problem with PostgreSQL. PostgreSQL's built-in full-text search (`tsvector`) combined with `pgvector` provides hybrid search in a single database, eliminating the need for Typesense.

---

## 3. Strict Modification Rule

> [!CAUTION]
> The explicitly approved core stack is locked. AI agents are **forbidden** from introducing alternative databases, state libraries, or backend frameworks without an approved Architecture Decision Record (ADR) and explicit human sign-off.
