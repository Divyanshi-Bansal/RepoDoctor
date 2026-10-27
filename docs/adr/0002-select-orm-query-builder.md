# [ADR-0002] ORM and Query Builder Selection for RepoDoctor

- **Status:** PROPOSED
- **Date:** 2026-10-13
- **Author:** AI Engineering Agent (Antigravity)
- **Deciders:** Human Engineer (Project Owner)
- **Consulted:** AI Agent Systems Designer

---

## 1. Context & Problem Statement

RepoDoctor requires a database access layer for PostgreSQL 16+ to support the following query workloads:

1. **Entity persistence:** Storing and retrieving structured relational entities — repositories, system nodes, system edges, evidence records, code chunk embeddings, and processing state.
2. **Recursive CTE graph traversal:** Downstream blast-radius computation using PostgreSQL `WITH RECURSIVE` Common Table Expressions with a `visited`-array cycle guard.
3. **pgvector similarity search:** Top‑k cosine distance queries (`<=>` operator) over `vector(1536)` embedding columns.
4. **JSONB flexible metadata:** Storing arbitrary manifest and AST metadata alongside relational records.
5. **Transactional atomicity:** Persisting graph deltas (nodes + edges + evidence in a single commit SHA batch) inside a single database transaction.

This ADR records the selection of an ORM and query strategy that fulfils all five workloads within a NestJS 10 monolith on Node.js 22 LTS.

---

## 2. Decision Drivers

- **Hackathon development velocity:** First‑class NestJS integration and decorator‑based entity mapping accelerates initial schema bootstrap.
- **Graph traversal correctness:** Recursive CTEs and pgvector similarity queries must be expressible without leaking untyped raw SQL strings into the business logic layer.
- **Relational integrity enforcement:** The `chk_evidence_single_target` check constraint and foreign key constraints must be durable across migrations.
- **JSONB expressiveness:** Flexible metadata storage without schema‑rigidity penalties.
- **Operational simplicity:** Zero platform‑specific native binaries required during hackathon development.

---

## 3. Considered Options

- **Option A: TypeORM** — Decorator‑based ORM with first‑class NestJS integration (`@nestjs/typeorm`), entity‑based relational mapping, built‑in migration runner, and `DataSource.query()` for explicit parameterised SQL.
- **Option B: Drizzle ORM** — Lightweight TypeScript‑first query builder with schema‑as‑code approach and `sql<T>` tagged template expressions for CTE and pgvector queries.
- **Option C: Prisma** — Schema‑first ORM with a Rust binary query engine; lacks native recursive CTE or pgvector support, requiring `$queryRaw` for all advanced graph operations.

---

## 4. Decision Outcome

Chosen option: **Option A — TypeORM**, because it integrates natively with NestJS via `@nestjs/typeorm`, provides a clear entity‑repository pattern consistent with the module structure, and supports explicit parameterised SQL (`DataSource.query(sql, params)`) for advanced PostgreSQL operations where the ORM abstraction is insufficient.

> [!IMPORTANT]
> TypeORM does **not** provide a high‑level query builder API for PostgreSQL `WITH RECURSIVE` CTEs or `pgvector` similarity search. These queries must be written as explicit, parameterised SQL strings and executed via `DataSource.query()` or `EntityManager.query()`. This is not a deficiency unique to TypeORM — no ORM provides a type‑safe recursive CTE builder. The responsibility to ensure parameterisation and prevent raw string injection lies with the `graph‑engine` module, validated by automated SQL injection tests.

### Query Responsibility Split:

| Workload | TypeORM Mechanism | Notes |
| :--- | :--- | :--- |
| Entity CRUD & joins | `Repository<Entity>`, `QueryBuilder` | Fully ORM‑managed, strongly typed |
| Schema migrations | `typeorm migration:generate` / `migration:run` | TypeORM migration runner owns schema evolution |
| Transactions (delta persist) | `EntityManager` + `queryRunner.startTransaction()` | ORM‑managed transaction lifecycle |
| Recursive CTE blast‑radius | `DataSource.query(sql, [params])` | Explicit parameterised SQL; no ORM abstraction |
| pgvector similarity (`<=>`) | `DataSource.query(sql, [params])` | Explicit parameterised SQL with vector literal binding |
| JSONB metadata storage | TypeORM `@Column({ type: 'jsonb' })` | ORM‑managed; JSON serialisation handled automatically |
| Check constraint creation | TypeORM migration raw SQL or `@Check()` decorator | `@Check()` or migration raw `ALTER TABLE` statement |

