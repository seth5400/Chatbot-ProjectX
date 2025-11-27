using ChatbotAPI.Constants;
using ChatbotAPI.DTOs;
using ChatbotAPI.Settings;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace ChatbotAPI.Services
{
    /// <summary>
    /// Service for uploading and managing images on Cloudinary
    /// </summary>
    public class CloudinaryService : ICloudinaryService
    {
        private readonly Cloudinary _cloudinary;
        private readonly ILogger<CloudinaryService> _logger;

        public CloudinaryService(
            IOptions<CloudinarySettings> cloudinarySettings,
            ILogger<CloudinaryService> logger)
        {
            _logger = logger;

            var settings = cloudinarySettings.Value;
            var account = new Account(
                settings.CloudName,
                settings.ApiKey,
                settings.ApiSecret
            );

            _cloudinary = new Cloudinary(account);
            _cloudinary.Api.Secure = true; // Always use HTTPS
        }

        public async Task<ImageUploadResultDto> UploadImageAsync(IFormFile file)
        {
            try
            {
                // Validate file exists
                if (file == null || file.Length == 0)
                {
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = "No file provided"
                    };
                }

                // Validate file type
                if (!ImageConstants.AllowedMimeTypes.Contains(file.ContentType.ToLower()))
                {
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = $"Invalid file type. Allowed types: {string.Join(", ", ImageConstants.AllowedMimeTypes)}"
                    };
                }

                // Validate file size
                if (file.Length > ImageConstants.MaxFileSizeBytes)
                {
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = $"File size exceeds {ImageConstants.MaxFileSizeMB}MB limit."
                    };
                }

                using var stream = file.OpenReadStream();
                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream),
                    Folder = ImageConstants.CloudinaryFolder,
                    Transformation = new Transformation()
                        .Quality("auto")
                        .FetchFormat("auto")
                };

                var uploadResult = await _cloudinary.UploadAsync(uploadParams);

                if (uploadResult.Error != null)
                {
                    _logger.LogError("Cloudinary upload error: {Error}", uploadResult.Error.Message);
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = uploadResult.Error.Message
                    };
                }

                _logger.LogInformation("Image uploaded successfully: {PublicId}", uploadResult.PublicId);

                return new ImageUploadResultDto
                {
                    Success = true,
                    Url = uploadResult.SecureUrl.ToString(),
                    PublicId = uploadResult.PublicId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading image to Cloudinary");
                return new ImageUploadResultDto
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<ImageUploadResultDto> UploadImageFromBase64Async(string base64Data, string? mimeType = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(base64Data))
                {
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = "No image data provided"
                    };
                }

                // Extract base64 content and mime type from data URL if present
                var base64Content = base64Data;
                var detectedMimeType = mimeType ?? ImageConstants.DefaultMimeType;

                if (base64Data.Contains(","))
                {
                    // Format: "data:image/png;base64,iVBOR..."
                    var parts = base64Data.Split(',');
                    base64Content = parts[1];

                    // Extract mime type from data URL
                    if (parts[0].Contains(":") && parts[0].Contains(";"))
                    {
                        var mimeStart = parts[0].IndexOf(':') + 1;
                        var mimeEnd = parts[0].IndexOf(';');
                        detectedMimeType = parts[0].Substring(mimeStart, mimeEnd - mimeStart);
                    }
                }

                // Validate mime type
                if (!ImageConstants.AllowedMimeTypes.Contains(detectedMimeType.ToLower()))
                {
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = $"Invalid image type: {detectedMimeType}. Allowed types: {string.Join(", ", ImageConstants.AllowedMimeTypes)}"
                    };
                }

                var uploadParams = new ImageUploadParams
                {
                    File = new FileDescription($"data:{detectedMimeType};base64,{base64Content}"),
                    Folder = ImageConstants.CloudinaryFolder,
                    Transformation = new Transformation()
                        .Quality("auto")
                        .FetchFormat("auto")
                };

                var uploadResult = await _cloudinary.UploadAsync(uploadParams);

                if (uploadResult.Error != null)
                {
                    _logger.LogError("Cloudinary upload error: {Error}", uploadResult.Error.Message);
                    return new ImageUploadResultDto
                    {
                        Success = false,
                        Error = uploadResult.Error.Message
                    };
                }

                _logger.LogInformation("Image uploaded from base64 successfully: {PublicId}", uploadResult.PublicId);

                return new ImageUploadResultDto
                {
                    Success = true,
                    Url = uploadResult.SecureUrl.ToString(),
                    PublicId = uploadResult.PublicId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading base64 image to Cloudinary");
                return new ImageUploadResultDto
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        public async Task<bool> DeleteImageAsync(string publicId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(publicId))
                {
                    return false;
                }

                var deleteParams = new DeletionParams(publicId);
                var result = await _cloudinary.DestroyAsync(deleteParams);

                if (result.Result == "ok")
                {
                    _logger.LogInformation("Image deleted successfully: {PublicId}", publicId);
                    return true;
                }

                _logger.LogWarning("Failed to delete image: {PublicId}, Result: {Result}", publicId, result.Result);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting image from Cloudinary: {PublicId}", publicId);
                return false;
            }
        }
    }
}
