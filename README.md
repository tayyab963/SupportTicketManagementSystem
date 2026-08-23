# Support Ticket Management System

A full-stack support ticket management platform built as a technical assessment.

**Backend:** ASP.NET Core 8 Web API, Entity Framework Core, SQL Server, JWT authentication, clean/layered architecture.
**Frontend:** Angular 20 (standalone components), Angular Material, TypeScript, RxJS.

> **Status: Phase 1 — Project Setup & Architecture.** This README reflects what is actually implemented today. See [Incomplete Requirements](#incomplete-requirements) for what is intentionally not yet built.

---

## Project Overview

The system lets **Customers** raise support tickets, **Support Agents** work assigned tickets, and **Admins** manage users, assignments and view analytics. Data isolation (a customer can never read another customer's ticket, even by guessing an ID) is enforced at the API/query level, not just in the UI.

## Features

Planned end-to-end feature set (tracked across upcoming phases):

- JWT authentication with role-based authorization (Admin / SupportAgent / Customer)
- Resource-level authorization (ownership + role checks on every ticket access)
- Ticket CRUD with server-side paging, filtering, sorting and search
- Enforced ticket status transition rules
- Assignment, priority and status management
- Comments and a full activity timeline per ticket
- Time tracking with aggregated totals
- Admin dashboard with summary metrics, charts and agent workload
- Admin user management
- Backend unit + integration tests, Angular unit tests

None of the above are implemented yet — Phase 1 only lays the foundation described below.

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8 Web API, C# 12 |
| ORM | Entity Framework Core 8 (SQL Server provider) |
| Auth | JWT Bearer (`Microsoft.AspNetCore.Authentication.JwtBearer`) |
| Validation | FluentValidation |
| Logging | Serilog (console sink, request logging) |
| API Docs | Swashbuckle / Swagger with JWT "Authorize" support |
| Backend testing | xUnit, Moq, FluentAssertions, EF Core InMemory, `WebApplicationFactory` |
| Frontend | Angular 20 (standalone components, no NgModules) |
| UI | Angular Material 20 (Material 3 theming) |
| Frontend testing | Karma + Jasmine |

## Architecture

Layered/clean architecture on the backend; standalone, lazy-loaded feature modules on the frontend.

```
SupportTicketManagementSystem/
├── Backend/
│   ├── SupportTicketSystem.sln
│   ├── SupportTicketSystem.Domain/            # Entities, enums — no external dependencies
│   │   ├── Entities/                          # User, Ticket, Comment, TicketActivity, TimeEntry
│   │   ├── Enums/                              # UserRole, TicketStatus, TicketPriority, ActivityType
│   │   └── Common/                             # IHasCreatedAt / IHasUpdatedAt audit interfaces
│   ├── SupportTicketSystem.Application/        # DTOs, service interfaces, validators (business logic)
│   ├── SupportTicketSystem.Infrastructure/     # EF Core DbContext, entity configs, migrations
│   │   └── Persistence/
│   │       ├── ApplicationDbContext.cs
│   │       ├── Configurations/                 # IEntityTypeConfiguration<T> per entity
│   │       └── Migrations/                     # InitialCreate
│   ├── SupportTicketSystem.API/                # Controllers, Program.cs, Swagger, auth wiring
│   ├── SupportTicketSystem.UnitTests/
│   └── SupportTicketSystem.IntegrationTests/
└── Frontend/
    └── support-ticket-ui/
        └── src/app/
            ├── core/
            │   ├── models/                      # ApiResponse<T>, PagedResult<T>, shared enums
            │   ├── services/                     # (empty — populated in the auth phase)
            │   ├── guards/                        # (empty — populated in the auth phase)
            │   └── interceptors/                  # (empty — populated in the auth phase)
            ├── shared/components/                 # (empty — populated as reusable UI is built)
            └── features/
                ├── auth/pages/login/
                ├── dashboard/pages/dashboard/
                ├── tickets/pages/{ticket-list,ticket-form,ticket-detail}/
                ├── users/pages/user-list/
                └── profile/pages/profile/
```

Controllers never expose EF Core entities directly — only DTOs (DTOs land in the Application layer starting in the next phase).

### Project references

`API → Application, Infrastructure` · `Infrastructure → Application, Domain` · `Application → Domain` · `UnitTests → Application, Domain, Infrastructure` · `IntegrationTests → API`

## Database Setup

The `Ticket`, `Comment`, `TicketActivity` and `TimeEntry` tables cascade-delete from their parent `Ticket`. All relationships back to `User` (customer, assigned agent, comment author, activity author, time entry author) use `Restrict` to avoid SQL Server's multiple-cascade-path error — users are meant to be deactivated (`IsActive`), not deleted.

| Entity | Notable constraints |
|---|---|
| `Users` | Unique index on `Email` |
| `Tickets` | Unique index on `TicketNumber`; indexes on `CustomerId`, `AssignedAgentId`, `Status`, `Priority`, `CreatedAt` |
| `Comments`, `TicketActivities`, `TimeEntries` | Indexed on `TicketId` and `UserId` |

By default the app targets **SQL Server LocalDB**:

```
Server=(localdb)\mssqllocaldb;Database=SupportTicketSystemDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True
```

To use a different SQL Server instance (or SQL Server Express/full/Docker), update `ConnectionStrings:DefaultConnection` in `Backend/SupportTicketSystem.API/appsettings.Development.json`, or override it with the `ConnectionStrings__DefaultConnection` environment variable.

## Migration Instructions

From the `Backend/` folder:

```bash
# apply the InitialCreate migration and create the database
dotnet ef database update `
  --project SupportTicketSystem.Infrastructure `
  --startup-project SupportTicketSystem.API

# after future model changes, add a new migration with
dotnet ef migrations add <MigrationName> `
  --project SupportTicketSystem.Infrastructure `
  --startup-project SupportTicketSystem.API `
  --output-dir Persistence/Migrations
```

(`dotnet-ef` must be installed: `dotnet tool install --global dotnet-ef`.)

## Running Backend

```bash
cd Backend
dotnet restore
dotnet build
dotnet ef database update --project SupportTicketSystem.Infrastructure --startup-project SupportTicketSystem.API
dotnet run --project SupportTicketSystem.API
```

The API listens on `http://localhost:5107` (and `https://localhost:7244`) by default, with Swagger UI at `/swagger`. CORS is pre-configured to allow `http://localhost:4200` / `https://localhost:4200` (the Angular dev server).

## Running Frontend

```bash
cd Frontend/support-ticket-ui
npm install
npm start
```

Serves at `http://localhost:4200`. `src/environments/environment.development.ts` points `apiUrl` at `http://localhost:5107/api`.

## Seed Accounts

**Not implemented yet.** Seed data (admin/agent/customer accounts, sample tickets) is planned for a later phase. This section will be filled in with real, clearly-fake credentials once seeding exists — do not assume any accounts exist today.

## API Documentation

Swagger/OpenAPI is configured at `/swagger` (Development environment) with a JWT "Authorize" button already wired into the security scheme. No endpoints exist yet beyond the framework's own health of the host — controllers will be documented here as they're added.

## Testing

### Backend

```bash
cd Backend
dotnet test
```

Currently: 2 unit tests (`SupportTicketSystem.UnitTests`, sanity-checking `Domain` entity defaults) and 1 integration test (`SupportTicketSystem.IntegrationTests`, boots the full API host via `WebApplicationFactory<Program>` and asserts Swagger is served). These exist to prove the test projects and DI wiring work end-to-end — the meaningful business-rule and data-isolation tests required by the assessment land once those features exist.

### Frontend

```bash
cd Frontend/support-ticket-ui
npm test -- --watch=false --browsers=ChromeHeadless
```

Currently: 2 tests on the root `App` shell component (renders, shows the toolbar title).

## Assumptions

- SQL Server LocalDB is available locally (ships with Visual Studio); any SQL Server-compatible instance works if the connection string is updated.
- Entity primary keys are `Guid` (not sequential `int`s) as defense-in-depth against ID enumeration, on top of the mandatory server-side ownership checks — the human-readable `TicketNumber` (`TKT-000001`) is separate and will be generated when ticket creation is implemented.
- `CreatedAt`/`UpdatedAt` are stamped automatically in `ApplicationDbContext.SaveChanges(Async)` via `IHasCreatedAt`/`IHasUpdatedAt` marker interfaces, so individual services never need to remember to set them.
- Angular 20's Material 3 `mat.theme()` API is used (not the legacy `mat-*-theme` mixins), since that's what `ng add @angular/material` generates on this Angular Material version.

## Incomplete Requirements

Everything below is **explicitly not built yet** — it is scoped to later phases of this assessment, not omitted by oversight:

- No controllers, DTOs, or business/service logic (auth, tickets, comments, timeline, time tracking, dashboard, user management)
- No JWT issuance/validation flow (only the ASP.NET Core JWT Bearer *middleware* and options binding are wired up; there is no login/register endpoint yet, so nothing can actually authenticate)
- No FluentValidation validators yet (the package and DI hook (`AddValidatorsFromAssembly`) are wired, but zero validators exist)
- No global exception handling middleware
- No seed data
- No Angular services, guards, interceptors, or real forms — `core/services`, `core/guards`, `core/interceptors` and `shared/components` are empty scaffolding, and every feature page is a static placeholder card
- No data isolation logic or tests yet (this is the most important requirement in the full assessment and will be built and explicitly tested once ticket endpoints exist)

## Security Notes

- Passwords are never stored in plaintext (hashing will be wired up alongside the auth endpoints).
- The JWT signing secret is **never** committed for real use: `appsettings.json` (the base/production file) ships with an empty `Jwt:Secret`, and `appsettings.Development.json` carries an explicitly-labelled dev-only placeholder secret. Production deployments must supply `Jwt__Secret` (and the connection string) via environment variables or a secret manager — never commit real secrets to `appsettings.json`.
- CORS is locked to the known Angular dev origins (`localhost:4200`), not a wildcard.
- All EF Core access goes through parameterized LINQ (no raw SQL), which is SQL-injection-safe by construction.

## Future Improvements

- Consider MediatR/CQRS if the Application layer's service surface grows large enough to warrant it (not adopted now to avoid overengineering a 12–16 hour assessment).
- Consider `Microsoft.AspNetCore.Identity` for full account management (password reset, lockout) if the assessment scope ever grows beyond the four required roles.
- Add OpenTelemetry/structured log shipping if this ever needs to run outside local development.
