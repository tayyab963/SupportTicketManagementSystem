using FluentAssertions;
using SupportTicketSystem.Domain.Entities;
using SupportTicketSystem.Domain.Enums;
using Xunit;

namespace SupportTicketSystem.UnitTests.Domain;

public class EntityDefaultsTests
{
    [Fact]
    public void User_IsActive_DefaultsToTrue()
    {
        var user = new User();

        user.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Ticket_CanBeAssignedCoreProperties()
    {
        var customerId = Guid.NewGuid();

        var ticket = new Ticket
        {
            TicketNumber = "TKT-000001",
            Title = "Login page returns 500",
            Description = "Users cannot log in since this morning.",
            Status = TicketStatus.Open,
            Priority = TicketPriority.High,
            CustomerId = customerId
        };

        ticket.TicketNumber.Should().Be("TKT-000001");
        ticket.Status.Should().Be(TicketStatus.Open);
        ticket.Priority.Should().Be(TicketPriority.High);
        ticket.AssignedAgentId.Should().BeNull();
        ticket.CustomerId.Should().Be(customerId);
    }
}
