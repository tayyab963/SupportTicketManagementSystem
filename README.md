# Support Ticket Management System

A full-stack support ticket management platform built as a technical assessment.

**Backend:** ASP.NET Core 8 Web API, Entity Framework Core, SQL Server, JWT authentication, clean/layered architecture.
**Frontend:** Angular 20 (standalone components), Angular Material, TypeScript, RxJS.

> **Status: Phase 2 — Authentication, JWT & Security.** This README reflects what is actually implemented today. See [Incomplete Requirements](#incomplete-requirements) for what is intentionally not yet built.

---

## Project Overview

The system lets **Customers** raise support tickets, **Support Agents** work assigned tickets, and **Admins** manage users, assignments and view analytics. Data isolation (a customer can never read another customer's ticket, even by guessing an ID) is enforced at the API/query level, not just in the UI.

## Features

Planned end-to-end feature set (tracked across upcoming phases):

- [x] JWT authentication with role-based authorization (Admin / SupportAgent / Customer)
- [x] Resource-level authorization (ownership + role checks on every ticket access)
- [ ] Ticket CRUD with server-side paging, filtering, sorting and search *(minimal, non-paged CRUD + comments/status/time-entries exist today to prove out isolation — full paging/filtering/search is a later phase)*
- [ ] Enforced ticket status transition rules *(status can be changed today with role/ownership checks, but no state-machine validation of legal transitions yet)*
- [x] Assignment, priority and status management
- [x] Comments and a full activity timeline per ticket
- [x] Time tracking (logging only — aggregated totals/reporting still pending)
- [ ] Admin dashboard with summary metrics, charts and agent workload
- [ ] Admin user management (UI)
- [x] Backend unit + integration tests, Angular unit tests

Phase 1 laid the architectural foundation; Phase 2 (this phase) adds the full auth/security layer described below. Ticket business rules (paging, search, status-transition validation, dashboard, admin UX) are tracked for later phases — see [Incomplete Requirements](#incomplete-requirements).

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
│   │   ├── Auth/                               # LoginRequest/RegisterRequest/AuthResponseDto, IAuthService
│   │   ├── Tickets/                             # Ticket/Comment/TimeEntry DTOs, ITicketService
│   │   └── Common/
│   │       ├── Interfaces/                      # ICurrentUserService, IJwtTokenGenerator, IPasswordHasher
│   │       └── Exceptions/                      # NotFoundException, ForbiddenAccessException, ConflictException
│   ├── SupportTicketSystem.Infrastructure/     # EF Core DbContext, entity configs, migrations, auth/services
│   │   ├── Identity/                            # JwtTokenGenerator, PasswordHasherService, CurrentUserService
│   │   ├── Services/                            # AuthService, TicketService (isolation enforcement lives here)
│   │   └── Persistence/
│   │       ├── ApplicationDbContext.cs
│   │       ├── Configurations/                 # IEntityTypeConfiguration<T> per entity
│   │       ├── Migrations/                     # InitialCreate
│   │       └── Seed/DbSeeder.cs                 # Development-only seed accounts
│   ├── SupportTicketSystem.API/                # Controllers, Program.cs, Swagger, auth wiring
│   │   ├── Controllers/                         # AuthController, TicketsController
│   │   ├── Middleware/                          # ExceptionHandlingMiddleware (401/403/404/409 mapping)
│   │   └── Common/ApiResponse.cs                # Shared success/error response envelope
│   ├── SupportTicketSystem.UnitTests/
│   └── SupportTicketSystem.IntegrationTests/    # Auth flow + customer-isolation tests (InMemory DB)
└── Frontend/
    └── support-ticket-ui/
        └── src/app/
            ├── core/
            │   ├── models/                      # ApiResponse<T>, PagedResult<T>, auth.model.ts, shared enums
            │   ├── services/                     # AuthService, TokenStorageService
            │   ├── guards/                        # authGuard, guestGuard, roleGuard
            │   └── interceptors/                  # authInterceptor (attaches JWT), errorInterceptor (401 handling)
            ├── shared/components/                 # (empty — populated as reusable UI is built)
            └── features/
                ├── auth/pages/login/               # Real login form (AuthService-backed)
                ├── dashboard/pages/dashboard/
                ├── tickets/pages/{ticket-list,ticket-form,ticket-detail}/
                ├── users/pages/user-list/           # Route is Admin-only (roleGuard)
                └── profile/pages/profile/
```

Controllers never expose EF Core entities directly — only DTOs, defined in `SupportTicketSystem.Application` alongside the service interfaces and FluentValidation validators that operate on them.

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

**Development convenience:** on every startup in the `Development` environment, `Program.cs` automatically applies any pending EF Core migrations and seeds the accounts listed in [Seed Accounts](#seed-accounts) (idempotent — it no-ops if any users already exist). This only runs in `Development`; the integration test host runs under a distinct `Testing` environment (see `CustomWebApplicationFactory`) specifically so `dotnet test` never touches a real database. The manual `dotnet ef database update` command above still works and is required for non-Development environments.

## Running Frontend

```bash
cd Frontend/support-ticket-ui
npm install
npm start
```

Serves at `http://localhost:4200`. `src/environments/environment.development.ts` points `apiUrl` at `http://localhost:5107/api`.

## Seed Accounts

Seeded automatically on Development startup by `SupportTicketSystem.Infrastructure/Persistence/Seed/DbSeeder.cs`. These are intentionally simple, clearly-fake **development-only** credentials — never reuse this seeding approach or these passwords outside local development:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@123` |
| Support Agent | `agent1@example.com` | `Agent1@123` |
| Support Agent | `agent2@example.com` | `Agent2@123` |
| Customer | `customer1@example.com` | `Customer1@123` |
| Customer | `customer2@example.com` | `Customer2@123` |

New customer accounts can also be self-registered via `POST /api/auth/register` — that endpoint always creates a `Customer`-role account regardless of any other field sent in the request body; Admin/SupportAgent accounts are provisioned only via seed data.

## API Documentation

Swagger/OpenAPI is served at `/swagger` (Development environment only) with a JWT "Authorize" button wired into the security scheme — paste a raw token (no `Bearer ` prefix needed, Swashbuckle adds it) obtained from `POST /api/auth/login` to call protected endpoints from the UI.

Implemented endpoints:

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/auth/login` | Anonymous | Returns a JWT + profile |
| `POST /api/auth/register` | Anonymous | Always creates a Customer |
| `GET /api/auth/me` | Any authenticated user | Current user from JWT claims |
| `GET /api/tickets` | Any authenticated user | Customer-scoped; Agent/Admin see all |
| `POST /api/tickets` | Customer, Admin | Customer can only create for themselves |
| `GET /api/tickets/{id}` | Any authenticated user | 404 if outside the caller's scope |
| `PUT /api/tickets/{id}` | Owner Customer, assigned Agent, Admin | |
| `POST /api/tickets/{id}/comments` | Any authenticated user with visibility | |
| `POST /api/tickets/{id}/status` | Owner Customer (Closed only), assigned Agent, Admin | |
| `POST /api/tickets/{id}/time-entries` | SupportAgent, Admin | Customers are rejected at the role level (403) |

All responses use a shared envelope (`{ success, message, data }` or `{ success, message, errors }`), matching the Angular `ApiResponse<T>` model.

## Testing

### Backend

```bash
cd Backend
dotnet test
```

Currently: 2 unit tests (`SupportTicketSystem.UnitTests`, sanity-checking `Domain` entity defaults) and 22 integration tests (`SupportTicketSystem.IntegrationTests`, via `CustomWebApplicationFactory` — the real API host and middleware pipeline against an isolated EF Core InMemory database, so no LocalDB is needed to run the suite):

- `ApiFactoryTests` — host boots, DI resolves, unauthenticated requests to protected routes 401, unknown routes 404.
- `AuthTests` — register/login round-trip, wrong password / unknown email → 401, duplicate email → 409, weak password → 400 with field errors, a client-supplied `role` field on register is silently ignored (always Customer), `/auth/me` requires and reflects a valid token.
- `TicketIsolationTests` — the exact malicious-request scenarios called out by the assessment: a second customer (or an unassigned agent) attempting `GET`/`PUT`/comment/status/time-entry against another customer's ticket, asserting each is rejected with the correct status code (404 for cross-customer access, 403 for role/assignment violations, 401 unauthenticated), plus positive-path checks that the owning customer, assigned agent, and admin *can* perform the corresponding action.

### Frontend

```bash
cd Frontend/support-ticket-ui
npm test -- --watch=false --browsers=ChromeHeadless
```

Currently: `App` shell component (renders, shows the toolbar title). Auth-critical logic (guards, interceptors, `AuthService`) is currently covered end-to-end via a manual/Playwright-driven browser pass (see below) rather than Karma unit specs — component/service unit tests for the auth layer are a good next addition.

## Manual Verification (this phase)

Performed as part of Phase 2, against a real LocalDB-backed API and the Angular dev server:

- Login via Swagger's "Authorize" flow for each seeded role; wrong password → 401.
- Full login → dashboard → logout flow through the Angular UI, and the toolbar's current-user/role display.
- `authGuard` redirecting an unauthenticated visit to `/dashboard`/`/tickets` to `/login?returnUrl=...`, and honoring that `returnUrl` after login.
- `roleGuard` letting Admin into `/users` and bouncing a Customer back to `/dashboard`.
- Customer isolation against a live ticket: a second customer's `GET`/`PUT`/comment/status all rejected (404), time-entries rejected (403), all confirmed both via the automated `TicketIsolationTests` suite and via direct HTTP calls against the running API.

## Assumptions

- SQL Server LocalDB is available locally (ships with Visual Studio); any SQL Server-compatible instance works if the connection string is updated.
- Entity primary keys are `Guid` (not sequential `int`s) as defense-in-depth against ID enumeration, on top of the mandatory server-side ownership checks.
- `CreatedAt`/`UpdatedAt` are stamped automatically in `ApplicationDbContext.SaveChanges(Async)` via `IHasCreatedAt`/`IHasUpdatedAt` marker interfaces, so individual services never need to remember to set them.
- Angular 20's Material 3 `mat.theme()` API is used (not the legacy `mat-*-theme` mixins), since that's what `ng add @angular/material` generates on this Angular Material version.
- No full `Microsoft.AspNetCore.Identity` (`UserManager`/`RoleManager`) — the `User` entity is custom, and `Microsoft.Extensions.Identity.Core`'s `PasswordHasher<T>` is used directly for hashing (see [Future Improvements](#future-improvements)).
- Enums (`UserRole`, `TicketStatus`, `TicketPriority`, `ActivityType`) are annotated with `[JsonConverter(typeof(JsonStringEnumConverter))]` directly on the Domain type, so they always serialize as their string name over HTTP regardless of which serializer options a given caller uses — matching the Angular string enums in `core/models/enums.ts` and avoiding surprises in ad-hoc tooling that doesn't share the API's global JSON options.
- Ticket data isolation is enforced at the data-query level (`TicketService.ApplyVisibilityScope` filters by `CustomerId` before the query runs, not after fetching), and a Customer probing another customer's ticket ID gets the same 404 as a nonexistent ticket — existence is never confirmed to a caller who shouldn't see it. Agents/Admins can view all tickets for triage, but mutating a ticket they're not assigned to (or don't administer) is rejected with 403.
- Public self-registration (`POST /api/auth/register`) always creates a `Customer` — the request DTO has no `Role` field, so a client cannot request Admin/SupportAgent for itself even by adding an extra JSON field (verified by `AuthTests.Register_IgnoresClientSuppliedRole_AlwaysCreatesCustomer`).

## Incomplete Requirements

Everything below is **explicitly not built yet** — it is scoped to later phases of this assessment, not omitted by oversight:

- Ticket listing has no paging/filtering/sorting/search yet (returns the caller's full accessible set)
- No enforced ticket status **transition** state machine (a Customer can only set Closed; Agent/Admin can set any status, but illegal/nonsensical transitions like Closed → Open aren't blocked yet)
- No admin dashboard (summary metrics, charts, agent workload)
- No Angular admin user-management UI (the `/users` route exists and is Admin-gated, but the page itself is still the Phase 1 placeholder)
- No Angular unit tests yet for `AuthService`/guards/interceptors specifically (covered by manual + Playwright verification this phase — see above)
- No aggregated time-tracking totals/reporting (logging individual entries works)

## Security Notes

- Passwords are hashed with `Microsoft.AspNetCore.Identity`'s `PasswordHasher<T>` (PBKDF2) — never stored in plaintext, and never logged.
- JWTs are signed HS256, carry `UserId`/`Email`/`Role` claims, and are validated on every request against configured issuer, audience, signing key and expiration (`Program.cs`, bound from `IOptions<JwtSettings>` rather than read once at startup, so configuration changes — including test-time overrides — are always honored).
- The JWT signing secret is **never** committed for real use: `appsettings.json` (the base/production file) ships with an empty `Jwt:Secret`, and `appsettings.Development.json` carries an explicitly-labelled dev-only placeholder secret. Production deployments must supply `Jwt__Secret` (and the connection string) via environment variables or a secret manager — never commit real secrets to `appsettings.json`.
- The authenticated user's identity/role for every business decision comes exclusively from `ICurrentUserService`, which reads validated JWT claims off `HttpContext.User` — no controller or service trusts a `userId`/`role` field from a request body, query string, or route value.
- Customer data isolation is enforced at the API/service/data-query level (see `TicketService` in Assumptions above), not in the Angular app — the Angular guards (`authGuard`/`roleGuard`) are UX conveniences only, and every ticket endpoint independently re-checks ownership/role server-side regardless of what the client believes.
- 401 (no/invalid/expired token), 403 (authenticated but not permitted) and 404 (not found / hidden from this caller) are all mapped consistently through `ExceptionHandlingMiddleware` and the JWT bearer's `OnChallenge`/`OnForbidden` events into the same `ApiResponse` envelope used by every other endpoint.
- CORS is locked to the known Angular dev origins (`localhost:4200`), not a wildcard.
- All EF Core access goes through parameterized LINQ (no raw SQL), which is SQL-injection-safe by construction.

## Future Improvements

- Consider MediatR/CQRS if the Application layer's service surface grows large enough to warrant it (not adopted now to avoid overengineering a 12–16 hour assessment).
- Consider `Microsoft.AspNetCore.Identity` for full account management (password reset, lockout, refresh tokens) if the assessment scope ever grows beyond the four required roles — today only its `PasswordHasher<T>` primitive is used, against a custom `User` entity/table.
- Add OpenTelemetry/structured log shipping if this ever needs to run outside local development.
- Add a real ticket status transition state machine and server-side enforcement once that phase's rules are defined.
