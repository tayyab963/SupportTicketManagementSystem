using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SupportTicketSystem.Infrastructure.Persistence;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Boots the real API host (Program.cs, real middleware/auth pipeline) but swaps the SQL Server
/// DbContext for an isolated EF Core InMemory database, and forces the "Testing" environment so
/// Program.cs's Development-only auto-migrate/seed block never runs — tests never touch a real
/// database or the LocalDB the app uses at dev time. Each factory instance gets its own uniquely
/// named database so test classes don't leak state into one another.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"TestDb_{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // The "Testing" environment only loads appsettings.json (no appsettings.Testing.json exists,
        // deliberately — there's nothing test-specific worth committing to disk), whose base Jwt:Secret
        // is intentionally blank for production safety. Supply a self-contained test-only signing key
        // here instead of adding another secrets file.
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "INTEGRATION-TEST-ONLY-SIGNING-KEY-DO-NOT-USE-ELSEWHERE-1234567890",
                ["Jwt:Issuer"] = "SupportTicketSystem.IntegrationTests",
                ["Jwt:Audience"] = "SupportTicketSystem.IntegrationTests.Client",
                ["Jwt:ExpirationMinutes"] = "60"
            });
        });

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(_databaseName));
        });
    }
}
