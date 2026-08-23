using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

public class CreateTicketRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; } = TicketPriority.Medium;

    /// <summary>
    /// Only honored when the caller is an Admin creating a ticket on behalf of a customer.
    /// Ignored for Customer-role callers, who always create tickets for themselves regardless of
    /// what this field contains — the owning customer is taken from the JWT, never from the body.
    /// </summary>
    public Guid? CustomerId { get; set; }
}
