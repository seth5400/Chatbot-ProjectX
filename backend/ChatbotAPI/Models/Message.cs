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

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Foreign key
        [Required]
        public string ChatId { get; set; } = string.Empty;

        // Navigation property
        [ForeignKey("ChatId")]
        public Chat? Chat { get; set; }

        // Version tracking fields
        public string? ParentMessageId { get; set; }  // Links AI response to user message

        [ForeignKey("ParentMessageId")]
        public Message? ParentMessage { get; set; }

        public int VersionNumber { get; set; } = 1;  // Version number (1, 2, 3...)

        public bool IsActive { get; set; } = true;   // Is this the currently displayed version?

        public int MessageOrder { get; set; } = 0;   // Order in conversation
    }
}
