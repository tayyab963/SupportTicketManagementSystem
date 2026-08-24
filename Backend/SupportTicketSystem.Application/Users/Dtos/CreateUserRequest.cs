using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Users.Dtos;

/// <summary>
/// Admin-provisioned account of any role (Admin, SupportAgent, or Customer) — unlike public
/// self-registration (RegisterRequest), which is always a Customer and never lets the caller pick a role.
/// </summary>
public class CreateUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}
