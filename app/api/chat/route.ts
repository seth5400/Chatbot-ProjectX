import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
  
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    console.log("Debug - API Key Status:", apiKey ? "Loaded (Found)" : "Missing");

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key not found in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });

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