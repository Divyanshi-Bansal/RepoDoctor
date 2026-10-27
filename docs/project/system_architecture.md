# System Architecture & Component Design — RepoDoctor

> **Authority:** Canonical Architectural Baseline  
> **Precedence:** Level 4 (Governs all module implementations and interfaces)

---

## 1. High-Level System Architecture

RepoDoctor is structured around a unidirectional pipeline that transforms raw multi-repository code and manifests into an evidence-backed system intelligence graph.

> [!NOTE]
> Detailed interface contracts for each module will be defined in `docs/modules/*/MODULE.md` during Phase 2.

```mermaid
flowchart TD
    subgraph IngestionBoundary ["Module 1: ingestion (Planned Phase 2 Spec)"]
        GH[GitHub API / GitHub App] -->|Tree & File Blobs| IngestSvc[Ingestion Service]
        IngestSvc -->|Job Enqueue| RedisQueue[(BullMQ / Redis)]
    end

    subgraph AnalyzerBoundary ["Module 2: analyzer (Planned Phase 2 Spec)"]
        RedisQueue -->|Async Job| Worker[Analysis Worker]
        Worker --> ManifestParser[Manifest & Config Parser]
        Worker --> ASTParser[Static AST Extractor]
        ManifestParser --> Extractor[Relationship & Evidence Extractor]
        ASTParser --> Extractor
    end

    subgraph GraphBoundary ["Module 3: graph-engine (Planned Phase 2 Spec)"]
        Extractor -->|Nodes, Edges, Citations| GraphSvc[Graph Engine Service]
        GraphSvc <--> Postgres[(PostgreSQL 16 + pgvector)]
    end

    subgraph IntelligenceBoundary ["Module 4: intelligence-api (Planned Phase 2 Spec)"]
        Postgres <--> HybridRetrieval[Hybrid Search: Graph + Vector]
        HybridRetrieval --> LLMOrchestrator[LLM Grounding & Citation Engine]
        LLMOrchestrator --> RestAPI[NestJS REST & SSE Endpoints]
    end

    subgraph ClientBoundary ["Module 5: web-client (Planned Phase 2 Spec)"]
        RestAPI --> NextApp[Next.js App Router]
        NextApp --> ReactFlowCanvas[React Flow System Canvas]
        NextApp --> ChatDrawer[Architecture Chat & Evidence Viewer]
    end
```

---

## 2. Core Relational Data Model (PostgreSQL + pgvector)

The graph is persisted relationally with foreign-key constraints to guarantee integrity across re-indexing operations. Every node and every edge is backed by verifiable line citations in code or manifests:

```mermaid
erDiagram
    REPOSITORIES ||--o{ SYSTEM_NODES : owns
    REPOSITORIES ||--o{ EVIDENCE : provides
    SYSTEM_NODES ||--o{ SYSTEM_EDGES : "source / target"
    SYSTEM_NODES ||--o{ EVIDENCE : "backed by"
    SYSTEM_EDGES ||--o{ EVIDENCE : "backed by"
    SYSTEM_NODES ||--o{ CODE_EMBEDDINGS : indexed_in

    REPOSITORIES {
        uuid id PK
        string github_org
        string name
        string default_branch
        string last_commit_sha
        timestamp updated_at
    }

    SYSTEM_NODES {
        uuid id PK
        uuid repository_id FK
        string node_type "SERVICE | DATABASE | QUEUE | ENDPOINT | PACKAGE"
        string identifier "e.g. auth-service"
        string display_name
        jsonb metadata
        timestamp created_at
    }

    SYSTEM_EDGES {
        uuid id PK
        uuid source_node_id FK
        uuid target_node_id FK
        string edge_type "CALLS | READS_FROM | WRITES_TO | CONSUMES | PRODUCES"
        float confidence "1.0 for deterministic, <1.0 for inferred"
        boolean is_inferred
        timestamp created_at
    }

    EVIDENCE {
        uuid id PK
        uuid node_id FK "nullable (linked if node evidence)"
        uuid edge_id FK "nullable (linked if edge evidence)"
        uuid repository_id FK
        string file_path
        int line_start
        int line_end
        text code_snippet
        string commit_sha
    }

    CODE_EMBEDDINGS {
        uuid id PK
        uuid node_id FK
        text content_chunk
        vector embedding "dimension TBD by model selection"
        jsonb metadata
    }
```

