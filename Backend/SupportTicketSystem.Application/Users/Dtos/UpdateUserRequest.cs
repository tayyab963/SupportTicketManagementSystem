using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Users.Dtos;

/// <summary>
/// Profile + role fields only. Active/inactive status is deliberately not here — it's changed only
/// through the dedicated activate/deactivate endpoints, not folded into a general-purpose update.
/// </summary>
public class UpdateUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}
