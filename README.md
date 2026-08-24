# Support Ticket Management System

A full-stack support ticket management platform built as a technical assessment.

**Backend:** ASP.NET Core 8 Web API, Entity Framework Core, SQL Server, JWT authentication, clean/layered architecture.
**Frontend:** Angular 20 (standalone components), Angular Material, TypeScript, RxJS.

> **Status: Phase 3 — Ticket Management.** This README reflects what is actually implemented today. See [Incomplete Requirements](#incomplete-requirements) for what is intentionally not yet built.

---

## Project Overview

The system lets **Customers** raise support tickets, **Support Agents** work assigned tickets, and **Admins** manage users, assignments and view analytics. Data isolation (a customer can never read another customer's ticket, even by guessing an ID) is enforced at the API/query level, not just in the UI.

## Features

Planned end-to-end feature set (tracked across upcoming phases):

- [x] JWT authentication with role-based authorization (Admin / SupportAgent / Customer)
- [x] Resource-level authorization (ownership + role checks on every ticket access)
- [x] Ticket CRUD with server-side paging, filtering, sorting and search *(never loads the caller's full accessible ticket set into memory — see [Ticket Query API](#ticket-query-api))*
- [x] Enforced ticket status transition rules *(state machine in `TicketStatusTransitionRules`, plus role rules on top — see [Ticket Status Rules](#ticket-status-rules))*
- [x] Assignment, priority and status management *(dedicated Admin-only endpoints for assign/priority)*
- [x] Comments and a full activity timeline per ticket
- [x] Time tracking (logging only — aggregated totals/reporting still pending)
- [x] Angular ticket list/detail/form UI with Material, Reactive Forms, and role-gated actions
- [ ] Admin dashboard with summary metrics, charts and agent workload
- [ ] Admin user management (UI)
- [x] Backend unit + integration tests, Angular unit tests

Phase 1 laid the architectural foundation; Phase 2 added the full auth/security layer; Phase 3 (this phase) adds complete ticket management — server-side paging/search/filter/sort, ticket status business rules, dedicated assign/priority endpoints, and the Angular ticket list/detail/form UI. Dashboard and admin user-management UI are tracked for later phases — see [Incomplete Requirements](#incomplete-requirements).

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
│   ├── SupportTicketSystem.Domain/            # Entities, enums, business rules — no external dependencies
│   │   ├── Entities/                          # User, Ticket, Comment, TicketActivity, TimeEntry
│   │   ├── Enums/                              # UserRole, TicketStatus, TicketPriority, ActivityType
│   │   ├── Rules/                              # TicketStatusTransitionRules — the ticket status state machine
│   │   └── Common/                             # IHasCreatedAt / IHasUpdatedAt audit interfaces
│   ├── SupportTicketSystem.Application/        # DTOs, service interfaces, validators (business logic)
│   │   ├── Auth/                               # LoginRequest/RegisterRequest/AuthResponseDto, IAuthService
│   │   ├── Tickets/                             # Ticket/Comment/TimeEntry/query DTOs, ITicketService
│   │   ├── Users/                               # IUserService (agent roster for assign/filter pickers)
│   │   └── Common/
│   │       ├── Models/                          # PagedResult<T>, JwtSettings
│   │       ├── Interfaces/                      # ICurrentUserService, IJwtTokenGenerator, IPasswordHasher
│   │       └── Exceptions/                      # NotFoundException, ForbiddenAccessException, ConflictException
│   ├── SupportTicketSystem.Infrastructure/     # EF Core DbContext, entity configs, migrations, auth/services
│   │   ├── Identity/                            # JwtTokenGenerator, PasswordHasherService, CurrentUserService
│   │   ├── Services/                            # AuthService, TicketService, UserService (isolation enforcement lives here)
│   │   └── Persistence/
│   │       ├── ApplicationDbContext.cs
│   │       ├── Configurations/                 # IEntityTypeConfiguration<T> per entity
│   │       ├── Migrations/                     # InitialCreate
│   │       └── Seed/DbSeeder.cs                 # Development-only seed accounts
│   ├── SupportTicketSystem.API/                # Controllers, Program.cs, Swagger, auth wiring
│   │   ├── Controllers/                         # AuthController, TicketsController, UsersController
│   │   ├── Middleware/                          # ExceptionHandlingMiddleware (401/403/404/409 mapping)
│   │   └── Common/ApiResponse.cs                # Shared success/error response envelope
│   ├── SupportTicketSystem.UnitTests/          # Pure Domain-level tests (entity defaults, status transition rules)
│   └── SupportTicketSystem.IntegrationTests/    # Auth flow, ticket isolation, status rules, query/paging (InMemory DB)
└── Frontend/
    └── support-ticket-ui/
        └── src/app/
            ├── core/
            │   ├── models/                      # ApiResponse<T>, PagedResult<T>, ticket.model.ts, user.model.ts, shared enums
            │   ├── services/                     # AuthService, TokenStorageService, TicketService, UserService
            │   ├── guards/                        # authGuard, guestGuard, roleGuard
            │   └── interceptors/                  # authInterceptor (attaches JWT), errorInterceptor (401 handling)
            ├── shared/components/                 # (empty — populated as reusable UI is built)
            └── features/
                ├── auth/pages/login/               # Real login form (AuthService-backed)
                ├── dashboard/pages/dashboard/
                ├── tickets/pages/{ticket-list,ticket-form,ticket-detail}/  # Paged/filterable list, create+edit form, full detail view
                ├── users/pages/user-list/           # Route is Admin-only (roleGuard) — still the Phase 1 placeholder
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
| `GET /api/tickets` | Any authenticated user | Paged/searched/filtered/sorted — see [Ticket Query API](#ticket-query-api). Customer: own only; Agent: assigned only; Admin: all |
| `POST /api/tickets` | Customer, Admin | Customer can only create for themselves |
| `GET /api/tickets/{id}` | Any authenticated user | 404 if outside the caller's scope. Unlike the list, any Agent/Admin can view any ticket for triage |
| `PUT /api/tickets/{id}` | Owner Customer, assigned Agent, Admin | Title/description only — see assign/priority endpoints below |
| `POST /api/tickets/{id}/assign` | Admin | Body: `{ agentId: Guid \| null }`; 404 if `agentId` isn't an active SupportAgent |
| `POST /api/tickets/{id}/priority` | Admin | Body: `{ priority: TicketPriority }` |
| `POST /api/tickets/{id}/comments` | Any authenticated user with visibility | |
| `POST /api/tickets/{id}/status` | Owner Customer (Resolved→Closed only), assigned Agent (any transition except closing), Admin (any) | See [Ticket Status Rules](#ticket-status-rules) |
| `POST /api/tickets/{id}/time-entries` | SupportAgent, Admin | Customers are rejected at the role level (403) |
| `GET /api/users/agents` | Admin, SupportAgent | Active support agents only, for assignment/filter dropdowns |

All responses use a shared envelope (`{ success, message, data }` or `{ success, message, errors }`), matching the Angular `ApiResponse<T>` model.

### Ticket Query API

`GET /api/tickets` accepts the following query parameters (all optional, all applied server-side against `IQueryable<Ticket>` — the caller's accessible ticket set is never loaded into memory to filter/sort/paginate client-side):

| Parameter | Type | Notes |
|---|---|---|
| `pageNumber`, `pageSize` | int | Default `1`/`20`; both are clamped (page ≥ 1, `1 ≤ pageSize ≤ 100`) rather than rejected |
| `search` | string | Case-insensitive match against ticket number, title, description |
| `status`, `priority` | enum | Exact match |
| `assignedAgentId` | Guid | Exact match |
| `unassigned` | bool | `true` filters to tickets with no assigned agent; takes precedence over `assignedAgentId` |
| `customerId` | Guid | Exact match (Admin/Agent use — a Customer caller is already scoped to their own regardless) |
| `dateFrom`, `dateTo` | DateTime | Inclusive range on `CreatedAt` |
| `sortBy` | `CreatedAt` \| `UpdatedAt` \| `Priority` \| `Status` | Default `CreatedAt` |
| `sortDescending` | bool | Default `true` |

`Priority`/`Status` are persisted as strings (see [Database Setup](#database-setup)), so sorting by the raw column would order alphabetically (`Critical` < `High` < `Low` < `Medium`) instead of by actual severity/workflow order — `TicketService` re-maps both to an explicit numeric rank before sorting so `sortBy=Priority` and `sortBy=Status` reflect genuine business order.

### Ticket Status Rules

Legal transitions (enforced in `Domain.Rules.TicketStatusTransitionRules`, independent of role):

```
Open → InProgress
InProgress → Resolved | Open
Resolved → Closed | InProgress
Closed → (terminal — no further transitions)
```

Any other requested transition (`Open → Resolved`, `Open → Closed`, anything out of `Closed`, or no-op) is rejected with `400 Bad Request` before role is even considered. On top of that state machine, `TicketService.EnsureCallerCanChangeStatus` restricts *who* may invoke a given legal transition:

- **Customer**: only `Resolved → Closed`, and only on their own ticket.
- **SupportAgent**: any legal transition except `Resolved → Closed`, and only on a ticket assigned to them.
- **Admin**: any legal transition, unrestricted.

Ticket numbers (`TKT-000001`, `TKT-000002`, ...) are generated from the current max sequence at creation time and guaranteed unique via the database's unique index on `TicketNumber` plus a bounded retry-on-conflict loop in `TicketService.CreateTicketAsync` — this covers the rare race between two concurrent creates without needing a database-specific sequence object.

## Testing

### Backend

```bash
cd Backend
dotnet test
```

Currently: 14 unit tests (`SupportTicketSystem.UnitTests` — entity defaults plus exhaustive `TicketStatusTransitionRules` coverage of every valid/invalid transition pair) and 43 integration tests (`SupportTicketSystem.IntegrationTests`, via `CustomWebApplicationFactory` — the real API host and middleware pipeline against an isolated EF Core InMemory database, so no LocalDB is needed to run the suite):

- `ApiFactoryTests` — host boots, DI resolves, unauthenticated requests to protected routes 401, unknown routes 404.
- `AuthTests` — register/login round-trip, wrong password / unknown email → 401, duplicate email → 409, weak password → 400 with field errors, a client-supplied `role` field on register is silently ignored (always Customer), `/auth/me` requires and reflects a valid token.
- `TicketIsolationTests` — the exact malicious-request scenarios called out by the assessment: a second customer (or an unassigned agent) attempting `GET`/`PUT`/comment/status/time-entry against another customer's ticket, asserting each is rejected with the correct status code (404 for cross-customer access, 403 for role/assignment violations, 401 unauthenticated), plus positive-path checks that the owning customer, assigned agent, and admin *can* perform the corresponding action.
- `TicketStatusTransitionTests` — illegal transitions rejected with 400 regardless of role, `Closed` is terminal, Admin can drive the full valid lifecycle including reopening, a Customer can't invoke an otherwise-legal transition that isn't theirs to make, and an assigned Agent can't close a resolved ticket (only the customer/admin can).
- `TicketAssignmentAndPriorityTests` — assign/unassign, 404 on a nonexistent or non-agent `agentId`, 403 for non-Admin callers on both endpoints.
- `TicketQueryTests` — sequential unique ticket numbers, pagination (page size/total count/total pages), case-insensitive search, status/priority/unassigned filters, `sortBy=Priority`/`sortBy=Status` ordering by actual business order (not alphabetical), and an Agent's list being scoped to only their assigned tickets while single-ticket lookup stays open for triage.

### Frontend

```bash
cd Frontend/support-ticket-ui
npm test -- --watch=false --browsers=ChromeHeadless
```

Currently 9 Karma/Jasmine specs: the `App` shell component, `getValidNextStatuses` (the client-side status-dropdown projection — see [Ticket Status Rules](#ticket-status-rules)), and `TicketService` (request shaping — query params, method/URL/body — and paged-result unwrapping) via `HttpTestingController`. Auth-critical logic (guards, interceptors, `AuthService`) and the ticket list/detail/form components are currently covered end-to-end via a manual/Playwright-driven browser pass (see below) rather than Karma unit specs — component-level specs for those are a good next addition.

## Manual Verification (this phase)

Performed as part of Phase 3, against a real LocalDB-backed API and the Angular dev server, driven headlessly end-to-end with Playwright across all three roles in one continuous flow:

- Customer logs in, creates a ticket via `TicketFormComponent` (Reactive Forms), lands on `TicketDetailComponent`, and sees a `TKT-000NNN` ticket number.
- Ticket list search narrows results; Admin sees an Agent filter that Customer/Agent views don't.
- Admin changes priority, assigns the ticket to an agent, and confirms the status dropdown from `Open` offers *only* `InProgress` (not `Resolved`/`Closed`) — moves it to `InProgress`.
- Agent logs in and the ticket list is scoped to only their assigned tickets; moves status `InProgress → Resolved`; logs a time entry.
- Customer confirms the ticket shows `Resolved` and successfully closes it (`Resolved → Closed`), exercising the "customer can only close a resolved ticket" rule end-to-end.
- No browser console errors across the whole flow; a page-level horizontal-overflow bug in the toolbar at narrow viewports (390px) was caught by this pass and fixed (`app.scss` — flex items need `min-width: 0` to actually shrink/ellipsize instead of forcing the page wider than the viewport).
- (Phase 2, retained) Login via Swagger's "Authorize" flow for each seeded role; wrong password → 401; `authGuard`/`roleGuard` redirect behavior; customer isolation against a live ticket.

## Assumptions

- SQL Server LocalDB is available locally (ships with Visual Studio); any SQL Server-compatible instance works if the connection string is updated.
- Entity primary keys are `Guid` (not sequential `int`s) as defense-in-depth against ID enumeration, on top of the mandatory server-side ownership checks.
- `CreatedAt`/`UpdatedAt` are stamped automatically in `ApplicationDbContext.SaveChanges(Async)` via `IHasCreatedAt`/`IHasUpdatedAt` marker interfaces, so individual services never need to remember to set them.
- Angular 20's Material 3 `mat.theme()` API is used (not the legacy `mat-*-theme` mixins), since that's what `ng add @angular/material` generates on this Angular Material version.
- No full `Microsoft.AspNetCore.Identity` (`UserManager`/`RoleManager`) — the `User` entity is custom, and `Microsoft.Extensions.Identity.Core`'s `PasswordHasher<T>` is used directly for hashing (see [Future Improvements](#future-improvements)).
- Enums (`UserRole`, `TicketStatus`, `TicketPriority`, `ActivityType`) are annotated with `[JsonConverter(typeof(JsonStringEnumConverter))]` directly on the Domain type, so they always serialize as their string name over HTTP regardless of which serializer options a given caller uses — matching the Angular string enums in `core/models/enums.ts` and avoiding surprises in ad-hoc tooling that doesn't share the API's global JSON options.
- Ticket data isolation is enforced at the data-query level. Two distinct scopes exist in `TicketService`, deliberately: `ApplyListVisibilityScope` (GET /api/tickets — Customer sees only their own, Agent sees only tickets *assigned to them*, Admin sees all) is stricter than `ApplyDetailVisibilityScope` (GET-by-id and every mutation — Customer still only their own, but any Agent/Admin can look up any ticket for triage; mutating one an Agent isn't assigned to is separately rejected with 403). A Customer probing another customer's ticket ID gets the same 404 as a nonexistent ticket either way — existence is never confirmed to a caller who shouldn't see it.
- Public self-registration (`POST /api/auth/register`) always creates a `Customer` — the request DTO has no `Role` field, so a client cannot request Admin/SupportAgent for itself even by adding an extra JSON field (verified by `AuthTests.Register_IgnoresClientSuppliedRole_AlwaysCreatesCustomer`).
- Any authenticated user with visibility into a ticket can comment on it (Customer, Agent, and Admin alike) — the Phase 3 role table calls out "comment" for Customer and Agent specifically, but nothing suggests Admin should be *less* capable than either, and this matches the pre-existing, already-tested Phase 2 behavior.
- The Angular status dropdown (`getValidNextStatuses` in `core/models/ticket.model.ts`) is a client-side *projection* of the backend's transition rules, used only to populate sensible options in the UI — it is not the authority. The backend (`TicketStatusTransitionRules` + `TicketService.EnsureCallerCanChangeStatus`) independently re-validates every request regardless of what the dropdown offered, per the requirement that transition validation live in the service layer, not Angular.
- Priority and assignment changes are dedicated Admin-only endpoints/DTOs (`AssignTicketRequest`, `ChangeTicketPriorityRequest`) rather than fields on the general `PUT /api/tickets/{id}` edit, so each can be independently `[Authorize(Roles = "Admin")]`-gated without a broader edit endpoint having to reason about which fields are role-restricted.

## Incomplete Requirements

Everything below is **explicitly not built yet** — it is scoped to later phases of this assessment, not omitted by oversight:

- No admin dashboard (summary metrics, charts, agent workload)
- No Angular admin user-management UI (the `/users` route exists and is Admin-gated, but the page itself is still the Phase 1 placeholder)
- No Angular unit tests yet for `AuthService`/guards/interceptors, or component-level specs for the ticket list/detail/form components specifically (covered by manual + Playwright verification this phase — see above)
- No aggregated time-tracking totals/reporting (logging individual entries works)
- Date-range filtering (`dateFrom`/`dateTo`) and the `customerId` filter are implemented and tested on the backend `GET /api/tickets` API, but intentionally not exposed as Angular list controls — the Phase 3 UI spec's required list controls are search, status, priority, agent, sort and pagination only

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
- Add aggregated time-tracking totals/reporting once the dashboard phase defines what "reporting" should show.
- Add component-level Angular specs for the ticket list/detail/form components (currently covered by manual + Playwright verification — see [Manual Verification](#manual-verification-this-phase)).
