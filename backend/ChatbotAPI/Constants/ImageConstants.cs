namespace ChatbotAPI.Constants
{
    /// <summary>
    /// Constants for image upload validation and configuration
    /// </summary>
    public static class ImageConstants
    {
        /// <summary>
        /// Maximum file size in bytes (10MB)
        /// </summary>
        public const long MaxFileSizeBytes = 10 * 1024 * 1024;

        /// <summary>
        /// Maximum file size in MB for display
        /// </summary>
        public const int MaxFileSizeMB = 10;

        /// <summary>
        /// Allowed MIME types for image upload
        /// </summary>
        public static readonly string[] AllowedMimeTypes = new[]
        {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
        };

        /// <summary>
        /// Allowed file extensions for image upload
        /// </summary>
        public static readonly string[] AllowedExtensions = new[]
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp"
        };

        /// <summary>
        /// Cloudinary folder name for chat images
        /// </summary>
        public const string CloudinaryFolder = "chatbot-images";

        /// <summary>
        /// Default MIME type when not specified
        /// </summary>
        public const string DefaultMimeType = "image/jpeg";
    }
}
