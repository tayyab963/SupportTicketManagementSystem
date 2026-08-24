namespace SupportTicketSystem.Application.Dashboard.Dtos;

public class DashboardSummaryDto
{
    public int TotalTickets { get; set; }
    public int OpenTickets { get; set; }
    public int InProgressTickets { get; set; }
    public int ResolvedTickets { get; set; }
    public int ClosedTickets { get; set; }

    /// <summary>Also the "Critical" bucket of the priority breakdown (LowPriorityTickets/MediumPriorityTickets/HighPriorityTickets/CriticalTickets).</summary>
    public int CriticalTickets { get; set; }
    public int LowPriorityTickets { get; set; }
    public int MediumPriorityTickets { get; set; }
    public int HighPriorityTickets { get; set; }

    /// <summary>Mean of (ResolvedAt - CreatedAt) across every ticket that has been resolved, in minutes. 0 when none have.</summary>
    public double AverageResolutionMinutes { get; set; }

    public List<AgentWorkloadDto> AgentWorkload { get; set; } = [];
}
