using Duende.IdentityServer.Events;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Stores;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using IdentityServer.Models;

namespace IdentityServer.Pages.Account.Login;

[AllowAnonymous]
public class IndexModel : PageModel
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IIdentityServerInteractionService _interaction;
    private readonly IEventService _events;
    private readonly IAuthenticationSchemeProvider _schemeProvider;
    private readonly IIdentityProviderStore _identityProviderStore;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        IIdentityServerInteractionService interaction,
        IEventService events,
        IAuthenticationSchemeProvider schemeProvider,
        IIdentityProviderStore identityProviderStore,
        ILogger<IndexModel> logger)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _interaction = interaction;
        _events = events;
        _schemeProvider = schemeProvider;
        _identityProviderStore = identityProviderStore;
        _logger = logger;
    }

    [BindProperty]
    public InputModel Input { get; set; } = default!;

    [BindProperty(SupportsGet = true)]
    public string? ReturnUrl { get; set; }

    public class InputModel
    {
        public string? Username { get; set; }
        public string? Password { get; set; }
        public bool RememberLogin { get; set; }
    }

    public async Task<IActionResult> OnGetAsync(string? returnUrl = null)
    {
        ReturnUrl = returnUrl ?? Url.Content("~/");
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        _logger.LogInformation("=== LOGIN POST RECEIVED ===");
        _logger.LogInformation("ReturnUrl from parameter: {ReturnUrl}", returnUrl);
        _logger.LogInformation("ReturnUrl from Model: {ModelReturnUrl}", ReturnUrl);
        _logger.LogInformation("Username: {Username}", Input?.Username);

        returnUrl ??= ReturnUrl ?? Url.Content("~/");
        _logger.LogInformation("Final ReturnUrl: {FinalReturnUrl}", returnUrl);

        var context = await _interaction.GetAuthorizationContextAsync(returnUrl);
        _logger.LogInformation("Authorization context: {Context}", context != null ? "Found" : "Not Found");

        if (string.IsNullOrEmpty(Input?.Username) || string.IsNullOrEmpty(Input?.Password))
        {
            _logger.LogWarning("Username or password is empty");
            ModelState.AddModelError(string.Empty, "Username and password are required.");
            ReturnUrl = returnUrl;
            return Page();
        }

        _logger.LogInformation("Attempting sign in for user: {Username}", Input.Username);
        var result = await _signInManager.PasswordSignInAsync(Input.Username, Input.Password, Input.RememberLogin, lockoutOnFailure: true);
        _logger.LogInformation("Sign in result: Succeeded={Succeeded}, IsLockedOut={IsLockedOut}, IsNotAllowed={IsNotAllowed}, RequiresTwoFactor={RequiresTwoFactor}",
            result.Succeeded, result.IsLockedOut, result.IsNotAllowed, result.RequiresTwoFactor);

        if (result.Succeeded)
        {
            var user = await _userManager.FindByNameAsync(Input.Username);
            _logger.LogInformation("User found: {UserId}", user?.Id);
            await _events.RaiseAsync(new UserLoginSuccessEvent(user!.UserName, user.Id, user.UserName, clientId: context?.Client?.ClientId));

            if (context != null)
            {
                _logger.LogInformation("Redirecting to: {ReturnUrl}", returnUrl);
                return Redirect(returnUrl);
            }

            _logger.LogInformation("No context, redirecting to home");
            return LocalRedirect("~/");
        }

        _logger.LogWarning("Login failed for user: {Username}", Input.Username);
        await _events.RaiseAsync(new UserLoginFailureEvent(Input.Username, "Invalid credentials", clientId: context?.Client?.ClientId));
        ModelState.AddModelError(string.Empty, "Invalid username or password");
        ReturnUrl = returnUrl;

        return Page();
    }
}
