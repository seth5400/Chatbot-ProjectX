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
        private readonly ILiteLLMService _liteLLMService;
        private readonly ICloudinaryService _cloudinaryService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            AppDbContext context,
            ILiteLLMService liteLLMService,
            ICloudinaryService cloudinaryService,
            ILogger<ChatController> logger)
        {
            _context = context;
            _liteLLMService = liteLLMService;
            _cloudinaryService = cloudinaryService;
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
                            ImageUrl = m.ImageUrl,
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
            try
            {
                Response.Headers.Append("Content-Type", "text/event-stream");
                Response.Headers.Append("Cache-Control", "no-cache");
                Response.Headers.Append("Connection", "keep-alive");

                Chat? chat = null;
                List<MessageHistoryDto>? history = request.History;
                string? uploadedImageUrl = null;
                string? uploadedImagePublicId = null;

                // Upload image to Cloudinary if provided
                if (!string.IsNullOrWhiteSpace(request.ImageBase64))
                {
                    _logger.LogInformation("Uploading image to Cloudinary...");
                    var uploadResult = await _cloudinaryService.UploadImageFromBase64Async(request.ImageBase64);

                    if (uploadResult.Success)
                    {
                        uploadedImageUrl = uploadResult.Url;
                        uploadedImagePublicId = uploadResult.PublicId;
                        _logger.LogInformation("Image uploaded successfully: {Url}", uploadedImageUrl);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to upload image: {Error}", uploadResult.Error);
                        // Continue without image, but log the error
                    }
                }

                // Handle non-temporary chat
                if (!request.Temporary)
                {
                    // Get or create chat
                    if (!string.IsNullOrEmpty(request.ChatId))
                    {
                        chat = await _context.Chats
                            .Include(c => c.Messages)
                            .FirstOrDefaultAsync(c => c.Id == request.ChatId);

                        if (chat == null)
                        {
                            await WriteStreamError("Chat not found");
                            return;
                        }

                        // Load history from database if not provided
                        if (history == null || history.Count == 0)
                        {
                            history = chat.Messages
                                .OrderBy(m => m.CreatedAt)
                                .Select(m => new MessageHistoryDto
                                {
                                    Role = m.Role,
                                    Content = m.Content,
                                    ImageUrl = m.ImageUrl
                                })
                                .ToList();
                        }
                    }
                    else
                    {
                        // Create new chat
                        // Generate AI-powered title (like ChatGPT)
                        var chatTitle = await _liteLLMService.GenerateChatTitleAsync(request.Message);

                        chat = new Chat
                        {
                            Id = Guid.NewGuid().ToString(),
                            Title = chatTitle,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        _context.Chats.Add(chat);
                        await _context.SaveChangesAsync();
                    }

                    // Save user message with image URL if uploaded
                    var userMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "user",
                        Content = request.Message,
                        ImageUrl = uploadedImageUrl,
                        ImagePublicId = uploadedImagePublicId,
                        ChatId = chat.Id,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Messages.Add(userMessage);
                    await _context.SaveChangesAsync();

                    // เพิ่ม user message ล่าสุดเข้าไปใน history ก่อนส่งไป LiteLLM
                    if (history == null)
                    {
                        history = new List<MessageHistoryDto>();
                    }
                    history.Add(new MessageHistoryDto
                    {
                        Role = "user",
                        Content = request.Message,
                        ImageUrl = uploadedImageUrl
                    });
                }

                // Stream response from LiteLLM
                var fullText = new StringBuilder();

                await foreach (var chunk in _liteLLMService.SendMessageStreamAsync(
                    request.Message,
                    history,
                    chat?.Id,
                    request.ModelId,
                    request.EnableGrounding,
                    request.SystemInstruction,
                    request.ImageBase64,
                    request.ImageMimeType))
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
                if (!request.Temporary && chat != null)
                {
                    var botMessage = new Message
                    {
                        Id = Guid.NewGuid().ToString(),
                        Role = "model",
                        Content = fullText.ToString(),
                        ChatId = chat.Id,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Messages.Add(botMessage);
                    chat.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message");
                await WriteStreamError(ex.Message);
            }
        }

        // POST: api/chat/upload - Upload image endpoint (for separate image upload)
        [HttpPost("upload")]
        [RequestSizeLimit(Constants.ImageConstants.MaxFileSizeBytes)]
        public async Task<ActionResult<ImageUploadResultDto>> UploadImage(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ImageUploadResultDto { Success = false, Error = "No file provided" });
                }

                var result = await _cloudinaryService.UploadImageAsync(file);

                if (result.Success)
                {
                    return Ok(result);
                }

                return BadRequest(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading image");
                return StatusCode(500, new ImageUploadResultDto
                {
                    Success = false,
                    Error = ex.Message
                });
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

                // Delete images from Cloudinary
                foreach (var message in chat.Messages)
                {
                    if (!string.IsNullOrEmpty(message.ImagePublicId))
                    {
                        await _cloudinaryService.DeleteImageAsync(message.ImagePublicId);
                    }
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
