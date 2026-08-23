namespace SupportTicketSystem.Application.Auth.Dtos;

/// <summary>
/// Public self-registration request. Deliberately has no Role property — every account created
/// through this endpoint is a Customer. Admin and SupportAgent accounts are provisioned only via
/// seed data / an administrator, never chosen by the caller.
/// </summary>
public class RegisterRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
