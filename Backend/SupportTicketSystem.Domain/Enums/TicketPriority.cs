using System.Text.Json.Serialization;

namespace SupportTicketSystem.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TicketPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}
