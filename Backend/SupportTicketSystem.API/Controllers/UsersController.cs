using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Common.Models;
using SupportTicketSystem.Application.Users;
using SupportTicketSystem.Application.Users.Dtos;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>Powers the assignment and "assigned agent" filter dropdowns — Admin assigns tickets, agents can see who else is available.</summary>
    [HttpGet("agents")]
    [Authorize(Roles = $"{nameof(UserRole.Admin)},{nameof(UserRole.SupportAgent)}")]
    public async Task<ActionResult<ApiResponse<List<UserSummaryDto>>>> GetAgents(CancellationToken cancellationToken)
    {
        var result = await _userService.GetAgentsAsync(cancellationToken);
        return Ok(ApiResponse<List<UserSummaryDto>>.Ok(result, "Agents retrieved."));
    }

    /// <summary>Admin-only user management list — server-side paged/searched/filtered, never exposes PasswordHash.</summary>
    [HttpGet]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<PagedResult<UserListItemDto>>>> GetUsers([FromQuery] UserQueryParameters query, CancellationToken cancellationToken)
    {
        var result = await _userService.GetUsersAsync(query, cancellationToken);
        return Ok(ApiResponse<PagedResult<UserListItemDto>>.Ok(result, "Users retrieved."));
    }

    /// <summary>Admin-only: provisions an account of any role (Admin, SupportAgent, or Customer).</summary>
    [HttpPost]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<UserListItemDto>>> CreateUser(CreateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.CreateUserAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<UserListItemDto>.Ok(result, "User created."));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<UserListItemDto>>> UpdateUser(Guid id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var result = await _userService.UpdateUserAsync(id, request, cancellationToken);
        return Ok(ApiResponse<UserListItemDto>.Ok(result, "User updated."));
    }

    [HttpPost("{id:guid}/activate")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<UserListItemDto>>> Activate(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.SetActiveStatusAsync(id, true, cancellationToken);
        return Ok(ApiResponse<UserListItemDto>.Ok(result, "User activated."));
    }

    /// <summary>Rejects deactivating the caller's own account — enforced in UserService, not here.</summary>
    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<UserListItemDto>>> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await _userService.SetActiveStatusAsync(id, false, cancellationToken);
        return Ok(ApiResponse<UserListItemDto>.Ok(result, "User deactivated."));
    }
}
