using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

/// <summary>
/// Bound from the GET /api/tickets query string. PageNumber/PageSize are defensively clamped by
/// TicketService rather than rejected — an out-of-range page just gets normalized to the nearest
/// valid value instead of failing the request.
/// </summary>
public class TicketQueryParameters
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;

    /// <summary>Matched case-insensitively against ticket number, title and description.</summary>
    public string? Search { get; set; }

    public TicketStatus? Status { get; set; }
    public TicketPriority? Priority { get; set; }
    public Guid? AssignedAgentId { get; set; }

    /// <summary>
    /// True filters to tickets with no assigned agent. Takes precedence over AssignedAgentId (which
    /// on its own has no way to express "IS NULL" — a Guid? query parameter can only ever be
    /// "unspecified" or "equals this specific agent").
    /// </summary>
    public bool? Unassigned { get; set; }

    public Guid? CustomerId { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }

    public TicketSortBy SortBy { get; set; } = TicketSortBy.CreatedAt;
    public bool SortDescending { get; set; } = true;
}
