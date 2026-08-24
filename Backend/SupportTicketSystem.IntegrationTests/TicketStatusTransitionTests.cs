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
/// Exercises the state-machine + role rules documented for ticket status changes: the transition
/// itself must be legal (TicketStatusTransitionRules), and separately the caller's role must be
/// allowed to invoke that specific transition (TicketService.EnsureCallerCanChangeStatus).
/// </summary>
public class TicketStatusTransitionTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TicketStatusTransitionTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<HttpStatusCode> ChangeStatusAsync(string token, Guid ticketId, TicketStatus status)
    {
        var client = TestClients.WithBearerToken(_factory, token);
        var response = await client.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = status });
        return response.StatusCode;
    }

    [Theory]
    [InlineData(TicketStatus.Resolved)]
    [InlineData(TicketStatus.Closed)]
    public async Task IllegalTransition_FromOpen_Returns400_RegardlessOfRole(TicketStatus illegalTarget)
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "txn-open");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "txn-open-admin");

        (await ChangeStatusAsync(adminToken, ticketId, illegalTarget)).Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Closed_IsATerminalState_NoFurtherTransitionsAllowed()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "txn-terminal");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "txn-terminal-admin");

        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.Resolved)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.Closed)).Should().Be(HttpStatusCode.OK);

        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.Open)).Should().Be(HttpStatusCode.BadRequest);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Admin_CanDriveTheFullValidLifecycle_IncludingReopeningFromResolved()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "txn-lifecycle");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "txn-lifecycle-admin");

        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.Resolved)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(adminToken, ticketId, TicketStatus.Open)).Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Customer_CannotMoveTicketToInProgress_EvenThoughItsAValidTransition()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "txn-cust-forbidden");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        (await ChangeStatusAsync(ownerToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AssignedAgent_CannotCloseAResolvedTicket_OnlyTheCustomerOrAdminCan()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "txn-agent-close");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "txn-agent-close-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "txn-agent-close-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        (await ChangeStatusAsync(agentToken, ticketId, TicketStatus.InProgress)).Should().Be(HttpStatusCode.OK);
        (await ChangeStatusAsync(agentToken, ticketId, TicketStatus.Resolved)).Should().Be(HttpStatusCode.OK);

        (await ChangeStatusAsync(agentToken, ticketId, TicketStatus.Closed)).Should().Be(HttpStatusCode.Forbidden);
        (await ChangeStatusAsync(ownerToken, ticketId, TicketStatus.Closed)).Should().Be(HttpStatusCode.OK);
    }
}
