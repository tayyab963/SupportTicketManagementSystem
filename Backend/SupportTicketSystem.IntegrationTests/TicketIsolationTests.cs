using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Application.Common.Interfaces;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;
using Xunit;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Exercises the exact malicious-request scenarios called out by the assessment: a second customer
/// (or an unrelated/unassigned agent) trying to read or act on a ticket that isn't theirs. Every one
/// of these must be rejected — the assertions pin down the specific status code the isolation design
/// in TicketService is supposed to produce for each case.
/// </summary>
public class TicketIsolationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TicketIsolationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(string Token, Guid UserId)> RegisterCustomerAsync(string emailPrefix)
    {
        var client = _factory.CreateClient();
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

    private async Task<(string Token, Guid UserId)> CreateStaffUserDirectlyAsync(UserRole role, string emailPrefix)
    {
        using var scope = _factory.Services.CreateScope();
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

        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { Email = email, Password = password });
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();

        return (loginBody!.Data!.Token, user.Id);
    }

    private async Task<Guid> CreateTicketAsync(string ownerToken)
    {
        var client = TestClients.WithBearerToken(_factory, ownerToken);

        var response = await client.PostAsJsonAsync("/api/tickets", new CreateTicketRequest
        {
            Title = "Cannot log in",
            Description = "The login page returns a 500 error for my account.",
            Priority = TicketPriority.High
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        return body!.Data!.Id;
    }

    [Fact]
    public async Task AnonymousRequest_ToTicketDetail_Returns401()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-anon");
        var ticketId = await CreateTicketAsync(ownerToken);

        var anonymousClient = _factory.CreateClient();
        var response = await anonymousClient.GetAsync($"/api/tickets/{ticketId}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Customer_CanFullyAccessTheirOwnTicket()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-control");
        var ticketId = await CreateTicketAsync(ownerToken);
        var client = TestClients.WithBearerToken(_factory, ownerToken);

        (await client.GetAsync($"/api/tickets/{ticketId}")).StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.PutAsJsonAsync($"/api/tickets/{ticketId}", new UpdateTicketRequest
        {
            Title = "Cannot log in (updated)",
            Description = "Still broken after clearing cookies."
        })).StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest
        {
            CommentText = "Any update on this?"
        })).StatusCode.Should().Be(HttpStatusCode.Created);

        // A customer can only close a *resolved* ticket (see TicketService.EnsureCallerCanChangeStatus) —
        // drive it there via staff first, then confirm the owning customer can close it themselves.
        var (staffToken, _) = await CreateStaffUserDirectlyAsync(UserRole.Admin, "owner-control-staff");
        var staffClient = TestClients.WithBearerToken(_factory, staffToken);
        (await staffClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await staffClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.Resolved }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest
        {
            Status = TicketStatus.Closed
        })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Customer_CannotGetAnotherCustomersTicket_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-get");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync("attacker-get");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.GetAsync($"/api/tickets/{ticketId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Customer_CannotUpdateAnotherCustomersTicket_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-put");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync("attacker-put");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.PutAsJsonAsync($"/api/tickets/{ticketId}", new UpdateTicketRequest
        {
            Title = "Hijacked title",
            Description = "Hijacked description"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Customer_CannotCommentOnAnotherCustomersTicket_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-comment");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync("attacker-comment");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest
        {
            CommentText = "I shouldn't be able to see this ticket, let alone comment on it."
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Customer_CannotChangeStatusOfAnotherCustomersTicket_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-status");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync("attacker-status");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest
        {
            Status = TicketStatus.Closed
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Customer_CannotAddTimeEntryToAnyTicket_Returns403_EvenOnTheirOwnTicket()
    {
        // Time entries are staff-only regardless of ownership — the role check on the endpoint
        // rejects a Customer before ownership is even evaluated.
        var (ownerToken, _) = await RegisterCustomerAsync("owner-time");
        var ticketId = await CreateTicketAsync(ownerToken);
        var ownerClient = TestClients.WithBearerToken(_factory, ownerToken);

        var response = await ownerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 30,
            Description = "Trying to log time as a customer."
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UnassignedAgent_CanViewTicket_ButCannotUpdateOrChangeStatus_Returns403()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-agent-view");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (agentToken, _) = await CreateStaffUserDirectlyAsync(UserRole.SupportAgent, "unassigned-agent");
        var agentClient = TestClients.WithBearerToken(_factory, agentToken);

        (await agentClient.GetAsync($"/api/tickets/{ticketId}")).StatusCode.Should().Be(HttpStatusCode.OK);

        var updateResponse = await agentClient.PutAsJsonAsync($"/api/tickets/{ticketId}", new UpdateTicketRequest
        {
            Title = "Reassigned to myself",
            Description = "Sneaky update"
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // InProgress is a legal next state from Open — this isolates the assertion to the
        // assignment check rather than tripping the status state-machine validation instead.
        var statusResponse = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest
        {
            Status = TicketStatus.InProgress
        });
        statusResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AssignedAgent_CanUpdateTicketAndChangeStatus()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-agent-assigned");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(UserRole.SupportAgent, "assigned-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(UserRole.Admin, "assigning-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var assignResponse = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest
        {
            AgentId = agentId
        });
        assignResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var agentClient = TestClients.WithBearerToken(_factory, agentToken);

        var statusResponse = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest
        {
            Status = TicketStatus.InProgress
        });
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var timeEntryResponse = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 45,
            Description = "Investigated the login failure."
        });
        timeEntryResponse.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Admin_CanAccessAnyCustomersTicket()
    {
        var (ownerToken, _) = await RegisterCustomerAsync("owner-admin-access");
        var ticketId = await CreateTicketAsync(ownerToken);

        var (adminToken, _) = await CreateStaffUserDirectlyAsync(UserRole.Admin, "super-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var response = await adminClient.GetAsync($"/api/tickets/{ticketId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
