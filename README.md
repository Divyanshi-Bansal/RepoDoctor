# RepoDoctor

> **Product Thesis:** *Understand systems, not repositories.*

RepoDoctor is an AI-native engineering intelligence platform that ingests multi-repository software systems, detects services, databases, queues, and APIs, reconstructs a verified system dependency graph, and provides natural-language architecture intelligence and change-impact analysis.

---

## 🏛️ Development Environment & AI Agent Governance

RepoDoctor uses a structured, AI-native engineering process to guarantee architectural integrity, security, and empirical verification.

- **Global Agent Instructions:** [AGENTS.md](./AGENTS.md)
- **Scoped Agent Rules:** [.agents/rules/](./.agents/rules/)
  - [Architecture Rules](./.agents/rules/architecture.md)
  - [Coding Standards](./.agents/rules/coding_standards.md)
  - [Security Rules](./.agents/rules/security.md)
  - [Testing Rules](./.agents/rules/testing.md)
  - [Documentation Rules](./.agents/rules/documentation.md)
  - [Agent Behavior Rules](./.agents/rules/agent_behavior.md)
- **Project Knowledge Base:** [docs/project/](./docs/project/)
  - [Product Vision & Scope](./docs/project/product_vision.md)
  - [Approved Tech Stack Decisions](./docs/project/tech_stack_decisions.md)
  - [System Architecture Specification](./docs/project/system_architecture.md)
  - [Governance & Precedence Matrix](./docs/project/governance_and_precedence.md)
- **Architecture Decision Records:** [docs/adr/](./docs/adr/)
  - [ADR-0001: Core Technology Stack Selection](./docs/adr/0001-record-architecture-decisions.md)

---

## 🛠️ Confirmed Technical Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React Flow
- **Backend:** NestJS (Node.js, TypeScript)
- **Database:** PostgreSQL 16+ with `pgvector`
- **Cache & Queue:** Redis 7+ with BullMQ
- **VCS Integration:** GitHub App (Read-Only)

---

## 🚀 Quickstart & Team Setup Guide

Follow these steps to run RepoDoctor locally on your system.

### 1. Prerequisites
- **Node.js:** v20.x or v22.x
- **Package Manager:** `pnpm` (run `corepack enable` or `npm install -g pnpm`)
- **Docker & Docker Compose:** Installed and running

---

### 2. Service URLs & Connection Strings

| Service | Local URL / Connection String | Description |
|---|---|---|
| **Web Frontend** | `http://localhost:3000` | Next.js UI (Overview, Features, Architecture, Ask Doctor) |
| **Backend API** | `http://localhost:3001` | NestJS REST API |
| **PostgreSQL Database** | `postgresql://repodoctor:repodoctor_dev@localhost:5432/repodoctor` | PostgreSQL 16 + `pgvector` |
| **Database Web Viewer (Adminer)** | `http://localhost:8080` | Web UI to view tables, rows, & run SQL in browser |
| **Redis Cache** | `redis://localhost:6379` | Redis 7 |

---

### 3. Step-by-Step Setup

#### Step 1: Environment Variables
Create the `.env` file from the template (the template already contains working local defaults):
```bash
cp .env.example .env
```

#### Step 2: Start Database & Cache
Start PostgreSQL (with `pgvector`) and Redis:
```bash
docker compose up -d
```
> [!NOTE]
> `docker-compose.yml` mounts `init-db.sql` to `/docker-entrypoint-initdb.d/init.sql`. When the container starts for the first time, PostgreSQL automatically initializes with all database tables, pre-configured users, and the pre-analyzed demo project.

#### Step 3: Install Dependencies
```bash
pnpm install
```

#### Step 4: Run the Application
Start both the NestJS backend API and the Next.js web client:
```bash
# Terminal 1: Start Backend (Port 3001)
pnpm --filter @repo-doctor/api dev

# Terminal 2: Start Web Frontend (Port 3000)
pnpm --filter @repo-doctor/web dev
```
*(Or run both concurrently from the root with `pnpm dev`)*

---

### 4. Pre-Configured Test Credentials

Once both servers are running, open `http://localhost:3000`:

- **Email:** `divyanshibansal9@gmail.com`
- **Password:** `Password123!`

*(You can also register a new account directly through the UI).*

Once logged in, select the pre-analyzed multi-repository workspace:
- **Project Name:** `Test project in repodoctor`
- **Repositories Linked:** `cadence-web` (Frontend Next.js) and `cadence-api` (Backend NestJS)
- **Features & Architecture:** Pre-analyzed and ready to explore immediately (Storyboard, Flow Tree, Code Viewer, and Ask RepoDoctor).

---

### 5. Running Database Migrations (Optional)
If modifying schema entities in the future:
```bash
pnpm --filter @repo-doctor/api migration:run
```

---

## 🚦 Human Approval Policy

All agent operations are governed by a **3-Tier Risk Model**:
- **Tier 1 (High Risk):** Architecture, product scope, security model, and infrastructure changes require **explicit human approval** before code is written.
- **Tier 2 (Medium Risk):** New features and internal refactorings require an approved `implementation_plan.md` before execution.
- **Tier 3 (Low Risk):** Bug fixes and test implementations proceed autonomously within approved scope and conclude with empirical verification evidence.
