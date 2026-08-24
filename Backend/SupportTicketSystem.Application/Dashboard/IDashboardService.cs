using SupportTicketSystem.Application.Dashboard.Dtos;

namespace SupportTicketSystem.Application.Dashboard;

/// <summary>Admin-only (enforced via [Authorize(Roles = ...)] on the controller) — aggregate figures across every ticket, not scoped to the caller.</summary>
public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);
}
