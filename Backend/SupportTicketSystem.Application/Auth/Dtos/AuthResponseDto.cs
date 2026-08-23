namespace SupportTicketSystem.Application.Auth.Dtos;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public UserSummaryDto User { get; set; } = null!;
}
