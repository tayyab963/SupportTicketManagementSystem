using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Users.Dtos;

/// <summary>Bound from the GET /api/users query string. PageNumber/PageSize are defensively clamped by UserService rather than rejected.</summary>
public class UserQueryParameters
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;

    /// <summary>Matched case-insensitively against first name, last name and email.</summary>
    public string? Search { get; set; }

    public UserRole? Role { get; set; }
    public bool? IsActive { get; set; }
}
