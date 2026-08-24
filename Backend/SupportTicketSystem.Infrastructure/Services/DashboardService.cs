using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Application.Dashboard;
using SupportTicketSystem.Application.Dashboard.Dtos;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.Infrastructure.Services;

/// <summary>
/// Every figure here is computed by the database (grouped counts, per-agent subquery counts) rather
/// than by pulling the Tickets table into memory and aggregating in C#. The one exception —
/// average resolution time — projects just the two DateTime columns it needs for resolved tickets,
/// since neither EF.Functions.DateDiffMinute (SQL Server-only, throws under the InMemory provider
/// used by the integration test suite) nor TimeSpan-subtraction-in-SQL is reliably portable across
/// both providers; averaging that narrow projection client-side is still far short of loading full
/// ticket rows.
/// </summary>
public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _db;

    public DashboardService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var statusCounts = await _db.Tickets
            .AsNoTracking()
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var priorityCounts = await _db.Tickets
            .AsNoTracking()
            .GroupBy(t => t.Priority)
            .Select(g => new { Priority = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Priority, x => x.Count, cancellationToken);

        var resolutionSpans = await _db.Tickets
            .AsNoTracking()
            .Where(t => t.ResolvedAt != null)
            .Select(t => new { t.CreatedAt, ResolvedAt = t.ResolvedAt!.Value })
            .ToListAsync(cancellationToken);

        var averageResolutionMinutes = resolutionSpans.Count == 0
            ? 0d
            : Math.Round(resolutionSpans.Average(s => (s.ResolvedAt - s.CreatedAt).TotalMinutes), 2);

        var agentWorkload = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.SupportAgent)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new AgentWorkloadDto
            {
                AgentId = u.Id,
                AgentName = u.FirstName + " " + u.LastName,
                TotalAssigned = u.TicketsAsAgent.Count(),
                Open = u.TicketsAsAgent.Count(t => t.Status == TicketStatus.Open),
                InProgress = u.TicketsAsAgent.Count(t => t.Status == TicketStatus.InProgress),
                Resolved = u.TicketsAsAgent.Count(t => t.Status == TicketStatus.Resolved)
            })
            .ToListAsync(cancellationToken);

        return new DashboardSummaryDto
        {
            TotalTickets = statusCounts.Values.Sum(),
            OpenTickets = statusCounts.GetValueOrDefault(TicketStatus.Open),
            InProgressTickets = statusCounts.GetValueOrDefault(TicketStatus.InProgress),
            ResolvedTickets = statusCounts.GetValueOrDefault(TicketStatus.Resolved),
            ClosedTickets = statusCounts.GetValueOrDefault(TicketStatus.Closed),
            CriticalTickets = priorityCounts.GetValueOrDefault(TicketPriority.Critical),
            LowPriorityTickets = priorityCounts.GetValueOrDefault(TicketPriority.Low),
            MediumPriorityTickets = priorityCounts.GetValueOrDefault(TicketPriority.Medium),
            HighPriorityTickets = priorityCounts.GetValueOrDefault(TicketPriority.High),
            AverageResolutionMinutes = averageResolutionMinutes,
            AgentWorkload = agentWorkload
        };
    }
}
