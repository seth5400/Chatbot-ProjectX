# LiteLLM Chatbot

แอปพลิเคชัน AI Chatbot แบบ Full-stack สร้างด้วย **Next.js 14** และ **.NET 10 Web API** ขับเคลื่อนโดย **LiteLLM** ร่วมกับ **Typhoon 2.5** (โมเดล AI ภาษาไทยโดย SCB 10X)

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![.NET](https://img.shields.io/badge/.NET-10-purple?logo=dotnet)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwind-css)
![SQL Server](https://img.shields.io/badge/SQL%20Server-2022-red?logo=microsoft-sql-server)

## ฟีเจอร์หลัก

- **Real-time Streaming** - แสดงผลคำตอบแบบ real-time ด้วย Server-Sent Events (SSE)
- **ประวัติการสนทนา** - บันทึกแชทลง SQL Server
- **โหมดแชทชั่วคราว** - สนทนาโดยไม่บันทึกลงฐานข้อมูล
- **บุคลิก AI** - เลือกบุคลิกสำเร็จรูป (เพื่อนคุย, มืออาชีพ, ครูผู้สอน, โปรแกรมเมอร์, นักสร้างสรรค์)
- **คำสั่งกำหนดเอง** - กำหนดพฤติกรรม AI ตามต้องการ
- **จัดการแชท** - สร้าง, เปลี่ยนชื่อ, ลบ และค้นหาแชท
- **จัดการข้อความ** - แก้ไขข้อความ, สร้างคำตอบใหม่, คัดลอก
- **UI ทันสมัย** - ธีมสีเข้มสวยงามด้วย Tailwind CSS
- **รองรับ Markdown** - แสดงผลข้อความ rich text พร้อม syntax highlighting

## เทคโนโลยีที่ใช้

### Frontend
| เทคโนโลยี | เวอร์ชัน | คำอธิบาย |
|-----------|---------|----------|
| Next.js | 14 | React Framework (App Router) |
| TypeScript | 5 | ภาษาโปรแกรม |
| Tailwind CSS | 3 | CSS Framework |
| react-markdown | 10 | แสดงผล Markdown |

### Backend
| เทคโนโลยี | เวอร์ชัน | คำอธิบาย |
|-----------|---------|----------|
| ASP.NET Core | 10 | Web API Framework |
| Entity Framework Core | 10 | ORM สำหรับฐานข้อมูล |
| SQL Server | 2019+ | ฐานข้อมูล |
| LiteLLM | - | API Gateway สำหรับ AI |

### AI Model
- **Typhoon 2.5** โดย SCB 10X - โมเดล AI ภาษาไทยที่เข้าใจบริบทไทยได้ดี

## โครงสร้างโปรเจค

```
litellm-chatbot/
├── frontend/                 # Next.js Frontend
│   ├── app/
│   │   ├── page.tsx         # หน้าแชทหลัก
│   │   ├── layout.tsx       # Layout หลัก
│   │   └── globals.css      # CSS ทั่วไป
│   ├── lib/
│   │   └── config.ts        # ตั้งค่า API
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── package.json
│
├── backend/
│   └── ChatbotAPI/          # .NET Web API
│       ├── Controllers/
│       │   └── ChatController.cs    # API endpoints
│       ├── Services/
│       │   ├── ILiteLLMService.cs   # Interface
│       │   └── LiteLLMService.cs    # เชื่อมต่อ LiteLLM
│       ├── Models/
│       │   ├── Chat.cs              # Model แชท
│       │   └── Message.cs           # Model ข้อความ
│       ├── DTOs/
│       │   ├── ChatRequestDto.cs    # Request DTO
│       │   └── ChatResponseDto.cs   # Response DTO
│       ├── Data/
│       │   └── AppDbContext.cs      # Database Context
│       ├── Migrations/              # EF Core Migrations
│       ├── Program.cs               # จุดเริ่มต้นโปรแกรม
│       └── appsettings.json         # ตั้งค่า
│
└── LiteLLMChatbot.sln       # Solution file
```

## สิ่งที่ต้องมีก่อนติดตั้ง

- **Node.js** เวอร์ชัน 18 ขึ้นไป
- **.NET SDK** เวอร์ชัน 10.0 ขึ้นไป
- **SQL Server** เวอร์ชัน 2019 ขึ้นไป (หรือ LocalDB)
- **LiteLLM API Key** (หรือ API ที่รองรับรูปแบบ OpenAI)

## วิธีติดตั้งและใช้งาน

### 1. Clone โปรเจค

```bash
git clone https://github.com/yourusername/litellm-chatbot.git
cd litellm-chatbot
```

### 2. ติดตั้ง Backend

```bash
cd backend/ChatbotAPI

# ติดตั้ง packages
dotnet restore

# แก้ไขไฟล์ appsettings.json ตามการตั้งค่าของคุณ
# - ConnectionStrings:DefaultConnection (connection string ฐานข้อมูล)
# - LiteLLMSettings:BaseUrl (URL ของ LiteLLM Gateway)
# - LiteLLMSettings:ApiKey (API Key)

# สร้างฐานข้อมูล
dotnet ef database update

# รันเซิร์ฟเวอร์
dotnet run
```

API จะพร้อมใช้งานที่ `http://localhost:5001`

### 3. ติดตั้ง Frontend

```bash
cd frontend

# ติดตั้ง dependencies
npm install

# สร้างไฟล์ .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5001" > .env.local

# รันเซิร์ฟเวอร์
npm run dev
```

เว็บแอปจะพร้อมใช้งานที่ `http://localhost:3000`

## การตั้งค่า

### Backend (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=LiteLLMChatbotDB;Integrated Security=true;TrustServerCertificate=true;"
  },
  "LiteLLMSettings": {
    "BaseUrl": "https://your-litellm-gateway.com/",
    "ApiKey": "your-api-key"
  }
}
```

> **หมายเหตุ:** อย่า commit API Key จริงขึ้น GitHub ให้ใช้ environment variables หรือ User Secrets แทน

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/chat` | ดึงรายการแชททั้งหมด |
| GET | `/api/chat?search={query}` | ค้นหาแชท |
| GET | `/api/chat/{id}` | ดึงแชทตาม ID |
| POST | `/api/chat` | ส่งข้อความ (SSE streaming) |
| POST | `/api/chat/new` | สร้างแชทใหม่ |
| PATCH | `/api/chat/{id}` | แก้ไขชื่อแชท |
| DELETE | `/api/chat/{id}` | ลบแชท |