### 2.1 Evidence Integrity Invariant (Data-Integrity Rule)

To guarantee unambiguous provenance and prevent conflicting citations, every `evidence` record must satisfy this strict invariant:

> [!IMPORTANT]
> **Exactly-One-Target Invariant:**  
> Each evidence record must reference **exactly one target**: either a `system_node` OR a `system_edge`.  
> An evidence record must never link to both a node and an edge simultaneously, nor may it link to neither.

When the database schema is established during Phase 3, this invariant will be enforced via a PostgreSQL table check constraint:
```sql
ALTER TABLE evidence ADD CONSTRAINT chk_evidence_single_target
    CHECK (
        (node_id IS NOT NULL AND edge_id IS NULL) OR
        (node_id IS NULL AND edge_id IS NOT NULL)
    );
```
- **Node Evidence (`node_id IS NOT NULL`):** Proves the existence, configuration, and declaration of a system node (e.g. service manifest in `docker-compose.yml:L12-L28`, database connection string in `config.ts:L40-L45`).
- **Edge Evidence (`edge_id IS NOT NULL`):** Proves an active directional dependency or data flow between two nodes (e.g. an HTTP client call, message producer publish, or consumer handler).

---

## 3. Directional Blast-Radius Traversal (PostgreSQL Recursive CTE)

When a developer or AI agent asks for the impact of modifying a component, `graph-engine` executes a recursive traversal:

> [!TIP]
> **Performance Target:** Target sub-50ms graph traversal latency for 1,000-node systems. This is a design hypothesis to be validated through empirical benchmarks once test fixtures and Docker database containers are initialized.

```sql
WITH RECURSIVE blast_radius AS (
    -- Anchor member: immediate downstream dependents
    SELECT 
        e.id AS edge_id,
        e.source_node_id,
        e.target_node_id,
        e.edge_type,
        e.confidence,
        1 AS depth,
        ARRAY[e.source_node_id, e.target_node_id] AS path
    FROM system_edges e
    WHERE e.source_node_id = :targetNodeId

    UNION ALL

    -- Recursive member: follow outgoing edges with cycle prevention
    SELECT 
        e.id AS edge_id,
        e.source_node_id,
        e.target_node_id,
        e.edge_type,
        e.confidence,
        b.depth + 1,
        b.path || e.target_node_id
    FROM system_edges e
    JOIN blast_radius b ON e.source_node_id = b.target_node_id
    WHERE NOT (e.target_node_id = ANY(b.path)) -- Cycle prevention
      AND b.depth < 10                         -- Max traversal depth
)
SELECT 
    b.*, 
    n.display_name AS target_node_name, 
    n.node_type AS target_node_type
FROM blast_radius b
JOIN system_nodes n ON b.target_node_id = n.id
ORDER BY b.depth ASC;
```

---

## 4. Hybrid Search & Grounded Retrieval Flow

To answer architectural questions (*"How does user signup communicate with the email notification system?"*):
1. **Semantic Search (`pgvector`):** Vector similarity search identifies relevant nodes, endpoints, and code chunks. (Embedding model and vector dimensions to be finalized upon model selection).
2. **Relational Subgraph Expansion:** Using the top-k matched nodes, the graph engine retrieves immediate neighbors (1-hop or 2-hop edges) and associated evidence.
3. **Prompt Construction:** The retrieved subgraph topology and code citations are packaged into an evidence context block for the LLM.
4. **Citation Enforcement:** The response generator parses the LLM output and validates that every cited relation maps to an active record in `system_edges` and `evidence`. Any ungrounded claim is stripped or flagged with a warning badge.
