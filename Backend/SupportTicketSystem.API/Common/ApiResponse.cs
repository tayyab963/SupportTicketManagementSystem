namespace SupportTicketSystem.API.Common;

/// <summary>
/// Uniform response envelope for every API response — success and error alike — matching the
/// frontend's ApiSuccessResponse/ApiErrorResponse contract (core/models/api-response.model.ts).
/// Null Data/Errors are omitted from the serialized JSON, so a success response only ever carries
/// Data and an error response only ever carries Errors.
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public IDictionary<string, string[]>? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Success") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message, IDictionary<string, string[]>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}