## โครงสร้างฐานข้อมูล

```
┌─────────────────┐       ┌─────────────────┐
│     Chats       │       │    Messages     │
│   (ตารางแชท)    │       │  (ตารางข้อความ)  │
├─────────────────┤       ├─────────────────┤
│ Id (PK)         │───┐   │ Id (PK)         │
│ Title           │   │   │ Role            │
│ CreatedAt       │   └──►│ ChatId (FK)     │
│ UpdatedAt       │       │ Content         │
└─────────────────┘       │ CreatedAt       │
                          └─────────────────┘
```

**ความสัมพันธ์:** Chat 1 ตัว มีได้หลาย Messages (One-to-Many)

## การพัฒนา

### รัน Backend (Development Mode)

```bash
cd backend/ChatbotAPI
dotnet watch run    # รันพร้อม hot reload
```

### รัน Frontend (Development Mode)

```bash
cd frontend
npm run dev
```

### Build สำหรับ Production

**Backend:**
```bash
cd backend/ChatbotAPI
dotnet publish -c Release -o ./publish
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

## สถาปัตยกรรมระบบ

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────►│   Next.js   │────►│  .NET API   │────►│   LiteLLM   │
│  (ผู้ใช้)    │◄────│  Frontend   │◄────│   Backend   │◄────│   Gateway   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                   │                    │
                          │                   ▼                    ▼
                          │             ┌───────────┐       ┌───────────┐
                          │             │ SQL Server│       │ Typhoon   │
                          │             │ (เก็บแชท)  │       │ 2.5 Model │
                          │             └───────────┘       └───────────┘
                          │
                    ┌─────┴─────┐
                    │ localhost │
                    │   :3000   │
                    └───────────┘
```

**Flow การทำงาน:**
1. ผู้ใช้พิมพ์ข้อความผ่าน Browser
2. Frontend ส่ง request ไปยัง Backend API
3. Backend ส่งต่อไปยัง LiteLLM Gateway
4. LiteLLM เรียก Typhoon 2.5 Model
5. คำตอบถูกส่งกลับมาแบบ streaming (SSE)
6. ข้อความถูกบันทึกลง SQL Server

## License

โปรเจคนี้อยู่ภายใต้ MIT License - ดูรายละเอียดในไฟล์ [LICENSE](LICENSE)

## เครดิต

- [LiteLLM](https://github.com/BerriAI/litellm) - API Gateway รองรับรูปแบบ OpenAI
- [Typhoon 2.5](https://opentyphoon.ai/) - โมเดล AI ภาษาไทยโดย SCB 10X
- [Next.js](https://nextjs.org/) - React Framework
- [ASP.NET Core](https://dotnet.microsoft.com/apps/aspnet) - Web API Framework

---

พัฒนาด้วย ❤️ สำหรับชุมชนนักพัฒนาไทย
