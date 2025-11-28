using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChatbotAPI.Data;
using ChatbotAPI.Models;
using ChatbotAPI.DTOs;
using ChatbotAPI.Services;
using System.Text;
using System.Text.Json;

namespace ChatbotAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IDbContextFactory<AppDbContext> _contextFactory;
        private readonly ILiteLLMService _liteLLMService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            AppDbContext context,
            IDbContextFactory<AppDbContext> contextFactory,
            ILiteLLMService liteLLMService,
            ILogger<ChatController> logger)
        {
            _context = context;
            _contextFactory = contextFactory;
            _liteLLMService = liteLLMService;
            _logger = logger;
        }

        // GET: api/chat
        // Optional query parameter: ?search=keyword
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ChatListDto>>> GetChats([FromQuery] string? search)
        {
            try
            {
                var query = _context.Chats
                    .Include(c => c.Messages)
                    .AsQueryable();

                // ถ้ามี search keyword ให้ค้นหา
                // SQL Server default collation เป็น case-insensitive อยู่แล้ว
                // ไม่ต้องใช้ ToLower() ซึ่งจะทำให้ไม่สามารถใช้ Index ได้
                if (!string.IsNullOrWhiteSpace(search))
                {
                    query = query.Where(c =>
                        c.Title.Contains(search) ||
                        c.Messages.Any(m => m.Content.Contains(search))
                    );
                }

                var chats = await query
                    .OrderByDescending(c => c.UpdatedAt)
                    .Select(c => new ChatListDto
                    {
                        Id = c.Id,
                        Title = c.Title,
                        CreatedAt = c.CreatedAt,
                        UpdatedAt = c.UpdatedAt,
                        MessageCount = c.Messages.Count
                    })
                    .ToListAsync();

                return Ok(chats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching chats");
                return StatusCode(500, new { message = "Error fetching chats", error = ex.Message });
            }
        }

        // GET: api/chat/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<ChatDetailDto>> GetChat(string id)
        {
            try
            {
                var chat = await _context.Chats
                    .Include(c => c.Messages)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (chat == null)
                {
                    return NotFound(new { message = "Chat not found" });
                }

                // Get all messages ordered by MessageOrder, then CreatedAt
                var allMessages = chat.Messages
                    .OrderBy(m => m.MessageOrder)
                    .ThenBy(m => m.CreatedAt)
                    .ToList();

                // Group AI responses by ParentMessageId
                var aiResponseGroups = allMessages
                    .Where(m => m.Role == "model" && m.ParentMessageId != null)
                    .GroupBy(m => m.ParentMessageId)
                    .ToDictionary(g => g.Key!, g => g.OrderBy(m => m.VersionNumber).ToList());

                var messageList = new List<MessageDto>();

                foreach (var message in allMessages)
                {
                    // Skip non-active AI versions (we'll include them as Versions array)
                    if (message.Role == "model" && message.ParentMessageId != null && !message.IsActive)
                    {
                        continue;
                    }

                    var dto = new MessageDto
                    {
                        Id = message.Id,
                        Role = message.Role,
                        Content = message.Content,
                        CreatedAt = message.CreatedAt,
                        ParentMessageId = message.ParentMessageId,
                        VersionNumber = message.VersionNumber,
                        IsActive = message.IsActive
                    };

                    // For AI responses, include all versions
                    if (message.Role == "model" && message.ParentMessageId != null
                        && aiResponseGroups.TryGetValue(message.ParentMessageId, out var versions))
                    {
                        dto.TotalVersions = versions.Count;
                        dto.Versions = versions.Select(v => new MessageVersionDto
                        {
                            Id = v.Id,
                            Content = v.Content,
                            CreatedAt = v.CreatedAt,
                            VersionNumber = v.VersionNumber,
                            IsActive = v.IsActive
                        }).ToList();
                    }

                    messageList.Add(dto);
                }

                var chatDetail = new ChatDetailDto
                {
                    Id = chat.Id,
                    Title = chat.Title,
                    CreatedAt = chat.CreatedAt,
                    UpdatedAt = chat.UpdatedAt,
                    Messages = messageList
                };

                return Ok(chatDetail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching chat {ChatId}", id);
                return StatusCode(500, new { message = "Error fetching chat", error = ex.Message });
            }
        }

        // POST: api/chat
        [HttpPost]
        public async Task SendMessage([FromBody] ChatRequestDto request)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            string? chatId = null;
            string? userMessageId = null;
            List<MessageHistoryDto>? history = request.History;

            try
            {
                // Handle non-temporary chat - use factory for short-lived context
                if (!request.Temporary)
                {
                    await using var context = await _contextFactory.CreateDbContextAsync();

                    // Get or create chat
                    if (!string.IsNullOrEmpty(request.ChatId))
                    {
                        var chat = await context.Chats
                            .Include(c => c.Messages)
                            .FirstOrDefaultAsync(c => c.Id == request.ChatId);

                        if (chat == null)
                        {
                            await WriteStreamError("Chat not found");
                            return;
                        }

                        chatId = chat.Id;

                        // Load history from database if not provided
                        if (history == null || history.Count == 0)
                        {
                            history = chat.Messages
                                .OrderBy(m => m.CreatedAt)
                                .Select(m => new MessageHistoryDto
                                {
                                    Role = m.Role,
                                    Content = m.Content
                                })
                                .ToList();
                        }
                    }
                    else
                    {
                        // Create new chat with AI-powered title
                        var chatTitle = await _liteLLMService.GenerateChatTitleAsync(request.Message);

                        var newChat = new Chat
                        {
                            Id = Guid.NewGuid().ToString(),
                            Title = chatTitle,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        context.Chats.Add(newChat);
                        await context.SaveChangesAsync();
                        chatId = newChat.Id;
                    }

                    // Get the next message order
                    var maxOrder = await context.Messages
                        .Where(m => m.ChatId == chatId)
                        .MaxAsync(m => (int?)m.MessageOrder) ?? 0;

                    // Save user message
                    var userMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "user",
                        Content = request.Message,
                        ChatId = chatId,
                        CreatedAt = DateTime.UtcNow,
                        MessageOrder = maxOrder + 1
                    };

                    context.Messages.Add(userMessage);
                    await context.SaveChangesAsync();
                    userMessageId = userMessage.Id;

                    // Add user message to history
                    history ??= new List<MessageHistoryDto>();
                    history.Add(new MessageHistoryDto
                    {
                        Role = "user",
                        Content = request.Message
                    });
                }

                // Stream response from LiteLLM
                var fullText = new StringBuilder();

                await foreach (var chunk in _liteLLMService.SendMessageStreamAsync(
                    request.Message,
                    history,
                    chatId,
                    request.ModelId,
                    request.SystemInstruction))
                {
                    var json = JsonSerializer.Serialize(chunk);
                    await Response.WriteAsync($"data: {json}\n\n");
                    await Response.Body.FlushAsync();

                    if (chunk.Type == "chunk" && !string.IsNullOrEmpty(chunk.Text))
                    {
                        fullText.Append(chunk.Text);
                    }
                }

                // Save bot message for non-temporary chat
                if (!request.Temporary && chatId != null)
                {
                    await using var saveContext = await _contextFactory.CreateDbContextAsync();

                    // Find the user message we just saved to link the AI response
                    var lastUserMessage = await saveContext.Messages
                        .Where(m => m.ChatId == chatId && m.Role == "user")
                        .OrderByDescending(m => m.MessageOrder)
                        .FirstOrDefaultAsync();

                    var botMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "model",
                        Content = fullText.ToString(),
                        ChatId = chatId,
                        CreatedAt = DateTime.UtcNow,
                        ParentMessageId = lastUserMessage?.Id,
                        VersionNumber = 1,
                        IsActive = true,
                        MessageOrder = (lastUserMessage?.MessageOrder ?? 0) + 1
                    };

                    saveContext.Messages.Add(botMessage);

                    var chatToUpdate = await saveContext.Chats.FindAsync(chatId);
                    if (chatToUpdate != null)
                    {
                        chatToUpdate.UpdatedAt = DateTime.UtcNow;
                    }

                    await saveContext.SaveChangesAsync();

                    // Send message IDs back to frontend for regenerate functionality
                    var messageIds = new
                    {
                        Type = "message_ids",
                        UserMessageId = userMessageId ?? lastUserMessage?.Id,
                        BotMessageId = botMessage.Id
                    };
                    var idsJson = JsonSerializer.Serialize(messageIds);
                    await Response.WriteAsync($"data: {idsJson}\n\n");
                    await Response.Body.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message");
                await WriteStreamError(ex.Message);
            }
        }

        // POST: api/chat/new
        [HttpPost("new")]
        public async Task<ActionResult<Chat>> CreateChat([FromBody] CreateChatDto? request)
        {
            try
            {
                var chat = new Chat
                {
                    Id = Guid.NewGuid().ToString(),
                    Title = request?.Title ?? "New Chat",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.Chats.Add(chat);
                await _context.SaveChangesAsync();

                return Ok(new { chat, message = "Chat created successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating chat");
                return StatusCode(500, new { message = "Error creating chat", error = ex.Message });
            }
        }

        // PATCH: api/chat/{id}
        [HttpPatch("{id}")]
        public async Task<ActionResult<Chat>> UpdateChatTitle(string id, [FromBody] UpdateChatTitleDto request)
        {
            try
            {
                var chat = await _context.Chats.FindAsync(id);

                if (chat == null)
                {
                    return NotFound(new { message = "Chat not found" });
                }

                chat.Title = request.Title;
                chat.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { chat, message = "Chat title updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating chat {ChatId}", id);
                return StatusCode(500, new { message = "Error updating chat", error = ex.Message });
            }
        }

        // DELETE: api/chat/{id}
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteChat(string id)
        {
            try
            {
                var chat = await _context.Chats
                    .Include(c => c.Messages)
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (chat == null)
                {
                    return NotFound(new { message = "Chat not found" });
                }

                _context.Chats.Remove(chat);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Chat deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting chat {ChatId}", id);
                return StatusCode(500, new { message = "Error deleting chat", error = ex.Message });
            }
        }

        // POST: api/chat/{chatId}/regenerate
        [HttpPost("{chatId}/regenerate")]
        public async Task RegenerateResponse(string chatId, [FromBody] RegenerateRequestDto request)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            try
            {
                await using var context = await _contextFactory.CreateDbContextAsync();

                // Find the user message
                var userMessage = await context.Messages
                    .FirstOrDefaultAsync(m => m.Id == request.UserMessageId && m.Role == "user");

                if (userMessage == null)
                {
                    await WriteStreamError("User message not found");
                    return;
                }

                // Find existing AI responses for this user message
                var existingResponses = await context.Messages
                    .Where(m => m.ParentMessageId == request.UserMessageId && m.Role == "model")
                    .ToListAsync();

                // Mark all existing versions as not active
                foreach (var response in existingResponses)
                {
                    response.IsActive = false;
                }

                var nextVersionNumber = existingResponses.Count > 0
                    ? existingResponses.Max(r => r.VersionNumber) + 1
                    : 1;

                await context.SaveChangesAsync();

                // Build history up to (but NOT including) the current user message
                // LiteLLMService will add the current user message automatically
                var history = await context.Messages
                    .Where(m => m.ChatId == chatId && m.MessageOrder < userMessage.MessageOrder)
                    .Where(m => m.Role == "user" || (m.Role == "model" && m.IsActive))
                    .OrderBy(m => m.MessageOrder)
                    .Select(m => new MessageHistoryDto
                    {
                        Role = m.Role,
                        Content = m.Content
                    })
                    .ToListAsync();

                // Stream response from LiteLLM
                var fullText = new StringBuilder();

                await foreach (var chunk in _liteLLMService.SendMessageStreamAsync(
                    userMessage.Content,
                    history,
                    chatId,
                    request.ModelId,
                    request.SystemInstruction))
                {
                    var json = JsonSerializer.Serialize(chunk);
                    await Response.WriteAsync($"data: {json}\n\n");
                    await Response.Body.FlushAsync();

                    if (chunk.Type == "chunk" && !string.IsNullOrEmpty(chunk.Text))
                    {
                        fullText.Append(chunk.Text);
                    }
                }

                // Save new AI response version
                await using var saveContext = await _contextFactory.CreateDbContextAsync();

                var newResponse = new Message
                {
                    Id = Guid.NewGuid().ToString(),
                    Role = "model",
                    Content = fullText.ToString(),
                    ChatId = chatId,
                    CreatedAt = DateTime.UtcNow,
                    ParentMessageId = request.UserMessageId,
                    VersionNumber = nextVersionNumber,
                    IsActive = true,
                    MessageOrder = userMessage.MessageOrder + 1
                };

                saveContext.Messages.Add(newResponse);

                var chatToUpdate = await saveContext.Chats.FindAsync(chatId);
                if (chatToUpdate != null)
                {
                    chatToUpdate.UpdatedAt = DateTime.UtcNow;
                }

                await saveContext.SaveChangesAsync();

                // Send final metadata with version info
                var versionInfo = new
                {
                    Type = "version_info",
                    MessageId = newResponse.Id,
                    VersionNumber = nextVersionNumber,
                    TotalVersions = nextVersionNumber
                };
                var versionJson = JsonSerializer.Serialize(versionInfo);
                await Response.WriteAsync($"data: {versionJson}\n\n");
                await Response.Body.FlushAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error regenerating response");
                await WriteStreamError(ex.Message);
            }
        }

        // POST: api/chat/{chatId}/switch-version
        [HttpPost("{chatId}/switch-version")]
        public async Task<ActionResult> SwitchVersion(string chatId, [FromBody] SwitchVersionRequestDto request)
        {
            try
            {
                var targetMessage = await _context.Messages
                    .FirstOrDefaultAsync(m => m.Id == request.MessageId && m.ChatId == chatId);

                if (targetMessage == null)
                {
                    return NotFound(new { message = "Message not found" });
                }

                if (targetMessage.Role != "model" || targetMessage.ParentMessageId == null)
                {
                    return BadRequest(new { message = "Can only switch versions for AI responses" });
                }

                // Get all versions for this user message
                var allVersions = await _context.Messages
                    .Where(m => m.ParentMessageId == targetMessage.ParentMessageId && m.Role == "model")
                    .ToListAsync();

                // Mark all as not active, then set the target as active
                foreach (var version in allVersions)
                {
                    version.IsActive = version.Id == request.MessageId;
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Version switched successfully",
                    activeMessageId = request.MessageId,
                    versionNumber = targetMessage.VersionNumber
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error switching version");
                return StatusCode(500, new { message = "Error switching version", error = ex.Message });
            }
        }

        private async Task WriteStreamError(string errorMessage)
        {
            var errorChunk = new StreamChunkDto
            {
                Text = $"Error: {errorMessage}",
                Type = "error"
            };

            var json = JsonSerializer.Serialize(errorChunk);
            await Response.WriteAsync($"data: {json}\n\n");
            await Response.Body.FlushAsync();
        }
    }
}
