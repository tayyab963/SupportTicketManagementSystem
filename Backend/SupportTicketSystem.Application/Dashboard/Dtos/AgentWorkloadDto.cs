namespace SupportTicketSystem.Application.Dashboard.Dtos;

public class AgentWorkloadDto
{
    public Guid AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;

    /// <summary>Every ticket currently assigned to this agent, regardless of status.</summary>
    public int TotalAssigned { get; set; }
    public int Open { get; set; }
    public int InProgress { get; set; }
    public int Resolved { get; set; }
}
