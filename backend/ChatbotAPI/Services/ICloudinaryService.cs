using ChatbotAPI.DTOs;

namespace ChatbotAPI.Services
{
    /// <summary>
    /// Interface for Cloudinary image storage service
    /// </summary>
    public interface ICloudinaryService
    {
        /// <summary>
        /// Upload image from IFormFile (multipart/form-data)
        /// </summary>
        /// <param name="file">The uploaded file</param>
        /// <returns>Upload result with URL and public ID</returns>
        Task<ImageUploadResultDto> UploadImageAsync(IFormFile file);

        /// <summary>
        /// Upload image from base64 encoded string
        /// </summary>
        /// <param name="base64Data">Base64 encoded image data</param>
        /// <param name="mimeType">MIME type of the image (e.g., "image/png")</param>
        /// <returns>Upload result with URL and public ID</returns>
        Task<ImageUploadResultDto> UploadImageFromBase64Async(string base64Data, string? mimeType = null);

        /// <summary>
        /// Delete image from Cloudinary by public ID
        /// </summary>
        /// <param name="publicId">Cloudinary public ID of the image</param>
        /// <returns>True if deletion was successful</returns>
        Task<bool> DeleteImageAsync(string publicId);
    }
}
