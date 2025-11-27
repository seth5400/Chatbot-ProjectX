namespace ChatbotAPI.DTOs
{
    /// <summary>
    /// Result of image upload operation to Cloudinary
    /// </summary>
    public class ImageUploadResultDto
    {
        public bool Success { get; set; }
        public string? Url { get; set; }
        public string? PublicId { get; set; }
        public string? Error { get; set; }
    }

    /// <summary>
    /// Request DTO for base64 image upload
    /// </summary>
    public class ImageUploadRequestDto
    {
        /// <summary>
        /// Base64 encoded image data (with or without data URL prefix)
        /// Example: "data:image/png;base64,iVBOR..." or just "iVBOR..."
        /// </summary>
        public string ImageBase64 { get; set; } = string.Empty;

        /// <summary>
        /// Optional filename for the uploaded image
        /// </summary>
        public string? FileName { get; set; }
    }
}
