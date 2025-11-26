# 🚀 Setup Guide - Gemini AI Chatbot

คู่มือการติดตั้งและรันโปรเจกต์แบบครบถ้วน (Frontend + Backend)

## 📋 สิ่งที่ต้องเตรียม

### ซอฟต์แวร์ที่จำเป็น

1. **Node.js** (v18 ขึ้นไป)
   - ดาวน์โหลด: https://nodejs.org/

2. **.NET 10 SDK**
   - ดาวน์โหลด: https://dotnet.microsoft.com/download

3. **SQL Server**
   - SQL Server 2019/2022 หรือ SQL Server Express
   - ดาวน์โหลด: https://www.microsoft.com/sql-server/sql-server-downloads

4. **Gemini API Key**
   - สมัครที่: https://makersuite.google.com/app/apikey

---

## 🗄️ ขั้นตอนที่ 1: เตรียม SQL Server

### 1.1 เปิด SQL Server Management Studio (SSMS)

### 1.2 สร้าง Database ใหม่

```sql
CREATE DATABASE chatbot;
GO

USE chatbot;
GO
```

### 1.3 ตรวจสอบ Connection String

ตรวจสอบว่า SQL Server กำลังรันที่พอร์ต 1433 และมี SA password ที่ต้องการ

---

## ⚙️ ขั้นตอนที่ 2: ตั้งค่า Backend (.NET)

### 2.1 เข้าสู่โฟลเดอร์ Backend

```bash
cd backend/ChatbotAPI
```

### 2.2 ติดตั้ง Dependencies

```bash
dotnet restore
```

### 2.3 แก้ไขไฟล์ `appsettings.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=chatbot;User Id=sa;Password=YOUR_PASSWORD_HERE;Encrypt=true;TrustServerCertificate=true;"
  },
  "GeminiSettings": {
    "ApiKey": "YOUR_GEMINI_API_KEY_HERE"
  }
}
```

**สำคัญ:** แทนที่ค่าต่อไปนี้
- `YOUR_PASSWORD_HERE` = รหัสผ่าน SQL Server SA
- `YOUR_GEMINI_API_KEY_HERE` = API Key จาก Google AI Studio

### 2.4 สร้างและ Apply Database Migration

```bash
# สร้าง migration (ถ้ายังไม่มี)
dotnet ef migrations add InitialCreate

# Apply migration ไปยัง database
dotnet ef database update
```

### 2.5 รัน Backend API

```bash
dotnet run
```

Backend จะรันที่:
- HTTP: `http://localhost:5001`
- HTTPS: `https://localhost:7001`
- Swagger: `https://localhost:7001/swagger`

---

## 🎨 ขั้นตอนที่ 3: ตั้งค่า Frontend (Next.js)

### 3.1 เปิด Terminal ใหม่

เปิด terminal ใหม่ (อย่าปิด terminal ที่รัน backend)

### 3.2 เข้าสู่โฟลเดอร์ Frontend

```bash
cd frontend
```

### 3.3 ติดตั้ง Dependencies

```bash
npm install
```

### 3.4 ตรวจสอบไฟล์ `.env.local`

ตรวจสอบว่ามีไฟล์ `.env.local` พร้อมเนื้อหา:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5001
```

หากไม่มี ให้สร้างไฟล์นี้ในโฟลเดอร์ `frontend/`

### 3.5 รัน Frontend

```bash
npm run dev
```

Frontend จะรันที่: `http://localhost:3000`

---

## ✅ ขั้นตอนที่ 4: ทดสอบระบบ

### 4.1 เปิด Browser

เข้าไปที่: `http://localhost:3000`

### 4.2 ทดสอบฟีเจอร์

1. **แชทใหม่** - กด "แชทใหม่" แล้วพิมพ์ข้อความทดสอบ
2. **Streaming** - สังเกตข้อความจาก AI ที่ปรากฏแบบ real-time
3. **เลือก AI Model** - กดปุ่ม dropdown ที่ header เพื่อเลือก model (2.5 Flash, 2.5 Pro, etc.)
4. **แชทชั่วคราว** - กดปุ่ม "แชทชั่วคราว" (ไม่บันทึกลง DB)
5. **ประวัติแชท** - ดูรายการแชททั้งหมดใน sidebar
6. **เปลี่ยนชื่อ** - กดจุด 3 จุดที่แชท เลือก "เปลี่ยนชื่อ"
7. **ลบแชท** - กดจุด 3 จุดที่แชท เลือก "ลบแชท"

