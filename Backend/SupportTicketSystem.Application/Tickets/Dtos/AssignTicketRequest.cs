namespace SupportTicketSystem.Application.Tickets.Dtos;

/// <summary>A null AgentId unassigns the ticket.</summary>
public class AssignTicketRequest
{
    public Guid? AgentId { get; set; }
}
