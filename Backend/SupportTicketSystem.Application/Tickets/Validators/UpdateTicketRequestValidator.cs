using FluentValidation;
using SupportTicketSystem.Application.Tickets.Dtos;

namespace SupportTicketSystem.Application.Tickets.Validators;

public class UpdateTicketRequestValidator : AbstractValidator<UpdateTicketRequest>
{
    public UpdateTicketRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty();
    }
}
