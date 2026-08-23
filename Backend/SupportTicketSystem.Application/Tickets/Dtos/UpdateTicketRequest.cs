using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

public class UpdateTicketRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketPriority Priority { get; set; }

    /// <summary>Ignored when the caller is a Customer — only Agents/Admins may reassign a ticket.</summary>
    public Guid? AssignedAgentId { get; set; }
}
