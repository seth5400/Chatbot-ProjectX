using Duende.IdentityServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace IdentityServer.Pages.Home.Error;

[AllowAnonymous]
public class IndexModel : PageModel
{
    private readonly IIdentityServerInteractionService _interaction;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(IIdentityServerInteractionService interaction, ILogger<IndexModel> logger)
    {
        _interaction = interaction;
        _logger = logger;
    }

    public string? ErrorMessage { get; set; }
    public string? ErrorDescription { get; set; }
    public string? RequestId { get; set; }

    public async Task<IActionResult> OnGetAsync(string? errorId)
    {
        if (string.IsNullOrEmpty(errorId))
        {
            ErrorMessage = "Unknown error";
            return Page();
        }

        var message = await _interaction.GetErrorContextAsync(errorId);

        if (message != null)
        {
            ErrorMessage = message.Error;
            ErrorDescription = message.ErrorDescription;
            RequestId = message.RequestId;

            _logger.LogError("IdentityServer Error: {Error} - {Description}",
                message.Error, message.ErrorDescription);
        }
        else
        {
            ErrorMessage = "Unknown error";
        }

        return Page();
    }
}
