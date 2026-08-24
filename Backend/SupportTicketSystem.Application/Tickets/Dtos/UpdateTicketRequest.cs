namespace SupportTicketSystem.Application.Tickets.Dtos;

/// <summary>
/// Basic ticket edit (title/description only). Priority and assignment each have their own dedicated
/// endpoint/DTO (ChangeTicketPriorityRequest, AssignTicketRequest) so those actions can be
/// independently authorized (Admin-only) instead of riding along with a general-purpose edit.
/// </summary>
public class UpdateTicketRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
