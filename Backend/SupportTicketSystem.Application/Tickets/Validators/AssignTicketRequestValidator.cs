using FluentValidation;
using SupportTicketSystem.Application.Tickets.Dtos;

namespace SupportTicketSystem.Application.Tickets.Validators;

public class AssignTicketRequestValidator : AbstractValidator<AssignTicketRequest>
{
    public AssignTicketRequestValidator()
    {
        RuleFor(x => x.AgentId)
            .NotEqual(Guid.Empty)
            .When(x => x.AgentId.HasValue)
            .WithMessage("AgentId must not be an empty guid.");
    }
}
