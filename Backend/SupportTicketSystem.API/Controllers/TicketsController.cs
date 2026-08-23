using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Tickets;
using SupportTicketSystem.Application.Tickets.Dtos;
using SupportTicketSystem.Domain.Enums;

namespace SupportTicketSystem.API.Controllers;

/// <summary>
/// Every action requires authentication; all customer-isolation and role rules are enforced inside
/// ITicketService (query-scoped by ICurrentUserService), not here — this controller never reads a
/// userId/role from the request and never trusts route/body values for authorization decisions.
/// </summary>
[ApiController]
[Route("api/tickets")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly ITicketService _ticketService;

    public TicketsController(ITicketService ticketService)
    {
        _ticketService = ticketService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<TicketListItemDto>>>> GetTickets(CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetTicketsAsync(cancellationToken);
        return Ok(ApiResponse<List<TicketListItemDto>>.Ok(result, "Tickets retrieved."));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> GetTicket(Guid id, CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetTicketByIdAsync(id, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket retrieved."));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> CreateTicket(CreateTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.CreateTicketAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<TicketDetailDto>.Ok(result, "Ticket created."));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> UpdateTicket(Guid id, UpdateTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.UpdateTicketAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket updated."));
    }

    [HttpPost("{id:guid}/comments")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> AddComment(Guid id, CreateCommentRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.AddCommentAsync(id, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<TicketDetailDto>.Ok(result, "Comment added."));
    }

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> ChangeStatus(Guid id, ChangeTicketStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.ChangeStatusAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket status updated."));
    }

    /// <summary>Customers never log time — restricted at the role level, in addition to ownership scoping in the service.</summary>
    [HttpPost("{id:guid}/time-entries")]
    [Authorize(Roles = $"{nameof(UserRole.SupportAgent)},{nameof(UserRole.Admin)}")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> AddTimeEntry(Guid id, CreateTimeEntryRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.AddTimeEntryAsync(id, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<TicketDetailDto>.Ok(result, "Time entry logged."));
    }
}
