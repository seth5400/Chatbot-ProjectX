"use client";

import { useState, useRef, useEffect } from "react";
import { API_ENDPOINTS } from "@/lib/config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "model";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  updatedAt: string;
};

// Available Gemini models (Updated from API)
const AI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "แนะนำ - เร็วและฉลาด" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "เร็วที่สุด ประหยัด" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "ฉลาดที่สุด" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "เสถียร เร็ว" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "เสถียร ประหยัด" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)", description: "ใหม่ล่าสุด ทดลอง" },
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChats();
  }, []);

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

  const loadChats = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.CHAT);
      if (!response.ok) throw new Error("Failed to load chats");
      const data = await response.json();
      setChats(data || []);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

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

    try {
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          chatId: currentChatId,
          temporary: isTemporary,
          modelId: selectedModel,
          // สำหรับ temporary chat ส่ง history ไป, chat ปกติให้ backend โหลดจาก DB
          history: isTemporary ? messages : undefined,
        }),
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
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-[#ff6b35] to-[#ff4500] bg-clip-text text-transparent">
            แชททั้งหมด
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-custom p-2">
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
                className={`mb-6 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl ${
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
                          // Headings
                          h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-white">{children}</h3>,
                          // Paragraphs
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          // Bold & Italic
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                          em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
                          // Lists
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-gray-200">{children}</li>,
                          // Code
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
                          // Links
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">
                              {children}
                            </a>
                          ),
                          // Blockquote
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-[#ff6b35] pl-3 my-2 text-gray-400 italic">
                              {children}
                            </blockquote>
                          ),
                          // Horizontal rule
                          hr: () => <hr className="border-[#2a2a2a] my-4" />,
                          // Table
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
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start mb-6">
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
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r from-[#ff6b35] to-[#ff4500] hover:from-[#ff4500] hover:to-[#ff6b35] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
