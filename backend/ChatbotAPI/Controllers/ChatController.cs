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

                var chatDetail = new ChatDetailDto
                {
                    Id = chat.Id,
                    Title = chat.Title,
                    CreatedAt = chat.CreatedAt,
                    UpdatedAt = chat.UpdatedAt,
                    Messages = chat.Messages
                        .OrderBy(m => m.CreatedAt)
                        .Select(m => new MessageDto
                        {
                            Id = m.Id,
                            Role = m.Role,
                            Content = m.Content,
                            CreatedAt = m.CreatedAt
                        })
                        .ToList()
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

                    // Save user message
                    var userMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "user",
                        Content = request.Message,
                        ChatId = chatId,
                        CreatedAt = DateTime.UtcNow
                    };

                    context.Messages.Add(userMessage);
                    await context.SaveChangesAsync();

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

                    var botMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "model",
                        Content = fullText.ToString(),
                        ChatId = chatId,
                        CreatedAt = DateTime.UtcNow
                    };

                    saveContext.Messages.Add(botMessage);

                    var chatToUpdate = await saveContext.Chats.FindAsync(chatId);
                    if (chatToUpdate != null)
                    {
                        chatToUpdate.UpdatedAt = DateTime.UtcNow;
                    }

                    await saveContext.SaveChangesAsync();
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
