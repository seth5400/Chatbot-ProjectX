using ChatbotAPI.DTOs;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace ChatbotAPI.Services
{
    public class GeminiService
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
            bool enableGrounding = false)
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
            await foreach (var chunk in StreamChunksInternalAsync(message, history, model, enableGrounding))
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

        private async IAsyncEnumerable<StreamChunkDto> StreamChunksInternalAsync(
            string message,
            List<MessageHistoryDto>? history,
            string model,
            bool enableGrounding = false)
        {
            var channel = Channel.CreateUnbounded<StreamChunkDto>();

            // Start background task to fetch and write to channel
            var fetchTask = Task.Run(async () =>
            {
                var httpClient = _httpClientFactory.CreateClient();
                var url = $"{BaseUrl}/{model}:streamGenerateContent?key={_apiKey}&alt=sse";

                // Build contents array with history
                var contents = new List<Content>();

                if (history != null && history.Count > 0)
                {
                    foreach (var msg in history)
                    {
                        contents.Add(new Content
                        {
                            Role = msg.Role,
                            Parts = new List<Part> { new Part { Text = msg.Content } }
                        });
                    }
                }

                contents.Add(new Content
                {
                    Role = "user",
                    Parts = new List<Part> { new Part { Text = message } }
                });

                // Build request body with optional Google Search Grounding
                object requestBody;
                if (enableGrounding)
                {
                    requestBody = new
                    {
                        contents = contents,
                        tools = new[]
                        {
                            new
                            {
                                googleSearch = new { }
                            }
                        }
                    };
                }
                else
                {
                    requestBody = new
                    {
                        contents = contents
                    };
                }

                var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                });

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
        public async Task<string> GenerateChatTitleAsync(string firstMessage)
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
                var response = await httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
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
            string? modelId = null)
        {
            var httpClient = _httpClientFactory.CreateClient();
            var model = ValidateModel(modelId);
            var url = $"{BaseUrl}/{model}:generateContent?key={_apiKey}";

            var contents = new List<Content>();

            if (history != null && history.Count > 0)
            {
                foreach (var msg in history)
                {
                    contents.Add(new Content
                    {
                        Role = msg.Role,
                        Parts = new List<Part> { new Part { Text = msg.Content } }
                    });
                }
            }

            contents.Add(new Content
            {
                Role = "user",
                Parts = new List<Part> { new Part { Text = message } }
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
                var response = await httpClient.PostAsync(url, content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
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
            public Content? Content { get; set; }
        }

        private class Content
        {
            [JsonPropertyName("role")]
            public string Role { get; set; } = "user";

            [JsonPropertyName("parts")]
            public List<Part>? Parts { get; set; }
        }

        private class Part
        {
            [JsonPropertyName("text")]
            public string? Text { get; set; }
        }
    }
}
