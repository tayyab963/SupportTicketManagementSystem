using SupportTicketSystem.Application.Auth.Dtos;

namespace SupportTicketSystem.Application.Auth;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);

    Task<AuthResponseDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);

    Task<UserSummaryDto> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
