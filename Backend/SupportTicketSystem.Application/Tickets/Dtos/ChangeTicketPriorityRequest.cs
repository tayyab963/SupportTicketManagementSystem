using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

public class ChangeTicketPriorityRequest
{
    public TicketPriority Priority { get; set; }
}
