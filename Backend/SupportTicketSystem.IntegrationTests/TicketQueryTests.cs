using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Common.Models;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;
using static SupportTicketSystem.IntegrationTests.TicketTestHelpers;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Covers GET /api/tickets' server-side paging, search, filters and sorting — including the
/// Priority/Status sort order fix (those columns are persisted as strings, so a naive ORDER BY would
/// sort alphabetically instead of by business severity/workflow order) and the Agent-scoped-to-assigned
/// list visibility rule.
/// </summary>
public class TicketQueryTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TicketQueryTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreatedTickets_GetSequentialUniqueTicketNumbers()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "seq-owner");
        var firstId = await CreateTicketAsync(_factory, ownerToken, title: "First");
        var secondId = await CreateTicketAsync(_factory, ownerToken, title: "Second");

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var firstBody = await (await client.GetAsync($"/api/tickets/{firstId}")).Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();
        var secondBody = await (await client.GetAsync($"/api/tickets/{secondId}")).Content.ReadFromJsonAsync<ApiResponse<TicketDetailDto>>();

        firstBody!.Data!.TicketNumber.Should().MatchRegex(@"^TKT-\d{6}$");
        secondBody!.Data!.TicketNumber.Should().MatchRegex(@"^TKT-\d{6}$");
        firstBody.Data.TicketNumber.Should().NotBe(secondBody.Data.TicketNumber);
    }

    [Fact]
    public async Task Pagination_ReturnsCorrectPageSizeAndTotalCount()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "page-owner");
        for (var i = 0; i < 5; i++)
        {
            await CreateTicketAsync(_factory, ownerToken, title: $"Pagination ticket {i}");
        }

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var page1 = await GetPagedAsync(client, "pageNumber=1&pageSize=2");
        var page2 = await GetPagedAsync(client, "pageNumber=2&pageSize=2");

        page1.TotalCount.Should().Be(5);
        page1.TotalPages.Should().Be(3);
        page1.Items.Should().HaveCount(2);
        page2.Items.Should().HaveCount(2);
        page1.Items.Select(i => i.Id).Should().NotIntersectWith(page2.Items.Select(i => i.Id));
    }

    [Fact]
    public async Task Search_MatchesTitleCaseInsensitively()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "search-owner");
        await CreateTicketAsync(_factory, ownerToken, title: "Printer is on fire");
        await CreateTicketAsync(_factory, ownerToken, title: "Cannot reset password");

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "search=PRINTER");

        result.Items.Should().ContainSingle(i => i.Title == "Printer is on fire");
    }

    [Fact]
    public async Task StatusFilter_OnlyReturnsMatchingTickets()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "status-filter-owner");
        var openId = await CreateTicketAsync(_factory, ownerToken, title: "Stays open");
        var toProgressId = await CreateTicketAsync(_factory, ownerToken, title: "Goes in progress");

        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "status-filter-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{toProgressId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "status=Open");

        result.Items.Select(i => i.Id).Should().Contain(openId);
        result.Items.Select(i => i.Id).Should().NotContain(toProgressId);
    }

    [Fact]
    public async Task PriorityFilter_OnlyReturnsMatchingTickets()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "priority-filter-owner");
        var lowId = await CreateTicketAsync(_factory, ownerToken, title: "Low one", priority: TicketPriority.Low);
        var criticalId = await CreateTicketAsync(_factory, ownerToken, title: "Critical one", priority: TicketPriority.Critical);

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "priority=Critical");

        result.Items.Select(i => i.Id).Should().Contain(criticalId);
        result.Items.Select(i => i.Id).Should().NotContain(lowId);
    }

    [Fact]
    public async Task SortByPriority_OrdersBySeverityNotAlphabetically()
    {
        // Alphabetically this would come out Critical, High, Low, Medium — PriorityRank in
        // TicketService fixes the order to genuine severity (Critical > High > Medium > Low).
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "sort-priority-owner");
        await CreateTicketAsync(_factory, ownerToken, title: "Low", priority: TicketPriority.Low);
        await CreateTicketAsync(_factory, ownerToken, title: "Critical", priority: TicketPriority.Critical);
        await CreateTicketAsync(_factory, ownerToken, title: "Medium", priority: TicketPriority.Medium);
        await CreateTicketAsync(_factory, ownerToken, title: "High", priority: TicketPriority.High);

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "sortBy=Priority&sortDescending=true&pageSize=10");

        result.Items.Select(i => i.Priority).Should().Equal(
            TicketPriority.Critical, TicketPriority.High, TicketPriority.Medium, TicketPriority.Low);
    }

    [Fact]
    public async Task SortByStatus_OrdersByWorkflowStageNotAlphabetically()
    {
        // Alphabetically this would come out Closed, InProgress, Open, Resolved — StatusRank in
        // TicketService fixes the order to genuine workflow stage (Open -> ... -> Closed).
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "sort-status-owner");
        var openId = await CreateTicketAsync(_factory, ownerToken, title: "Stays open");

        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "sort-status-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var inProgressId = await CreateTicketAsync(_factory, ownerToken, title: "In progress");
        (await adminClient.PostAsJsonAsync($"/api/tickets/{inProgressId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "sortBy=Status&sortDescending=false&pageSize=10");

        var openIndex = result.Items.FindIndex(i => i.Id == openId);
        var inProgressIndex = result.Items.FindIndex(i => i.Id == inProgressId);
        openIndex.Should().BeLessThan(inProgressIndex);
    }

    [Fact]
    public async Task UnassignedFilter_OnlyReturnsTicketsWithNoAssignedAgent()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "unassigned-filter-owner");
        var unassignedId = await CreateTicketAsync(_factory, ownerToken, title: "Still unassigned");
        var assignedId = await CreateTicketAsync(_factory, ownerToken, title: "Now assigned");

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "unassigned-filter-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "unassigned-filter-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{assignedId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var client = TestClients.WithBearerToken(_factory, ownerToken);
        var result = await GetPagedAsync(client, "unassigned=true");

        result.Items.Select(i => i.Id).Should().Contain(unassignedId);
        result.Items.Select(i => i.Id).Should().NotContain(assignedId);
    }

    [Fact]
    public async Task AgentTicketList_IsScopedToOnlyTheirAssignedTickets()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "agent-scope-owner");
        var assignedId = await CreateTicketAsync(_factory, ownerToken, title: "Assigned to agent");
        var unassignedId = await CreateTicketAsync(_factory, ownerToken, title: "Not assigned");

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "agent-scope-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "agent-scope-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{assignedId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var agentClient = TestClients.WithBearerToken(_factory, agentToken);
        var result = await GetPagedAsync(agentClient, "pageSize=100");

        result.Items.Select(i => i.Id).Should().Contain(assignedId);
        result.Items.Select(i => i.Id).Should().NotContain(unassignedId);

        // Detail lookup for triage stays open to any agent even when unassigned (see
        // TicketService.ApplyDetailVisibilityScope) — only the list is scoped to "assigned to me".
        (await agentClient.GetAsync($"/api/tickets/{unassignedId}")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private static async Task<PagedResult<TicketListItemDto>> GetPagedAsync(HttpClient client, string queryString)
    {
        var response = await client.GetAsync($"/api/tickets?{queryString}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<TicketListItemDto>>>();
        return body!.Data!;
    }
}
