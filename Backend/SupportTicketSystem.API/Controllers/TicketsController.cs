using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Common.Models;
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

    /// <summary>
    /// Server-side paging/search/filter/sort — never loads the caller's full accessible ticket set
    /// into memory. See TicketQueryParameters for the supported filters/sort keys.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<TicketListItemDto>>>> GetTickets([FromQuery] TicketQueryParameters query, CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetTicketsAsync(query, cancellationToken);
        return Ok(ApiResponse<PagedResult<TicketListItemDto>>.Ok(result, "Tickets retrieved."));
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

    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<ApiResponse<List<CommentDto>>>> GetComments(Guid id, CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetCommentsAsync(id, cancellationToken);
        return Ok(ApiResponse<List<CommentDto>>.Ok(result, "Comments retrieved."));
    }

    /// <summary>Chronological activity log — ticket creation, assignment/status/priority changes, comments, time entries, closing.</summary>
    [HttpGet("{id:guid}/timeline")]
    public async Task<ActionResult<ApiResponse<List<ActivityDto>>>> GetTimeline(Guid id, CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetTimelineAsync(id, cancellationToken);
        return Ok(ApiResponse<List<ActivityDto>>.Ok(result, "Timeline retrieved."));
    }

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> ChangeStatus(Guid id, ChangeTicketStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.ChangeStatusAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket status updated."));
    }

    /// <summary>Admin-only: reassigning tickets is an Admin capability, not an Agent self-service action.</summary>
    [HttpPost("{id:guid}/assign")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> Assign(Guid id, AssignTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.AssignAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket assignment updated."));
    }

    /// <summary>Admin-only: priority changes are an Admin capability.</summary>
    [HttpPost("{id:guid}/priority")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> ChangePriority(Guid id, ChangeTicketPriorityRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.ChangePriorityAsync(id, request, cancellationToken);
        return Ok(ApiResponse<TicketDetailDto>.Ok(result, "Ticket priority updated."));
    }

    /// <summary>Customers never log time — restricted at the role level, in addition to ownership scoping in the service.</summary>
    [HttpPost("{id:guid}/time-entries")]
    [Authorize(Roles = $"{nameof(UserRole.SupportAgent)},{nameof(UserRole.Admin)}")]
    public async Task<ActionResult<ApiResponse<TicketDetailDto>>> AddTimeEntry(Guid id, CreateTimeEntryRequest request, CancellationToken cancellationToken)
    {
        var result = await _ticketService.AddTimeEntryAsync(id, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<TicketDetailDto>.Ok(result, "Time entry logged."));
    }

    /// <summary>Staff-only, same as logging time: internal work logs are not exposed to customers.</summary>
    [HttpGet("{id:guid}/time-entries")]
    [Authorize(Roles = $"{nameof(UserRole.SupportAgent)},{nameof(UserRole.Admin)}")]
    public async Task<ActionResult<ApiResponse<TimeEntrySummaryDto>>> GetTimeEntries(Guid id, CancellationToken cancellationToken)
    {
        var result = await _ticketService.GetTimeEntriesAsync(id, cancellationToken);
        return Ok(ApiResponse<TimeEntrySummaryDto>.Ok(result, "Time entries retrieved."));
    }
}
