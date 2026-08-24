namespace SupportTicketSystem.Application.Tickets.Dtos;

public class TimeEntrySummaryDto
{
    public List<TimeEntryDto> Entries { get; set; } = [];

    /// <summary>Computed server-side via SUM(DurationMinutes), not by summing the returned entries client-side.</summary>
    public int TotalDurationMinutes { get; set; }
}
