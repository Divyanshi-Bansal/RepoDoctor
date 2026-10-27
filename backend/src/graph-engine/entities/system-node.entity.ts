/**
 * TypeORM entity for the `system_nodes` table.
 * A system node represents a discovered architectural component (service, database, queue, etc.)
 * within a repository's system graph.
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RepositoryEntity } from './repository.entity.js';
import { SystemEdgeEntity } from './system-edge.entity.js';
import { EvidenceEntity } from './evidence.entity.js';
import { CodeEmbeddingEntity } from './code-embedding.entity.js';
import { NodeType } from './graph.enums.js';

@Entity('system_nodes')
export class SystemNodeEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  /** FK to the owning repository. Indexed for per-repository graph queries. */
  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @ManyToOne(() => RepositoryEntity, (repo) => repo.nodes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'repository_id' })
  repository!: RepositoryEntity;

  /** Discriminator for the component category. */
  @Column({ name: 'node_type', type: 'varchar', enum: NodeType })
  nodeType!: NodeType;

  /**
   * Unique stable identifier within the repository scope.
   * Examples: "auth-service", "pg-users-db", "order-events-topic".
   */
  @Column({ type: 'varchar' })
  identifier!: string;

  /** Human-readable label shown on the graph canvas. */
  @Column({ name: 'display_name', type: 'varchar' })
  displayName!: string;

  /**
   * Arbitrary manifest / AST metadata stored as JSONB.
   * Consumers must validate shape at read time.
   */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => SystemEdgeEntity, (edge) => edge.sourceNode, {
    cascade: false,
  })
  outgoingEdges!: SystemEdgeEntity[];

  @OneToMany(() => SystemEdgeEntity, (edge) => edge.targetNode, {
    cascade: false,
  })
  incomingEdges!: SystemEdgeEntity[];

  @OneToMany(() => EvidenceEntity, (ev) => ev.node, { cascade: false })
  evidence!: EvidenceEntity[];

  @OneToMany(() => CodeEmbeddingEntity, (emb) => emb.node, { cascade: false })
  embeddings!: CodeEmbeddingEntity[];
}
