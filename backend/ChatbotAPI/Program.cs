using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ChatbotAPI.Data;
using ChatbotAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Register HttpClient
builder.Services.AddHttpClient();

// Register Services with Interfaces
builder.Services.AddScoped<ILiteLLMService, LiteLLMService>();

// Configure Entity Framework Core with SQL Server using Pooled DbContextFactory
// This supports both regular DbContext injection and IDbContextFactory for long-running operations
builder.Services.AddPooledDbContextFactory<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Also register AppDbContext for regular scoped usage
builder.Services.AddScoped<AppDbContext>(sp =>
    sp.GetRequiredService<IDbContextFactory<AppDbContext>>().CreateDbContext());

// Configure JWT Authentication with IdentityServer
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["IdentityServer:Authority"] ?? "http://localhost:5002";
        options.RequireHttpsMetadata = false; // Development only - set to true in production
        options.Audience = "chatbot_api";

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidAudiences = new[] { "chatbot_api", "chatbot_api_resource" }
        };

        // For development - allow anonymous access when no token is provided
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                // Allow SSE requests without token check in header (token in query for SSE)
                if (context.Request.Headers.ContainsKey("Accept") &&
                    context.Request.Headers["Accept"].ToString().Contains("text/event-stream"))
                {
                    var token = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(token))
                    {
                        context.Token = token;
                    }
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000") // Next.js frontend
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("Content-Type", "Cache-Control", "Connection");
    });
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Use CORS
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
