using FluentValidation;
using SupportTicketSystem.Application.Tickets.Dtos;

namespace SupportTicketSystem.Application.Tickets.Validators;

public class ChangeTicketStatusRequestValidator : AbstractValidator<ChangeTicketStatusRequest>
{
    public ChangeTicketStatusRequestValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
    }
}
