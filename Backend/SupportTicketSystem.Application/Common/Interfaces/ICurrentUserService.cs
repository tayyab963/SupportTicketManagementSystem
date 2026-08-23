using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Application.Common.Interfaces;

/// <summary>
/// Resolves the authenticated caller strictly from validated JWT claims.
/// Every ticket-scoping and authorization decision must go through this service —
/// request bodies and route values are never trusted for identity or role.
/// </summary>
public interface ICurrentUserService
{
    bool IsAuthenticated { get; }
    Guid UserId { get; }
    string Email { get; }
    UserRole Role { get; }
}
