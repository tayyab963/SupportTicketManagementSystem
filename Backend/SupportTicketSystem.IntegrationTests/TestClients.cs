using System.Net.Http.Headers;

namespace SupportTicketSystem.IntegrationTests;

public static class TestClients
{
    public static HttpClient WithBearerToken(CustomWebApplicationFactory factory, string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
