using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;
using static SupportTicketSystem.IntegrationTests.TicketTestHelpers;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>Assign and priority are dedicated, Admin-only endpoints (see role rules in TicketsController).</summary>
public class TicketAssignmentAndPriorityTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TicketAssignmentAndPriorityTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Admin_CanAssignAndUnassignATicket()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "assign-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "assign-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "assign-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var assignResponse = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId });
        assignResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var assignedBody = await assignResponse.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        assignedBody!.Data!.AssignedAgentId.Should().Be(agentId);

        var unassignResponse = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = null });
        unassignResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var unassignedBody = await unassignResponse.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        unassignedBody!.Data!.AssignedAgentId.Should().BeNull();

        _ = agentToken; // token unused beyond proving the account exists to assign
    }

    [Fact]
    public async Task Assign_ToANonexistentAgent_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "assign-missing-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "assign-missing-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var response = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = Guid.NewGuid() });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Assign_ToACustomerId_Returns404_CustomersAreNotValidAssignees()
    {
        var (ownerToken, ownerId) = await RegisterCustomerAsync(_factory, "assign-cust-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "assign-cust-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var response = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = ownerId });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(UserRole.Customer)]
    [InlineData(UserRole.SupportAgent)]
    public async Task NonAdmin_CannotAssignATicket_Returns403(UserRole role)
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "assign-forbidden-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var callerToken = role == UserRole.Customer
            ? ownerToken
            : (await CreateStaffUserDirectlyAsync(_factory, role, "assign-forbidden-agent")).Token;
        var callerClient = TestClients.WithBearerToken(_factory, callerToken);

        var response = await callerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = null });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Admin_CanChangePriority()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "priority-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken, priority: TicketPriority.Low);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "priority-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var response = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/priority", new ChangeTicketPriorityRequest { Priority = TicketPriority.Critical });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        body!.Data!.Priority.Should().Be(TicketPriority.Critical);
    }

    [Theory]
    [InlineData(UserRole.Customer)]
    [InlineData(UserRole.SupportAgent)]
    public async Task NonAdmin_CannotChangePriority_Returns403(UserRole role)
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "priority-forbidden-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var callerToken = role == UserRole.Customer
            ? ownerToken
            : (await CreateStaffUserDirectlyAsync(_factory, role, "priority-forbidden-agent")).Token;
        var callerClient = TestClients.WithBearerToken(_factory, callerToken);

        var response = await callerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/priority", new ChangeTicketPriorityRequest { Priority = TicketPriority.Critical });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
