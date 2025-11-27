using System.ComponentModel.DataAnnotations;

namespace ChatbotAPI.DTOs
{
    public class ChatRequestDto
    {
        [Required(ErrorMessage = "Message is required")]
        public string Message { get; set; } = string.Empty;

        public string? ChatId { get; set; }

        public bool Temporary { get; set; } = false;

        public List<MessageHistoryDto>? History { get; set; }

        /// <summary>
        /// AI Model ID - depends on your LiteLLM configuration
        /// Default: "gpt-4o-mini"
        /// </summary>
        public string ModelId { get; set; } = "gpt-4o-mini";

        /// <summary>
        /// Enable Google Search Grounding for real-time data
        /// When enabled, AI can search Google to get current information (e.g., exchange rates, news)
        /// Default: false
        /// </summary>
        public bool EnableGrounding { get; set; } = false;

        /// <summary>
        /// System Instruction for AI personality/behavior customization
        /// This sets the AI's persona, tone, and response style
        /// </summary>
        public string? SystemInstruction { get; set; }

        /// <summary>
        /// Base64 encoded image data (with or without data URL prefix)
        /// Example: "data:image/png;base64,iVBOR..." or just "iVBOR..."
        /// </summary>
        public string? ImageBase64 { get; set; }

        /// <summary>
        /// MIME type of the image (e.g., "image/png", "image/jpeg")
        /// Required when ImageBase64 is provided
        /// </summary>
        public string? ImageMimeType { get; set; }
    }

    public class MessageHistoryDto
    {
        [Required]
        public string Role { get; set; } = string.Empty; // 'user' or 'model'

        [Required]
        public string Content { get; set; } = string.Empty;

        /// <summary>
        /// URL of the image attached to this message (for history)
        /// </summary>
        public string? ImageUrl { get; set; }
    }

    public class CreateChatDto
    {
        public string? Title { get; set; }
    }
}
