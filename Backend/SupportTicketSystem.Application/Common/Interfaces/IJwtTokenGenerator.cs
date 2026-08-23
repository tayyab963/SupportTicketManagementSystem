using SupportTicketSystem.Domain.Entities;

namespace SupportTicketSystem.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    (string Token, DateTime ExpiresAtUtc) GenerateToken(User user);
}
