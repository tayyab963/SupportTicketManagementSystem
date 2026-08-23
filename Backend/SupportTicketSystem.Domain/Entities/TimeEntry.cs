using SupportTicketSystem.Domain.Common;

namespace SupportTicketSystem.Domain.Entities;

public class TimeEntry : IHasCreatedAt
{
    public Guid Id { get; set; }

    public Guid TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateOnly WorkDate { get; set; }
    public int DurationMinutes { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
