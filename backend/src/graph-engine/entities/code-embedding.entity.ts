/**
 * TypeORM entity for the `code_embeddings` table.
 *
 * Stores text chunk embeddings alongside model identity metadata.
 * The `embedding` column uses the native TypeORM 'vector' type backed by
 * the pgvector extension (confirmed supported in TypeORM 0.3.31+).
 *
 * Vector dimension is 1536, matching OpenAI text-embedding-ada-002 /
 * text-embedding-3-small output dimensions (placeholder; model finalised
 * in a later ADR per tech_stack_decisions.md).
 *
 * Security invariant: top-k similarity queries must enforce k <= 50.
 * See GraphQueryService.searchCodeEmbeddings().
 */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SystemNodeEntity } from './system-node.entity.js';

/** Dimension of the stored embedding vectors (placeholder, pending model ADR). */
export const EMBEDDING_DIMENSION = 1536;

@Entity('code_embeddings')
export class CodeEmbeddingEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  /** FK to the node whose source text this chunk was derived from. */
  @Column({ name: 'node_id', type: 'uuid' })
  nodeId!: string;

  @ManyToOne(() => SystemNodeEntity, (node) => node.embeddings, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'node_id' })
  node!: SystemNodeEntity;

  /** The raw text chunk that was embedded. */
  @Column({ name: 'content_chunk', type: 'text' })
  contentChunk!: string;

  /**
   * Dense float vector produced by the embedding model.
   * Stored as `vector(1536)` in PostgreSQL via the pgvector extension.
   * TypeORM serialises/deserialises this as a JavaScript number[].
   */
  @Column('vector', { length: EMBEDDING_DIMENSION })
  embedding!: number[];

  /**
   * Model identity and configuration metadata:
   *   { model_provider, model_name, embedding_config_revision, dimension }
   * Stored as JSONB; shape validated by consumers.
   */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
