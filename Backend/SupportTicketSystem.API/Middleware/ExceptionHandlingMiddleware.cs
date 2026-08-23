using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Common.Exceptions;

namespace SupportTicketSystem.API.Middleware;

/// <summary>
/// Single place that turns domain/service exceptions into the correct HTTP status code and the
/// shared ApiResponse envelope, so every controller can just throw instead of repeating
/// try/catch-to-status-code boilerplate.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception exception)
        {
            await WriteErrorResponseAsync(context, exception);
        }
    }

    private async Task WriteErrorResponseAsync(HttpContext context, Exception exception)
    {
        var (statusCode, message, errors) = MapException(exception);

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message, errors));
    }

    private static (int StatusCode, string Message, IDictionary<string, string[]>? Errors) MapException(Exception exception) => exception switch
    {
        NotFoundException => (StatusCodes.Status404NotFound, exception.Message, null),
        ForbiddenAccessException => (StatusCodes.Status403Forbidden, exception.Message, null),
        ConflictException => (StatusCodes.Status409Conflict, exception.Message, null),
        UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, exception.Message, null),
        FluentValidation.ValidationException validationException => (
            StatusCodes.Status400BadRequest,
            "Validation failed.",
            validationException.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())),
        _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.", null)
    };
}
