import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersAndProjects1729000000001 implements MigrationInterface {
  public readonly name = 'AddUsersAndProjects1729000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              uuid         NOT NULL DEFAULT gen_random_uuid(),
        "email"           varchar      NOT NULL,
        "password_hash"   varchar,
        "name"            varchar      NOT NULL,
        "github_username" varchar,
        "github_id"       varchar,
        "gitlab_username" varchar,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // 2. projects table
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"          uuid         NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar      NOT NULL,
        "description" varchar,
        "owner_id"    uuid         NOT NULL,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projects_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 3. Add project_id and owner_id to repositories
    await queryRunner.query(`
      ALTER TABLE "repositories" 
      ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "repositories" 
      DROP COLUMN IF EXISTS "project_id",
      DROP COLUMN IF EXISTS "owner_id";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
