using ChatbotAPI.DTOs;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace ChatbotAPI.Services
{
    public class GeminiService : IGeminiService
    {
        private readonly string _apiKey;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<GeminiService> _logger;
        private const string BaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

        public GeminiService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<GeminiService> logger)
        {
            _apiKey = configuration["GeminiSettings:ApiKey"]
                ?? throw new InvalidOperationException("Gemini API key is not configured");
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        // Available Gemini models (Free Tier) - Updated from API response
        private static readonly HashSet<string> ValidModels = new()
        {
            // Gemini 2.5 (Latest)
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            // Gemini 2.0
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            // Gemini 3.0 Preview
            "gemini-3-pro-preview",
            // Latest aliases
            "gemini-pro-latest",
            "gemini-flash-latest",
            "gemini-flash-lite-latest"
        };

        private const string DefaultModel = "gemini-2.5-flash";

        public async IAsyncEnumerable<StreamChunkDto> SendMessageStreamAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? chatId = null,
            string? modelId = null,
            bool enableGrounding = false,
            string? systemInstruction = null,
            string? imageBase64 = null,
            string? imageMimeType = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Validate and set model
            var model = ValidateModel(modelId);

            // Send metadata first
            yield return new StreamChunkDto
            {
                ChatId = chatId,
                Type = "metadata"
            };

            // Use helper method to get all chunks, then yield them
            await foreach (var chunk in StreamChunksInternalAsync(message, history, model, enableGrounding, systemInstruction, imageBase64, imageMimeType))
            {
                yield return chunk;
            }
        }

        private string ValidateModel(string? modelId)
        {
            if (string.IsNullOrWhiteSpace(modelId))
                return DefaultModel;

            return ValidModels.Contains(modelId) ? modelId : DefaultModel;
        }

        /// <summary>
        /// Build parts array for a message content, supporting text and optional image
        /// </summary>
        private async Task<List<object>> BuildPartsAsync(string? text, string? imageBase64 = null, string? imageMimeType = null, string? imageUrl = null)
        {
            var parts = new List<object>();

            // Add text part if provided
            if (!string.IsNullOrWhiteSpace(text))
            {
                parts.Add(new { text = text });
            }

            // Add image part if provided (base64)
            if (!string.IsNullOrWhiteSpace(imageBase64))
            {
                // Remove data URL prefix if present
                var base64Data = imageBase64;
                if (imageBase64.Contains(","))
                {
                    base64Data = imageBase64.Split(',')[1];
                }

                // Default to image/jpeg if no mime type provided
                var mimeType = imageMimeType ?? "image/jpeg";

                parts.Add(new
                {
                    inlineData = new
                    {
                        mimeType = mimeType,
                        data = base64Data
                    }
                });
            }
            // If we have an image URL (from history), fetch and convert to base64
            else if (!string.IsNullOrWhiteSpace(imageUrl))
            {
                try
                {
                    var httpClient = _httpClientFactory.CreateClient();
                    var imageBytes = await httpClient.GetByteArrayAsync(imageUrl);
                    var base64Data = Convert.ToBase64String(imageBytes);

                    // Detect mime type from URL or default to jpeg
                    var mimeType = "image/jpeg";
                    if (imageUrl.Contains(".png", StringComparison.OrdinalIgnoreCase))
                        mimeType = "image/png";
                    else if (imageUrl.Contains(".gif", StringComparison.OrdinalIgnoreCase))
                        mimeType = "image/gif";
                    else if (imageUrl.Contains(".webp", StringComparison.OrdinalIgnoreCase))
                        mimeType = "image/webp";

                    parts.Add(new
                    {
                        inlineData = new
                        {
                            mimeType = mimeType,
                            data = base64Data
                        }
                    });

                    _logger.LogDebug("Fetched and converted image from URL: {Url}", imageUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to fetch image from URL: {Url}", imageUrl);
                    // Continue without the image
                }
            }

            return parts;
        }

        private async IAsyncEnumerable<StreamChunkDto> StreamChunksInternalAsync(
            string message,
            List<MessageHistoryDto>? history,
            string model,
            bool enableGrounding = false,
            string? systemInstruction = null,
            string? imageBase64 = null,
            string? imageMimeType = null)
        {
            var channel = Channel.CreateUnbounded<StreamChunkDto>();

            // Start background task to fetch and write to channel
            var fetchTask = Task.Run(async () =>
            {
                var httpClient = _httpClientFactory.CreateClient();
                var url = $"{BaseUrl}/{model}:streamGenerateContent?key={_apiKey}&alt=sse";

                // Build contents array with history
                var contents = new List<object>();

                if (history != null && history.Count > 0)
                {
                    foreach (var msg in history)
                    {
                        // Check if this history message has an image
                        var parts = await BuildPartsAsync(msg.Content, null, null, msg.ImageUrl);
                        contents.Add(new
                        {
                            role = msg.Role,
                            parts = parts
                        });
                    }
                }

                // Build user message with optional image
                var userParts = await BuildPartsAsync(message, imageBase64, imageMimeType);
                contents.Add(new
                {
                    role = "user",
                    parts = userParts
                });

                // Build request body with optional Google Search Grounding and System Instruction
                object? systemInstructionObj = null;
                if (!string.IsNullOrWhiteSpace(systemInstruction))
                {
                    systemInstructionObj = new
                    {
                        parts = new[] { new { text = systemInstruction } }
                    };
                }

                // Build tools array if grounding is enabled
                object[]? toolsArray = null;
                if (enableGrounding)
                {
                    toolsArray = new object[]
                    {
                        new { googleSearch = new { } }
                    };
                }

                var requestBody = new
                {
                    system_instruction = systemInstructionObj,
                    contents = contents,
                    tools = toolsArray
                };

                var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                });

                _logger.LogDebug("Gemini request: {Request}", json.Substring(0, Math.Min(500, json.Length)));

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var hasError = false;

                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = content
                    };

                    using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Gemini API error: {StatusCode} - {Error}", response.StatusCode, errorContent);

                        // Try to write error message to channel before completing
                        try
                        {
                            await channel.Writer.WriteAsync(new StreamChunkDto
                            {
                                Text = $"Error: API returned {response.StatusCode}",
                                Type = "error"
                            });
                        }
                        catch { }

                        hasError = true;
                        return;
                    }

                    using var stream = await response.Content.ReadAsStreamAsync();
                    using var reader = new StreamReader(stream);

                    string? line;
                    while ((line = await reader.ReadLineAsync()) != null)
                    {
                        if (line.StartsWith("data: "))
                        {
                            var data = line.Substring(6);
                            if (string.IsNullOrWhiteSpace(data)) continue;

                            try
                            {
                                var chunk = JsonSerializer.Deserialize<GeminiResponse>(data);
                                if (chunk?.Candidates != null && chunk.Candidates.Count > 0)
                                {
                                    var text = chunk.Candidates[0]?.Content?.Parts?.FirstOrDefault()?.Text;
                                    if (!string.IsNullOrEmpty(text))
                                    {
                                        await channel.Writer.WriteAsync(new StreamChunkDto
                                        {
                                            Text = text,
                                            Type = "chunk"
                                        });
                                    }
                                }
                            }
                            catch (JsonException ex)
                            {
                                _logger.LogWarning("Failed to parse chunk: {Error}", ex.Message);
                            }
                        }
                    }

                    // Send done signal only if no error
                    if (!hasError)
                    {
                        await channel.Writer.WriteAsync(new StreamChunkDto
                        {
                            Type = "done"
                        });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in StreamChunksInternalAsync");

                    // Try to write error message to channel before completing
                    try
                    {
                        await channel.Writer.WriteAsync(new StreamChunkDto
                        {
                            Text = $"Error: {ex.Message}",
                            Type = "error"
                        });
                    }
                    catch { }

                    hasError = true;
                }
                finally
                {
                    // Always complete the channel, but only once
                    try
                    {
                        channel.Writer.Complete();
                    }
                    catch { }
                }
            });

            // Read from channel and yield
            await foreach (var chunk in channel.Reader.ReadAllAsync())
            {
                yield return chunk;
            }

            await fetchTask;
        }

        /// <summary>
        /// Generate a short, concise title for a chat based on the first message
        /// Uses AI to summarize the main topic (like ChatGPT does)
        /// </summary>
        public async Task<string> GenerateChatTitleAsync(string firstMessage, CancellationToken cancellationToken = default)
        {
            var httpClient = _httpClientFactory.CreateClient();
            // Use fast model for title generation
            var url = $"{BaseUrl}/gemini-2.0-flash-lite:generateContent?key={_apiKey}";

            var prompt = $@"สรุปข้อความนี้เป็นชื่อหัวข้อสั้นๆ ไม่เกิน 30 ตัวอักษร ภาษาเดียวกับข้อความ ไม่ต้องใส่เครื่องหมายคำพูด:

""{firstMessage}""

ตอบแค่ชื่อหัวข้อเท่านั้น:";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[] { new { text = prompt } }
                    }
                },
                generationConfig = new
                {
                    maxOutputTokens = 50,
                    temperature = 0.3
                }
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await httpClient.PostAsync(url, content, cancellationToken);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                var title = result?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text?.Trim();

                // Clean up the title - remove quotes if present
                if (!string.IsNullOrEmpty(title))
                {
                    title = title.Trim('"', '\'', '"', '"', '「', '」');
                    // Limit to 50 chars max
                    if (title.Length > 50)
                        title = title.Substring(0, 47) + "...";
                    return title;
                }

                // Fallback to truncated message
                return firstMessage.Length > 50 ? firstMessage.Substring(0, 47) + "..." : firstMessage;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to generate chat title, using fallback");
                // Fallback to truncated message
                return firstMessage.Length > 50 ? firstMessage.Substring(0, 47) + "..." : firstMessage;
            }
        }

        public async Task<string> SendMessageAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? modelId = null,
            string? imageBase64 = null,
            string? imageMimeType = null,
            CancellationToken cancellationToken = default)
        {
            var httpClient = _httpClientFactory.CreateClient();
            var model = ValidateModel(modelId);
            var url = $"{BaseUrl}/{model}:generateContent?key={_apiKey}";

            // Build contents array
            var contents = new List<object>();

            if (history != null && history.Count > 0)
            {
                foreach (var msg in history)
                {
                    var parts = await BuildPartsAsync(msg.Content, null, null, msg.ImageUrl);
                    contents.Add(new
                    {
                        role = msg.Role,
                        parts = parts
                    });
                }
            }

            // Build user message with optional image
            var userParts = await BuildPartsAsync(message, imageBase64, imageMimeType);
            contents.Add(new
            {
                role = "user",
                parts = userParts
            });

            var requestBody = new
            {
                contents = contents
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await httpClient.PostAsync(url, content, cancellationToken);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<GeminiResponse>(responseJson);

                return result?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendMessageAsync");
                return $"Error: {ex.Message}";
            }
        }

        // Response models
        private class GeminiResponse
        {
            [JsonPropertyName("candidates")]
            public List<Candidate>? Candidates { get; set; }
        }

        private class Candidate
        {
            [JsonPropertyName("content")]
            public ContentResponse? Content { get; set; }
        }

        private class ContentResponse
        {
            [JsonPropertyName("role")]
            public string Role { get; set; } = "model";

            [JsonPropertyName("parts")]
            public List<PartResponse>? Parts { get; set; }
        }

        private class PartResponse
        {
            [JsonPropertyName("text")]
            public string? Text { get; set; }
        }
    }
}
