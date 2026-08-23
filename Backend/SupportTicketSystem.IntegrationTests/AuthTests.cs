using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Auth.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;

namespace SupportTicketSystem.IntegrationTests;

public class AuthTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static RegisterRequest NewRegisterRequest(string emailPrefix) => new()
    {
        FirstName = "Test",
        LastName = "User",
        Email = $"{emailPrefix}-{Guid.NewGuid():N}@example.com",
        Password = "Password123"
    };

    [Fact]
    public async Task Register_ThenLogin_Succeeds_AndIssuesTokenWithCustomerRole()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest("register-login");

        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", request);
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var registerBody = await registerResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        registerBody!.Success.Should().BeTrue();
        registerBody.Data!.User.Role.Should().Be(UserRole.Customer);
        registerBody.Data.Token.Should().NotBeNullOrWhiteSpace();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = request.Email,
            Password = request.Password
        });

        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        loginBody!.Data!.User.Email.Should().Be(request.Email.ToLowerInvariant());
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest("wrong-password");
        await client.PostAsJsonAsync("/api/auth/register", request);

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = request.Email,
            Password = "TotallyWrongPassword1"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Email = "nobody-here@example.com",
            Password = "Whatever123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns409()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest("duplicate");
        await client.PostAsJsonAsync("/api/auth/register", request);

        var secondAttempt = await client.PostAsJsonAsync("/api/auth/register", request);

        secondAttempt.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Register_WithWeakPassword_Returns400WithFieldError()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest("weak-password");
        request.Password = "abc";

        var response = await client.PostAsJsonAsync("/api/auth/register", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Errors.Should().ContainKey(nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Register_IgnoresClientSuppliedRole_AlwaysCreatesCustomer()
    {
        var client = _factory.CreateClient();

        // RegisterRequest has no Role property at all — an extra "role" field in the raw JSON body
        // must be silently ignored by model binding, proving a caller cannot self-elevate to Admin.
        var payload = new
        {
            firstName = "Sneaky",
            lastName = "User",
            email = $"role-escalation-{Guid.NewGuid():N}@example.com",
            password = "Password123",
            role = "Admin"
        };

        var response = await client.PostAsJsonAsync("/api/auth/register", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();
        body!.Data!.User.Role.Should().Be(UserRole.Customer);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithValidToken_ReturnsCurrentUser()
    {
        var client = _factory.CreateClient();
        var request = NewRegisterRequest("me-endpoint");
        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", request);
        var registerBody = await registerResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponseDto>>();

        var authorizedClient = TestClients.WithBearerToken(_factory, registerBody!.Data!.Token);
        var meResponse = await authorizedClient.GetAsync("/api/auth/me");

        meResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var meBody = await meResponse.Content.ReadFromJsonAsync<ApiResponse<UserSummaryDto>>();
        meBody!.Data!.Email.Should().Be(request.Email.ToLowerInvariant());
    }
}
