using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Dashboard.Dtos;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;
using static SupportTicketSystem.IntegrationTests.TicketTestHelpers;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Phase 5: GET /api/dashboard/summary. Covers the Admin-only authorization matrix (Customer/Agent
/// forbidden, Admin allowed) and that the aggregate figures — status/critical counts, average
/// resolution time, and per-agent workload — reflect a known set of tickets.
/// </summary>
public class DashboardTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public DashboardTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetSummary_Customer_Returns403()
    {
        var (customerToken, _) = await RegisterCustomerAsync(_factory, "dash-customer");
        var client = TestClients.WithBearerToken(_factory, customerToken);

        var response = await client.GetAsync("/api/dashboard/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetSummary_SupportAgent_Returns403()
    {
        var (agentToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "dash-agent");
        var client = TestClients.WithBearerToken(_factory, agentToken);

        var response = await client.GetAsync("/api/dashboard/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetSummary_Unauthenticated_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/dashboard/summary");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSummary_Admin_ReturnsAggregateFiguresAcrossAllTickets()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "dash-owner");
        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "dash-agent-summary");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "dash-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        var agentClient = TestClients.WithBearerToken(_factory, agentToken);

        var openTicketId = await CreateTicketAsync(_factory, ownerToken, priority: TicketPriority.Low);
        var criticalTicketId = await CreateTicketAsync(_factory, ownerToken, priority: TicketPriority.Critical);
        var resolvedTicketId = await CreateTicketAsync(_factory, ownerToken, priority: TicketPriority.Medium);

        foreach (var ticketId in new[] { openTicketId, criticalTicketId, resolvedTicketId })
        {
            (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
                .StatusCode.Should().Be(HttpStatusCode.OK);
        }

        (await agentClient.PostAsJsonAsync($"/api/tickets/{resolvedTicketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await agentClient.PostAsJsonAsync($"/api/tickets/{resolvedTicketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.Resolved }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await adminClient.GetAsync("/api/dashboard/summary");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<DashboardSummaryDto>>();
        var summary = body!.Data!;

        summary.TotalTickets.Should().BeGreaterOrEqualTo(3);
        summary.OpenTickets.Should().BeGreaterOrEqualTo(2);
        summary.ResolvedTickets.Should().BeGreaterOrEqualTo(1);
        summary.CriticalTickets.Should().BeGreaterOrEqualTo(1);
        summary.LowPriorityTickets.Should().BeGreaterOrEqualTo(1);
        summary.MediumPriorityTickets.Should().BeGreaterOrEqualTo(1);
        summary.AverageResolutionMinutes.Should().BeGreaterOrEqualTo(0);

        var agentEntry = summary.AgentWorkload.Should().ContainSingle(a => a.AgentId == agentId).Subject;
        agentEntry.TotalAssigned.Should().Be(3);
        agentEntry.Open.Should().Be(2);
        agentEntry.Resolved.Should().Be(1);
    }

    /// <summary>
    /// Uses its own factory (an empty, isolated in-memory database) rather than the shared class
    /// fixture, since every other test in this class adds tickets to the shared database — this is
    /// the only reliable way to exercise the genuinely-zero-tickets/zero-resolved case and guard
    /// against an empty-sequence Average() exception.
    /// </summary>
    [Fact]
    public async Task GetSummary_NoTicketsAtAll_AverageResolutionIsZero_NotAnError()
    {
        using var emptyFactory = new CustomWebApplicationFactory();

        var (adminToken, _) = await CreateStaffUserDirectlyAsync(emptyFactory, UserRole.Admin, "dash-admin-empty");
        var adminClient = TestClients.WithBearerToken(emptyFactory, adminToken);

        var response = await adminClient.GetAsync("/api/dashboard/summary");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<DashboardSummaryDto>>();
        body!.Data!.TotalTickets.Should().Be(0);
        body.Data!.AverageResolutionMinutes.Should().Be(0);
        body.Data!.AgentWorkload.Should().BeEmpty();
    }
}
