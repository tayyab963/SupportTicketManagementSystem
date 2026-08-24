using System.Linq.Expressions;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Application.Common.Exceptions;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Application.Common.Models;
using SupportTicketSystem.Application.Tickets;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Domain.Rules;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.Infrastructure.Services;

/// <summary>
/// Customer data isolation is enforced here, at the data-query level, not just checked after the
/// fact: <see cref="ApplyDetailVisibilityScope"/>/<see cref="ApplyListVisibilityScope"/> filter the
/// IQueryable by the authenticated caller's role *before* the query runs, so a Customer's query for
/// another customer's ticket returns no rows at all — it 404s exactly like a nonexistent ticket
/// would, rather than confirming (via a 403) that the ticket exists under someone else's account.
/// </summary>
public class TicketService : ITicketService
{
    private const string TicketNumberPrefix = "TKT-";
    private const int TicketNumberDigits = 6;
    private const int MaxTicketNumberAttempts = 5;

    private static readonly Expression<Func<Ticket, int>> PriorityRank = t =>
        t.Priority == TicketPriority.Critical ? 4 :
        t.Priority == TicketPriority.High ? 3 :
        t.Priority == TicketPriority.Medium ? 2 : 1;

    private static readonly Expression<Func<Ticket, int>> StatusRank = t =>
        t.Status == TicketStatus.Closed ? 4 :
        t.Status == TicketStatus.Resolved ? 3 :
        t.Status == TicketStatus.InProgress ? 2 : 1;

    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public TicketService(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<TicketListItemDto>> GetTicketsAsync(TicketQueryParameters query, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var tickets = ApplyListVisibilityScope(_db.Tickets.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            tickets = tickets.Where(t =>
                t.TicketNumber.ToLower().Contains(search) ||
                t.Title.ToLower().Contains(search) ||
                t.Description.ToLower().Contains(search));
        }

        if (query.Status is { } status)
        {
            tickets = tickets.Where(t => t.Status == status);
        }

        if (query.Priority is { } priority)
        {
            tickets = tickets.Where(t => t.Priority == priority);
        }

        if (query.Unassigned == true)
        {
            tickets = tickets.Where(t => t.AssignedAgentId == null);
        }
        else if (query.AssignedAgentId is { } assignedAgentId)
        {
            tickets = tickets.Where(t => t.AssignedAgentId == assignedAgentId);
        }

        if (query.CustomerId is { } customerId)
        {
            tickets = tickets.Where(t => t.CustomerId == customerId);
        }

        if (query.DateFrom is { } dateFrom)
        {
            tickets = tickets.Where(t => t.CreatedAt >= dateFrom);
        }

        if (query.DateTo is { } dateTo)
        {
            tickets = tickets.Where(t => t.CreatedAt <= dateTo);
        }

        tickets = ApplySorting(tickets, query.SortBy, query.SortDescending);

        var totalCount = await tickets.CountAsync(cancellationToken);

        // Projected straight to the DTO inside the IQueryable pipeline (no .Include()) so the
        // database returns only the columns the list view needs, not full Customer/AssignedAgent
        // rows (which would otherwise carry PasswordHash and every other user column per page row).
        var pageItems = await tickets
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TicketListItemDto
            {
                Id = t.Id,
                TicketNumber = t.TicketNumber,
                Title = t.Title,
                Status = t.Status,
                Priority = t.Priority,
                CustomerId = t.CustomerId,
                CustomerName = t.Customer.FirstName + " " + t.Customer.LastName,
                AssignedAgentId = t.AssignedAgentId,
                AssignedAgentName = t.AssignedAgent == null ? null : t.AssignedAgent.FirstName + " " + t.AssignedAgent.LastName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<TicketListItemDto>
        {
            Items = pageItems,
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<TicketDetailDto> GetTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketWithDetailsAsync(ticketId, cancellationToken);
        return MapToDetail(ticket);
    }

    public async Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, CancellationToken cancellationToken = default)
    {
        Guid customerId;

        if (_currentUser.Role == UserRole.Customer)
        {
            // A customer can only ever open a ticket for themselves — any CustomerId in the body is ignored.
            customerId = _currentUser.UserId;
        }
        else if (_currentUser.Role == UserRole.Admin)
        {
            if (request.CustomerId is null)
            {
                throw new FluentValidation.ValidationException(new[]
                {
                    new ValidationFailure(nameof(request.CustomerId), "CustomerId is required when an admin creates a ticket on behalf of a customer.")
                });
            }

            var customerExists = await _db.Users
                .AsNoTracking()
                .AnyAsync(u => u.Id == request.CustomerId && u.Role == UserRole.Customer, cancellationToken);

            if (!customerExists)
            {
                throw new NotFoundException("Target customer not found.");
            }

            customerId = request.CustomerId.Value;
        }
        else
        {
            throw new ForbiddenAccessException("Support agents cannot create tickets.");
        }

        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Status = TicketStatus.Open,
            Priority = request.Priority,
            CustomerId = customerId
        };

        _db.Tickets.Add(ticket);
        AddActivity(ticket, ActivityType.Created, null, $"Priority: {request.Priority}");

        // The ticket number is derived from the current max at generation time, so a retry loop
        // guards against the rare race where two concurrent creates compute the same next number —
        // the unique index on TicketNumber (see TicketConfiguration) rejects the loser, which is
        // caught here and regenerated against the now-current max instead of surfacing a 500.
        for (var attempt = 1; attempt <= MaxTicketNumberAttempts; attempt++)
        {
            ticket.TicketNumber = await GenerateNextTicketNumberAsync(cancellationToken);

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return await GetTicketByIdAsync(ticket.Id, cancellationToken);
            }
            catch (DbUpdateException) when (attempt < MaxTicketNumberAttempts)
            {
            }
        }

        throw new ConflictException("Could not generate a unique ticket number. Please try again.");
    }

