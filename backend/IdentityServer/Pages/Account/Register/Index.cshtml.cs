using System.Security.Claims;
using Duende.IdentityServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using IdentityServer.Models;

namespace IdentityServer.Pages.Account.Register;

[AllowAnonymous]
public class IndexModel : PageModel
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IIdentityServerInteractionService _interaction;

    public IndexModel(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IIdentityServerInteractionService interaction)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _interaction = interaction;
    }

    [BindProperty]
    public InputModel Input { get; set; } = default!;

    public string? ReturnUrl { get; set; }

    public class InputModel
    {
        public string? Email { get; set; }
        public string? FullName { get; set; }
        public string? Password { get; set; }
        public string? ConfirmPassword { get; set; }
    }

    public void OnGet(string? returnUrl = null)
    {
        ReturnUrl = returnUrl ?? Url.Content("~/");
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        returnUrl ??= Url.Content("~/");
        ReturnUrl = returnUrl;

        if (string.IsNullOrEmpty(Input.Email) || string.IsNullOrEmpty(Input.Password))
        {
            ModelState.AddModelError(string.Empty, "Email and password are required.");
            return Page();
        }

        if (Input.Password != Input.ConfirmPassword)
        {
            ModelState.AddModelError(string.Empty, "Passwords do not match.");
            return Page();
        }

        var user = new ApplicationUser
        {
            UserName = Input.Email,
            Email = Input.Email,
            FullName = Input.FullName ?? Input.Email,
            EmailConfirmed = true // Auto-confirm for demo
        };

        var result = await _userManager.CreateAsync(user, Input.Password);

        if (result.Succeeded)
        {
            // Add claims
            await _userManager.AddClaimsAsync(user, new[]
            {
                new Claim("name", user.FullName ?? user.Email!),
                new Claim("email", user.Email!)
            });

            // Sign in the user
            await _signInManager.SignInAsync(user, isPersistent: false);

            var context = await _interaction.GetAuthorizationContextAsync(returnUrl);
            if (context != null)
            {
                return Redirect(returnUrl);
            }

            return LocalRedirect(returnUrl);
        }

        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(string.Empty, error.Description);
        }

        return Page();
    }
}