---

## 🔍 การแก้ปัญหา (Troubleshooting)

### ปัญหา: Backend ไม่สามารถเชื่อมต่อ SQL Server

**อาการ:** Migration ล้มเหลว หรือ error เกี่ยวกับ connection string

**วิธีแก้:**
1. ตรวจสอบว่า SQL Server กำลังรัน
2. ลอง connect ผ่าน SSMS ด้วย credentials เดียวกัน
3. ตรวจสอบ firewall - เปิดพอร์ต 1433
4. เปลี่ยน `Encrypt=true` เป็น `Encrypt=false` ถ้าไม่ได้ใช้ SSL

### ปัญหา: Gemini API Error

**อาการ:** ข้อความจาก AI ไม่แสดง หรือ error 401/403

**วิธีแก้:**
1. ตรวจสอบ API Key ใน `appsettings.json`
2. ไปที่ https://makersuite.google.com/app/apikey เพื่อสร้าง key ใหม่
3. ตรวจสอบว่ามี quota API เหลืออยู่

### ปัญหา: CORS Error

**อาการ:** Frontend ไม่สามารถเรียก Backend API ได้

**วิธีแก้:**
1. ตรวจสอบว่า Backend รันที่ `http://localhost:5001`
2. ตรวจสอบ CORS configuration ใน `backend/ChatbotAPI/Program.cs`
3. ตรวจสอบว่า Frontend รันที่ `http://localhost:3000`

### ปัญหา: Frontend ไม่เห็นข้อมูล

**อาการ:** Sidebar ว่างเปล่า หรือไม่มีแชท

**วิธีแก้:**
1. เปิด Browser DevTools (F12) > Console เช็ค error
2. เปิด Network tab ดู request ไป backend
3. ตรวจสอบว่า Backend response 200 OK
4. ลอง refresh database: `dotnet ef database drop` แล้ว `dotnet ef database update`

### ปัญหา: Streaming ไม่ทำงาน

**อาการ:** ข้อความจาก AI แสดงทั้งหมดพร้อมกันแทนที่จะเป็นทีละตัวอักษร

**วิธีแก้:**
1. เช็คว่า response headers มี `Content-Type: text/event-stream`
2. เช็ค Network tab ใน DevTools ว่า response type เป็น `eventsource`
3. ตรวจสอบว่าไม่มี proxy หรือ load balancer บล็อก SSE

---

## 📁 โครงสร้างโปรเจกต์

```
my-gemini-chatbot/
├── backend/
│   └── ChatbotAPI/
│       ├── Controllers/     # API endpoints
│       ├── DTOs/           # Data Transfer Objects
│       ├── Models/         # Entity models
│       ├── Data/           # DbContext
│       ├── Services/       # Business logic (GeminiService)
│       ├── Migrations/     # EF Core migrations
│       └── appsettings.json
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx       # Main chat UI
│   │   └── globals.css    # Styles
│   ├── lib/
│   │   └── config.ts      # API configuration
│   └── .env.local         # Environment variables
│
└── README.md
```

---

## 🚀 รันทั้งสองตัวพร้อมกัน

### Windows (PowerShell)

```powershell
# Terminal 1 - Backend
cd backend/ChatbotAPI
dotnet run

# Terminal 2 - Frontend (เปิดใหม่)
cd frontend
npm run dev
```

### macOS/Linux

```bash
# Terminal 1 - Backend
cd backend/ChatbotAPI
dotnet run

# Terminal 2 - Frontend (เปิดใหม่)
cd frontend
npm run dev
```

---

## 📝 สิ่งที่ควรทำต่อ

- [ ] เพิ่ม User Authentication (JWT)
- [ ] Deploy ไป Azure/AWS/Vercel
- [ ] เพิ่ม Rate Limiting
- [ ] เพิ่ม Logging และ Error tracking
- [ ] เพิ่ม Unit tests
- [ ] เพิ่ม Docker support

---

## 🆘 ต้องการความช่วยเหลือ?

1. เช็ค [backend/README.md](backend/README.md) สำหรับ API documentation
2. เช็ค root [README.md](README.md) สำหรับภาพรวมโปรเจกต์
3. เปิด issue บน GitHub (ถ้ามี repository)

---

สร้างโดย .NET 10 + Next.js 14 + Gemini AI ✨
