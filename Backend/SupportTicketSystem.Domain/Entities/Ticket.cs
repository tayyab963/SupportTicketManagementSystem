using SupportTicketSystem.Domain.Common;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Domain.Entities;

public class Ticket : IHasCreatedAt, IHasUpdatedAt
{
    public Guid Id { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public TicketStatus Status { get; set; }
    public TicketPriority Priority { get; set; }

    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = null!;

    public Guid? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<TicketActivity> Activities { get; set; } = new List<TicketActivity>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}
