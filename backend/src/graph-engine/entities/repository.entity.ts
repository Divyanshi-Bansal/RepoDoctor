/**
 * TypeORM entity for the `repositories` table.
 * Represents a GitHub repository registered for graph analysis.
 */
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { SystemNodeEntity } from './system-node.entity.js';
import { EvidenceEntity } from './evidence.entity.js';
import type { ProjectEntity } from './project.entity.js';

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  /** GitHub organisation (owner) login, e.g. "acme-corp". */
  @Column({ name: 'github_org', type: 'varchar' })
  githubOrg!: string;

  /** Repository name without the owner prefix, e.g. "api-gateway". */
  @Column({ type: 'varchar' })
  name!: string;

  /** Primary branch name, e.g. "main". */
  @Column({ name: 'default_branch', type: 'varchar' })
  defaultBranch!: string;

  /**
   * SHA of the most recently indexed commit.
   * Null until the first ingestion cycle completes.
   */
  @Column({ name: 'last_commit_sha', nullable: true, type: 'varchar' })
  lastCommitSha!: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @ManyToOne('ProjectEntity', (project: ProjectEntity) => project.repositories, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'project_id' })
  project?: ProjectEntity;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SystemNodeEntity, (node) => node.repository, {
    cascade: false,
  })
  nodes!: SystemNodeEntity[];

  @OneToMany(() => EvidenceEntity, (ev) => ev.repository, { cascade: false })
  evidence!: EvidenceEntity[];
}
