# ChatbotAPI - .NET Backend

Backend API สำหรับ Gemini AI Chatbot ใช้ .NET 10 Web API with Entity Framework Core

## โครงสร้างโปรเจกต์

```
ChatbotAPI/
├── Controllers/
│   └── ChatController.cs     # API endpoints with streaming
├── DTOs/
│   ├── ChatRequestDto.cs     # Request models (รวม modelId)
│   └── ChatResponseDto.cs    # Response models
├── Models/
│   ├── Chat.cs               # Chat entity model
│   └── Message.cs            # Message entity model
├── Data/
│   └── AppDbContext.cs       # EF Core DbContext
├── Services/
│   └── GeminiService.cs      # Gemini AI integration
├── Migrations/               # EF Core migrations
├── appsettings.json          # Configuration
└── Program.cs                # Application entry point
```

## Models

### Chat.cs
```csharp
- Id: string (UUID)
- Title: string (nvarchar(max))
- CreatedAt: DateTime
- UpdatedAt: DateTime
- Messages: ICollection<Message> (Navigation property)
```

### Message.cs
```csharp
- Id: string (UUID)
- Role: string ('user' or 'model')
- Content: string (nvarchar(max))
- CreatedAt: DateTime
- ChatId: string (Foreign key)
- Chat: Chat (Navigation property)
```

## Database Configuration

### Connection String (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=chatbot;User Id=sa;Password=YourStrongPassword123;Encrypt=true;TrustServerCertificate=true;"
  },
  "GeminiSettings": {
    "ApiKey": "your_gemini_api_key_here"
  }
}
```

**สำคัญ:** แก้ไข `Password` ให้ตรงกับรหัสผ่าน SQL Server ของคุณ

### Entity Framework Core Migrations

```bash
cd backend/ChatbotAPI

# สร้าง migration แรก
dotnet ef migrations add InitialCreate

# Apply migration ไปยัง database
dotnet ef database update
```

## การรันโปรเจกต์

```bash
cd backend/ChatbotAPI

# รัน development server
dotnet run

# หรือ รัน แบบ watch mode (auto-reload)
dotnet watch run
```

API จะรันที่:
- HTTPS: `https://localhost:7xxx`
- HTTP: `http://localhost:5xxx`
- Swagger UI: `https://localhost:7xxx/swagger`

## NuGet Packages ที่ติดตั้ง

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="10.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0" />
```

## CORS Configuration

API ถูกตั้งค่าให้รับ requests จาก Next.js frontend ที่ `http://localhost:3000`

ถ้าต้องการเพิ่ม origins อื่น แก้ไขใน [Program.cs](Program.cs):
```csharp
policy.WithOrigins("http://localhost:3000", "http://localhost:3001")
```

## Available Gemini Models

```
gemini-2.5-flash       (Default - แนะนำ)
gemini-2.5-flash-lite  (เร็วที่สุด)
gemini-2.5-pro         (ฉลาดที่สุด)
gemini-2.0-flash       (เสถียร)
gemini-2.0-flash-lite  (เสถียร ประหยัด)
gemini-3-pro-preview   (ใหม่ล่าสุด)
```

## API Features

- ✅ **Chat Management** - CRUD operations สำหรับ Chat
- ✅ **Message Streaming** - SSE real-time streaming
- ✅ **AI Model Selection** - เลือก Gemini model ได้
- ✅ **Temporary Chat** - แชทที่ไม่บันทึกลง DB
- ✅ **Chat History** - บันทึกประวัติการสนทนา

## เทคโนโลยีที่ใช้

- **.NET 10** - Latest .NET version
- **ASP.NET Core Web API** - RESTful API framework
- **Entity Framework Core 10** - ORM for database
- **SQL Server** - Database
- **Swagger/OpenAPI** - API documentation

---

สร้างโดย .NET CLI และ Entity Framework Core
