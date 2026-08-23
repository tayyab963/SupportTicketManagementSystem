using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Tickets.Dtos;

public class CommentDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public UserRole UserRole { get; set; }
    public string CommentText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
