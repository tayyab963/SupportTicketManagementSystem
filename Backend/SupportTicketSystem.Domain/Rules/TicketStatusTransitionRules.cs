using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Domain.Rules;

/// <summary>
/// The single source of truth for which ticket status transitions are legal, independent of who is
/// requesting them (role-based restrictions on top of this are applied by the caller). Pure and
/// side-effect-free so it can be unit tested without a database.
/// </summary>
public static class TicketStatusTransitionRules
{
    private static readonly Dictionary<TicketStatus, TicketStatus[]> AllowedTransitions = new()
    {
        [TicketStatus.Open] = [TicketStatus.InProgress],
        [TicketStatus.InProgress] = [TicketStatus.Resolved, TicketStatus.Open],
        [TicketStatus.Resolved] = [TicketStatus.Closed, TicketStatus.InProgress],
        [TicketStatus.Closed] = []
    };

    public static bool IsValidTransition(TicketStatus from, TicketStatus to) =>
        AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
}
