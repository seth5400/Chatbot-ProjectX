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

        // Version tracking fields
        public string? ParentMessageId { get; set; }
        public int VersionNumber { get; set; } = 1;
        public bool IsActive { get; set; } = true;
        public int TotalVersions { get; set; } = 1;
        public List<MessageVersionDto>? Versions { get; set; }
    }

    public class MessageVersionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int VersionNumber { get; set; }
        public bool IsActive { get; set; }
    }

    public class RegenerateRequestDto
    {
        public string UserMessageId { get; set; } = string.Empty;
        public string ModelId { get; set; } = "ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest";
        public string? SystemInstruction { get; set; }
    }

    public class SwitchVersionRequestDto
    {
        public string MessageId { get; set; } = string.Empty;
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