### Positive Consequences
- Native `@Module`/`@Injectable()` integration with NestJS dependency injection without adapter libraries.
- Decorator‑based entity definitions (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany`) provide clear, readable schema declarations.
- TypeORM migration runner provides auditable, versioned schema evolution without a separate migration tool.
- `DataSource.query()` accepts explicit parameter arrays (`$1, $2, ...`), satisfying the parameterised‑query security invariant for all advanced SQL.
- JSONB columns natively serialise and deserialise TypeScript objects.

### Negative Consequences / Trade‑offs
- Recursive CTEs and pgvector queries must be written as explicit SQL strings — these are untyped at the TypeORM level. The engineering team is responsible for maintaining TypeScript interfaces over the raw result rows.
- TypeORM's lazy‑loading and active‑record patterns can introduce N+1 query issues if not explicitly managed; `graph‑engine` should use eager‑join query builders rather than implicit lazy relations.
- TypeORM migration generation from entity decorators can sometimes produce suboptimal DDL for advanced constraints; migrations must be reviewed before execution.

---

## 5. Pros and Cons of the Options

### Option A: TypeORM
- **Good:** First‑class `@nestjs/typeorm` integration; decorator entities align naturally with NestJS module architecture.
- **Good:** Supports `@Check()` decorator for table‑level check constraints.
- **Good:** `DataSource.query()` accepts parameterised SQL arrays, satisfying injection‑prevention invariants.
- **Good:** Migration runner is mature and well‑documented for PostgreSQL.
- **Bad:** Recursive CTE and pgvector queries are not expressible through the ORM query builder; explicit SQL strings are required.
- **Bad:** Entity decorator magic can obscure column definitions; careful naming conventions are required to prevent accidental schema drift.

### Option B: Drizzle ORM
- **Good:** Schema‑as‑code with typed `sql<T>` template expressions that provide typed parameter binding even for CTEs.
- **Good:** Zero binary dependencies; pure JavaScript runtime.
- **Bad:** No native NestJS integration module; requires manual wiring into NestJS providers.
- **Bad:** Less established migration tooling compared to TypeORM for production PostgreSQL workloads.

### Option C: Prisma
- **Bad:** Rust binary query engine introduces platform‑specific binary management complexity.
- **Bad:** Recursive CTEs and pgvector operations require untyped `$queryRaw` strings, providing no advantage over TypeORM `DataSource.query()`.
- **Bad:** No native table‑level check constraint support in Prisma schema DSL.

---

## 6. Implementation Notes & Migration Path

### TypeORM pgvector Integration
**Resolved** – As of TypeORM 0.3.27+, native support for PostgreSQL `vector` columns is provided via the column type `'vector'`. The entity definition can now be written as:
```ts
@Column('vector', { length: 1536 })
vectorEmbedding: number[];
```
No external adapter (e.g., `pgvector/typeorm`) is required. A compatibility test will be executed in a later phase to confirm migrations and CRUD work correctly.

### Check Constraint Enforcement
- The `chk_evidence_single_target` constraint:
```sql
CHECK ((node_id IS NOT NULL AND edge_id IS NULL) OR (node_id IS NULL AND edge_id IS NOT NULL))
```
must be expressed as a TypeORM migration raw SQL statement or via the `@Check(...)` decorator on the `Evidence` entity. The migration must be reviewed and manually confirmed before execution.

### Security Invariant: Parameterised Queries
All invocations of `DataSource.query()` in `graph‑engine` must use the parameterised form:
```ts
await dataSource.query(
  'SELECT ... WHERE source_node_id = $1 AND NOT ($2 = ANY(visited))',
  [nodeId, nodeId]
);
```
Raw string interpolation (`WHERE id = '${id}'`) is strictly forbidden under Level 1 security rules.

### Migration Ownership
- TypeORM migration files (`src/migrations/*.ts`) are owned by the `graph‑engine` module in `backend`.
- Migrations are generated via `typeorm migration:generate`, reviewed by a human or AI agent per the zero‑drift policy, and applied via `typeorm migration:run`.
- A human must review and approve migration files before execution in any environment.
