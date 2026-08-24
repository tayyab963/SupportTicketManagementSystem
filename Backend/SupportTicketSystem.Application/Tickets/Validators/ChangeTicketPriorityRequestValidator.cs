using FluentValidation;
using SupportTicketSystem.Application.Tickets.Dtos;

namespace SupportTicketSystem.Application.Tickets.Validators;

public class ChangeTicketPriorityRequestValidator : AbstractValidator<ChangeTicketPriorityRequest>
{
    public ChangeTicketPriorityRequestValidator()
    {
        RuleFor(x => x.Priority).IsInEnum();
    }
}
