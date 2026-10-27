# [ADR-0001] Core Technology Stack Selection for RepoDoctor

- **Status:** ACCEPTED
- **Date:** 2026-10-12
- **Author:** Principal Software Architect
- **Deciders:** Human Engineer (Project Owner)
- **Consulted:** AI Agent Systems Designer

---

## 1. Context & Problem Statement
RepoDoctor is an AI-native engineering intelligence platform that ingests multi-repository software systems, extracts services, queues, and databases, builds an evidence-backed system graph, and provides natural-language architecture intelligence and change-impact analysis.

We need to establish a high-velocity, reliable, and maintainable technology stack for building RepoDoctor during a hackathon, balancing rapid development against architectural rigor.

---

## 2. Decision Drivers
- **Rapid Hackathon Velocity:** Must avoid over-complicated infrastructure that requires fragile multi-container orchestration.
- **Graph & Blast-Radius Traversal:** Must execute multi-hop downstream dependency traversals efficiently with cycle detection.
- **Unified Vector & Evidence Storage:** Avoid dual-write database synchronization bugs between search engines and the primary database.
- **Async Execution Safety:** Heavy multi-repo git operations and AST parsing must run in background queues without blocking HTTP requests.
- **Strict Modularity:** Enforce clean architectural boundaries across the 5 system modules.

---

## 3. Considered Options

### Frontend
- **Option 1A: Next.js (App Router) + TypeScript + Tailwind CSS + React Flow**
- **Option 1B: Pure React (Vite SPA) + React Flow**

### Backend
- **Option 2A: NestJS (Node.js + TypeScript)**
- **Option 2B: Raw Node.js with Express or Fastify**

### Primary Database
- **Option 3A: PostgreSQL 16+ with `pgvector`**
- **Option 3B: MongoDB (Atlas)**
- **Option 3C: Dedicated Graph Database (Neo4j)**

### Caching & Background Processing
- **Option 4A: Redis with BullMQ**
- **Option 4B: In-Process Asynchronous Tasks (no queue)**
- **Option 4C: Typesense + In-Process Queue**

---

## 4. Decision Outcome
Explicitly approved decisions:
1. **Frontend:** **Next.js (App Router)** with **TypeScript**, **Tailwind CSS**, and **React Flow** (client-side dynamic).
2. **Backend:** **NestJS** for structured modularity, dependency injection, and BullMQ integration.
3. **Database:** **PostgreSQL 16+ with `pgvector`** for relational integrity, recursive CTE graph traversals, and local vector search in a single database container.
4. **Cache & Queue:** **Redis 7+ with BullMQ** for reliable background ingestion and analysis jobs, avoiding Typesense to eliminate dual-write sync bugs.

> [!NOTE]
> Tooling choices such as package manager (`pnpm`), ORM (`Drizzle` vs `Prisma`), test runner (`Jest` vs `Vitest`), and specific embedding model dimensions remain proposed and subject to separate review during Phase 3.

---

## 5. Rationale & Consequences

### Positive Consequences
- **Single Database for Graph, Relational & Vectors:** Storing nodes, edges, citations, and vector embeddings in PostgreSQL eliminates the need for Neo4j, MongoDB, or dedicated vector clouds.
- **Recursive CTEs for Blast Radius:** Downstream impact paths are calculated natively in PostgreSQL via recursive queries with a target latency of `< 50ms` for 1,000-node graphs (to be empirically validated).
- **Decoupled Heavy Jobs:** BullMQ prevents HTTP request timeouts when ingesting large git repositories or computing embeddings.
- **Enterprise Modularity:** NestJS modules map 1:1 to RepoDoctor's logical modules (`ingestion`, `analyzer`, `graph-engine`, `intelligence-api`), enabling clean testability.

### Negative Consequences / Trade-offs
- Requires running PostgreSQL (with `pgvector`) and Redis in local Docker containers during development.
- Next.js requires wrapping React Flow components with `'use client'` dynamic imports to avoid SSR hydration mismatches.

---

## 6. Implementation Notes & Modification Rule
- The confirmed core stack is locked. Any proposed modification to these 4 core components requires a formal superseding ADR and explicit human sign-off.
