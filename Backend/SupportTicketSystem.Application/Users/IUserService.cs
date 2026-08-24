using SupportTicketSystem.Application.Auth.Dtos;

namespace SupportTicketSystem.Application.Users;

public interface IUserService
{
    /// <summary>Active support agents only, for assignment/filter pickers.</summary>
    Task<List<UserSummaryDto>> GetAgentsAsync(CancellationToken cancellationToken = default);
}
