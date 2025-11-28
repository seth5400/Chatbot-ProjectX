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
        /// Default: "ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest"
        /// </summary>
        public string ModelId { get; set; } = "ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest";

        /// <summary>
        /// System Instruction for AI personality/behavior customization
        /// This sets the AI's persona, tone, and response style
        /// </summary>
        public string? SystemInstruction { get; set; }
    }

    public class MessageHistoryDto
    {
        [Required]
        public string Role { get; set; } = string.Empty; // 'user' or 'model'

        [Required]
        public string Content { get; set; } = string.Empty;
    }

    public class CreateChatDto
    {
        public string? Title { get; set; }
    }
}
