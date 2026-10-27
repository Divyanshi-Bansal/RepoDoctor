---
name: coding-standards
description: Strict TypeScript rules, zero 'any' policy, NestJS DTO validation, and error-handling conventions.
trigger: glob
globs: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx"
---

# Coding Standards & Language Rules

> **Scope:** TypeScript, NestJS, Next.js, and general code hygiene.  
> **Precedence:** Level 2 (Coding & Quality Constraints — Subordinate to Level 1 Security & Approval Gates)

---

## 1. Strict TypeScript Standards

- **Zero `any` Policy:**
  - The use of `any` is strictly prohibited. Use `unknown`, generic parameters, or explicit union types.
  - If third-party libraries lack types, author a targeted `d.ts` declaration file or narrow with type guards (`is` operator).
- **Explicit Type Declarations:**
  - All public methods, exported functions, and service boundaries must declare explicit return types.
  - Function arguments must be fully typed. Do not rely on loose type inference across module boundaries.
- **Strict Compiler Settings:**
  - Every package must compile under `strict: true`, `noImplicitAny: true`, and `exactOptionalPropertyTypes: true`.
  - Type assertions (`as SomeType`) are forbidden unless accompanied by a runtime validation guard or parser check (e.g., Zod or `class-validator`).
- **Immutability by Default:**
  - Use `readonly` for array and object properties where mutation is unintended.
  - Prefer immutable array transformations (`map`, `filter`, `reduce`, `toSorted`) over mutating in-place methods (`push`, `sort`, `splice`).

---

## 2. Error Handling & Resilience

- **Domain-Specific Custom Exceptions:**
  - Define custom domain exception classes inheriting from standard NestJS `HttpException` or base `Error` (e.g., `RepositoryNotFoundException`, `GraphCycleDetectedException`, `ManifestParsingException`).
  - Every custom exception must include a machine-readable error code (e.g., `ERR_GRAPH_CYCLE_DETECTED`).
- **No Empty Catch Blocks:**
  - Swallowing errors silently is forbidden:
    ```typescript
    // FORBIDDEN:
    try { doSomething(); } catch (e) {}

    // REQUIRED:
    try {
      await doSomething();
    } catch (error) {
      this.logger.error(`Failed to process node: ${error.message}`, error.stack);
      throw new NodeProcessingException(nodeId, error);
    }
    ```
- **Error Information Leakage Prevention:**
  - Never return raw database error messages, SQL queries, or internal stack traces in HTTP responses to clients.
  - Use NestJS Global Exception Filters to normalize error responses into consistent `{ statusCode, errorCode, message, timestamp }` formats.

---

## 3. NestJS Specific Conventions

- **DTOs and Validation:**
  - Every API endpoint request body and query parameter object must be defined as a TypeScript class with `class-validator` and `class-transformer` decorators.
  - NestJS `ValidationPipe` must be enabled globally with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- **Configuration Management:**
  - Environment variables must never be accessed via raw `process.env.VARIABLE`.
  - Inject `@nestjs/config` `ConfigService` or strongly-typed configuration objects validated with Joi or Zod schemas at startup.

---

## 4. Next.js & Frontend Conventions

- **Clean Styling with Tailwind CSS:**
  - Use Tailwind utility classes with consistent spacing scales. Avoid inline `style={{ ... }}` objects.
  - Use semantic CSS color tokens (dark mode first).
- **Component Design:**
  - Components must be single-responsibility and under 250 lines. Decompose complex UI into subcomponents.
  - Separate data fetching and state hooks from pure visual rendering components.
- **Unique Identifiers for UI Elements:**
  - Assign meaningful `data-testid` or `id` attributes to interactive elements (buttons, node drawers, graph canvas) to facilitate automated browser testing.
