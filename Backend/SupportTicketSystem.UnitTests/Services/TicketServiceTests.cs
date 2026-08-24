using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Application.Common.Exceptions;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Infrastructure.Persistence;
using SupportTicketSystem.Infrastructure.Services;
using Xunit;

namespace SupportTicketSystem.UnitTests.Services;

/// <summary>
/// Exercises TicketService directly against an EF Core InMemory database — no HTTP pipeline, no
/// controller-level [Authorize] attributes — so these pin down the business rules the service itself
/// is responsible for (status transitions, ownership scoping, creation/assignment rules, duration
/// totals) independent of the ASP.NET routing/auth layer already covered by the integration tests.
/// </summary>
public class TicketServiceTests : IDisposable
{
    private readonly ApplicationDbContext _db;

    public TicketServiceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ApplicationDbContext(options);
    }

    public void Dispose() => _db.Dispose();

    private TicketService CreateService(User callingAs) => new(_db, new FakeCurrentUserService(callingAs));

    private User AddUser(UserRole role, bool isActive = true)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = role.ToString(),
            Email = $"{Guid.NewGuid():N}@example.com",
            PasswordHash = "hash",
            Role = role,
            IsActive = isActive
        };
        _db.Users.Add(user);
        _db.SaveChanges();
        return user;
    }

    private Ticket AddTicket(Guid customerId, TicketStatus status = TicketStatus.Open, Guid? assignedAgentId = null, TicketPriority priority = TicketPriority.Medium)
    {
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            TicketNumber = $"TKT-{Guid.NewGuid().GetHashCode():X8}",
            Title = "Sample ticket",
            Description = "Sample description",
            Status = status,
            Priority = priority,
            CustomerId = customerId,
            AssignedAgentId = assignedAgentId
        };
        _db.Tickets.Add(ticket);
        _db.SaveChanges();
        return ticket;
    }

    // ---------------------------------------------------------------------
    // 1-6: status transition rules (state machine + role authorization together)
    // ---------------------------------------------------------------------

    [Fact]
    public async Task ChangeStatus_OpenToInProgress_ByAssignedAgent_Succeeds()
    {
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open, agent.Id);
        var service = CreateService(agent);

        var result = await service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.InProgress });

        result.Status.Should().Be(TicketStatus.InProgress);
    }

    [Fact]
    public async Task ChangeStatus_InProgressToResolved_ByAssignedAgent_Succeeds_AndStampsResolvedAt()
    {
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.InProgress, agent.Id);
        var service = CreateService(agent);

        var result = await service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Resolved });

        result.Status.Should().Be(TicketStatus.Resolved);
        result.ResolvedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ChangeStatus_ResolvedToClosed_ByOwningCustomer_Succeeds_AndStampsClosedAt()
    {
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Resolved);
        var service = CreateService(customer);

        var result = await service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Closed });

        result.Status.Should().Be(TicketStatus.Closed);
        result.ClosedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ChangeStatus_OpenToClosed_IsRejected_RegardlessOfRole()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open);
        var service = CreateService(admin);

        var act = () => service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Closed });

        await act.Should().ThrowAsync<FluentValidation.ValidationException>();
    }

    [Fact]
    public async Task ChangeStatus_OpenToResolved_IsRejected_RegardlessOfRole()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open);
        var service = CreateService(admin);

        var act = () => service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Resolved });

        await act.Should().ThrowAsync<FluentValidation.ValidationException>();
    }

    [Fact]
    public async Task ChangeStatus_ClosedToOpen_IsRejected_ClosedIsTerminal()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Closed);
        var service = CreateService(admin);

        var act = () => service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Open });

        await act.Should().ThrowAsync<FluentValidation.ValidationException>();
    }

    [Fact]
    public async Task ChangeStatus_ByUnassignedAgent_IsForbidden_EvenForALegalTransition()
    {
        var owningAgent = AddUser(UserRole.SupportAgent);
        var otherAgent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open, owningAgent.Id);
        var service = CreateService(otherAgent);

        var act = () => service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.InProgress });

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    [Fact]
    public async Task ChangeStatus_ResolvedToClosed_ByAssignedAgent_IsForbidden_OnlyCustomerOrAdminMayClose()
    {
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Resolved, agent.Id);
        var service = CreateService(agent);

        var act = () => service.ChangeStatusAsync(ticket.Id, new ChangeTicketStatusRequest { Status = TicketStatus.Closed });

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    // ---------------------------------------------------------------------
    // 7: customer ownership validation
    // ---------------------------------------------------------------------

    [Fact]
    public async Task GetTicketById_ByOwningCustomer_Succeeds()
    {
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(customer);

        var result = await service.GetTicketByIdAsync(ticket.Id);

        result.Id.Should().Be(ticket.Id);
    }

    [Fact]
    public async Task GetTicketById_ByNonOwningCustomer_ThrowsNotFound()
    {
        var owner = AddUser(UserRole.Customer);
        var attacker = AddUser(UserRole.Customer);
        var ticket = AddTicket(owner.Id);
        var service = CreateService(attacker);

        var act = () => service.GetTicketByIdAsync(ticket.Id);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task UpdateTicket_ByNonOwningCustomer_ThrowsNotFound_TicketIsUnchanged()
    {
        var owner = AddUser(UserRole.Customer);
        var attacker = AddUser(UserRole.Customer);
        var ticket = AddTicket(owner.Id);
        var service = CreateService(attacker);

        var act = () => service.UpdateTicketAsync(ticket.Id, new UpdateTicketRequest { Title = "Hijacked", Description = "Hijacked" });

        await act.Should().ThrowAsync<NotFoundException>();
        (await _db.Tickets.AsNoTracking().FirstAsync(t => t.Id == ticket.Id)).Title.Should().Be("Sample ticket");
    }

    [Fact]
    public async Task UpdateTicket_OnAClosedTicket_ByOwningCustomer_IsForbidden()
    {
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Closed);
        var service = CreateService(customer);

        var act = () => service.UpdateTicketAsync(ticket.Id, new UpdateTicketRequest { Title = "New title", Description = "New description" });

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    // ---------------------------------------------------------------------
    // 8: time duration calculation
    // ---------------------------------------------------------------------

    [Fact]
    public async Task GetTimeEntries_TotalDurationIsTheSumOfAllEntries_ComputedByTheDatabase()
    {
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open, agent.Id);
        var service = CreateService(agent);

        await service.AddTimeEntryAsync(ticket.Id, new CreateTimeEntryRequest { WorkDate = DateOnly.FromDateTime(DateTime.UtcNow), DurationMinutes = 45, Description = "First session." });
        await service.AddTimeEntryAsync(ticket.Id, new CreateTimeEntryRequest { WorkDate = DateOnly.FromDateTime(DateTime.UtcNow), DurationMinutes = 30, Description = "Second session." });
        await service.AddTimeEntryAsync(ticket.Id, new CreateTimeEntryRequest { WorkDate = DateOnly.FromDateTime(DateTime.UtcNow), DurationMinutes = 15, Description = "Third session." });

        var summary = await service.GetTimeEntriesAsync(ticket.Id);

        summary.Entries.Should().HaveCount(3);
        summary.TotalDurationMinutes.Should().Be(90);
    }

    [Fact]
    public async Task GetTimeEntries_NoEntriesLogged_TotalIsZero()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(admin);

        var summary = await service.GetTimeEntriesAsync(ticket.Id);

        summary.Entries.Should().BeEmpty();
        summary.TotalDurationMinutes.Should().Be(0);
    }

    [Fact]
    public async Task AddTimeEntry_ByUnassignedAgent_IsForbidden()
    {
        var owningAgent = AddUser(UserRole.SupportAgent);
        var otherAgent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open, owningAgent.Id);
        var service = CreateService(otherAgent);

        var act = () => service.AddTimeEntryAsync(ticket.Id, new CreateTimeEntryRequest { WorkDate = DateOnly.FromDateTime(DateTime.UtcNow), DurationMinutes = 30, Description = "Should be rejected." });

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    // ---------------------------------------------------------------------
    // 9: ticket creation rules
    // ---------------------------------------------------------------------

    [Fact]
    public async Task CreateTicket_ByCustomer_IgnoresAnySuppliedCustomerId_AlwaysUsesTheCallersOwnId()
    {
        var customer = AddUser(UserRole.Customer);
        var someoneElse = AddUser(UserRole.Customer);
        var service = CreateService(customer);

        var result = await service.CreateTicketAsync(new CreateTicketRequest
        {
            Title = "  Cannot log in  ",
            Description = "  Happens every morning.  ",
            Priority = TicketPriority.High,
            CustomerId = someoneElse.Id
        });

        result.CustomerId.Should().Be(customer.Id);
        result.Status.Should().Be(TicketStatus.Open);
        result.Title.Should().Be("Cannot log in");
        result.Description.Should().Be("Happens every morning.");
    }

    [Fact]
    public async Task CreateTicket_ByAdmin_WithoutCustomerId_ThrowsValidationException()
    {
        var admin = AddUser(UserRole.Admin);
        var service = CreateService(admin);

        var act = () => service.CreateTicketAsync(new CreateTicketRequest { Title = "T", Description = "D", Priority = TicketPriority.Low, CustomerId = null });

        await act.Should().ThrowAsync<FluentValidation.ValidationException>();
    }

    [Fact]
    public async Task CreateTicket_ByAdmin_ForANonexistentCustomer_ThrowsNotFound()
    {
        var admin = AddUser(UserRole.Admin);
        var service = CreateService(admin);

        var act = () => service.CreateTicketAsync(new CreateTicketRequest { Title = "T", Description = "D", Priority = TicketPriority.Low, CustomerId = Guid.NewGuid() });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task CreateTicket_ByAdmin_OnBehalfOfARealCustomer_Succeeds()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var service = CreateService(admin);

        var result = await service.CreateTicketAsync(new CreateTicketRequest { Title = "T", Description = "D", Priority = TicketPriority.Low, CustomerId = customer.Id });

        result.CustomerId.Should().Be(customer.Id);
    }

    [Fact]
    public async Task CreateTicket_BySupportAgent_IsForbidden()
    {
        var agent = AddUser(UserRole.SupportAgent);
        var service = CreateService(agent);

        var act = () => service.CreateTicketAsync(new CreateTicketRequest { Title = "T", Description = "D", Priority = TicketPriority.Low });

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    // ---------------------------------------------------------------------
    // 10: assignment rules
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Assign_ToAnActiveSupportAgent_Succeeds()
    {
        var admin = AddUser(UserRole.Admin);
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(admin);

        var result = await service.AssignAsync(ticket.Id, new AssignTicketRequest { AgentId = agent.Id });

        result.AssignedAgentId.Should().Be(agent.Id);
    }

    [Fact]
    public async Task Assign_ToANonexistentAgent_ThrowsNotFound()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(admin);

        var act = () => service.AssignAsync(ticket.Id, new AssignTicketRequest { AgentId = Guid.NewGuid() });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Assign_ToACustomerId_ThrowsNotFound_CustomersAreNotValidAssignees()
    {
        var admin = AddUser(UserRole.Admin);
        var customer = AddUser(UserRole.Customer);
        var otherCustomer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(admin);

        var act = () => service.AssignAsync(ticket.Id, new AssignTicketRequest { AgentId = otherCustomer.Id });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Assign_ToADeactivatedAgent_ThrowsNotFound()
    {
        var admin = AddUser(UserRole.Admin);
        var inactiveAgent = AddUser(UserRole.SupportAgent, isActive: false);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id);
        var service = CreateService(admin);

        var act = () => service.AssignAsync(ticket.Id, new AssignTicketRequest { AgentId = inactiveAgent.Id });

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Assign_WithNullAgentId_UnassignsAPreviouslyAssignedTicket()
    {
        var admin = AddUser(UserRole.Admin);
        var agent = AddUser(UserRole.SupportAgent);
        var customer = AddUser(UserRole.Customer);
        var ticket = AddTicket(customer.Id, TicketStatus.Open, agent.Id);
        var service = CreateService(admin);

        var result = await service.AssignAsync(ticket.Id, new AssignTicketRequest { AgentId = null });

        result.AssignedAgentId.Should().BeNull();
    }
}
