using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Common.Interfaces;

namespace SupportTicketSystem.API.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUser;

    public AuthController(IAuthService authService, ICurrentUserService currentUser)
    {
        _authService = authService;
        _currentUser = currentUser;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(request, cancellationToken);
        return Ok(ApiResponse<AuthResponseDto>.Ok(result, "Login successful."));
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.RegisterAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<AuthResponseDto>.Ok(result, "Registration successful."));
    }

    /// <summary>
    /// Returns the caller's own profile, resolved from JWT claims via ICurrentUserService —
    /// never from a client-supplied id. Backs the Angular AuthService's current-user state.
    /// </summary>
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<UserSummaryDto>>> Me(CancellationToken cancellationToken)
    {
        var result = await _authService.GetCurrentUserAsync(_currentUser.UserId, cancellationToken);
        return Ok(ApiResponse<UserSummaryDto>.Ok(result, "Current user retrieved."));
    }
}
