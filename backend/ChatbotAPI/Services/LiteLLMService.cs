using ChatbotAPI.DTOs;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace ChatbotAPI.Services
{
    public class LiteLLMService : ILiteLLMService
    {
        private readonly string _apiKey;
        private readonly string _baseUrl;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<LiteLLMService> _logger;

        public LiteLLMService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<LiteLLMService> logger)
        {
            _baseUrl = configuration["LiteLLMSettings:BaseUrl"]
                ?? throw new InvalidOperationException("LiteLLM Base URL is not configured");
            _apiKey = configuration["LiteLLMSettings:ApiKey"]
                ?? throw new InvalidOperationException("LiteLLM API key is not configured");
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        // Default model - based on your LiteLLM API key access
        private const string DefaultModel = "ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest";

        public async IAsyncEnumerable<StreamChunkDto> SendMessageStreamAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? chatId = null,
            string? modelId = null,
            string? systemInstruction = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var model = string.IsNullOrWhiteSpace(modelId) ? DefaultModel : modelId;

            // Send metadata first
            yield return new StreamChunkDto
            {
                ChatId = chatId,
                Type = "metadata"
            };

            // Use helper method to get all chunks, then yield them
            await foreach (var chunk in StreamChunksInternalAsync(message, history, model, systemInstruction))
            {
                yield return chunk;
            }
        }

        private async IAsyncEnumerable<StreamChunkDto> StreamChunksInternalAsync(
            string message,
            List<MessageHistoryDto>? history,
            string model,
            string? systemInstruction = null)
        {
            var channel = Channel.CreateUnbounded<StreamChunkDto>();

            // Start background task to fetch and write to channel
            var fetchTask = Task.Run(async () =>
            {
                var httpClient = _httpClientFactory.CreateClient();
                var url = $"{_baseUrl.TrimEnd('/')}/v1/chat/completions";

                // Build messages array (OpenAI format)
                var messages = new List<object>();

                // Add system instruction if provided
                if (!string.IsNullOrWhiteSpace(systemInstruction))
                {
                    messages.Add(new
                    {
                        role = "system",
                        content = systemInstruction
                    });
                }

                // Add history messages
                if (history != null && history.Count > 0)
                {
                    foreach (var msg in history)
                    {
                        var role = msg.Role == "model" ? "assistant" : msg.Role;
                        messages.Add(new
                        {
                            role = role,
                            content = msg.Content
                        });
                    }
                }

                // Add current user message
                messages.Add(new
                {
                    role = "user",
                    content = message
                });

                // Build request body (OpenAI format)
                var requestBody = new
                {
                    model = model,
                    messages = messages,
                    stream = true
                };

                var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                });

                _logger.LogDebug("LiteLLM request: {Request}", json.Substring(0, Math.Min(500, json.Length)));

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var hasError = false;

                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, url)
                    {
                        Content = content
                    };

                    // Add Authorization header (Bearer token)
                    request.Headers.Add("Authorization", $"Bearer {_apiKey}");

                    using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("LiteLLM API error: {StatusCode} - {Error}", response.StatusCode, errorContent);

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
                            var data = line.Substring(6).Trim();

                            // Check for stream end signal
                            if (data == "[DONE]")
                            {
                                break;
                            }

                            if (string.IsNullOrWhiteSpace(data)) continue;

                            try
                            {
                                var chunk = JsonSerializer.Deserialize<OpenAIStreamResponse>(data);
                                if (chunk?.Choices != null && chunk.Choices.Count > 0)
                                {
                                    var text = chunk.Choices[0]?.Delta?.Content;
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
        /// </summary>
        public async Task<string> GenerateChatTitleAsync(string firstMessage, CancellationToken cancellationToken = default)
        {
            var httpClient = _httpClientFactory.CreateClient();
            var url = $"{_baseUrl.TrimEnd('/')}/v1/chat/completions";

            var prompt = $@"สรุปข้อความนี้เป็นชื่อหัวข้อสั้นๆ ไม่เกิน 30 ตัวอักษร ภาษาเดียวกับข้อความ ไม่ต้องใส่เครื่องหมายคำพูด:

""{firstMessage}""

ตอบแค่ชื่อหัวข้อเท่านั้น:";

            var requestBody = new
            {
                model = DefaultModel,
                messages = new[]
                {
                    new { role = "user", content = prompt }
                },
                max_tokens = 50,
                temperature = 0.3
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = content
                };
                request.Headers.Add("Authorization", $"Bearer {_apiKey}");

                var response = await httpClient.SendAsync(request, cancellationToken);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<OpenAIResponse>(responseJson);

                var title = result?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();

                // Clean up the title - remove quotes if present
                if (!string.IsNullOrEmpty(title))
                {
                    title = title.Trim('"', '\'', '"', '"', '「', '」');
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
                return firstMessage.Length > 50 ? firstMessage.Substring(0, 47) + "..." : firstMessage;
            }
        }

        public async Task<string> SendMessageAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? modelId = null,
            CancellationToken cancellationToken = default)
        {
            var httpClient = _httpClientFactory.CreateClient();
            var model = string.IsNullOrWhiteSpace(modelId) ? DefaultModel : modelId;
            var url = $"{_baseUrl.TrimEnd('/')}/v1/chat/completions";

            // Build messages array
            var messages = new List<object>();

            if (history != null && history.Count > 0)
            {
                foreach (var msg in history)
                {
                    var role = msg.Role == "model" ? "assistant" : msg.Role;
                    messages.Add(new
                    {
                        role = role,
                        content = msg.Content
                    });
                }
            }

            // Add user message
            messages.Add(new
            {
                role = "user",
                content = message
            });

            var requestBody = new
            {
                model = model,
                messages = messages
            };

            var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = content
                };
                request.Headers.Add("Authorization", $"Bearer {_apiKey}");

                var response = await httpClient.SendAsync(request, cancellationToken);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<OpenAIResponse>(responseJson);

                return result?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendMessageAsync");
                return $"Error: {ex.Message}";
            }
        }

        // OpenAI Response models (for non-streaming)
        private class OpenAIResponse
        {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("choices")]
            public List<OpenAIChoice>? Choices { get; set; }
        }

        private class OpenAIChoice
        {
            [JsonPropertyName("index")]
            public int Index { get; set; }

            [JsonPropertyName("message")]
            public OpenAIMessage? Message { get; set; }

            [JsonPropertyName("finish_reason")]
            public string? FinishReason { get; set; }
        }

        private class OpenAIMessage
        {
            [JsonPropertyName("role")]
            public string? Role { get; set; }

            [JsonPropertyName("content")]
            public string? Content { get; set; }
        }

        // OpenAI Streaming Response models
        private class OpenAIStreamResponse
        {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("choices")]
            public List<OpenAIStreamChoice>? Choices { get; set; }
        }

        private class OpenAIStreamChoice
        {
            [JsonPropertyName("index")]
            public int Index { get; set; }

            [JsonPropertyName("delta")]
            public OpenAIDelta? Delta { get; set; }

            [JsonPropertyName("finish_reason")]
            public string? FinishReason { get; set; }
        }

        private class OpenAIDelta
        {
            [JsonPropertyName("role")]
            public string? Role { get; set; }

            [JsonPropertyName("content")]
            public string? Content { get; set; }
        }
    }
}
