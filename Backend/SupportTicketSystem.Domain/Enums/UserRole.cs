using System.Text.Json.Serialization;

namespace SupportTicketSystem.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum UserRole
{
    Admin = 1,
    SupportAgent = 2,
    Customer = 3
}
