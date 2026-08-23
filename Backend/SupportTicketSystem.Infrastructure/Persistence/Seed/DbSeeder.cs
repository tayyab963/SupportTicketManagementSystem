using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.Infrastructure.Persistence.Seed;

/// <summary>
/// Development-only convenience data. These accounts and passwords are intentionally simple,
/// publicly documented (see README "Seed Accounts"), and only ever created when running against a
/// Development environment — never use this seeding approach, or these credentials, outside local
/// development.
/// </summary>
public static class DbSeeder
{
    public static readonly (string FirstName, string LastName, string Email, string Password, UserRole Role)[] SeedUsers =
    [
        ("System", "Admin", "admin@example.com", "Admin@123", UserRole.Admin),
        ("Alice", "Agent", "agent1@example.com", "Agent1@123", UserRole.SupportAgent),
        ("Bob", "Agent", "agent2@example.com", "Agent2@123", UserRole.SupportAgent),
        ("Carol", "Customer", "customer1@example.com", "Customer1@123", UserRole.Customer),
        ("Dave", "Customer", "customer2@example.com", "Customer2@123", UserRole.Customer)
    ];

    public static async Task SeedAsync(ApplicationDbContext db, IPasswordHasher passwordHasher, ILogger logger)
    {
        if (await db.Users.AnyAsync())
        {
            return;
        }

        foreach (var seedUser in SeedUsers)
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                FirstName = seedUser.FirstName,
                LastName = seedUser.LastName,
                Email = seedUser.Email,
                PasswordHash = passwordHasher.Hash(seedUser.Password),
                Role = seedUser.Role,
                IsActive = true
            });
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded {Count} development user accounts.", SeedUsers.Length);
    }
}
