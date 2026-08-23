using SupportTicketSystem.Domain.Common;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Domain.Entities;

public class User : IHasCreatedAt
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public ICollection<Ticket> TicketsAsCustomer { get; set; } = new List<Ticket>();
    public ICollection<Ticket> TicketsAsAgent { get; set; } = new List<Ticket>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<TicketActivity> TicketActivities { get; set; } = new List<TicketActivity>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}
