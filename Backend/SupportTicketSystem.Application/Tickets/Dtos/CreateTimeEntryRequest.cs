namespace SupportTicketSystem.Application.Tickets.Dtos;

public class CreateTimeEntryRequest
{
    public DateOnly WorkDate { get; set; }
    public int DurationMinutes { get; set; }
    public string Description { get; set; } = string.Empty;
}
