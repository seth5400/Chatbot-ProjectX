using Duende.IdentityServer.Events;
using Duende.IdentityServer.Extensions;
using Duende.IdentityServer.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using IdentityServer.Models;

namespace IdentityServer.Pages.Account.Logout;

[AllowAnonymous]
public class IndexModel : PageModel
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IIdentityServerInteractionService _interaction;
    private readonly IEventService _events;

    public IndexModel(
        SignInManager<ApplicationUser> signInManager,
        IIdentityServerInteractionService interaction,
        IEventService events)
    {
        _signInManager = signInManager;
        _interaction = interaction;
        _events = events;
    }

    public string? LogoutId { get; set; }
    public string? PostLogoutRedirectUri { get; set; }
    public string? ClientName { get; set; }

    public async Task<IActionResult> OnGetAsync(string? logoutId)
    {
        LogoutId = logoutId;

        var context = await _interaction.GetLogoutContextAsync(logoutId);

        if (context?.ShowSignoutPrompt == false)
        {
            return await OnPostAsync(logoutId);
        }

        return Page();
    }

    public async Task<IActionResult> OnPostAsync(string? logoutId)
    {
        if (User?.Identity?.IsAuthenticated == true)
        {
            await _signInManager.SignOutAsync();
            await _events.RaiseAsync(new UserLogoutSuccessEvent(User.GetSubjectId(), User.GetDisplayName()));
        }

        var logout = await _interaction.GetLogoutContextAsync(logoutId);

        if (!string.IsNullOrEmpty(logout?.PostLogoutRedirectUri))
        {
            return Redirect(logout.PostLogoutRedirectUri);
        }

        return RedirectToPage("/Account/Logout/LoggedOut", new { logoutId });
    }
}
