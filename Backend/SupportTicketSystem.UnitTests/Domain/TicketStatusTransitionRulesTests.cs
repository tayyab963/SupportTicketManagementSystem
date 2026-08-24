using FluentAssertions;
using SupportTicketSystem.Domain.Enums;
using SupportTicketSystem.Domain.Rules;
using Xunit;

namespace SupportTicketSystem.UnitTests.Domain;

public class TicketStatusTransitionRulesTests
{
    [Theory]
    [InlineData(TicketStatus.Open, TicketStatus.InProgress)]
    [InlineData(TicketStatus.InProgress, TicketStatus.Resolved)]
    [InlineData(TicketStatus.InProgress, TicketStatus.Open)]
    [InlineData(TicketStatus.Resolved, TicketStatus.Closed)]
    [InlineData(TicketStatus.Resolved, TicketStatus.InProgress)]
    public void IsValidTransition_AllowsDocumentedTransitions(TicketStatus from, TicketStatus to)
    {
        TicketStatusTransitionRules.IsValidTransition(from, to).Should().BeTrue();
    }

    [Theory]
    [InlineData(TicketStatus.Open, TicketStatus.Resolved)]
    [InlineData(TicketStatus.Open, TicketStatus.Closed)]
    [InlineData(TicketStatus.Closed, TicketStatus.Open)]
    [InlineData(TicketStatus.Closed, TicketStatus.InProgress)]
    [InlineData(TicketStatus.Closed, TicketStatus.Resolved)]
    [InlineData(TicketStatus.Open, TicketStatus.Open)]
    [InlineData(TicketStatus.InProgress, TicketStatus.InProgress)]
    public void IsValidTransition_RejectsUndocumentedTransitions(TicketStatus from, TicketStatus to)
    {
        TicketStatusTransitionRules.IsValidTransition(from, to).Should().BeFalse();
    }
}
