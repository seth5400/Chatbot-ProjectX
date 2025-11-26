# Gemini AI Chatbot - Monorepo

Full-stack chatbot application ที่ใช้ Gemini AI แบ่งออกเป็น Frontend (Next.js) และ Backend (.NET) อย่างชัดเจน

## 📁 โครงสร้างโปรเจกต์

```
my-gemini-chatbot/
├── frontend/                  # Next.js 14 Frontend Application
│   ├── app/                  # App Router (Pages & Components)
│   │   ├── page.tsx         # Main chat interface
│   │   └── globals.css      # Global styles
│   ├── lib/
│   │   └── config.ts        # API configuration
│   ├── .env.local           # Environment variables
│   └── package.json
│
├── backend/                   # .NET 10 Web API Backend
│   └── ChatbotAPI/
│       ├── Controllers/      # API endpoints
│       ├── DTOs/            # Data Transfer Objects
│       ├── Models/          # Entity models (Chat, Message)
│       ├── Data/            # DbContext
│       ├── Services/        # Business logic (GeminiService)
│       ├── Migrations/      # EF Core migrations
│       └── appsettings.json # Configuration
│
├── SETUP.md                  # คู่มือการติดตั้งแบบละเอียด
└── README.md                 # ไฟล์นี้
```

## 🚀 Quick Start

### วิธีที่ 1: อ่านคู่มือฉบับเต็ม (แนะนำ)

👉 **อ่าน [SETUP.md](SETUP.md)** สำหรับคู่มือการติดตั้งแบบละเอียดทุกขั้นตอน

### วิธีที่ 2: Quick Setup (สำหรับคนที่มีประสบการณ์)

#### 1. ตั้งค่า Backend (.NET)

```bash
cd backend/ChatbotAPI

# แก้ไข appsettings.json ใส่ Connection String และ Gemini API Key

dotnet restore
dotnet ef database update
dotnet run
```

Backend จะรันที่ `http://localhost:5001`

#### 2. ตั้งค่า Frontend (Next.js)

```bash
cd frontend

# สร้างไฟล์ .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:5001

npm install
npm run dev
```

Frontend จะรันที่ `http://localhost:3000`

## 🎯 เทคโนโลยีที่ใช้

### Frontend Stack
- **Next.js 14** - React Framework with App Router
- **React 18** - UI Library
- **TypeScript** - Type-safe development
- **Tailwind CSS 3** - Utility-first CSS framework

### Backend Stack
- **.NET 10** - Web API Framework
- **Entity Framework Core 10** - ORM for SQL Server
- **Mscc.GenerativeAI** - Google Gemini AI SDK
- **SQL Server** - Database

### AI & APIs
- **Google Gemini AI** - gemini-2.5-flash model (เลือกได้หลาย model)
- **Server-Sent Events (SSE)** - Real-time streaming

## ✨ คุณสมบัติ

- ✅ **Real-time Streaming** - ข้อความจาก AI แสดงแบบ character-by-character
- ✅ **AI Model Selection** - เลือก Gemini model ได้ (2.5 Flash, 2.5 Pro, 2.0 Flash, 3.0 Preview)
- ✅ **Chat History** - บันทึกประวัติการสนทนาลง SQL Server
- ✅ **Temporary Chat** - โหมดชั่วคราวที่ไม่บันทึก DB
- ✅ **Rename & Delete** - เปลี่ยนชื่อและลบแชทได้
- ✅ **Responsive UI** - Sidebar ซ่อน/แสดงได้ ใช้งานง่าย
- ✅ **Modern Design** - ธีมสีส้ม-ขาว-ดำ สไตล์ ChatGPT

## 🔌 API Endpoints

### Chat Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat` | ดึงรายการแชททั้งหมด |
| GET | `/api/chat/{id}` | ดึงข้อความในแชทตาม ID |
| POST | `/api/chat` | ส่งข้อความ (พร้อม streaming) |
| POST | `/api/chat/new` | สร้างแชทใหม่ |
| PATCH | `/api/chat/{id}` | เปลี่ยนชื่อแชท |
| DELETE | `/api/chat/{id}` | ลบแชท |

**ตัวอย่าง POST `/api/chat`:**

```json
{
  "message": "สวัสดี",
  "chatId": "uuid (optional)",
  "temporary": false,
  "modelId": "gemini-2.5-flash",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "model", "content": "..."}
  ]
}
```

**Available Models:**
- `gemini-2.5-flash` (Default - แนะนำ)
- `gemini-2.5-flash-lite`
- `gemini-2.5-pro`
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`
- `gemini-3-pro-preview`

## 📚 Database Schema

### Chat Table
```
Chat
├── Id (string, PK)
├── Title (string)
├── CreatedAt (DateTime)
├── UpdatedAt (DateTime)
└── Messages (Collection)
```

### Message Table
```
Message
├── Id (string, PK)
├── Role (string) - 'user' or 'model'
├── Content (string)
├── CreatedAt (DateTime)
└── ChatId (string, FK)
```

## 🛠️ Development Scripts

### Frontend

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Backend

```bash
dotnet run                     # Run API (localhost:5001)
dotnet watch run              # Auto-reload on changes
dotnet ef migrations add Name # Create migration
dotnet ef database update     # Apply migrations
dotnet build                  # Build project
```

## 🔧 Configuration Files

### Frontend - `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Backend - `appsettings.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=chatbot;..."
  },
  "GeminiSettings": {
    "ApiKey": "your_api_key_here"
  }
}
```

## 📖 เอกสารเพิ่มเติม

- **[SETUP.md](SETUP.md)** - คู่มือการติดตั้งแบบละเอียด step-by-step
- **[backend/README.md](backend/README.md)** - เอกสาร Backend API พร้อม examples
- **Swagger UI** - เข้าถึงได้ที่ `https://localhost:7001/swagger` (เมื่อรัน backend)

## 🐛 Troubleshooting

### ปัญหาที่พบบ่อย

1. **SQL Server Connection Error**
   - ตรวจสอบ SQL Server กำลังรันอยู่
   - เช็ค connection string ถูกต้อง

2. **CORS Error**
   - Frontend ต้องรันที่ `localhost:3000`
   - Backend ต้องรันที่ `localhost:5001`

3. **Gemini API Error**
   - ตรวจสอบ API Key
   - เช็ค internet connection

4. **Migration Error**
   - ลองรัน `dotnet ef database drop` แล้ว `update` ใหม่

ดู [SETUP.md](SETUP.md) สำหรับรายละเอียดการแก้ปัญหาเพิ่มเติม

## 🚧 Roadmap

- [ ] User Authentication (JWT)
- [ ] Rate Limiting
- [ ] Caching (Redis)
- [ ] File/Image Upload
- [ ] Export Chat History
- [ ] Docker Support
- [ ] Deploy to Azure/AWS
- [ ] Unit & Integration Tests

## 📄 License

This project is open source and available under the MIT License.

---

**สร้างโดย:**
Next.js 14 + .NET 10 + Entity Framework Core + Google Gemini AI

**คุณสมบัติพิเศษ:**
✨ Real-time Streaming | 💾 SQL Server | 🎨 Modern UI | 🚀 RESTful API

---

**ต้องการความช่วยเหลือ?** อ่าน [SETUP.md](SETUP.md) หรือเช็ค [backend/README.md](backend/README.md)
