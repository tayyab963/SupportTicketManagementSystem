using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.UnitTests.Services;

/// <summary>Test double standing in for the JWT-derived caller identity that TicketService relies on for every scoping/authorization decision.</summary>
internal sealed class FakeCurrentUserService : ICurrentUserService
{
    public FakeCurrentUserService(User user)
    {
        UserId = user.Id;
        Email = user.Email;
        Role = user.Role;
    }

    public bool IsAuthenticated => true;
    public Guid UserId { get; }
    public string Email { get; }
    public UserRole Role { get; }
}
