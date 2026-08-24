using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Users;
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
}
