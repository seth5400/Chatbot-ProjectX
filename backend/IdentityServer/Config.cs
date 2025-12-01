using Duende.IdentityServer;
using Duende.IdentityServer.Models;

namespace IdentityServer;

public static class Config
{
    public static IEnumerable<IdentityResource> IdentityResources =>
    [
        new IdentityResources.OpenId(),
        new IdentityResources.Profile(),
        new IdentityResources.Email(),
    ];

    public static IEnumerable<ApiScope> ApiScopes =>
    [
        new ApiScope("chatbot_api", "Chatbot API")
        {
            UserClaims = ["name", "email"]
        }
    ];

    public static IEnumerable<ApiResource> ApiResources =>
    [
        new ApiResource("chatbot_api_resource", "Chatbot API Resource")
        {
            Scopes = { "chatbot_api" },
            UserClaims = ["name", "email"]
        }
    ];

    public static IEnumerable<Client> Clients =>
    [
        // Next.js Frontend Client
        new Client
        {
            ClientId = "nextjs-chatbot",
            ClientName = "Next.js Chatbot Application",
            ClientSecrets = { new Secret("chatbot-secret-key-2024".Sha256()) },

            AllowedGrantTypes = GrantTypes.Code,
            RequirePkce = true,
            RequireClientSecret = true,

            // Redirect URIs for Next.js Auth
            RedirectUris =
            {
                "http://localhost:3000/api/auth/callback/identityserver"
            },
            PostLogoutRedirectUris =
            {
                "http://localhost:3000"
            },
            AllowedCorsOrigins =
            {
                "http://localhost:3000"
            },

            AllowedScopes =
            {
                IdentityServerConstants.StandardScopes.OpenId,
                IdentityServerConstants.StandardScopes.Profile,
                IdentityServerConstants.StandardScopes.Email,
                "chatbot_api"
            },

            AllowOfflineAccess = true,
            RefreshTokenUsage = TokenUsage.ReUse,
            RefreshTokenExpiration = TokenExpiration.Sliding,
            SlidingRefreshTokenLifetime = 86400 * 30, // 30 days
            AccessTokenLifetime = 3600, // 1 hour
            IdentityTokenLifetime = 3600,

            AlwaysIncludeUserClaimsInIdToken = true
        }
    ];
}
