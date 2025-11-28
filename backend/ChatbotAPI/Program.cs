using Microsoft.EntityFrameworkCore;
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

app.UseAuthorization();

app.MapControllers();

app.Run();
