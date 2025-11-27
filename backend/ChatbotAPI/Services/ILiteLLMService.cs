using ChatbotAPI.DTOs;

namespace ChatbotAPI.Services
{
    public interface ILiteLLMService
    {
        IAsyncEnumerable<StreamChunkDto> SendMessageStreamAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? chatId = null,
            string? modelId = null,
            bool enableGrounding = false,
            string? systemInstruction = null,
            string? imageBase64 = null,
            string? imageMimeType = null,
            CancellationToken cancellationToken = default);

        Task<string> GenerateChatTitleAsync(string firstMessage, CancellationToken cancellationToken = default);

        Task<string> SendMessageAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? modelId = null,
            string? imageBase64 = null,
            string? imageMimeType = null,
            CancellationToken cancellationToken = default);
    }
}
