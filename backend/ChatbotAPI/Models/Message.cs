using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ChatbotAPI.Models
{
    public class Message
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        public string Role { get; set; } = string.Empty; // 'user' or 'model'

        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string Content { get; set; } = string.Empty;

        /// <summary>
        /// URL of the attached image (stored in Cloudinary)
        /// </summary>
        [Column(TypeName = "nvarchar(500)")]
        public string? ImageUrl { get; set; }

        /// <summary>
        /// Cloudinary public ID for image deletion
        /// </summary>
        [Column(TypeName = "nvarchar(200)")]
        public string? ImagePublicId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Foreign key
        [Required]
        public string ChatId { get; set; } = string.Empty;

        // Navigation property
        [ForeignKey("ChatId")]
        public Chat? Chat { get; set; }
    }
}
