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
        /// AI Model ID (e.g., "gemini-2.5-flash", "gemini-2.0-flash")
        /// Default: "gemini-2.5-flash"
        /// </summary>
        public string ModelId { get; set; } = "gemini-2.5-flash";

        /// <summary>
        /// Enable Google Search Grounding for real-time data
        /// When enabled, AI can search Google to get current information (e.g., exchange rates, news)
        /// Default: false
        /// </summary>
        public bool EnableGrounding { get; set; } = false;
    }

    public class MessageHistoryDto
    {
        [Required]
        public string Role { get; set; } = string.Empty; // 'user' or 'model'

        [Required]
        public string Content { get; set; } = string.Empty;
    }
}
