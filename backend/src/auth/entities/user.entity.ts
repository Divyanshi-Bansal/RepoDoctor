import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ name: 'github_username', type: 'varchar', nullable: true })
  githubUsername!: string | null;

  @Column({ name: 'github_id', type: 'varchar', nullable: true })
  githubId!: string | null;

  @Column({ name: 'gitlab_username', type: 'varchar', nullable: true })
  gitlabUsername!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
