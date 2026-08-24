# Support Ticket Management System

A full-stack support ticket management platform built as a technical assessment (target scope: 12–16 hours).

**Backend:** ASP.NET Core 8 Web API, Entity Framework Core, SQL Server, JWT authentication, layered/clean architecture.
**Frontend:** Angular 20 (standalone components), Angular Material, TypeScript, RxJS, Reactive Forms.

> **Status: Phase 7 — Final Audit & Documentation.** All core requirements (auth, ticket lifecycle, comments/timeline/time-tracking, admin dashboard, admin user management) are implemented, tested, and have been through a dedicated security/performance/UX audit pass. See [Incomplete Requirements](#incomplete-requirements) for what remains intentionally out of scope.

---

## 1. Project Overview

The system lets **Customers** raise and track support tickets, **Support Agents** work the tickets assigned to them, and **Admins** manage users, assignments, priorities and view cross-organization analytics. Data isolation — a customer can never read, modify, or even confirm the existence of another customer's ticket, even by guessing an ID — is enforced at the API/query level, not just hidden in the UI.

## 2. Features

- [x] JWT authentication (login, self-registration) with role-based authorization (Admin / SupportAgent / Customer)
- [x] Resource-level authorization — ownership + role checks on every ticket access, independent of the client
- [x] Ticket CRUD with server-side paging, filtering, sorting and search (never loads the caller's full accessible ticket set into memory)
- [x] Enforced ticket status transition rules (state machine in `TicketStatusTransitionRules`, plus role rules on top)
- [x] Assignment, priority and status management (dedicated Admin-only endpoints for assign/priority)
- [x] Comments and a full activity timeline per ticket
- [x] Time tracking (log entries + a server-computed running total per ticket)
- [x] Admin dashboard — ticket totals by status/priority, average resolution time, per-agent workload
- [x] Admin user management UI — create/edit users of any role, activate/deactivate, search/filter/paginate
- [x] Angular ticket list/detail/form UI with Material, Reactive Forms, and role-gated actions
- [x] Role-aware navigation menu, success/error snackbar notifications, confirmation dialogs for destructive actions
- [x] Backend unit + integration tests (130), Angular unit tests (100)
- [ ] Customer/Agent self-service profile editing (page exists, still a placeholder — see [Incomplete Requirements](#incomplete-requirements))

## 3. Architecture

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
│   ├── SupportTicketSystem.Application/        # DTOs, service interfaces, validators (business logic contracts)
│   │   ├── Auth/                               # LoginRequest/RegisterRequest/AuthResponseDto, IAuthService
│   │   ├── Tickets/                            # Ticket/Comment/TimeEntry/query DTOs, ITicketService
│   │   ├── Users/                              # CreateUserRequest/UpdateUserRequest, IUserService
│   │   ├── Dashboard/                          # DashboardSummaryDto, AgentWorkloadDto, IDashboardService
│   │   └── Common/
│   │       ├── Models/                          # PagedResult<T>, JwtSettings
│   │       ├── Interfaces/                      # ICurrentUserService, IJwtTokenGenerator, IPasswordHasher
│   │       └── Exceptions/                      # NotFoundException, ForbiddenAccessException, ConflictException
│   ├── SupportTicketSystem.Infrastructure/     # EF Core DbContext, entity configs, migrations, auth/services
│   │   ├── Identity/                            # JwtTokenGenerator, PasswordHasherService, CurrentUserService
│   │   ├── Services/                            # AuthService, TicketService, UserService, DashboardService
│   │   └── Persistence/
│   │       ├── ApplicationDbContext.cs
│   │       ├── Configurations/                 # IEntityTypeConfiguration<T> per entity
│   │       ├── Migrations/                     # InitialCreate, AddTicketUpdatedAtIndex
│   │       └── Seed/DbSeeder.cs                 # Development-only seed accounts
│   ├── SupportTicketSystem.API/                # Controllers, Program.cs, Swagger, auth wiring
│   │   ├── Controllers/                         # AuthController, TicketsController, UsersController, DashboardController
│   │   ├── Middleware/                          # ExceptionHandlingMiddleware (401/403/404/409/500 mapping)
│   │   └── Common/ApiResponse.cs                # Shared success/error response envelope
│   ├── SupportTicketSystem.UnitTests/          # Pure Domain/service-level tests
│   └── SupportTicketSystem.IntegrationTests/    # Full HTTP pipeline tests (InMemory DB via WebApplicationFactory)
└── Frontend/
    └── support-ticket-ui/
        └── src/app/
            ├── core/
            │   ├── models/                      # ApiResponse<T>, PagedResult<T>, ticket/user/dashboard models, enums
            │   ├── services/                     # AuthService, TokenStorageService, TicketService, UserService, DashboardService
            │   ├── guards/                        # authGuard, guestGuard, roleGuard
            │   └── interceptors/                  # authInterceptor (attaches JWT), errorInterceptor (401 handling)
            ├── shared/components/                 # ConfirmDialogComponent (reusable Yes/No confirmation)
            └── features/
                ├── auth/pages/login/               # Reactive-form login (AuthService-backed)
                ├── dashboard/                       # Admin-only summary cards, status donut, priority bars, agent workload table
                ├── tickets/pages/{ticket-list,ticket-form,ticket-detail}/  # Paged/filterable list, create+edit form, full detail view
                ├── tickets/components/               # activity-timeline, comments-section, time-tracking
                ├── users/pages/user-list/           # Admin-only user management (search/filter/paginate/create/edit/activate/deactivate)
                └── profile/pages/profile/           # Placeholder — see Incomplete Requirements
```

Controllers never expose EF Core entities directly — only DTOs, defined in `SupportTicketSystem.Application` alongside the service interfaces and FluentValidation validators that operate on them. Every controller action is a thin delegate to a service method; there is no business logic, LINQ query, or direct `DbContext` use in a controller.

### Project references

`API → Application, Infrastructure` · `Infrastructure → Application, Domain` · `Application → Domain` · `UnitTests → Application, Domain, Infrastructure` · `IntegrationTests → API`

## 4. Technology Stack

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

## 5. Database Setup

The `Ticket`, `Comment`, `TicketActivity` and `TimeEntry` tables cascade-delete from their parent `Ticket`. All relationships back to `User` (customer, assigned agent, comment author, activity author, time entry author) use `Restrict` to avoid SQL Server's multiple-cascade-path error — users are meant to be deactivated (`IsActive`), not deleted.

| Entity | Notable constraints |
|---|---|
| `Users` | Unique index on `Email` |
| `Tickets` | Unique index on `TicketNumber`; indexes on `CustomerId`, `AssignedAgentId`, `Status`, `Priority`, `CreatedAt`, `UpdatedAt` |
| `Comments`, `TicketActivities`, `TimeEntries` | Indexed on `TicketId` and `UserId` |

By default the app targets **SQL Server LocalDB**:

```
Server=(localdb)\mssqllocaldb;Database=SupportTicketSystemDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True
```

To use a different SQL Server instance (or SQL Server Express/full/Docker), update `ConnectionStrings:DefaultConnection` in `Backend/SupportTicketSystem.API/appsettings.Development.json`, or override it with the `ConnectionStrings__DefaultConnection` environment variable.

## 6. Migration Commands

From the `Backend/` folder:

```bash
# apply all migrations and create the database
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

Two migrations exist: `InitialCreate` and `AddTicketUpdatedAtIndex` (adds the index needed by the `sortBy=UpdatedAt` ticket-list option — added during the Phase 7 performance audit). Both were verified against a fresh LocalDB database (`dotnet ef database drop` → `dotnet ef database update`) as part of this audit.

## 7. Running Backend

```bash
cd Backend
dotnet restore
dotnet build
dotnet ef database update --project SupportTicketSystem.Infrastructure --startup-project SupportTicketSystem.API
dotnet run --project SupportTicketSystem.API
```

The API listens on `http://localhost:5107` (and `https://localhost:7244`) by default, with Swagger UI at `/swagger`. CORS is pre-configured to allow `http://localhost:4200` / `https://localhost:4200` (the Angular dev server).

**Development convenience:** on every startup in the `Development` environment, `Program.cs` automatically applies any pending EF Core migrations and seeds the accounts listed in [Seed Accounts](#9-seed-accounts) (idempotent — it no-ops if any users already exist). This only runs in `Development`; the integration test host runs under a distinct `Testing` environment (see `CustomWebApplicationFactory`) specifically so `dotnet test` never touches a real database. The manual `dotnet ef database update` command above still works and is required for non-Development environments.

**Launch profile note:** either the `http` or `https` launch profile (`Properties/launchSettings.json`) works — `dotnet run --project SupportTicketSystem.API` uses `http` by default; Visual Studio's F5 may default to `https` instead, which additionally listens on `https://localhost:7244`. The Angular dev build only ever calls the plain `http://localhost:5107` URL either way, so this is safe now — see the Phase 7 audit summary below for why that used to matter.

## 8. Running Frontend

```bash
cd Frontend/support-ticket-ui
npm install
npm start
```

Serves at `http://localhost:4200`. `src/environments/environment.development.ts` points `apiUrl` at `http://localhost:5107/api`.

## 9. Seed Accounts

Seeded automatically on Development startup by `SupportTicketSystem.Infrastructure/Persistence/Seed/DbSeeder.cs`. These are intentionally simple, clearly-fake **development-only** credentials — never reuse this seeding approach or these passwords outside local development:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@123` |
| Support Agent | `agent1@example.com` | `Agent1@123` |
| Support Agent | `agent2@example.com` | `Agent2@123` |
| Customer | `customer1@example.com` | `Customer1@123` |
| Customer | `customer2@example.com` | `Customer2@123` |

New customer accounts can also be self-registered via `POST /api/auth/register` — that endpoint always creates a `Customer`-role account regardless of any other field sent in the request body; Admin/SupportAgent accounts are provisioned only via seed data or the Admin user-management UI (`POST /api/users`).

## 10. API Documentation (Swagger)

Swagger/OpenAPI is served at **`http://localhost:5107/swagger`** (Development environment only) with a JWT "Authorize" button wired into the security scheme — paste a raw token (no `Bearer ` prefix needed, Swashbuckle adds it) obtained from `POST /api/auth/login` to call protected endpoints from the UI.

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
| `GET /api/tickets/{id}/comments`, `/timeline`, `/time-entries` | Visibility-scoped (`time-entries` is staff-only) | |
| `POST /api/tickets/{id}/status` | Owner Customer (Resolved→Closed only), assigned Agent (any transition except closing), Admin (any) | See [Ticket Status Rules](#ticket-status-rules) |
| `POST /api/tickets/{id}/time-entries` | SupportAgent, Admin | Customers are rejected at the role level (403) |
| `GET /api/users/agents` | Admin, SupportAgent | Active support agents only, for assignment/filter dropdowns |
| `GET /api/users` | Admin | Paged/searched/filtered user list |
| `POST /api/users` | Admin | Create a user of any role |
| `PUT /api/users/{id}` | Admin | Update profile fields + role |
| `POST /api/users/{id}/activate`, `/deactivate` | Admin | Rejects deactivating the caller's own account (403) |
| `GET /api/dashboard/summary` | Admin | Ticket counts by status/priority, average resolution time, per-agent workload |

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

`Priority`/`Status` are persisted as strings, so sorting by the raw column would order alphabetically (`Critical` < `High` < `Low` < `Medium`) instead of by actual severity/workflow order — `TicketService` re-maps both to an explicit numeric rank before sorting so `sortBy=Priority` and `sortBy=Status` reflect genuine business order.

### Ticket Status Rules

Legal transitions (enforced in `Domain.Rules.TicketStatusTransitionRules`, independent of role):

```
Open → InProgress
InProgress → Resolved | Open
Resolved → Closed | InProgress
Closed → (terminal — no further transitions)
```

Any other requested transition (`Open → Resolved`, `Open → Closed`, anything out of `Closed`, or no-op) is rejected with `400 Bad Request` before role is even considered. On top of that state machine, `TicketService.EnsureCallerCanChangeStatus` restricts *who* may invoke a given legal transition:

- **Customer**: only `Resolved → Closed`, and only on their own ticket (the Angular UI gates this behind a confirmation dialog, since closing is final).
- **SupportAgent**: any legal transition except `Resolved → Closed`, and only on a ticket assigned to them.
- **Admin**: any legal transition, unrestricted.

## 11. Testing Commands

### Backend

```bash
cd Backend
dotnet test
```

**130 tests, all passing**: 39 unit tests (`SupportTicketSystem.UnitTests` — entity defaults, exhaustive `TicketStatusTransitionRules` coverage, and `TicketService` unit tests against a fake `ICurrentUserService`) and 91 integration tests (`SupportTicketSystem.IntegrationTests`, via `CustomWebApplicationFactory` — the real API host and middleware pipeline against an isolated EF Core InMemory database per test class, so no LocalDB is needed to run the suite):

- `ApiFactoryTests` — host boots, DI resolves, unauthenticated requests 401, unknown routes 404, malformed/tampered/**expired-but-validly-signed** bearer tokens all rejected with 401.
- `AuthTests` — register/login round-trip, wrong password / unknown email → 401, duplicate email → 409, weak password → 400, a client-supplied `role` field on register is silently ignored (always Customer), `/auth/me` requires and reflects a valid token.
- `TicketIsolationTests` / `CustomerDataIsolationTests` — the exact malicious-request scenarios called out by the assessment: a second customer (or an unassigned agent) attempting `GET`/`PUT`/comment/status/time-entry against another customer's ticket, `CustomerId` manipulation in create/update bodies, each asserted with the correct status code (404 for cross-customer access, 403 for role/assignment violations, 401 unauthenticated), plus positive-path checks that the owning customer, assigned agent, and admin *can* perform the corresponding action.
- `TicketStatusTransitionTests` — illegal transitions rejected with 400 regardless of role, `Closed` is terminal, Admin can drive the full valid lifecycle including reopening, a Customer can't invoke an otherwise-legal transition that isn't theirs to make, an assigned Agent can't close a resolved ticket.
- `TicketAssignmentAndPriorityTests` — assign/unassign, 404 on a nonexistent or non-agent `agentId`, 403 for non-Admin callers on both endpoints.
- `TicketQueryTests` — sequential unique ticket numbers, pagination, case-insensitive search, status/priority/unassigned filters, business-order sorting, an Agent's list scoped to only their assigned tickets while single-ticket lookup stays open for triage.
- `TicketCommentsTimelineAndTimeTrackingTests` — comment/timeline/time-entry visibility and isolation, an unassigned agent rejected on comments **and time entries**, total-duration summation, full-lifecycle timeline ordering.
- `UserManagementTests` — Admin-only matrix on every `/api/users*` route including `GET /api/users/agents` explicitly rejecting a Customer, search/role/active filters, duplicate-email 409, self-deactivation 403, `PasswordHash` never serialized.
- `DashboardTests` — Admin-only access, correct aggregate figures.

### Frontend

```bash
cd Frontend/support-ticket-ui
npm test -- --watch=false --browsers=ChromeHeadless
```

**100 Karma/Jasmine specs, all passing** — guards (`authGuard`, `guestGuard`, `roleGuard`), interceptors (`authInterceptor`, `errorInterceptor`), `AuthService`, the `App` shell, `getValidNextStatuses`, `TicketService` request shaping, and component specs for the dashboard, ticket-list, ticket-form and ticket-detail pages.

### Manual / Browser Verification (Phase 7 audit)

Performed against a real LocalDB-backed API and the Angular dev server, driven headlessly with Playwright, covering the changes made in this audit pass:

- Customer login lands on `/tickets`; the new role-aware navigation menu shows only Tickets/Profile for a Customer.
- Admin login lands on `/dashboard`; the menu additionally shows Dashboard/Users; both pages load real data.
- A Customer or Agent manually navigating to `/dashboard` is redirected away (not shown a broken/403'd page) — confirms the `roleGuard` fix holds end-to-end, not just in unit tests.
- Deactivating a user now shows a confirmation dialog; **Cancel** leaves the account untouched, confirming shows a success snackbar.
- Changing a ticket's priority shows a success snackbar.
- Zero browser console errors across the whole flow.

## 12. Security Implementation

- Passwords are hashed with `Microsoft.AspNetCore.Identity`'s `PasswordHasher<T>` (PBKDF2) — never stored in plaintext, never logged.
- JWTs are signed HS256, carry `UserId`/`Email`/`Role` claims, and are validated on every request against configured issuer, audience, signing key **and expiration** (`ValidateLifetime = true`, `ClockSkew = TimeSpan.Zero`) — bound from `IOptions<JwtSettings>` rather than read once at startup, so configuration changes (including test-time overrides) are always honored.
- The JWT signing secret is **never** committed for real use: `appsettings.json` (the base/production file) ships with an empty `Jwt:Secret`, and `appsettings.Development.json` carries an explicitly-labelled dev-only placeholder secret. Production deployments must supply `Jwt__Secret` (and the connection string) via environment variables or a secret manager.
- The authenticated user's identity/role for every business decision comes exclusively from `ICurrentUserService`, which reads validated JWT claims off `HttpContext.User` — no controller or service trusts a `userId`/`role` field from a request body, query string, or route value.
- 401 (no/invalid/expired token), 403 (authenticated but not permitted) and 404 (not found / hidden from this caller) are all mapped consistently through `ExceptionHandlingMiddleware` and the JWT bearer's `OnChallenge`/`OnForbidden` events into the same `ApiResponse` envelope used by every other endpoint. Unhandled exceptions map to a generic 500 with no stack trace or internal detail ever serialized to the client, in any environment.
- CORS is locked to the known Angular dev origins (`localhost:4200`), not a wildcard.
- All EF Core access goes through parameterized LINQ (no raw SQL), which is SQL-injection-safe by construction.
- The Angular guards (`authGuard`/`roleGuard`) and role-aware navigation menu are UX conveniences only — every protected route/action is independently re-checked server-side regardless of what the client believes or displays.

### Security audit (Phase 7)

A dedicated authorization/IDOR audit was performed against this codebase, attempting each of the following bypasses by tracing the actual controller → service → query code paths (not just reading the tests). **No exploitable vulnerability was found.** Summary:

| Attack attempted | Result | Enforced by |
|---|---|---|
| Customer reads/modifies another customer's ticket | Blocked (404) | `TicketService.ApplyDetailVisibilityScope` — query-scoped by `CustomerId` before the row is ever loaded |
| Customer manipulates `CustomerId` in create/update body | Blocked | `CreateTicketAsync` ignores the body's `CustomerId` for a Customer caller; `UpdateTicketRequest` has no `CustomerId` field at all |
| Customer/Agent manipulates a `role` field to self-escalate | Blocked | `RegisterRequest` has no `Role` property; user-management endpoints that do accept `Role` are Admin-only |
| Agent accesses another agent's assigned ticket | Read allowed by design (triage), mutation blocked (403) | `EnsureAgentAssigned` on every mutating action |
| Non-Admin accesses the dashboard | Blocked (403) | `[Authorize(Roles = "Admin")]` on `DashboardController` |
| Non-Admin accesses user management | Blocked (403) | `[Authorize(Roles = "Admin")]` on `UsersController` (agents-list excepted, itself role-gated) |
| Tampered / expired JWT | Blocked (401) | `TokenValidationParameters` (signature, issuer, audience, lifetime all validated) |
| IDOR existence probing (403 vs 404 side-channel) | Not exploitable | Every scoped lookup returns a uniform 404 whether the resource doesn't exist or belongs to someone else — a caller can never distinguish the two |
| Mass assignment via extra JSON fields | Blocked | Every DTO is a narrow, hand-written class; no controller binds directly to a Domain entity |

Three minor **test-coverage gaps** (not vulnerabilities — the code path was already protected by the same guard used and tested elsewhere) were found and closed during this audit:
- An unassigned agent posting a time entry now has an explicit 403 test (`TicketCommentsTimelineAndTimeTrackingTests`).
- A Customer calling `GET /api/users/agents` now has an explicit 403 test (`UserManagementTests`).
- An expired-but-validly-signed JWT now has an explicit 401 test (`ApiFactoryTests`).

## 13. Data Isolation Approach

Ticket data isolation is enforced at the data-query level, in `SupportTicketSystem.Infrastructure.Services.TicketService`. Two distinct scopes exist deliberately:

- `ApplyListVisibilityScope` (`GET /api/tickets`) — Customer sees only their own tickets, Agent sees only tickets *assigned to them*, Admin sees all.
- `ApplyDetailVisibilityScope` (GET-by-id and every mutation) — stricter for Customers (still only their own), but any Agent/Admin can look up any ticket by ID for triage purposes; an Agent *mutating* a ticket they aren't assigned to is separately rejected with 403 via `EnsureAgentAssigned`.

A Customer probing another customer's ticket ID gets the same 404 as a nonexistent ticket either way — existence is never confirmed to a caller who shouldn't see it. This scoping is applied to the `IQueryable<Ticket>` *before* the query executes against the database, not filtered from an in-memory result set, so it can't be bypassed by a query shape the service didn't anticipate.

User-management endpoints use a simpler model: they are Admin-only in their entirety (`[Authorize(Roles = "Admin")]` at the controller-action level), so no additional row-level scoping is needed there — an Admin's authority is global by design.

## 14. Assumptions

- SQL Server LocalDB is available locally (ships with Visual Studio); any SQL Server-compatible instance works if the connection string is updated.
- Entity primary keys are `Guid` (not sequential `int`s) as defense-in-depth against ID enumeration, on top of the mandatory server-side ownership checks.
- `CreatedAt`/`UpdatedAt` are stamped automatically in `ApplicationDbContext.SaveChanges(Async)` via `IHasCreatedAt`/`IHasUpdatedAt` marker interfaces.
- Angular 20's Material 3 `mat.theme()` API is used (not the legacy `mat-*-theme` mixins), since that's what `ng add @angular/material` generates on this Angular Material version.
- No full `Microsoft.AspNetCore.Identity` (`UserManager`/`RoleManager`) — the `User` entity is custom, and `Microsoft.Extensions.Identity.Core`'s `PasswordHasher<T>` is used directly for hashing.
- Enums (`UserRole`, `TicketStatus`, `TicketPriority`, `ActivityType`) are annotated with `[JsonConverter(typeof(JsonStringEnumConverter))]` directly on the Domain type, so they always serialize as their string name over HTTP — matching the Angular string enums in `core/models/enums.ts`.
- Public self-registration (`POST /api/auth/register`) always creates a `Customer` — the request DTO has no `Role` field, so a client cannot request Admin/SupportAgent for itself even by adding an extra JSON field.
- Any authenticated user with visibility into a ticket can comment on it (Customer, Agent, and Admin alike).
- The Angular status dropdown (`getValidNextStatuses` in `core/models/ticket.model.ts`) is a client-side *projection* of the backend's transition rules, used only to populate sensible options in the UI — it is not the authority. The backend independently re-validates every request regardless of what the dropdown offered.
- After the Phase 7 audit, the default post-login landing page differs deliberately by role: Admin lands on `/dashboard` (a meaningful default for that role); a Customer or Agent hitting `/dashboard` — whether as a post-login default or by typing the URL — is bounced by `roleGuard` to `/tickets`, which is reachable by every role. This was a real bug found during the audit (the dashboard route previously had no role guard at all, so non-admins landed on a page whose only API call 403'd) and is now covered by both guard unit tests and an end-to-end Playwright pass.
- A lightweight role-aware navigation menu (hamburger icon in the toolbar) was added during the audit — the app previously had no way to reach the Dashboard, Users, or Profile pages except by typing the URL directly, which made those built features effectively unreachable through normal use.

## 15. Incomplete Requirements

Everything below is **explicitly not built**, called out here rather than left silently missing:

- **Customer/Agent self-service profile editing.** The `/profile` route and page exist and are reachable from the nav menu, but the page is still a placeholder ("Profile details will be implemented in a later phase") with no edit form. Only Admins can edit user profiles today, via `/users`. Not required by the assessment's role/permission matrix, so it was left out of scope for this audit pass rather than added as an unplanned feature.
- **Aggregated time-tracking reporting beyond the per-ticket total.** Logging individual time entries and a per-ticket running total both work; cross-ticket/cross-agent time reporting does not exist.
- **Mobile card-layout fallback for dense tables.** The ticket list, user list, and agent-workload tables are responsive via `overflow-x: auto` (horizontal scroll) on narrow viewports rather than a stacked card layout. This was flagged in the Phase 7 UX audit and consciously deferred — the app shell, dashboard, and ticket-detail sections all use proper responsive grids, but reworking three Material tables into a card view was judged to be out of proportion for the remaining time budget on this pass. Documented here per the "time-boxed assessment" constraint rather than left silently unaddressed.
- **Date-range filtering (`dateFrom`/`dateTo`) and the `customerId` filter** are implemented and tested on the backend `GET /api/tickets` API, but intentionally not exposed as Angular list controls — the assessment's required list controls are search, status, priority, agent, sort and pagination only.

## 16. Future Improvements

- Implement the Customer/Agent profile page (name/email/password change) using the same Reactive Forms + snackbar pattern already established elsewhere.
- Rework `ticket-list`/`user-list`/`agent-workload-table` into a card layout below a chosen breakpoint, instead of relying on horizontal scroll.
- Add aggregated time-tracking totals/reporting (by agent, by date range) now that the per-ticket data model already supports it.
- Consider MediatR/CQRS if the Application layer's service surface grows large enough to warrant it (not adopted now to avoid overengineering a 12–16 hour assessment).
- Consider `Microsoft.AspNetCore.Identity` for full account management (password reset, lockout, refresh tokens) if the assessment scope ever grows beyond the four required roles.
- Add OpenTelemetry/structured log shipping if this ever needs to run outside local development.
- The `TicketService.LoadScopedTicketWithDetailsAsync` query still `Include()`s full `Comment.User`/`TimeEntry.User` navigation properties (rather than a `.Select()` projection) to build a single ticket's detail view — acceptable given the bounded per-ticket row count, but a projection-based rewrite (matching what the Phase 7 performance audit already did for the ticket *list* query) would avoid materializing unused `User` columns like `PasswordHash` into memory even for that one row.
- Replace the plain HTML `<table>` in `time-tracking.component.ts` with `mat-table`, for visual/interaction consistency with the rest of the app's tables.

---

## Phase 7 Audit Summary

This phase was a structured final audit rather than new-feature work, covering backend architecture, security, EF Core performance, frontend/UX, and documentation. All findings below were either fixed or explicitly documented as a scoped compromise.

**Fixed:**
- Added the one missing FluentValidation validator (`AssignTicketRequestValidator`).
- Added `.AsNoTracking()` to four read-only queries that were missing it (`AuthService.LoginAsync`/`GetCurrentUserAsync`, two lookups in `TicketService`).
- Replaced an `Include()` + in-memory map with a direct `.Select()` projection for the ticket list query, avoiding materializing full `Customer`/`AssignedAgent` `User` rows per page.
- Replaced four correlated per-agent `Count()` subqueries in the dashboard's agent-workload aggregation with a single grouped query.
- Removed a redundant second database round trip in `GetTimeEntriesAsync` (summing in memory instead of re-querying).
- Skipped loading `TimeEntries` entirely for a Customer caller in `LoadScopedTicketWithDetailsAsync` (that role never sees them).
- Added a missing index on `Tickets.UpdatedAt` (an exposed sort option that had no supporting index) via a new migration, verified against a clean database.
- Fixed the dashboard route having no role guard (any authenticated user could hit an endpoint that would then 403) and the resulting broken landing experience for non-admins; added a role-aware navigation menu so the Dashboard/Users/Profile pages are actually reachable through the UI.
- Added a reusable confirmation dialog, wired into user deactivation and closing a ticket (both irreversible/impactful actions).
- Added success/error snackbar notifications across ticket create/update, status/priority/assignment changes, comments, time entries, and list-load failures (previously silent).
- Closed three security test-coverage gaps found during the audit (see [Security Implementation](#12-security-implementation)).
- **Removed `app.UseHttpsRedirection()` from `Program.cs`.** Found post-audit while reproducing a live login failure: when the API is launched under the `https` profile (e.g. Visual Studio's F5 default — see `launchSettings.json`), it listens on both `http://localhost:5107` and `https://localhost:7244`. `UseHttpsRedirection()` then 307-redirected every request — including the Angular dev build's login call, which only ever targets the `http` port — to the `https` port. That cross-port redirect breaks the CORS preflight for a JSON POST, so the browser reported it as a generic, unhelpful login failure with no clear underlying cause visible in the UI. Confirmed fixed by reproducing the exact scenario (`--launch-profile https`) and re-running both a raw HTTP request and a full Playwright browser login — both now succeed with zero console errors. HTTPS termination for a real deployment belongs to a reverse proxy in front of Kestrel, not an in-app redirect that only serves to break the one client this app actually has.

**Verified, no change needed:**
- No controller exposes an EF entity or contains business logic; DI, migrations, and seed data all passed review.
- No authorization bypass was found in a dedicated attempted-exploit pass across 12 attack scenarios (see the security audit table above).
- Lazy-loaded routes, guards wired to protected routes, interceptors, Reactive Forms, `takeUntilDestroyed()` RxJS hygiene, server-side pagination/filtering/search/sorting, and loading/empty states were all already correctly implemented.

**Documented as an accepted, time-boxed compromise (not fixed in this pass):** the mobile card-layout fallback and the profile page, both listed above under [Incomplete Requirements](#15-incomplete-requirements), and the two minor items under [Future Improvements](#16-future-improvements).
