using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>Shared account/ticket setup helpers for the ticket-focused integration test classes.</summary>
internal static class TicketTestHelpers
{
    public static async Task<(string Token, Guid UserId)> RegisterCustomerAsync(CustomWebApplicationFactory factory, string emailPrefix)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            FirstName = "Test",
            LastName = "Customer",
            Email = $"{emailPrefix}-{Guid.NewGuid():N}@example.com",
            Password = "Password123"
        });

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        return (body!.Data!.Token, body.Data.User.Id);
    }

    public static async Task<(string Token, Guid UserId)> CreateStaffUserDirectlyAsync(CustomWebApplicationFactory factory, UserRole role, string emailPrefix)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var email = $"{emailPrefix}-{Guid.NewGuid():N}@example.com";
        const string password = "Password123";

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = role.ToString(),
            Email = email,
            PasswordHash = passwordHasher.Hash(password),
            Role = role,
            IsActive = true
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var client = factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Email = email, Password = password });
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();

        return (loginBody!.Data!.Token, user.Id);
    }

    public static async Task<Guid> CreateTicketAsync(
        CustomWebApplicationFactory factory,
        string ownerToken,
        string title = "Cannot log in",
        string description = "The login page returns a 500 error for my account.",
        TicketPriority priority = TicketPriority.High)
    {
        var client = TestClients.WithBearerToken(factory, ownerToken);

        var response = await client.PostAsJsonAsync("/api/tickets", new CreateTicketRequest
        {
            Title = title,
            Description = description,
            Priority = priority
        });

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        return body!.Data!.Id;
    }
}
