using System.Text.Json.Serialization;

namespace SupportTicketSystem.Application.Tickets.Dtos;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketSortBy
{
    CreatedAt = 1,
    UpdatedAt = 2,
    Priority = 3,
    Status = 4
}
