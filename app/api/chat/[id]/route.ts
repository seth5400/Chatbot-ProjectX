import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = 'nodejs';

// GET: ดึงข้อมูลแชทและข้อความทั้งหมดในแชทนั้น
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ chat });

  } catch (error) {
    console.error("Failed to fetch chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// PATCH: แก้ไขชื่อแชท (Rename)
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json({
      chat,
      message: "Chat title updated successfully"
    });

  } catch (error) {
    console.error("Failed to update chat:", error);
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

// DELETE: ลบแชท
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.chat.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Chat deleted successfully"
    });

  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
