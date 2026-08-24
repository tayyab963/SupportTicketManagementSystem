using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Users.Dtos;

/// <summary>Never carries PasswordHash — see UserService's projections, which never select it.</summary>
public class UserListItemDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
