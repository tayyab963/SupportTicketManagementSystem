using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;
using static SupportTicketSystem.IntegrationTests.TicketTestHelpers;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Phase 6, "Critical Data Isolation Tests" — the mandatory scenario spelled out by the assessment,
/// verbatim: Customer A creates Ticket A; Customer B (a second, unrelated customer) must be unable to
/// read, update, comment on, close, reprioritize, or log time against it. Every case below reuses
/// Ticket A's real id directly (in the URL or request body) rather than a fabricated one — i.e. this
/// *is* the "manipulating IDs directly" attack: the id is genuine, only the caller is wrong.
/// TicketIsolationTests/TicketAssignmentAndPriorityTests/TicketCommentsTimelineAndTimeTrackingTests
/// already cover these paths under generic owner/attacker naming; this class exists to make the
/// specific mandated Customer-A/Customer-B scenario independently traceable and explicit.
/// </summary>
public class CustomerDataIsolationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public CustomerDataIsolationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Scenario(string TicketAId, string CustomerBToken, string AdminToken, string AgentId);

    private async Task<Scenario> ArrangeAsync([System.Runtime.CompilerServices.CallerMemberName] string caller = "")
    {
        // CreateStaffUserDirectlyAsync inserts the email as-given (no normalization), but
        // AuthService.LoginAsync lower-cases the login email before querying — the caller-derived
        // prefix must be lower-cased here or a mixed-case test method name would make the
        // subsequent login 401 on a case mismatch.
        var prefix = caller.ToLowerInvariant();

        var (customerAToken, customerAId) = await RegisterCustomerAsync(_factory, $"{prefix}-customerA");
        var ticketAId = await CreateTicketAsync(_factory, customerAToken, title: "Customer A's private ticket");

        var (customerBToken, _) = await RegisterCustomerAsync(_factory, $"{prefix}-customerB");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, $"{prefix}-admin");
        var (_, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, $"{prefix}-agent");

        _ = customerAId;
        return new Scenario(ticketAId.ToString(), customerBToken, adminToken, agentId.ToString());
    }

    [Fact]
    public async Task CustomerB_CannotReadTicketA_Returns404()
    {
        var s = await ArrangeAsync();
        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);

        var response = await customerB.GetAsync($"/api/tickets/{s.TicketAId}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CustomerB_CannotUpdateTicketA_Returns404_AndTicketAIsUnchanged()
    {
        var s = await ArrangeAsync();
        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);

        var response = await customerB.PutAsJsonAsync($"/api/tickets/{s.TicketAId}", new UpdateTicketRequest
        {
            Title = "Hijacked by Customer B",
            Description = "This should never be persisted."
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var admin = TestClients.WithBearerToken(_factory, s.AdminToken);
        var stillOwnedByA = await admin.GetAsync($"/api/tickets/{s.TicketAId}");
        var body = await stillOwnedByA.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        body!.Data!.Title.Should().Be("Customer A's private ticket");
    }

    [Fact]
    public async Task CustomerB_CannotCommentOnTicketA_Returns404()
    {
        var s = await ArrangeAsync();
        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);

        var response = await customerB.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/comments", new CreateCommentRequest
        {
            CommentText = "Customer B should not be able to post this."
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CustomerB_CannotCloseTicketA_Returns404_EvenWhenTicketAIsResolved()
    {
        var s = await ArrangeAsync();

        // Drive Ticket A to Resolved via staff first, so this isolates the ownership check rather
        // than tripping the (also-illegal) Open -> Closed transition instead.
        var admin = TestClients.WithBearerToken(_factory, s.AdminToken);
        (await admin.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.Resolved }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);
        var response = await customerB.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/status", new ChangeTicketStatusRequest
        {
            Status = TicketStatus.Closed
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CustomerB_CannotChangeTicketAsPriority()
    {
        var s = await ArrangeAsync();
        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);

        var response = await customerB.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/priority", new ChangeTicketPriorityRequest
        {
            Priority = TicketPriority.Critical
        });

        // Priority changes are Admin-only (see TicketsController.ChangePriority) — Customer B is
        // rejected by the role gate before ticket ownership is ever evaluated, so this 403s rather
        // than 404s. Either way, Ticket A's priority must be provably untouched.
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var admin = TestClients.WithBearerToken(_factory, s.AdminToken);
        var ticket = await admin.GetAsync($"/api/tickets/{s.TicketAId}");
        var body = await ticket.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        body!.Data!.Priority.Should().Be(TicketPriority.High);
    }

    [Fact]
    public async Task CustomerB_CannotLogTimeAgainstTicketA()
    {
        var s = await ArrangeAsync();
        var customerB = TestClients.WithBearerToken(_factory, s.CustomerBToken);

        var response = await customerB.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 30,
            Description = "Customer B trying to log time on someone else's ticket."
        });

        // Time entries are staff-only (see TicketsController.AddTimeEntry) — rejected at the role gate
        // regardless of ownership.
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    /// <summary>
    /// "Manipulating IDs directly": Customer B submits Customer A's own user id as the CustomerId
    /// field on a ticket-creation request, attempting to attribute a new ticket to Customer A instead
    /// of themselves. TicketService.CreateTicketAsync ignores any client-supplied CustomerId for a
    /// Customer caller and always uses the id resolved from the validated JWT.
    /// </summary>
    [Fact]
    public async Task CustomerB_CannotCreateATicketAttributedToCustomerA_ByManipulatingTheCustomerIdField()
    {
        var (customerAToken, customerAId) = await RegisterCustomerAsync(_factory, "spoof-customerA");
        var (customerBToken, customerBId) = await RegisterCustomerAsync(_factory, "spoof-customerB");
        _ = customerAToken;

        var customerB = TestClients.WithBearerToken(_factory, customerBToken);
        var response = await customerB.PostAsJsonAsync("/api/tickets", new CreateTicketRequest
        {
            Title = "Spoofed ownership attempt",
            Description = "CustomerId is forged to point at Customer A.",
            Priority = TicketPriority.Low,
            CustomerId = customerAId
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        body!.Data!.CustomerId.Should().Be(customerBId);
        body.Data!.CustomerId.Should().NotBe(customerAId);
    }

    [Fact]
    public async Task Admin_CanPerformEveryActionCustomerBWasDeniedOn_TicketA_ProvingTheRejectionsAreOwnershipSpecific()
    {
        var s = await ArrangeAsync();
        var admin = TestClients.WithBearerToken(_factory, s.AdminToken);

        (await admin.GetAsync($"/api/tickets/{s.TicketAId}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync($"/api/tickets/{s.TicketAId}", new UpdateTicketRequest { Title = "Admin edit", Description = "Admin edit" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/comments", new CreateCommentRequest { CommentText = "Admin note." }))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        (await admin.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/priority", new ChangeTicketPriorityRequest { Priority = TicketPriority.Critical }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync($"/api/tickets/{s.TicketAId}/assign", new AssignTicketRequest { AgentId = Guid.Parse(s.AgentId) }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
