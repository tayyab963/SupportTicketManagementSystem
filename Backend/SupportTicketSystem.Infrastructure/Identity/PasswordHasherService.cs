using Microsoft.AspNetCore.Identity;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Domain.Entities;

namespace SupportTicketSystem.Infrastructure.Identity;

/// <summary>
/// Wraps ASP.NET Core's PasswordHasher&lt;T&gt; (PBKDF2-based) instead of full ASP.NET Core Identity —
/// this project uses its own User entity/table rather than IdentityDbContext, so only the hashing
/// primitive is needed. The user argument to PasswordHasher&lt;T&gt; is unused by the default
/// implementation, so passing null is safe here.
/// </summary>
public class PasswordHasherService : IPasswordHasher
{
    private readonly PasswordHasher<User> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(null!, password);

    public bool Verify(string hashedPassword, string providedPassword)
    {
        var result = _hasher.VerifyHashedPassword(null!, hashedPassword, providedPassword);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
