using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using FluentAssertions;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace SupportTicketSystem.IntegrationTests;

public class ApiFactoryTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ApiFactoryTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// Swagger is only registered in the Development environment (see Program.cs), so this test host
    /// (which deliberately runs as "Testing" — see CustomWebApplicationFactory) doesn't serve it;
    /// Swagger itself is verified manually per the README. This checks instead that the full host —
    /// DI graph, auth middleware, routing — boots and responds correctly end to end.
    /// </summary>
    [Fact]
    public async Task Application_StartsUp_AndRejectsUnauthenticatedRequestsToProtectedRoutes()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/tickets");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Application_Returns404_ForUnknownRoutes()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/this-route-does-not-exist");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>A syntactically garbage bearer token (not even a well-formed JWT) — distinct from the "no token at all" case above.</summary>
    [Fact]
    public async Task MalformedBearerToken_Returns401()
    {
        var client = TestClients.WithBearerToken(_factory, "this-is-not-a-jwt");

        var response = await client.GetAsync("/api/tickets");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    /// <summary>A well-formed JWT (three base64url segments) whose signature was never issued by this host — must still be rejected.</summary>
    [Fact]
    public async Task TamperedBearerToken_WithInvalidSignature_Returns401()
    {
        var fakeHeader = Convert.ToBase64String("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"u8.ToArray()).TrimEnd('=');
        var fakePayload = Convert.ToBase64String("{\"sub\":\"attacker\",\"role\":\"Admin\"}"u8.ToArray()).TrimEnd('=');
        var tamperedToken = $"{fakeHeader}.{fakePayload}.not-a-valid-signature";

        var client = TestClients.WithBearerToken(_factory, tamperedToken);

        var response = await client.GetAsync("/api/tickets");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    /// <summary>A token signed with the real test signing key (see CustomWebApplicationFactory) but whose `exp` claim is already in the past — ValidateLifetime must still reject it.</summary>
    [Fact]
    public async Task ExpiredButValidlySignedBearerToken_Returns401()
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("INTEGRATION-TEST-ONLY-SIGNING-KEY-DO-NOT-USE-ELSEWHERE-1234567890"));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var expiredToken = new JwtSecurityToken(
            issuer: "SupportTicketSystem.IntegrationTests",
            audience: "SupportTicketSystem.IntegrationTests.Client",
            claims: new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()) },
            expires: DateTime.UtcNow.AddMinutes(-5),
            signingCredentials: credentials);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(expiredToken);
        var client = TestClients.WithBearerToken(_factory, tokenString);

        var response = await client.GetAsync("/api/tickets");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
