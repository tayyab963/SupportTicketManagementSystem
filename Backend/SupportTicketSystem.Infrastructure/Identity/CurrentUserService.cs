using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Infrastructure.Identity;

/// <summary>
/// Reads identity strictly from the current request's validated ClaimsPrincipal — i.e. from the
/// JWT the ASP.NET Core authentication middleware has already verified. There is no code path here
/// that accepts a userId/role from a request body, query string, or route value.
/// </summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? Principal => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public Guid UserId
    {
        get
        {
            var value = Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id)
                ? id
                : throw new UnauthorizedAccessException("No authenticated user in the current request.");
        }
    }

    public string Email =>
        Principal?.FindFirstValue(ClaimTypes.Email)
        ?? throw new UnauthorizedAccessException("No authenticated user in the current request.");

    public UserRole Role
    {
        get
        {
            var value = Principal?.FindFirstValue(ClaimTypes.Role);
            return Enum.TryParse<UserRole>(value, out var role)
                ? role
                : throw new UnauthorizedAccessException("No authenticated user in the current request.");
        }
    }
}
