# Backend API - Gemini AI Chatbot

ASP.NET Core Web API (.NET 10) สำหรับ Gemini AI Chatbot พร้อมการรองรับ Real-time Streaming

## เทคโนโลยี

- **.NET 10** - Web API Framework
- **Entity Framework Core 10** - ORM สำหรับ SQL Server
- **SQL Server** - Database
- **Mscc.GenerativeAI** - Google Gemini AI SDK สำหรับ C#
- **Swagger/OpenAPI** - API Documentation

## โครงสร้างโปรเจกต์

```
backend/ChatbotAPI/
├── Controllers/
│   └── ChatController.cs          # API endpoints with streaming support
├── DTOs/
│   ├── ChatRequestDto.cs          # Request models
│   └── ChatResponseDto.cs         # Response models
├── Models/
│   ├── Chat.cs                    # Chat entity
│   └── Message.cs                 # Message entity
├── Data/
│   └── AppDbContext.cs            # EF Core DbContext
├── Services/
│   └── GeminiService.cs           # Gemini AI integration service
├── Migrations/                    # EF Core migrations
├── appsettings.json               # Configuration
└── Program.cs                     # Application entry point
```

## API Endpoints

### Chat Management

#### 1. List All Chats
```http
GET /api/chat
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Chat Title",
    "createdAt": "2025-11-25T...",
    "updatedAt": "2025-11-25T...",
    "messageCount": 5
  }
]
```

#### 2. Get Chat by ID
```http
GET /api/chat/{id}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Chat Title",
  "createdAt": "2025-11-25T...",
  "updatedAt": "2025-11-25T...",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Hello",
      "createdAt": "2025-11-25T..."
    }
  ]
}
```

#### 3. Send Message (with Streaming)
```http
POST /api/chat
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Tell me about AI",
  "chatId": "uuid (optional)",
  "temporary": false,
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    }
  ]
}
```

**Response:** Server-Sent Events (SSE)
```
data: {"chatId":"uuid","type":"metadata"}

data: {"text":"AI ","type":"chunk"}

data: {"text":"stands ","type":"chunk"}

data: {"type":"done"}
```

#### 4. Create New Chat
```http
POST /api/chat/new
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "New Chat (optional)"
}
```

#### 5. Update Chat Title
```http
PATCH /api/chat/{id}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title"
}
```

#### 6. Delete Chat
```http
DELETE /api/chat/{id}
```

## การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies

```bash
cd backend/ChatbotAPI
dotnet restore
```

### 2. ตั้งค่า Database Connection

แก้ไขไฟล์ `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=chatbot;User Id=sa;Password=YourPassword;Encrypt=true;TrustServerCertificate=true;"
  },
  "GeminiSettings": {
    "ApiKey": "your_gemini_api_key_here"
  }
}
```

### 3. สร้าง Database

```bash
# สร้าง database migration (ถ้ายังไม่มี)
dotnet ef migrations add InitialCreate

# Apply migration ไปยัง database
dotnet ef database update
```

### 4. รัน Application

```bash
dotnet run
```

API จะรันที่:
- HTTPS: `https://localhost:7001`
- HTTP: `http://localhost:5001`
- Swagger UI: `https://localhost:7001/swagger`

## คุณสมบัติหลัก

### 1. Real-time Streaming
- ใช้ Server-Sent Events (SSE) สำหรับการส่งข้อความแบบ real-time
- รองรับการแสดงผลแบบ character-by-character เหมือน ChatGPT

### 2. Temporary Chat Mode
- รองรับ temporary chat ที่ไม่บันทึกลง database
- เหมาะสำหรับการทดสอบหรือแชทที่ไม่ต้องการเก็บประวัติ

### 3. Chat History Management
- เก็บประวัติการสนทนาในรูปแบบ Chat และ Message
- รองรับการ rename และ delete conversations
- CASCADE delete - ลบ Chat จะลบ Messages ทั้งหมดด้วย

### 4. CORS Support
- ตั้งค่า CORS ให้รองรับ Next.js frontend ที่ `http://localhost:3000`
- สามารถแก้ไขได้ใน `Program.cs`

## การใช้งานกับ Frontend

### Update Frontend API Base URL

แก้ไข frontend code ให้เรียก API ที่ backend แทน:

```typescript
// Before (Next.js API routes)
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify(data)
});

// After (ASP.NET Core backend)
const response = await fetch('http://localhost:5001/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

## Development Tools

### Swagger/OpenAPI
เข้าถึงได้ที่ `https://localhost:7001/swagger`

### EF Core Commands

```bash
# สร้าง migration ใหม่
dotnet ef migrations add MigrationName

# Apply migrations
dotnet ef database update

# ลบ migration ล่าสุด
dotnet ef migrations remove

# สร้าง SQL script
dotnet ef migrations script
```

### Build & Run

```bash
# Build
dotnet build

# Run in development mode
dotnet run

# Run in production mode
dotnet run --configuration Release

# Watch mode (auto-reload)
dotnet watch run
```

## Environment Variables

สร้างไฟล์ `appsettings.Development.json` สำหรับ development:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=chatbot_dev;User Id=sa;Password=DevPassword123;Encrypt=true;TrustServerCertificate=true;"
  },
  "GeminiSettings": {
    "ApiKey": "dev_api_key"
  }
}
```

## การ Deploy

### 1. Publish Application

```bash
dotnet publish --configuration Release --output ./publish
```

### 2. Run Published App

```bash
cd publish
dotnet ChatbotAPI.dll
```

### 3. Docker (Optional)

สร้างไฟล์ `Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["ChatbotAPI.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ChatbotAPI.dll"]
```

## ปัญหาที่พบบ่อยและวิธีแก้

### 1. SQL Server Connection Error
- ตรวจสอบว่า SQL Server กำลังรันอยู่
- ตรวจสอบ connection string ใน `appsettings.json`
- ตรวจสอบ firewall settings

### 2. Gemini API Error
- ตรวจสอบว่า API key ถูกต้อง
- ตรวจสอบว่า model name เป็น `gemini-2.0-flash-exp`
- ตรวจสอบ internet connection

### 3. CORS Error
- ตรวจสอบว่า frontend URL ตรงกับที่ตั้งค่าใน `Program.cs`
- ตรวจสอบว่า `UseCors("AllowFrontend")` ถูกเรียกก่อน `UseAuthorization()`

## Next Steps

- [ ] เพิ่ม Authentication/Authorization (JWT)
- [ ] เพิ่ม Rate Limiting
- [ ] เพิ่ม Caching (Redis)
- [ ] เพิ่ม Logging middleware
- [ ] เพิ่ม Health checks
- [ ] เพิ่ม Unit tests
- [ ] เพิ่ม Integration tests

---

สร้างโดย .NET 10 + Entity Framework Core + Gemini AI
