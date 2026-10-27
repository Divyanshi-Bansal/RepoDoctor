/**
 * Initial schema migration for RepoDoctor.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HUMAN REVIEW REQUIRED BEFORE EXECUTION (per ADR-0002, AGENTS.md)   │
 * │ Review all DDL statements, especially:                              │
 * │  • chk_evidence_single_target CHECK constraint on evidence table    │
 * │  • vector(1536) column type on code_embeddings (requires pgvector)  │
 * │  • IVFFLAT index on embedding column (lists=100 requires ≥ 100 rows)│
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Applies:
 *  1. CREATE EXTENSION IF NOT EXISTS vector
 *  2. CREATE TABLE repositories
 *  3. CREATE TABLE system_nodes
 *  4. CREATE TABLE system_edges
 *  5. CREATE TABLE evidence  + chk_evidence_single_target CHECK constraint
 *  6. CREATE TABLE code_embeddings  + vector(1536) column
 *  7. IVFFLAT cosine index on code_embeddings.embedding
 *
 * Reverts in strict reverse dependency order.
 */
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1729000000000 implements MigrationInterface {
  public readonly name = 'InitialSchema1729000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. pgvector extension ──────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

    // ── 2. repositories ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "repositories" (
        "id"              uuid         NOT NULL DEFAULT gen_random_uuid(),
        "github_org"      varchar      NOT NULL,
        "name"            varchar      NOT NULL,
        "default_branch"  varchar      NOT NULL,
        "last_commit_sha" varchar,
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_repositories" PRIMARY KEY ("id")
      )
    `);

    // ── 3. system_nodes ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "system_nodes" (
        "id"            uuid         NOT NULL DEFAULT gen_random_uuid(),
        "repository_id" uuid         NOT NULL,
        "node_type"     varchar      NOT NULL,
        "identifier"    varchar      NOT NULL,
        "display_name"  varchar      NOT NULL,
        "metadata"      jsonb        NOT NULL DEFAULT '{}',
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_nodes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_system_nodes_repository"
          FOREIGN KEY ("repository_id")
          REFERENCES "repositories"("id")
          ON DELETE CASCADE
      )
    `);

    // ── 4. system_edges ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "system_edges" (
        "id"             uuid           NOT NULL DEFAULT gen_random_uuid(),
        "source_node_id" uuid           NOT NULL,
        "target_node_id" uuid           NOT NULL,
        "edge_type"      varchar        NOT NULL,
        "confidence"     NUMERIC(4, 3)  NOT NULL DEFAULT 1.000,
        "is_inferred"    boolean        NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_edges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_system_edges_source"
          FOREIGN KEY ("source_node_id")
          REFERENCES "system_nodes"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_system_edges_target"
          FOREIGN KEY ("target_node_id")
          REFERENCES "system_nodes"("id")
          ON DELETE CASCADE
      )
    `);

    // ── 5. evidence + Exactly-One-Target check constraint ─────────────
    //
    // chk_evidence_single_target enforces the Level 1 data integrity rule:
    //   each evidence row must reference EITHER a node OR an edge,
    //   never both, never neither.
    //
    // Equivalent to the @Check decorator on EvidenceEntity but authoritative
    // only here (synchronize: false means entity decorators do not create DDL).
    await queryRunner.query(`
      CREATE TABLE "evidence" (
        "id"            uuid     NOT NULL DEFAULT gen_random_uuid(),
        "node_id"       uuid,
        "edge_id"       uuid,
        "repository_id" uuid     NOT NULL,
        "file_path"     varchar  NOT NULL,
        "line_start"    integer  NOT NULL,
        "line_end"      integer  NOT NULL,
        "code_snippet"  text     NOT NULL,
        "commit_sha"    varchar  NOT NULL,
        CONSTRAINT "PK_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evidence_repository"
          FOREIGN KEY ("repository_id")
          REFERENCES "repositories"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_evidence_node"
          FOREIGN KEY ("node_id")
          REFERENCES "system_nodes"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_evidence_edge"
          FOREIGN KEY ("edge_id")
          REFERENCES "system_edges"("id")
          ON DELETE CASCADE,
        CONSTRAINT "chk_evidence_single_target" CHECK (
          (node_id IS NOT NULL AND edge_id IS NULL)
          OR
          (node_id IS NULL AND edge_id IS NOT NULL)
        )
      )
    `);

    // ── 6. code_embeddings ────────────────────────────────────────────
    //
    // vector(1536): placeholder dimension matching OpenAI text-embedding-ada-002
    // and text-embedding-3-small output size. Final model selection is deferred
    // to a future ADR (tech_stack_decisions.md §1.2 — embedding model TBD).
    await queryRunner.query(`
      CREATE TABLE "code_embeddings" (
        "id"            uuid    NOT NULL DEFAULT gen_random_uuid(),
        "node_id"       uuid    NOT NULL,
        "content_chunk" text    NOT NULL,
        "embedding"     vector(1536) NOT NULL,
        "metadata"      jsonb   NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_code_embeddings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_code_embeddings_node"
          FOREIGN KEY ("node_id")
          REFERENCES "system_nodes"("id")
          ON DELETE CASCADE
      )
    `);

    // ── 7. IVFFLAT index for cosine similarity search ─────────────────
    //
    // lists=100 is the pgvector recommended default for moderate dataset sizes.
    // IMPORTANT: IVFFLAT requires the table to have at least (lists * 3) = 300
    // rows before the index provides benefit. For Milestone 2 integration tests
    // the index creation itself is validated; query performance is benchmarked
    // in Milestone 6.
    await queryRunner.query(`
      CREATE INDEX "IDX_code_embeddings_embedding_cosine"
        ON "code_embeddings"
        USING ivfflat ("embedding" vector_cosine_ops)
        WITH (lists = 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_code_embeddings_embedding_cosine"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "code_embeddings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_edges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_nodes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "repositories"`);
  }
}
