using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Application.Common.Exceptions;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Application.Tickets;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.Infrastructure.Services;

/// <summary>
/// Customer data isolation is enforced here, at the data-query level, not just checked after the
/// fact: <see cref="ApplyVisibilityScope"/> filters the IQueryable by the authenticated caller's
/// CustomerId *before* it runs, so a Customer's query for another customer's ticket returns no rows
/// at all — it 404s exactly like a nonexistent ticket would, rather than confirming (via a 403) that
/// the ticket exists under someone else's account. Agents/Admins can see all tickets for triage, but
/// mutation actions on a ticket they are not assigned to are separately rejected with 403 via
/// <see cref="EnsureAgentAssigned"/>.
/// </summary>
public class TicketService : ITicketService
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public TicketService(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<List<TicketListItemDto>> GetTicketsAsync(CancellationToken cancellationToken = default)
    {
        var tickets = await ApplyVisibilityScope(_db.Tickets.AsNoTracking())
            .Include(t => t.Customer)
            .Include(t => t.AssignedAgent)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        return tickets.Select(MapToListItem).ToList();
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

            var targetCustomer = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == request.CustomerId && u.Role == UserRole.Customer, cancellationToken)
                ?? throw new NotFoundException("Target customer not found.");

            customerId = targetCustomer.Id;
        }
        else
        {
            throw new ForbiddenAccessException("Support agents cannot create tickets.");
        }

        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            TicketNumber = await GenerateTicketNumberAsync(cancellationToken),
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Status = TicketStatus.Open,
            Priority = request.Priority,
            CustomerId = customerId
        };

        AddActivity(ticket, ActivityType.Created, null, $"Priority: {request.Priority}");

        _db.Tickets.Add(ticket);
        await _db.SaveChangesAsync(cancellationToken);

        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
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

                ticket.Title = request.Title.Trim();
                ticket.Description = request.Description.Trim();
                break;

            case UserRole.SupportAgent:
                EnsureAgentAssigned(ticket);
                ApplyAgentOrAdminUpdate(ticket, request);
                break;

            default: // Admin
                ApplyAgentOrAdminUpdate(ticket, request);
                break;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> ChangeStatusAsync(Guid ticketId, ChangeTicketStatusRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

        if (_currentUser.Role == UserRole.Customer && request.Status != TicketStatus.Closed)
        {
            throw new ForbiddenAccessException("Customers may only close their own tickets.");
        }

        if (_currentUser.Role == UserRole.SupportAgent)
        {
            EnsureAgentAssigned(ticket);
        }

        var previousStatus = ticket.Status;
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

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketDetailDto> AddCommentAsync(Guid ticketId, CreateCommentRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await LoadScopedTicketForMutationAsync(ticketId, cancellationToken);

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

        AddActivity(ticket, ActivityType.TimeLogged, null, $"{request.DurationMinutes} minutes");

        await _db.SaveChangesAsync(cancellationToken);
        return await GetTicketByIdAsync(ticket.Id, cancellationToken);
    }

    private IQueryable<Ticket> ApplyVisibilityScope(IQueryable<Ticket> query) =>
        _currentUser.Role == UserRole.Customer
            ? query.Where(t => t.CustomerId == _currentUser.UserId)
            : query; // SupportAgent and Admin can see all tickets; write actions are further restricted per-action above.

    private async Task<Ticket> LoadScopedTicketWithDetailsAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await ApplyVisibilityScope(_db.Tickets.AsNoTracking())
            .Include(t => t.Customer)
            .Include(t => t.AssignedAgent)
            .Include(t => t.Comments).ThenInclude(c => c.User)
            .Include(t => t.TimeEntries).ThenInclude(te => te.User)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        // A ticket that truly doesn't exist and one that exists but is outside this caller's scope
        // (e.g. another customer's ticket) are indistinguishable here by design.
        return ticket ?? throw new NotFoundException("Ticket not found.");
    }

    private async Task<Ticket> LoadScopedTicketForMutationAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await ApplyVisibilityScope(_db.Tickets)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

        return ticket ?? throw new NotFoundException("Ticket not found.");
    }

    private void EnsureAgentAssigned(Ticket ticket)
    {
        if (ticket.AssignedAgentId != _currentUser.UserId)
        {
            throw new ForbiddenAccessException("Only the agent assigned to this ticket (or an admin) can perform this action.");
        }
    }

    private void ApplyAgentOrAdminUpdate(Ticket ticket, UpdateTicketRequest request)
    {
        ticket.Title = request.Title.Trim();
        ticket.Description = request.Description.Trim();

        if (ticket.Priority != request.Priority)
        {
            AddActivity(ticket, ActivityType.PriorityChanged, ticket.Priority.ToString(), request.Priority.ToString());
            ticket.Priority = request.Priority;
        }

        if (ticket.AssignedAgentId != request.AssignedAgentId)
        {
            AddActivity(
                ticket,
                ActivityType.AssignmentChanged,
                ticket.AssignedAgentId?.ToString() ?? "Unassigned",
                request.AssignedAgentId?.ToString() ?? "Unassigned");
            ticket.AssignedAgentId = request.AssignedAgentId;
        }
    }

    private async Task<string> GenerateTicketNumberAsync(CancellationToken cancellationToken)
    {
        var count = await _db.Tickets.CountAsync(cancellationToken);
        return $"TKT-{count + 1:D6}";
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

    private static TicketListItemDto MapToListItem(Ticket ticket) => new()
    {
        Id = ticket.Id,
        TicketNumber = ticket.TicketNumber,
        Title = ticket.Title,
        Status = ticket.Status,
        Priority = ticket.Priority,
        CustomerId = ticket.CustomerId,
        CustomerName = $"{ticket.Customer.FirstName} {ticket.Customer.LastName}",
        AssignedAgentId = ticket.AssignedAgentId,
        AssignedAgentName = ticket.AssignedAgent is null ? null : $"{ticket.AssignedAgent.FirstName} {ticket.AssignedAgent.LastName}",
        CreatedAt = ticket.CreatedAt
    };
}
