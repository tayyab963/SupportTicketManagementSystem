using System.Net;
using FluentAssertions;
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
}
