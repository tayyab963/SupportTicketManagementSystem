using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

public class ChangeTicketStatusRequest
{
    public TicketStatus Status { get; set; }
}
