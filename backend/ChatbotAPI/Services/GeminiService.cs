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

        public async IAsyncEnumerable<StreamChunkDto> SendMessageStreamAsync(
            string message,
            List<MessageHistoryDto>? history = null,
            string? chatId = null)
        {
            // Send metadata first
            yield return new StreamChunkDto
            {
                ChatId = chatId,
                Type = "metadata"
            };

            // Use helper method to get all chunks, then yield them
            await foreach (var chunk in StreamChunksInternalAsync(message, history))
            {
                yield return chunk;
            }
        }

        private async IAsyncEnumerable<StreamChunkDto> StreamChunksInternalAsync(
            string message,
            List<MessageHistoryDto>? history)
        {
            var channel = Channel.CreateUnbounded<StreamChunkDto>();

            // Start background task to fetch and write to channel
            var fetchTask = Task.Run(async () =>
            {
                var httpClient = _httpClientFactory.CreateClient();
                var model = "gemini-2.5-flash";
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

                var requestBody = new
                {
                    contents = contents
                };

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

        public async Task<string> SendMessageAsync(
            string message,
            List<MessageHistoryDto>? history = null)
        {
            var httpClient = _httpClientFactory.CreateClient();
            var model = "gemini-2.5-flash";
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
