namespace SupportTicketSystem.Application.Tickets.Dtos;

public class TimeEntryDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public DateOnly WorkDate { get; set; }
    public int DurationMinutes { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
