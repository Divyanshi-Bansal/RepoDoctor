/**
 * TypeORM entity for the `evidence` table.
 *
 * Exactly-One-Target Invariant (Level 1 data integrity rule):
 *   Each evidence record must reference EITHER a system_node OR a system_edge —
 *   never both, never neither. This is enforced by the PostgreSQL check constraint
 *   `chk_evidence_single_target` applied in the initial schema migration.
 *
 * The @Check decorator documents the invariant on the entity class but does NOT
 * generate DDL when synchronize: false. The constraint is authoritative only
 * in the migration SQL (see 1729000000000-InitialSchema.ts).
 */
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RepositoryEntity } from './repository.entity.js';
import { SystemNodeEntity } from './system-node.entity.js';
import { SystemEdgeEntity } from './system-edge.entity.js';

@Check(
  'chk_evidence_single_target',
  '(node_id IS NOT NULL AND edge_id IS NULL) OR (node_id IS NULL AND edge_id IS NOT NULL)',
)
@Entity('evidence')
export class EvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  /**
   * FK to system_nodes. Null when this record evidences an edge.
   * Exactly one of node_id / edge_id must be non-null (enforced by DB constraint).
   */
  @Column({ name: 'node_id', type: 'uuid', nullable: true })
  nodeId!: string | null;

  @ManyToOne(() => SystemNodeEntity, (node) => node.evidence, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'node_id' })
  node!: SystemNodeEntity | null;

  /**
   * FK to system_edges. Null when this record evidences a node.
   * Exactly one of node_id / edge_id must be non-null (enforced by DB constraint).
   */
  @Column({ name: 'edge_id', type: 'uuid', nullable: true })
  edgeId!: string | null;

  @ManyToOne(() => SystemEdgeEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'edge_id' })
  edge!: SystemEdgeEntity | null;

  /** Repository that owns this evidence record. */
  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId!: string;

  @ManyToOne(() => RepositoryEntity, (repo) => repo.evidence, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'repository_id' })
  repository!: RepositoryEntity;

  /** Repo-relative path to the source file containing the evidence. */
  @Column({ name: 'file_path', type: 'varchar' })
  filePath!: string;

  /** 1-indexed start line of the evidencing code span. */
  @Column({ name: 'line_start', type: 'int' })
  lineStart!: number;

  /** 1-indexed end line (inclusive) of the evidencing code span. */
  @Column({ name: 'line_end', type: 'int' })
  lineEnd!: number;

  /** Verbatim source code extract for the cited span. */
  @Column({ name: 'code_snippet', type: 'text' })
  codeSnippet!: string;

  /** Git commit SHA at which this evidence was observed. */
  @Column({ name: 'commit_sha', type: 'varchar' })
  commitSha!: string;
}
