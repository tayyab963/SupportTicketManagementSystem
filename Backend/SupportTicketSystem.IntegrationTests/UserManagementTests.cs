using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using SupportTicketSystem.API.Common;
using SupportTicketSystem.Application.Common.Models;
using SupportTicketSystem.Application.Users.Dtos;
using SupportTicketSystem.Domain.Enums;
using Xunit;
using static SupportTicketSystem.IntegrationTests.TicketTestHelpers;

namespace SupportTicketSystem.IntegrationTests;

/// <summary>
/// Phase 5: admin-only user management (GET/POST /api/users, PUT /api/users/{id}, POST
/// .../activate, POST .../deactivate). Covers the Admin-only authorization matrix (Customer/Agent
/// forbidden, Admin allowed), search/role/active filters, pagination, that PasswordHash is never
/// serialized, and that an admin cannot deactivate their own account.
/// </summary>
public class UserManagementTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public UserManagementTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetUsers_Customer_Returns403()
    {
        var (customerToken, _) = await RegisterCustomerAsync(_factory, "users-customer");
        var client = TestClients.WithBearerToken(_factory, customerToken);

        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetUsers_SupportAgent_Returns403()
    {
        var (agentToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "users-agent");
        var client = TestClients.WithBearerToken(_factory, agentToken);

        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetUsers_Unauthenticated_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetUsers_Admin_ReturnsPagedResults_AndNeverSerializesPasswordHash()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-list-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        await RegisterCustomerAsync(_factory, "users-list-customer");

        var response = await client.GetAsync("/api/users?pageNumber=1&pageSize=5");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var rawJson = await response.Content.ReadAsStringAsync();
        rawJson.ToLowerInvariant().Should().NotContain("passwordhash");

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<UserListItemDto>>>();
        body!.Data!.Items.Should().NotBeEmpty();
        body.Data!.PageSize.Should().Be(5);
        body.Data!.TotalCount.Should().BeGreaterOrEqualTo(2);
    }

    [Fact]
    public async Task GetUsers_SearchMatchesEmail()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-search-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        var uniquePrefix = $"findme-{Guid.NewGuid():N}";
        await RegisterCustomerAsync(_factory, uniquePrefix);

        var response = await client.GetAsync($"/api/users?search={uniquePrefix}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<UserListItemDto>>>();
        body!.Data!.Items.Should().ContainSingle(u => u.Email.StartsWith(uniquePrefix));
    }

    [Fact]
    public async Task GetUsers_RoleFilter_ReturnsOnlyMatchingRole()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-role-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "users-role-agent");

        var response = await client.GetAsync("/api/users?role=SupportAgent&pageSize=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<UserListItemDto>>>();
        body!.Data!.Items.Should().NotBeEmpty();
        body.Data!.Items.Should().OnlyContain(u => u.Role == UserRole.SupportAgent);
    }

    [Fact]
    public async Task GetUsers_ActiveFilter_ReturnsOnlyMatchingStatus()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-active-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        var (_, deactivatedId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "users-active-target");
        (await client.PostAsync($"/api/users/{deactivatedId}/deactivate", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await client.GetAsync("/api/users?isActive=false&pageSize=100");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<UserListItemDto>>>();
        body!.Data!.Items.Should().Contain(u => u.Id == deactivatedId);
        body.Data!.Items.Should().OnlyContain(u => !u.IsActive);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.SupportAgent)]
    [InlineData(UserRole.Customer)]
    public async Task CreateUser_Admin_CanCreateAnyRole(UserRole role)
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, $"users-create-{role.ToString().ToLowerInvariant()}-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);

        var response = await client.PostAsJsonAsync("/api/users", new CreateUserRequest
        {
            FirstName = "New",
            LastName = role.ToString(),
            Email = $"new-{role}-{Guid.NewGuid():N}@example.com",
            Password = "Password123",
            Role = role
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UserListItemDto>>();
        body!.Data!.Role.Should().Be(role);
        body.Data!.IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData(UserRole.SupportAgent)]
    [InlineData(UserRole.Customer)]
    public async Task CreateUser_NonAdmin_Returns403(UserRole role)
    {
        var (token, _) = role == UserRole.Customer
            ? await RegisterCustomerAsync(_factory, "users-create-forbidden-customer")
            : await CreateStaffUserDirectlyAsync(_factory, role, "users-create-forbidden-agent");
        var client = TestClients.WithBearerToken(_factory, token);

        var response = await client.PostAsJsonAsync("/api/users", new CreateUserRequest
        {
            FirstName = "Nope",
            LastName = "Nope",
            Email = $"nope-{Guid.NewGuid():N}@example.com",
            Password = "Password123",
            Role = UserRole.Customer
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_Returns409()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-dup-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        var email = $"dup-{Guid.NewGuid():N}@example.com";
        var request = new CreateUserRequest
        {
            FirstName = "First",
            LastName = "Dup",
            Email = email,
            Password = "Password123",
            Role = UserRole.Customer
        };

        (await client.PostAsJsonAsync("/api/users", request)).StatusCode.Should().Be(HttpStatusCode.Created);
        var secondResponse = await client.PostAsJsonAsync("/api/users", request);

        secondResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task UpdateUser_Admin_UpdatesProfileAndRole()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-update-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        var (_, targetId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Customer, "users-update-target");

        var response = await client.PutAsJsonAsync($"/api/users/{targetId}", new UpdateUserRequest
        {
            FirstName = "Updated",
            LastName = "Name",
            Email = $"updated-{Guid.NewGuid():N}@example.com",
            Role = UserRole.SupportAgent
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UserListItemDto>>();
        body!.Data!.FirstName.Should().Be("Updated");
        body.Data!.Role.Should().Be(UserRole.SupportAgent);
    }

    [Fact]
    public async Task UpdateUser_UnknownId_Returns404()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-update-404-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);

        var response = await client.PutAsJsonAsync($"/api/users/{Guid.NewGuid()}", new UpdateUserRequest
        {
            FirstName = "Ghost",
            LastName = "User",
            Email = $"ghost-{Guid.NewGuid():N}@example.com",
            Role = UserRole.Customer
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeactivateThenActivate_Admin_TogglesIsActive()
    {
        var (adminToken, _) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-toggle-admin");
        var client = TestClients.WithBearerToken(_factory, adminToken);
        var (_, targetId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.SupportAgent, "users-toggle-target");

        var deactivateResponse = await client.PostAsync($"/api/users/{targetId}/deactivate", null);
        deactivateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var deactivatedBody = await deactivateResponse.Content.ReadFromJsonAsync<ApiResponse<UserListItemDto>>();
        deactivatedBody!.Data!.IsActive.Should().BeFalse();

        var activateResponse = await client.PostAsync($"/api/users/{targetId}/activate", null);
        activateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var activatedBody = await activateResponse.Content.ReadFromJsonAsync<ApiResponse<UserListItemDto>>();
        activatedBody!.Data!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Deactivate_OwnAccount_Returns403()
    {
        var (adminToken, adminId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Admin, "users-self-deactivate");
        var client = TestClients.WithBearerToken(_factory, adminToken);

        var response = await client.PostAsync($"/api/users/{adminId}/deactivate", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData(UserRole.Customer)]
    [InlineData(UserRole.SupportAgent)]
    public async Task Deactivate_NonAdmin_Returns403(UserRole role)
    {
        var (token, _) = role == UserRole.Customer
            ? await RegisterCustomerAsync(_factory, "users-deactivate-forbidden-customer")
            : await CreateStaffUserDirectlyAsync(_factory, role, "users-deactivate-forbidden-agent");
        var client = TestClients.WithBearerToken(_factory, token);
        var (_, targetId) = await CreateStaffUserDirectlyAsync(_factory, UserRole.Customer, "users-deactivate-forbidden-target");

        var response = await client.PostAsync($"/api/users/{targetId}/deactivate", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
