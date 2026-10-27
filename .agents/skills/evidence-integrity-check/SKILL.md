---
name: evidence-integrity-check
description: >-
  Audit and enforce evidence data-integrity invariants, provenance citations, and grounding rules.
  Activated when modifying graph models, database schemas, analyzer extractors, or LLM citation builders.
---

# Evidence Integrity & Grounding Skill

> **Skill Purpose:** Ensure that every discovered system component and dependency is strictly backed by verifiable code evidence, that the database Exactly-One-Target Invariant is preserved, and that inferred relationships are never presented as verified facts.

---

## 1. When to Activate This Skill

Activate this skill whenever:
- Modifying evidence generation in `analyzer`.
- Authoring or migrating graph schemas in `graph-engine`.
- Designing or auditing citation grounding in `intelligence-api`.
- Implementing or updating database constraints (`chk_evidence_single_target`).

---

## 2. Dynamic Environment Discovery Pre-Check

Before auditing or writing evidence-related code:
1. **Inspect Module Contracts:**
   - Read [docs/modules/analyzer/MODULE.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/modules/analyzer/MODULE.md) and [docs/modules/graph-engine/MODULE.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/modules/graph-engine/MODULE.md).
2. **Review Governing Invariants:**
   - Review Section 2.1 in [docs/project/system_architecture.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/docs/project/system_architecture.md).
   - Review Section 3 in [.agents/rules/architecture.md](file:///home/fiftyfive/Documents/FiftyFive%20Technology/RepoDoctor/.agents/rules/architecture.md).

---

## 3. Core Evidence Integrity Invariants

### 3.1 Exactly-One-Target Invariant (Database Level)
Every record in the `evidence` table must reference **exactly one target**:
```sql
CHECK (
    (node_id IS NOT NULL AND edge_id IS NULL) OR
    (node_id IS NULL AND edge_id IS NOT NULL)
)
```
- **Node Evidence:** Links strictly to `node_id`. Proves component existence (manifests, configs).
- **Edge Evidence:** Links strictly to `edge_id`. Proves directional dependencies (imports, API calls).
- **Dual-Link or Zero-Link is Forbidden:** Linking to both or neither target is strictly invalid.

### 3.2 Observed Facts vs. Inferred Relationships
- **Evidence-Backed Observed Facts:** `confidence = 1.0`, `isInferred = false`. Deterministic relationships with verifiable code citations.
- **Inferred Relationships:** `confidence < 1.0`, `isInferred = true`. Probabilistic hypotheses (shared event names, naming conventions). **Must be labeled with confidence and NEVER presented as verified facts.**

### 3.3 Evidence Citation Completeness
Every `EvidenceDto` must include:
- `repositoryId` (UUID)
- `filePath` (relative repository path)
- `lineStart` and `lineEnd` (`lineStart <= lineEnd`)
- `codeSnippet` (verbatim code slice)
- `commitSha` (immutable Git commit hash)

---

## 4. Step-by-Step Procedure

1. **Schema Check:** Verify that database schema migrations include the `chk_evidence_single_target` check constraint.
2. **Extractor Logic Audit:** Inspect AST and manifest extractor logic in `analyzer` to verify that `EvidenceDto` objects populate exactly one target ID.
3. **Fact-vs-Inference Classification:** Ensure edges created from manifests or explicit imports have `isInferred: false` and `confidence: 1.0`, while heuristic edges have `isInferred: true` and `confidence < 1.0`.
4. **LLM Citation Grounding Audit:** Verify that `intelligence-api` answer generators only cite active `evidence_id` records in `graph-engine`, disallowing hallucinated citations.
5. **Execute Unit Tests:** Run test cases asserting constraint enforcement on synthetic invalid payloads (both targets set, neither target set).

---

## 5. Explicit Stop-and-Ask Conditions

Immediately pause and request human guidance if:
1. A schema migration or query builder bypasses or relaxes the `chk_evidence_single_target` constraint.
2. A requirement asks to infer a relationship without providing an explicit confidence score and `isInferred: true` flag.
3. Ingested code contains ambiguous or conflicting citations that cannot be mapped to a single node or edge.
