/**
 * TypeORM entity for the `system_edges` table.
 * Represents a directed dependency relationship between two system nodes.
 * Confidence of 1.0 means deterministic (extracted from manifest/AST);
 * values < 1.0 indicate inferred relationships.
 */
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SystemNodeEntity } from './system-node.entity.js';
import { EdgeType } from './graph.enums.js';

@Entity('system_edges')
export class SystemEdgeEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  /** ID of the upstream (calling / producing) node. */
  @Column({ name: 'source_node_id', type: 'uuid' })
  sourceNodeId!: string;

  @ManyToOne(() => SystemNodeEntity, (node) => node.outgoingEdges, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'source_node_id' })
  sourceNode!: SystemNodeEntity;

  /** ID of the downstream (receiving / consuming) node. */
  @Column({ name: 'target_node_id', type: 'uuid' })
  targetNodeId!: string;

  @ManyToOne(() => SystemNodeEntity, (node) => node.incomingEdges, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'target_node_id' })
  targetNode!: SystemNodeEntity;

  /** Relationship type drawn from the EdgeType vocabulary. */
  @Column({ name: 'edge_type', type: 'varchar', enum: EdgeType })
  edgeType!: EdgeType;

  /**
   * Confidence score for this relationship.
   * 1.0 = deterministic (manifest / AST proven); < 1.0 = inferred.
   * Stored as NUMERIC(4,3) to avoid floating-point rounding.
   */
  @Column({ type: 'decimal', precision: 4, scale: 3, default: 1.0 })
  confidence!: number;

  /** True when the relationship was inferred, not deterministically proven. */
  @Column({ name: 'is_inferred', type: 'boolean', default: false })
  isInferred!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
