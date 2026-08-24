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
/// Phase 4: comments, the activity timeline, and time tracking. Covers the GET endpoints added for
/// each, the customer/agent isolation rules layered on top of them, and that the timeline correctly
/// records every tracked event (creation, assignment, priority, status, comments, time entries, closing).
/// </summary>
public class TicketCommentsTimelineAndTimeTrackingTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TicketCommentsTimelineAndTimeTrackingTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetComments_ReturnsCommentsInChronologicalOrder()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "comments-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var ownerClient = TestClients.WithBearerToken(_factory, ownerToken);

        (await ownerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest { CommentText = "First." }))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        (await ownerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest { CommentText = "Second." }))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var response = await ownerClient.GetAsync($"/api/tickets/{ticketId}/comments");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<CommentDto>>>();
        body!.Data.Should().HaveCount(2);
        body.Data![0].CommentText.Should().Be("First.");
        body.Data![1].CommentText.Should().Be("Second.");
        body.Data![0].UserRole.Should().Be(UserRole.Customer);
    }

    [Fact]
    public async Task GetComments_CustomerCannotViewAnotherCustomersComments_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "comments-owner-iso");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync(_factory, "comments-attacker-iso");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.GetAsync($"/api/tickets/{ticketId}/comments");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UnassignedAgent_CannotAddComment_Returns403()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "comments-unassigned-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (agentToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "comments-unassigned-agent");
        var agentClient = TestClients.WithBearerToken(_factory, agentToken);

        var response = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest
        {
            CommentText = "I'm not assigned to this ticket."
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AssignedAgent_CanAddComment()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "comments-assigned-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "comments-assigned-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "comments-assigned-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var agentClient = TestClients.WithBearerToken(_factory, agentToken);
        var response = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest
        {
            CommentText = "Looking into this now."
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Admin_CanCommentOnAnyTicket_RegardlessOfAssignment()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "comments-admin-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "comments-admin-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);

        var response = await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest
        {
            CommentText = "Admin note."
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task GetTimeline_TracksFullLifecycleInChronologicalOrder_WithHumanReadableAssignmentNames()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "timeline-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken, priority: TicketPriority.Low);
        var ownerClient = TestClients.WithBearerToken(_factory, ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "timeline-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "timeline-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        var agentClient = TestClients.WithBearerToken(_factory, agentToken);

        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/priority", new ChangeTicketPriorityRequest { Priority = TicketPriority.High }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.InProgress }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await ownerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/comments", new CreateCommentRequest { CommentText = "Any update?" }))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        (await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 90,
            Description = "Investigated the issue."
        })).StatusCode.Should().Be(HttpStatusCode.Created);
        (await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.Resolved }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await ownerClient.PostAsJsonAsync($"/api/tickets/{ticketId}/status", new ChangeTicketStatusRequest { Status = TicketStatus.Closed }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await ownerClient.GetAsync($"/api/tickets/{ticketId}/timeline");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<ActivityDto>>>();
        var activities = body!.Data!;

        activities.Should().HaveCount(9);

        // The final status change (to Closed) and the dedicated Closed activity are both recorded
        // within the same SaveChanges call and so share an identical CreatedAt — their relative order
        // isn't meaningful, only that everything before them is ordered and both are present at the end.
        activities.Take(7).Select(a => a.ActivityType).Should().Equal(
            ActivityType.Created,
            ActivityType.AssignmentChanged,
            ActivityType.PriorityChanged,
            ActivityType.StatusChanged,
            ActivityType.CommentAdded,
            ActivityType.TimeLogged,
            ActivityType.StatusChanged);
        activities.Skip(7).Select(a => a.ActivityType).Should().BeEquivalentTo(new[] { ActivityType.StatusChanged, ActivityType.Closed });

        activities.Should().BeInAscendingOrder(a => a.CreatedAt);

        var assignment = activities.Single(a => a.ActivityType == ActivityType.AssignmentChanged);
        assignment.OldValue.Should().Be("Unassigned");
        assignment.NewValue.Should().Be("Test SupportAgent");

        var priority = activities.Single(a => a.ActivityType == ActivityType.PriorityChanged);
        priority.OldValue.Should().Be("Low");
        priority.NewValue.Should().Be("High");

        var timeLogged = activities.Single(a => a.ActivityType == ActivityType.TimeLogged);
        timeLogged.NewValue.Should().Be("90");

        var closed = activities.Single(a => a.ActivityType == ActivityType.Closed);
        closed.OldValue.Should().Be("Resolved");
        closed.NewValue.Should().Be("Closed");
    }

    [Fact]
    public async Task GetTimeline_CustomerCannotViewAnotherCustomersTimeline_Returns404()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "timeline-owner-iso");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (attackerToken, _) = await RegisterCustomerAsync(_factory, "timeline-attacker-iso");
        var attackerClient = TestClients.WithBearerToken(_factory, attackerToken);

        var response = await attackerClient.GetAsync($"/api/tickets/{ticketId}/timeline");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetTimeEntries_TotalDurationIsTheSumOfAllEntries()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "time-total-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);

        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "time-total-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "time-total-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var agentClient = TestClients.WithBearerToken(_factory, agentToken);
        await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 45,
            Description = "First session."
        });
        await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = 45,
            Description = "Second session."
        });

        var response = await agentClient.GetAsync($"/api/tickets/{ticketId}/time-entries");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<TimeEntrySummaryDto>>();
        body!.Data!.Entries.Should().HaveCount(2);
        body.Data!.TotalDurationMinutes.Should().Be(90);
    }

    [Fact]
    public async Task GetTimeEntries_CustomerIsForbidden_EvenOnTheirOwnTicket()
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "time-forbidden-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var ownerClient = TestClients.WithBearerToken(_factory, ownerToken);

        var response = await ownerClient.GetAsync($"/api/tickets/{ticketId}/time-entries");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-15)]
    public async Task AddTimeEntry_DurationNotPositive_Returns400(int durationMinutes)
    {
        var (ownerToken, _) = await RegisterCustomerAsync(_factory, "time-invalid-owner");
        var ticketId = await CreateTicketAsync(_factory, ownerToken);
        var (agentToken, agentId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "time-invalid-agent");
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "time-invalid-admin");
        var adminClient = TestClients.WithBearerToken(_factory, adminToken);
        (await adminClient.PostAsJsonAsync($"/api/tickets/{ticketId}/assign", new AssignTicketRequest { AgentId = agentId }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var agentClient = TestClients.WithBearerToken(_factory, agentToken);
        var response = await agentClient.PostAsJsonAsync($"/api/tickets/{ticketId}/time-entries", new CreateTimeEntryRequest
        {
            WorkDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DurationMinutes = durationMinutes,
            Description = "Should be rejected."
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