    public async Task<TicketDetailDto> UpdateTicketAsync(Guid ticketId, UpdateTicketRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        switch (_currentUser.Role)
        {
            case UserRole.Customer:
                if (ticket.Status == TicketStatus.Closed)
                {
                    throw new ForbiddenAccessException("A closed ticket can no longer be edited.");
                }

                break;

            case UserRole.SupportAgent:
                EnsureAgentAssigned(ticket);
                break;

            default: // Admin
                break;
        }

        ticket.Title = request.Title.Trim();
        ticket.Description = request.Description.Trim();

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> ChangeStatusAsync(Guid ticketId, ChangeTicketStatusRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);
        var previousStatus = ticket.Status;

        if (!TicketStatusTransitionRules.IsValidTransition(previousStatus, request.Status))
        {
            throw new FluentValidation.ValidationException(new[]
            {
                new ValidationFailure(nameof(request.Status), $"Cannot change ticket status from '{previousStatus}' to '{request.Status}'.")
            });
        }

        EnsureCallerCanChangeStatus(ticket, previousStatus, request.Status);

        ticket.Status = request.Status;

        if (request.Status == TicketStatus.Resolved && ticket.ResolvedAt is null)
        {
            ticket.ResolvedAt = DateTime.UtcNow;
        }

        if (request.Status == TicketStatus.Closed)
        {
            ticket.ClosedAt = DateTime.UtcNow;
        }

        AddActivity(ticket, ActivityType.StatusChanged, previousStatus.ToString(), request.Status.ToString());

        // A distinct, explicitly-labeled activity in addition to the generic StatusChanged one, so the
        // timeline surfaces closing as its own tracked event per the Phase 4 spec ("closing" is listed
        // alongside, not folded into, "status changes").
        if (request.Status == TicketStatus.Closed)
        {
            AddActivity(ticket, ActivityType.Closed, previousStatus.ToString(), request.Status.ToString());
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> AssignAsync(Guid ticketId, AssignTicketRequest request, CancellationToken cancellationToken = default)
    {
        // Admin-only — enforced by [Authorize(Roles = nameof(UserRole.Admin))] on the controller action.
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        string? newAgentName = null;
        if (request.AgentId is { } agentId)
        {
            var agent = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == agentId && u.Role == UserRole.SupportAgent && u.IsActive)
                .Select(u => new { u.FirstName, u.LastName })
                .FirstOrDefaultAsync(cancellationToken);

            if (agent is null)
            {
                throw new NotFoundException("Agent not found.");
            }

            newAgentName = $"{agent.FirstName} {agent.LastName}";
        }

        if (ticket.AssignedAgentId != request.AgentId)
        {
            // Recorded by name (not the raw id) so the activity timeline can render "Assigned to John"
            // directly, without every reader having to resolve a user id to a name.
            var oldAgentName = ticket.AssignedAgentId is { } oldAgentId
                ? await _db.Users
                    .Where(u => u.Id == oldAgentId)
                    .Select(u => u.FirstName + " " + u.LastName)
                    .FirstOrDefaultAsync(cancellationToken)
                : null;

            AddActivity(ticket, ActivityType.AssignmentChanged, oldAgentName ?? "Unassigned", newAgentName ?? "Unassigned");
            ticket.AssignedAgentId = request.AgentId;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> ChangePriorityAsync(Guid ticketId, ChangeTicketPriorityRequest request, CancellationToken cancellationToken = default)
    {
        // Admin-only — enforced by [Authorize(Roles = nameof(UserRole.Admin))] on the controller action.
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        if (ticket.Priority != request.Priority)
        {
            AddActivity(ticket, ActivityType.PriorityChanged, ticket.Priority.ToString(), request.Priority.ToString());
            ticket.Priority = request.Priority;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> AddCommentAsync(Guid ticketId, CreateCommentRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        if (_currentUser.Role == UserRole.SupportAgent)
        {
            EnsureAgentAssigned(ticket);
        }

        _db.Comments.Add(new Comment
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            UserId = _currentUser.UserId,
            CommentText = request.CommentText.Trim()
        });

        AddActivity(ticket, ActivityType.CommentAdded, null, null);

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> AddTimeEntryAsync(Guid ticketId, CreateTimeEntryRequest request, CancellationToken cancellationToken = default)
    {
        // Customers never reach here — the controller restricts this endpoint to SupportAgent/Admin.
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        if (_currentUser.Role == UserRole.SupportAgent)
        {
            EnsureAgentAssigned(ticket);
        }

        _db.TimeEntries.Add(new TimeEntry
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            UserId = _currentUser.UserId,
            WorkDate = request.WorkDate,
            DurationMinutes = request.DurationMinutes,
            Description = request.Description.Trim()
        });

        // NewValue holds the raw minute count (not a pre-formatted phrase) so callers/UI can render
        // it however they like, e.g. as "1h 30m logged" on the activity timeline.
        AddActivity(ticket, ActivityType.TimeLogged, null, request.DurationMinutes.ToString());

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<List<CommentDto>> GetCommentsAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        await EnsureTicketVisibleAsync(ticketId, cancellationToken);

        return await _db.Comments
            .AsNoTracking()
            .Where(c => c.TicketId == ticketId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto
            {
                Id = c.Id,
                UserId = c.UserId,
                UserName = c.User.FirstName + " " + c.User.LastName,
                UserRole = c.User.Role,
                CommentText = c.CommentText,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<List<ActivityDto>> GetTimelineAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        await EnsureTicketVisibleAsync(ticketId, cancellationToken);

        return await _db.TicketActivities
            .AsNoTracking()
            .Where(a => a.TicketId == ticketId)
            .OrderBy(a => a.CreatedAt)
            .Select(a => new ActivityDto
            {
                Id = a.Id,
                ActivityType = a.ActivityType,
                Description = a.Description,
                UserId = a.UserId,
                UserName = a.User.FirstName + " " + a.User.LastName,
                OldValue = a.OldValue,
                NewValue = a.NewValue,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    /// <summary>Staff-only (enforced via [Authorize(Roles = ...)] on the controller action) — internal work logs are not exposed to customers, same as TicketDetailDto.TimeEntries.</summary>
    public async Task<TimeEntrySummaryDto> GetTimeEntriesAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        await EnsureTicketVisibleAsync(ticketId, cancellationToken);

        var entries = await _db.TimeEntries
            .AsNoTracking()
            .Where(te => te.TicketId == ticketId)
            .OrderBy(te => te.WorkDate)
            .Select(te => new TimeEntryDto
            {
                Id = te.Id,
                UserId = te.UserId,
                UserName = te.User.FirstName + " " + te.User.LastName,
                WorkDate = te.WorkDate,
                DurationMinutes = te.DurationMinutes,
                Description = te.Description,
                CreatedAt = te.CreatedAt
            })
            .ToListAsync(cancellationToken);

        // Summed from the already-materialized (small, per-ticket) list rather than issuing a second
        // round trip for a SUM the database has already effectively computed once here.
        var totalDurationMinutes = entries.Sum(e => e.DurationMinutes);

        return new TimeEntrySummaryDto
        {
            Entries = entries,
            TotalDurationMinutes = totalDurationMinutes
        };
    }

    /// <summary>
    /// Stricter than <see cref="ApplyDetailVisibilityScope"/>: an Agent's ticket LIST is scoped to
    /// only the tickets assigned to them (the Phase 3 "Agent: see assigned tickets" rule). Looking up
    /// a single ticket by ID stays open to any Agent for triage purposes — see
    /// <see cref="ApplyDetailVisibilityScope"/> for that distinction.
    /// </summary>
    private IQueryable<Ticket> ApplyListVisibilityScope(IQueryable<Ticket> query) => _currentUser.Role switch
    {
        UserRole.Customer => query.Where(t => t.CustomerId == _currentUser.UserId),
        UserRole.SupportAgent => query.Where(t => t.AssignedAgentId == _currentUser.UserId),
        _ => query // Admin sees everything, narrowed further by whatever filters were supplied.
    };

    /// <summary>
    /// Used for GET-by-id and every mutation. Agents/Admins can see (and, for Admins, mutate) any
    /// ticket for triage; mutation actions are separately rejected with 403 for an Agent who isn't
    /// assigned to the ticket via <see cref="EnsureAgentAssigned"/>.
    /// </summary>
    private IQueryable<Ticket> ApplyDetailVisibilityScope(IQueryable<Ticket> query) =>
        _currentUser.Role == UserRole.Customer
            ? query.Where(t => t.CustomerId == _currentUser.UserId)
            : query;

    private async Task<Ticket> LoadScopedTicketWithDetailsAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        IQueryable<Ticket> query = ApplyDetailVisibilityScope(_db.Tickets.AsNoTracking())
            .Include(t => t.Customer)
            .Include(t => t.AssignedAgent)
            .Include(t => t.Comments).ThenInclude(c => c.User);

        // TimeEntries are staff-only (see MapToDetail) and never read for a Customer caller, so skip
        // the extra join/hydration entirely rather than loading and then discarding it.
        if (_currentUser.Role != UserRole.Customer)
        {
            query = query.Include(t => t.TimeEntries).ThenInclude(te => te.User);
        }

        var ticket = await query.FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        // A ticket that truly doesn't exist and one that exists but is outside this caller's scope
        // (e.g. another customer's ticket) are indistinguishable here by design.
        return ticket ?? throw new NotFoundException("Ticket not found.");
    }

    private async Task<Ticket> LoadScopedTicketForMutationAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await ApplyDetailVisibilityScope(_db.Tickets)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        return ticket ?? throw new NotFoundException("Ticket not found.");
    }

    /// <summary>
    /// Existence + visibility check for a ticket's sub-resources (comments/timeline/time-entries) that
    /// don't need the Ticket entity itself — same 404-not-403 scoping as
    /// <see cref="LoadScopedTicketWithDetailsAsync"/>, without loading the whole ticket.
    /// </summary>
    private async Task EnsureTicketVisibleAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var exists = await ApplyDetailVisibilityScope(_db.Tickets.AsNoTracking())
            .AnyAsync(t => t.Id == ticketId, cancellationToken);

        if (!exists)
        {
            throw new NotFoundException("Ticket not found.");
        }
    }

    private void EnsureAgentAssigned(Ticket ticket)
    {
        if (ticket.AssignedAgentId != _currentUser.UserId)
        {
            throw new ForbiddenAccessException("Only the agent assigned to this ticket (or an admin) can perform this action.");
        }
    }

    /// <summary>
    /// Role rules on top of the pure state machine (TicketStatusTransitionRules): a Customer may only
    /// close a resolved ticket of their own; every other legal transition is staff-only. An Agent must
    /// be assigned to the ticket, and may drive any transition except the closing one, which is
    /// reserved for the customer (or an admin, who is unrestricted here).
    /// </summary>
    private void EnsureCallerCanChangeStatus(Ticket ticket, TicketStatus from, TicketStatus to)
    {
        switch (_currentUser.Role)
        {
            case UserRole.Customer:
                if (!(from == TicketStatus.Resolved && to == TicketStatus.Closed))
                {
                    throw new ForbiddenAccessException("Customers may only close a resolved ticket.");
                }

                break;

            case UserRole.SupportAgent:
                EnsureAgentAssigned(ticket);
                if (from == TicketStatus.Resolved && to == TicketStatus.Closed)
                {
                    throw new ForbiddenAccessException("Only the customer (or an admin) can close a resolved ticket.");
                }

                break;

            case UserRole.Admin:
                break;
        }
    }

    private static IQueryable<Ticket> ApplySorting(IQueryable<Ticket> query, TicketSortBy sortBy, bool descending) => sortBy switch
    {
        TicketSortBy.UpdatedAt => descending ? query.OrderByDescending(t => t.UpdatedAt) : query.OrderBy(t => t.UpdatedAt),
        // Priority/Status are persisted as strings (see TicketConfiguration), so ordering by the raw
        // column would sort alphabetically ("Critical" < "High" < "Low" < "Medium") instead of by
        // business severity/workflow order — PriorityRank/StatusRank re-map to the intended order.
        TicketSortBy.Priority => descending ? query.OrderByDescending(PriorityRank) : query.OrderBy(PriorityRank),
        TicketSortBy.Status => descending ? query.OrderByDescending(StatusRank) : query.OrderBy(StatusRank),
        _ => descending ? query.OrderByDescending(t => t.CreatedAt) : query.OrderBy(t => t.CreatedAt)
    };

    private async Task<string> GenerateNextTicketNumberAsync(CancellationToken cancellationToken)
    {
        var lastNumber = await _db.Tickets
            .OrderByDescending(t => t.TicketNumber)
            .Select(t => t.TicketNumber)
            .FirstOrDefaultAsync(cancellationToken);

        var nextSequence = 1;
        if (lastNumber is not null && int.TryParse(lastNumber.AsSpan(TicketNumberPrefix.Length), out var lastSequence))
        {
            nextSequence = lastSequence + 1;
        }

        return $"{TicketNumberPrefix}{nextSequence.ToString().PadLeft(TicketNumberDigits, '0')}";
    }

    /// <summary>
    /// Creates a TicketActivity and tracks it explicitly via _db.TicketActivities.Add — appending it
    /// only to ticket.Activities is not enough here: for an already-tracked (queried, not just-added)
    /// Ticket, EF's change-detection discovers new children reached purely through a navigation
    /// collection and, seeing our client-generated Guid key already has a non-default value, marks
    /// them Modified instead of Added, which the InMemory provider (and a real DB) then rejects as
    /// "no such row to update". Adding to the DbSet directly avoids that ambiguity.
    /// </summary>
    private void AddActivity(Ticket ticket, ActivityType activityType, string? oldValue, string? newValue)
    {
        var activity = new TicketActivity
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            UserId = _currentUser.UserId,
            ActivityType = activityType,
            Description = activityType.ToString(),
            OldValue = oldValue,
            NewValue = newValue
        };

        ticket.Activities.Add(activity);
        _db.TicketActivities.Add(activity);
    }

    private TicketDetailDto MapToDetail(Ticket ticket)
    {
        var includeTimeEntries = _currentUser.Role != UserRole.Customer;

        return new TicketDetailDto
        {
            Id = ticket.Id,
            TicketNumber = ticket.TicketNumber,
            Title = ticket.Title,
            Description = ticket.Description,
            Status = ticket.Status,
            Priority = ticket.Priority,
            CustomerId = ticket.CustomerId,
            CustomerName = $"{ticket.Customer.FirstName} {ticket.Customer.LastName}",
            AssignedAgentId = ticket.AssignedAgentId,
            AssignedAgentName = ticket.AssignedAgent is null ? null : $"{ticket.AssignedAgent.FirstName} {ticket.AssignedAgent.LastName}",
            CreatedAt = ticket.CreatedAt,
            UpdatedAt = ticket.UpdatedAt,
            ResolvedAt = ticket.ResolvedAt,
            ClosedAt = ticket.ClosedAt,
            Comments = ticket.Comments
                .OrderBy(c => c.CreatedAt)
                .Select(c => new CommentDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    UserName = $"{c.User.FirstName} {c.User.LastName}",
                    UserRole = c.User.Role,
                    CommentText = c.CommentText,
                    CreatedAt = c.CreatedAt
                })
                .ToList(),
            TimeEntries = includeTimeEntries
                ? ticket.TimeEntries
                    .OrderBy(te => te.WorkDate)
                    .Select(te => new TimeEntryDto
                    {
                        Id = te.Id,
                        UserId = te.UserId,
                        UserName = $"{te.User.FirstName} {te.User.LastName}",
                        WorkDate = te.WorkDate,
                        DurationMinutes = te.DurationMinutes,
                        Description = te.Description,
                        CreatedAt = te.CreatedAt
                    })
                    .ToList()
                : null
        };
    }

}
