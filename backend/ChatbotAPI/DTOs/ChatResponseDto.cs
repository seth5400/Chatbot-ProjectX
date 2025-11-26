using System.ComponentModel.DataAnnotations;

namespace ChatbotAPI.DTOs
{
    public class ChatResponseDto
    {
        public string? ChatId { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class ChatListDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int MessageCount { get; set; }
    }

    public class ChatDetailDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<MessageDto> Messages { get; set; } = new List<MessageDto>();
    }

    public class MessageDto
    {
        public string Id { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class StreamChunkDto
    {
        public string? ChatId { get; set; }
        public string? Text { get; set; }
        public string Type { get; set; } = string.Empty; // 'metadata', 'chunk', 'done'
    }

    public class UpdateChatTitleDto
    {
        [Required(ErrorMessage = "Title is required")]
        public string Title { get; set; } = string.Empty;
    }
}
