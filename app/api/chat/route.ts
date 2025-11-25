import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = 'nodejs';

// GET: ดึงรายการแชททั้งหมด
export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1, // เอาแค่ข้อความแรกเพื่อแสดงตัวอย่าง
        },
      },
    });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST: ส่งข้อความและรับคำตอบ (รองรับทั้งแชทปกติและ temporary)
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { message, chatId, temporary = false, history = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // ถ้าเป็น temporary chat ไม่ต้องบันทึก DB
    if (temporary) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // ใช้ history ที่ส่งมา
      const chat = model.startChat({
        history: history.map((msg: { role: string; content: string }) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })),
      });

      // Streaming response
      const result = await chat.sendMessageStream(message);

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // แชทปกติ - บันทึก DB
    let chat;
    let dbMessages: Array<{ role: string; content: string }> = [];

    if (chatId) {
      // ดึงแชทที่มีอยู่
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!chat) {
        return NextResponse.json(
          { error: "Chat not found" },
          { status: 404 }
        );
      }

      dbMessages = chat.messages;
    } else {
      // สร้างแชทใหม่
      chat = await prisma.chat.create({
        data: {
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        },
        include: { messages: true },
      });

      dbMessages = [];
    }

    // บันทึกข้อความของ user
    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        chatId: chat.id,
      },
    });

    // เตรียม history สำหรับ Gemini
    const historyForGemini = dbMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // เรียก Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const geminiChat = model.startChat({
      history: historyForGemini,
    });

    // Streaming response
    const result = await geminiChat.sendMessageStream(message);

    let fullText = '';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ส่ง chatId ไปก่อนเป็น metadata
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chatId: chat.id, type: 'metadata' })}\n\n`));

          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;
            // ส่งข้อความเป็น SSE format
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, type: 'chunk' })}\n\n`));
          }

          // บันทึกคำตอบทั้งหมดลง DB หลังจากได้รับครบ
          await prisma.message.create({
            data: {
              role: 'model',
              content: fullText,
              chatId: chat.id,
            },
          });

          // อัพเดท updatedAt ของ chat
          await prisma.chat.update({
            where: { id: chat.id },
            data: { updatedAt: new Date() },
          });

          // ส่งสัญญาณว่าเสร็จแล้ว
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("Gemini API Error Details:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch from Gemini",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}