using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Common.Models;
using SupportTicketSystem.Application.Users.Dtos;

namespace SupportTicketSystem.Application.Users;

public interface IUserService
{
    /// <summary>Active support agents only, for assignment/filter pickers.</summary>
    Task<List<UserSummaryDto>> GetAgentsAsync(CancellationToken cancellationToken = default);

    /// <summary>Admin-only (enforced via [Authorize(Roles = ...)] on the controller action). Server-side paged/searched/filtered — never loads the whole Users table into memory.</summary>
    Task<PagedResult<UserListItemDto>> GetUsersAsync(UserQueryParameters query, CancellationToken cancellationToken = default);

    /// <summary>Admin-only. Can provision an account of any role — Admin, SupportAgent, or Customer.</summary>
    Task<UserListItemDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);

    /// <summary>Admin-only. Updates profile fields and role; active/inactive status is changed only via SetActiveStatusAsync.</summary>
    Task<UserListItemDto> UpdateUserAsync(Guid userId, UpdateUserRequest request, CancellationToken cancellationToken = default);

    /// <summary>Admin-only. Deactivating the caller's own account is rejected, to prevent an admin from locking themselves out.</summary>
    Task<UserListItemDto> SetActiveStatusAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default);
}
