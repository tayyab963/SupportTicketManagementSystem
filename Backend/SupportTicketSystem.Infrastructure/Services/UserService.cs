using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Users;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _db;

    public UserService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<UserSummaryDto>> GetAgentsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.SupportAgent && u.IsActive)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new UserSummaryDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Role = u.Role
            })
            .ToListAsync(cancellationToken);
    }
}
