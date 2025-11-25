import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = 'nodejs';

// POST: สร้างแชทใหม่
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title = "New Chat" } = body;

    const chat = await prisma.chat.create({
      data: {
        title,
      },
    });

    return NextResponse.json({
      chat,
      message: "Chat created successfully"
    });

  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
