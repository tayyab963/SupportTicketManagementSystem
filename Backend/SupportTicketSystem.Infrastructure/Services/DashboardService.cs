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

        // A single grouped pass over Tickets (one scan) joined in memory against the small agent
        // roster, instead of four correlated Count() subqueries re-scanning Tickets per agent.
        var ticketCountsByAgentAndStatus = await _db.Tickets
            .AsNoTracking()
            .Where(t => t.AssignedAgentId != null)
            .GroupBy(t => new { t.AssignedAgentId, t.Status })
            .Select(g => new { g.Key.AssignedAgentId, g.Key.Status, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var agents = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.SupportAgent)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName })
            .ToListAsync(cancellationToken);

        var agentWorkload = agents.Select(agent =>
        {
            var counts = ticketCountsByAgentAndStatus.Where(c => c.AssignedAgentId == agent.Id).ToList();
            return new AgentWorkloadDto
            {
                AgentId = agent.Id,
                AgentName = agent.Name,
                TotalAssigned = counts.Sum(c => c.Count),
                Open = counts.Where(c => c.Status == TicketStatus.Open).Sum(c => c.Count),
                InProgress = counts.Where(c => c.Status == TicketStatus.InProgress).Sum(c => c.Count),
                Resolved = counts.Where(c => c.Status == TicketStatus.Resolved).Sum(c => c.Count)
            };
        }).ToList();

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
