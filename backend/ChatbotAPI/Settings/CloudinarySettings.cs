namespace ChatbotAPI.Settings
{
    /// <summary>
    /// Configuration settings for Cloudinary image storage service
    /// Maps to "CloudinarySettings" section in appsettings.json
    /// </summary>
    public class CloudinarySettings
    {
        public const string SectionName = "CloudinarySettings";

        public string CloudName { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string ApiSecret { get; set; } = string.Empty;
    }
}
