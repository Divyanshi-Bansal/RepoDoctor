# Product Vision & Scope — RepoDoctor

> **Product Thesis:** *Understand systems, not repositories.*  
> **Authority:** Human-Owned Canonical Product Specification  
> **Precedence:** Level 4 (Governs all feature requirements and scope boundaries)

---

## 1. Executive Summary & Problem Space

Modern software systems are distributed across dozens of repositories, microservices, cloud infrastructure components, queues, and shared databases. However, developer tooling and AI coding assistants remain trapped in a single-repository silo.

When developers or AI agents operate within a single repository:
- They lack visibility into cross-repository API contracts and breaking schema changes.
- Downstream consumers of event topics or database tables are invisible.
- Calculating the blast radius of a proposed pull request requires tedious manual investigation across disparate codebases.
- Existing documentation (Confluence, Miro, draw.io) is stale from the day it is drawn.

**RepoDoctor solves this by building a live, evidence-backed system intelligence graph across multi-repository ecosystems.**

---

## 2. Core Capabilities

1. **GitHub Ingestion Engine:**
   - Connects to GitHub organizations via a read-only GitHub App.
   - Ingests repository metadata, dependency manifests, directory trees, and source files across multiple configured repositories.
2. **Deterministic & Inferred Component Detection:**
   - Detects services, HTTP endpoints, database connections, message queues, and shared packages.
   - Extracts relationships deterministically (manifest imports, Docker Compose networks, env var bindings).
   - Infers probabilistic relationships (naming conventions, shared event patterns) with explicit confidence scores.
3. **Evidence-Backed System Graph:**
   - Every node (service, DB, queue) and edge (calls, consumes, produces) is tied to verifiable code citations (file path, line start/end, commit SHA).
   - Zero ungrounded claims: if an edge cannot point to evidence, it cannot be rendered as a verified dependency.
4. **Interactive System Canvas:**
   - React Flow visualizer supporting multi-level zoom, node filtering by type, and drill-down into source citations.
5. **Natural-Language Architecture Intelligence:**
   - Hybrid retrieval combining graph traversals with vector search over code and documentation.
   - Answers complex questions (*"What happens if the auth service is down?"*) grounded in real source citations.
6. **Change-Impact Analysis:**
   - Traces directional downstream blast radiuses from a proposed pull request diff or schema change.

---

## 3. Scope Boundaries: Hackathon MVP vs. Future Scope

To ensure successful delivery within the hackathon timeframe, strict scope boundaries are enforced:

### In-Scope for Hackathon MVP:
- **Languages / Manifests:** TypeScript/JavaScript (`package.json`, TS source), Docker Compose files, and environment variable bindings.
- **Components:** Services, REST endpoints, PostgreSQL databases, and Redis/BullMQ message queues.
- **Graph Traversal:** Subgraph extraction and downstream blast-radius paths using PostgreSQL Recursive CTEs.
- **Visualization:** Single-canvas React Flow interface with node detail drawers and evidence viewers.
- **Querying:** Natural-language architecture Q&A powered by hybrid search (Postgres graph + `pgvector`).

### Explicitly Out-of-Scope for MVP (Deferred to Future):
- Deep AST parsing of Java, C#, Go, Rust, and Python codebases.
- Automatic pull request remediation or automated code generation across repos.
- Write actions back to GitHub (RepoDoctor is strictly read-only).
- Kubernetes live runtime state or OpenTelemetry distributed tracing ingestion (future enhancement).
- Multi-cloud infrastructure drift detection (Terraform live state).
