using IdentityServer4.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Account.Logout;

[AllowAnonymous]
public class LoggedOutModel : PageModel
{
    private readonly IIdentityServerInteractionService _interaction;

    public LoggedOutModel(IIdentityServerInteractionService interaction)
    {
        _interaction = interaction;
    }

    public string? PostLogoutRedirectUri { get; set; }
    public string? ClientName { get; set; }

    public async Task OnGetAsync(string? logoutId)
    {
        var context = await _interaction.GetLogoutContextAsync(logoutId);

        PostLogoutRedirectUri = context?.PostLogoutRedirectUri;
        ClientName = context?.ClientName ?? context?.ClientId;
    }
}
