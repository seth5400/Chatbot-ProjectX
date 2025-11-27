"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, Chat } from "@/types";

// Available Gemini models (Updated from API)
const AI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "แนะนำ - เร็วและฉลาด" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "เร็วที่สุด ประหยัด" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "ฉลาดที่สุด" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "เสถียร เร็ว" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "เสถียร ประหยัด" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)", description: "ใหม่ล่าสุด ทดลอง" },
];

// Preset Personas
const PERSONAS = [
  {
    id: "default",
    name: "Default",
    icon: "🤖",
    description: "AI ปกติ ตอบทั่วไป",
    instruction: "",
  },
  {
    id: "friendly",
    name: "เพื่อนคุย",
    icon: "😊",
    description: "พูดคุยเป็นกันเอง สนุกสนาน",
    instruction: "คุณคือเพื่อนที่พูดคุยเป็นกันเอง สนุกสนาน ใช้ภาษาไม่เป็นทางการ ใส่อารมณ์ขันบ้าง แต่ยังให้ข้อมูลที่ถูกต้อง",
  },
  {
    id: "professional",
    name: "มืออาชีพ",
    icon: "💼",
    description: "เป็นทางการ กระชับ ตรงประเด็น",
    instruction: "คุณคือผู้เชี่ยวชาญมืออาชีพ ตอบอย่างเป็นทางการ กระชับ ตรงประเด็น ใช้ภาษาสุภาพ ให้ข้อมูลที่ชัดเจนและแม่นยำ",
  },
  {
    id: "teacher",
    name: "ครูผู้สอน",
    icon: "📚",
    description: "อธิบายละเอียด เข้าใจง่าย",
    instruction: "คุณคือครูผู้สอนที่อธิบายเรื่องยากให้เข้าใจง่าย ใช้ตัวอย่างประกอบ แบ่งเป็นขั้นตอน ใจเย็น และให้กำลังใจ",
  },
  {
    id: "coder",
    name: "โปรแกรมเมอร์",
    icon: "💻",
    description: "เน้นโค้ด อธิบายเทคนิค",
    instruction: "คุณคือโปรแกรมเมอร์อาวุโส เน้นตอบด้วยโค้ดที่ถูกต้อง อธิบายเทคนิค best practices และ clean code ใส่ comment อธิบายโค้ดด้วย",
  },
  {
    id: "creative",
    name: "นักสร้างสรรค์",
    icon: "🎨",
    description: "คิดนอกกรอบ ไอเดียใหม่ๆ",
    instruction: "คุณคือนักสร้างสรรค์ที่คิดนอกกรอบ ให้ไอเดียใหม่ๆ มุมมองที่แตกต่าง สร้างสรรค์ และกล้าเสนอแนวทางที่ไม่ธรรมดา",
  },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isTemporary, setIsTemporary] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [enableGrounding, setEnableGrounding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [settingsTab, setSettingsTab] = useState("personas");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // กำหนด loadChats ก่อน useEffect ที่เรียกใช้
  const loadChats = useCallback(async (search?: string) => {
    try {
      const url = search?.trim()
        ? API_ENDPOINTS.CHAT_SEARCH(search)
        : API_ENDPOINTS.CHAT;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load chats");
      const data = await response.json();
      setChats(data || []);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // โหลด chats ครั้งแรก
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Close menu and model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search - รอ 300ms หลังจากพิมพ์เสร็จแล้วค่อย search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        loadChats(searchQuery).finally(() => setIsSearching(false));
      } else {
        loadChats();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, loadChats]);

  const loadChat = async (chatId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.CHAT_BY_ID(chatId));
      if (!response.ok) throw new Error("Failed to load chat");
      const data = await response.json();
      setMessages(data.messages || []);
      setCurrentChatId(chatId);
      setIsTemporary(false);
    } catch (error) {
      console.error("Failed to load chat:", error);
    }
  };

  const createNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setIsTemporary(false);
  };

  const createTemporaryChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setIsTemporary(true);
  };

  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.CHAT_BY_ID(chatId), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete chat");
      setChats(chats.filter((chat) => chat.id !== chatId));
      if (currentChatId === chatId) {
        createNewChat();
      }
      setMenuOpenId(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.CHAT_BY_ID(chatId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error("Failed to rename chat");
      setChats(
        chats.map((chat) =>
          chat.id === chatId ? { ...chat, title: newTitle } : chat
        )
      );
      setIsRenaming(null);
      setMenuOpenId(null);
    } catch (error) {
      console.error("Failed to rename chat:", error);
    }
  };

  // Copy message to clipboard
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Edit message and resend
  const handleEditMessage = (index: number, content: string) => {
    setEditingIndex(index);
    setEditValue(content);
  };

  const submitEditedMessage = async () => {
    if (editingIndex === null || !editValue.trim()) return;

    // Remove messages from editingIndex onwards
    const newMessages = messages.slice(0, editingIndex);
    setMessages(newMessages);
    setEditingIndex(null);

    // Set input and send
    setInput(editValue);
    setEditValue("");

    // Need to wait for state update, then send
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }, 100);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  // Get current system instruction based on selected persona or custom
  const getCurrentSystemInstruction = useCallback(() => {
    if (customInstruction.trim()) {
      return customInstruction;
    }
    if (selectedPersona) {
      const persona = PERSONAS.find((p) => p.id === selectedPersona);
      return persona?.instruction || "";
    }
    return "";
  }, [customInstruction, selectedPersona]);

  // Stop generating
  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // Regenerate AI response - find the user message before this AI message and resend
  const regenerateResponse = (aiMessageIndex: number) => {
    if (isLoading) return;

    // Find the user message before this AI message
    let userMessageIndex = aiMessageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== "user") {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) return;

    const userMessage = messages[userMessageIndex].content;

    // Remove the AI message (and any messages after it)
    const newMessages = messages.slice(0, aiMessageIndex);
    setMessages(newMessages);

    // Set input and trigger send
    setInput(userMessage);
    setTimeout(() => {
      const form = document.querySelector("form");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }, 100);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    setInput("");

    const userMessage: Message = {
      role: "user",
      content: currentInput,
    };

    // เพิ่ม user message และ placeholder สำหรับ bot message พร้อมกัน
    setMessages((prev) => [...prev, userMessage, { role: "model", content: "" }]);
    const botMessageIndex = messages.length + 1; // index ของ bot message ใน array ใหม่
    setIsLoading(true);

    // Create AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const systemInstruction = getCurrentSystemInstruction();
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          chatId: currentChatId,
          temporary: isTemporary,
          modelId: selectedModel,
          enableGrounding: enableGrounding,
          systemInstruction: systemInstruction || undefined,
          // สำหรับ temporary chat ส่ง history ไป, chat ปกติให้ backend โหลดจาก DB
          history: isTemporary ? messages : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      // Streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                const data = JSON.parse(jsonStr);

                // Backend ส่งมาเป็น PascalCase: Type, ChatId, Text
                if (data.Type === "metadata" && data.ChatId) {
                  setCurrentChatId(data.ChatId);
                } else if (data.Type === "chunk" && data.Text) {
                  fullText += data.Text;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[botMessageIndex] = {
                      role: "model",
                      content: fullText,
                    };
                    return newMessages;
                  });
                } else if (data.Type === "done") {
                  loadChats(); // Reload chat list
                }
              } catch (e) {
                console.error("Parse error:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      // Check if it was aborted
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request was aborted");
        // Keep the partial response if any
        return;
      }

      console.error("Chat Error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[botMessageIndex] = {
          role: "model",
          content: "⚠️ ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } bg-[#141414] border-r border-[#2a2a2a] flex flex-col transition-all duration-300 overflow-hidden`}
      >
        <div className="p-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-[#ff6b35] to-[#ff4500] bg-clip-text text-transparent mb-3">
            แชททั้งหมด
          </h2>
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาแชท..."
              className="w-full pl-9 pr-8 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] transition-colors"
            />
            {/* Search Icon */}
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Loading indicator */}
            {isSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-custom p-2">
          {/* No results message */}
          {chats.length === 0 && searchQuery && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">ไม่พบแชทที่ค้นหา</p>
              <p className="text-xs mt-1">&quot;{searchQuery}&quot;</p>
            </div>
          )}
          {/* Empty state - no chats at all */}
          {chats.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">ยังไม่มีแชท</p>
              <p className="text-xs mt-1">กดปุ่ม &quot;+ แชทใหม่&quot; เพื่อเริ่มต้น</p>
            </div>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative p-3 mb-1 rounded-lg cursor-pointer hover:bg-[#1f1f1f] ${
                currentChatId === chat.id ? "bg-[#1f1f1f]" : ""
              }`}
              onClick={() => loadChat(chat.id)}
            >
              {isRenaming === chat.id ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (renameValue.trim()) {
                      renameChat(chat.id, renameValue);
                    } else {
                      setIsRenaming(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameValue.trim()) {
                      renameChat(chat.id, renameValue);
                    } else if (e.key === "Escape") {
                      setIsRenaming(null);
                    }
                  }}
                  autoFocus
                  className="w-full bg-[#0a0a0a] border border-[#ff6b35] rounded px-2 py-1 text-sm focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="text-sm truncate pr-8">{chat.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(chat.updatedAt).toLocaleDateString("th-TH")}
                  </div>

                  {/* Menu button */}
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                    }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {menuOpenId === chat.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-2 top-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-50 w-40 animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-[#2a2a2a] rounded-t-lg flex items-center gap-2"
                        onClick={() => {
                          setIsRenaming(chat.id);
                          setRenameValue(chat.title);
                          setMenuOpenId(null);
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        เปลี่ยนชื่อ
                      </button>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#2a2a2a] rounded-b-lg flex items-center gap-2"
                        onClick={() => deleteChat(chat.id)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ลบแชท
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#2a2a2a] space-y-2">
          <button
            onClick={createNewChat}
            className="w-full py-2 px-4 bg-gradient-to-r from-[#ff6b35] to-[#ff4500] hover:from-[#ff4500] hover:to-[#ff6b35] rounded-lg text-sm font-medium transition-all"
          >
            + แชทใหม่
          </button>
          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full py-2 px-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ตั้งค่า
            {(selectedPersona || customInstruction) && (
              <span className="w-2 h-2 bg-[#ff6b35] rounded-full"></span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-[#2a2a2a] flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold">Gemini AI Chat</h1>
              {isTemporary && (
                <p className="text-xs text-gray-500">โหมดชั่วคราว (ไม่บันทึก)</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg text-sm transition-all"
              >
                <svg className="w-4 h-4 text-[#ff6b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-300">
                  {AI_MODELS.find(m => m.id === selectedModel)?.name || "เลือกโมเดล"}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {isModelDropdownOpen && (
                <div className="absolute right-0 top-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-50 w-64 animate-fade-in">
                  {AI_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-[#2a2a2a] first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                        selectedModel === model.id ? "bg-[#2a2a2a]" : ""
                      }`}
                    >
                      <div>
                        <div className="text-white">{model.name}</div>
                        <div className="text-xs text-gray-500">{model.description}</div>
                      </div>
                      {selectedModel === model.id && (
                        <svg className="w-4 h-4 text-[#ff6b35]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Google Search Grounding Toggle */}
            <button
              onClick={() => setEnableGrounding(!enableGrounding)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                enableGrounding
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                  : "bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 border border-[#2a2a2a]"
              }`}
              title="เปิดใช้ Google Search เพื่อค้นหาข้อมูลปัจจุบัน (ค่าเงิน, ข่าว, ฯลฯ)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">ค้นหา Google</span>
              {enableGrounding && (
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              )}
            </button>

            <button
              onClick={createTemporaryChat}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isTemporary
                  ? "bg-[#ff6b35] text-white"
                  : "bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300"
              }`}
            >
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              แชทชั่วคราว
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-custom px-6 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ff4500] flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-lg font-medium">เริ่มสนทนาใหม่</p>
              <p className="text-sm mt-2">พิมพ์ข้อความด้านล่างเพื่อเริ่มการสนทนา</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Edit mode for user messages */}
                {editingIndex === index && msg.role === "user" ? (
                  <div className="w-full max-w-2xl">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full p-3 bg-[#1a1a1a] border border-[#ff6b35] rounded-lg text-white text-sm resize-none focus:outline-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={submitEditedMessage}
                        className="px-3 py-1.5 text-sm bg-gradient-to-r from-[#ff6b35] to-[#ff4500] text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        ส่งใหม่
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%]`}>
                    {/* Message bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-[#ff6b35] to-[#ff4500] text-white rounded-br-md"
                          : "bg-[#1a1a1a] text-gray-100 rounded-bl-md border border-[#2a2a2a]"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-white">{children}</h3>,
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-gray-200">{children}</li>,
                              code: ({ className, children }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="bg-[#2a2a2a] text-[#ff6b35] px-1.5 py-0.5 rounded text-xs font-mono">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block bg-[#0a0a0a] text-gray-300 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({ children }) => <pre className="bg-[#0a0a0a] rounded-lg overflow-x-auto my-2">{children}</pre>,
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">
                                  {children}
                                </a>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-[#ff6b35] pl-3 my-2 text-gray-400 italic">
                                  {children}
                                </blockquote>
                              ),
                              hr: () => <hr className="border-[#2a2a2a] my-4" />,
                              table: ({ children }) => (
                                <div className="overflow-x-auto my-2">
                                  <table className="min-w-full border border-[#2a2a2a] rounded">{children}</table>
                                </div>
                              ),
                              th: ({ children }) => <th className="bg-[#2a2a2a] px-3 py-2 text-left text-white font-semibold">{children}</th>,
                              td: ({ children }) => <td className="border-t border-[#2a2a2a] px-3 py-2">{children}</td>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Action buttons - always present, opacity controlled by hover */}
                    <div
                      className={`flex gap-1 mt-1 h-7 transition-opacity duration-200 ${
                        msg.role === "user" ? "mr-1" : "ml-1"
                      } ${hoveredIndex === index && !isLoading ? "opacity-100" : "opacity-0"}`}
                    >
                      {/* Copy button */}
                      <button
                        onClick={() => copyToClipboard(msg.content, index)}
                        className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                        title="คัดลอก"
                        tabIndex={hoveredIndex === index ? 0 : -1}
                      >
                        {copiedIndex === index ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>

                      {/* Edit button - only for user messages */}
                      {msg.role === "user" && (
                        <button
                          onClick={() => handleEditMessage(index, msg.content)}
                          className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                          title="แก้ไข"
                          tabIndex={hoveredIndex === index ? 0 : -1}
                        >
                          <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}

                      {/* Regenerate button - only for AI messages */}
                      {msg.role === "model" && (
                        <button
                          onClick={() => regenerateResponse(index)}
                          className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                          title="ตอบใหม่"
                          tabIndex={hoveredIndex === index ? 0 : -1}
                        >
                          <svg className="w-4 h-4 text-gray-500 hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator - only dots, stop button moved to input area */}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-3 rounded-2xl rounded-bl-md flex space-x-2">
                <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a2a] p-6">
          <form onSubmit={sendMessage} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์ข้อความที่นี่..."
              disabled={isLoading}
              className="w-full pl-4 pr-14 py-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl focus:outline-none focus:border-[#ff6b35] text-white placeholder-gray-500 transition-all disabled:opacity-50"
            />
            {isLoading ? (
              /* Stop button - replaces send button while loading */
              <button
                type="button"
                onClick={stopGenerating}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] text-white rounded-lg transition-all"
                title="หยุดสร้างข้อความ"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="6" y="6" width="8" height="8" rx="1" />
                </svg>
              </button>
            ) : (
              /* Send button */
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r from-[#ff6b35] to-[#ff4500] hover:from-[#ff4500] hover:to-[#ff6b35] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            )}
          </form>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-3xl h-[600px] flex overflow-hidden animate-fade-in">
            {/* Left Panel - 30% */}
            <div className="w-[30%] bg-[#141414] border-r border-[#2a2a2a] flex flex-col">
              <div className="p-4 border-b border-[#2a2a2a]">
                <h2 className="text-lg font-semibold text-white">ตั้งค่า</h2>
              </div>
              <nav className="flex-1 p-2">
                <button
                  onClick={() => setSettingsTab("personas")}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center gap-3 ${
                    settingsTab === "personas"
                      ? "bg-[#2a2a2a] text-white"
                      : "text-gray-400 hover:bg-[#1f1f1f] hover:text-white"
                  }`}
                >
                  <span className="text-lg">🎭</span>
                  บุคลิก AI
                </button>
                <button
                  onClick={() => setSettingsTab("custom")}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center gap-3 ${
                    settingsTab === "custom"
                      ? "bg-[#2a2a2a] text-white"
                      : "text-gray-400 hover:bg-[#1f1f1f] hover:text-white"
                  }`}
                >
                  <span className="text-lg">✏️</span>
                  คำสั่งกำหนดเอง
                </button>
              </nav>
            </div>

            {/* Right Panel - 70% */}
            <div className="w-[70%] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {settingsTab === "personas" ? "เลือกบุคลิก AI" : "คำสั่งกำหนดเอง"}
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {settingsTab === "personas" ? (
                  <div className="grid grid-cols-2 gap-3">
                    {PERSONAS.map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() => {
                          setSelectedPersona(persona.id === "default" ? null : persona.id);
                          setCustomInstruction("");
                        }}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          (selectedPersona === persona.id) || (persona.id === "default" && !selectedPersona && !customInstruction)
                            ? "border-[#ff6b35] bg-[#ff6b35]/10"
                            : "border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#2a2a2a]/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{persona.icon}</span>
                          <span className="font-medium text-white">{persona.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">{persona.description}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                      เขียนคำสั่งเพื่อกำหนดพฤติกรรมของ AI ตามที่คุณต้องการ คำสั่งนี้จะถูกใช้แทนบุคลิกที่เลือกไว้
                    </p>
                    <textarea
                      value={customInstruction}
                      onChange={(e) => {
                        setCustomInstruction(e.target.value);
                        if (e.target.value.trim()) {
                          setSelectedPersona(null);
                        }
                      }}
                      placeholder="เช่น: คุณคือผู้เชี่ยวชาญด้านการเงินที่ให้คำแนะนำอย่างรอบคอบ..."
                      className="w-full h-48 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] resize-none"
                    />
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{customInstruction.length} ตัวอักษร</span>
                      {customInstruction && (
                        <button
                          onClick={() => setCustomInstruction("")}
                          className="text-red-400 hover:text-red-300"
                        >
                          ล้างคำสั่ง
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#2a2a2a] flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {selectedPersona && !customInstruction && (
                    <span>กำลังใช้: {PERSONAS.find(p => p.id === selectedPersona)?.name}</span>
                  )}
                  {customInstruction && (
                    <span>กำลังใช้: คำสั่งกำหนดเอง</span>
                  )}
                  {!selectedPersona && !customInstruction && (
                    <span>ใช้ค่าเริ่มต้น</span>
                  )}
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2 bg-gradient-to-r from-[#ff6b35] to-[#ff4500] hover:from-[#ff4500] hover:to-[#ff6b35] text-white rounded-lg text-sm font-medium transition-all"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
