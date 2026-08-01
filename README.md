# Academic Management Portal — Phase 2.0 Foundation

NestJS + Prisma + PostgreSQL backend, React + Vite frontend. See
`../MIGRATION_PLAN.md` for the full architecture and phased build order.

## Prerequisites
- Node.js 20+, npm
- Docker Desktop (for local Postgres)

## Run it

```bash
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate deploy   # or `npx prisma migrate dev` in development
npx prisma db seed          # creates roles/permissions + a Super Admin + a sample branch
npm run start:dev           # http://localhost:3000/api

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (or next free port)
```

## Seeded dev credentials
- Username: `admin`
- Password: `ChangeMe123!`

**Change or remove this account before any non-local deployment.**

## What's implemented (Phase 2.0)
- JWT access + refresh tokens, with genuine refresh-token revocation
  (fixes the old system's broken logout — see `API_CONTRACTS.md` defect D1).
- Table-driven RBAC: `Role` / `Permission` / `RolePermission` / `UserRole`,
  enforced via `PermissionsGuard` (`@RequirePermission('key')`).
- Multi-branch scoping via `BranchScopeGuard`: GLOBAL-scope roles (Super
  Admin, Management) act across all branches; BRANCH-scope roles are
  restricted to their assigned branch(es).
- Branches and Users CRUD, role assignment.
- React shell: login, protected layout, branch switcher (for GLOBAL users),
  permission-filtered sidebar. No functional-module screens yet — those are
  Phases 2.1–2.6.

## Known caveats carried into later phases
- `@@unique([userId, roleId, branchId])` (and similar nullable-branchId
  compound uniques) can't be used with Prisma's typed `upsert` because
  Prisma's generated compound-unique input requires non-null values even
  though the column is nullable. Worked around with a manual
  find-then-create in `UsersService.assignRole` and the seed script. Same
  caveat applies to any future nullable-branchId compound unique (e.g.
  `LeaveQuota`, per the schema review).
- Prisma is pinned to the 5.x line, not the newly-released 7.x, because 7.x
  requires driver-adapter-based `PrismaClient` construction (a materially
  different API) inconsistent with the stable pattern the rest of this
  migration plan assumes. Revisit this pin deliberately later, not as a
  side effect of `npm update`.
