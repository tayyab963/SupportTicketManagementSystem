using SupportTicketSystem.Application.Tickets.Dtos;

namespace SupportTicketSystem.Application.Tickets;

/// <summary>
/// All members enforce customer data isolation and role-based mutation rules internally
/// (query-scoped by the authenticated caller, resolved via ICurrentUserService) — callers never
/// need to, and must not, pass along a caller-supplied identity to authorize these operations.
/// </summary>
public interface ITicketService
{
    Task<List<TicketListItemDto>> GetTicketsAsync(CancellationToken cancellationToken = default);

    Task<TicketDetailDto> GetTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken = default);

    Task<TicketDetailDto> CreateTicketAsync(CreateTicketRequest request, CancellationToken cancellationToken = default);

    Task<TicketDetailDto> UpdateTicketAsync(Guid ticketId, UpdateTicketRequest request, CancellationToken cancellationToken = default);

    Task<TicketDetailDto> ChangeStatusAsync(Guid ticketId, ChangeTicketStatusRequest request, CancellationToken cancellationToken = default);

    Task<TicketDetailDto> AddCommentAsync(Guid ticketId, CreateCommentRequest request, CancellationToken cancellationToken = default);

    Task<TicketDetailDto> AddTimeEntryAsync(Guid ticketId, CreateTimeEntryRequest request, CancellationToken cancellationToken = default);
}
