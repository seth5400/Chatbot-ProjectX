"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, Chat, MessageVersion } from "@/types";

// Available AI models via LiteLLM (based on your API key access)
const AI_MODELS = [
  { id: "ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest", name: "Typhoon 2.5", description: "Thai AI Model" },
  { id: "ollama/gpt-oss:20b", name: "GPT-OSS 20B", description: "Open Source GPT Model" }
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
  const { data: session, status } = useSession();
  const router = useRouter();

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
  const [selectedModel, setSelectedModel] = useState("ollama/scb10x/typhoon2.5-qwen3-30b-a3b:latest");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [isCustomInstructionModalOpen, setIsCustomInstructionModalOpen] = useState(false);
  const [tempCustomInstruction, setTempCustomInstruction] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Helper to get auth headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }
    return headers;
  }, [session?.accessToken]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const personaDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChats = useCallback(async (search?: string) => {
    try {
      const url = search?.trim()
        ? API_ENDPOINTS.CHAT_SEARCH(search)
        : API_ENDPOINTS.CHAT;
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load chats");
      const data = await response.json();
      setChats(data || []);
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (personaDropdownRef.current && !personaDropdownRef.current.contains(event.target as Node)) {
        setIsPersonaDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const response = await fetch(API_ENDPOINTS.CHAT_BY_ID(chatId), {
        headers: getAuthHeaders(),
      });
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

  const toggleTemporaryChat = () => {
    if (isTemporary) {
      setIsTemporary(false);
    } else {
      setMessages([]);
      setCurrentChatId(null);
      setIsTemporary(true);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.CHAT_BY_ID(chatId), {
        method: "DELETE",
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleEditMessage = (index: number, content: string) => {
    setEditingIndex(index);
    setEditValue(content);
  };

  const submitEditedMessage = async () => {
    if (editingIndex === null || !editValue.trim()) return;
    const newMessages = messages.slice(0, editingIndex);
    setMessages(newMessages);
    setEditingIndex(null);
    setInput(editValue);
    setEditValue("");
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

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const regenerateResponse = async (aiMessageIndex: number) => {
    if (isLoading || !currentChatId) return;

    // Find the user message that corresponds to this AI message
    let userMessageIndex = aiMessageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== "user") {
      userMessageIndex--;
    }
    if (userMessageIndex < 0) return;

    const userMessage = messages[userMessageIndex];
    if (!userMessage.id) return;

    setIsLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Update the current AI message to show loading
    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[aiMessageIndex] = {
        ...newMessages[aiMessageIndex],
        content: "",
      };
      return newMessages;
    });

    try {
      const systemInstruction = getCurrentSystemInstruction();
      const response = await fetch(API_ENDPOINTS.REGENERATE(currentChatId), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userMessageId: userMessage.id,
          modelId: selectedModel,
          systemInstruction: systemInstruction || undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let newMessageId = "";
      let newVersionNumber = 1;
      let totalVersions = 1;

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

                if (data.Type === "chunk" && data.Text) {
                  fullText += data.Text;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[aiMessageIndex] = {
                      ...newMessages[aiMessageIndex],
                      content: fullText,
                    };
                    return newMessages;
                  });
                } else if (data.Type === "version_info") {
                  newMessageId = data.MessageId;
                  newVersionNumber = data.VersionNumber;
                  totalVersions = data.TotalVersions;
                }
              } catch (e) {
                console.error("Parse error:", e);
              }
            }
          }
        }
      }

      // Update message with version info
      setMessages((prev) => {
        const newMessages = [...prev];
        const oldVersions = newMessages[aiMessageIndex].versions || [];

        // Create the new version
        const newVersion: MessageVersion = {
          id: newMessageId,
          content: fullText,
          createdAt: new Date().toISOString(),
          versionNumber: newVersionNumber,
          isActive: true,
        };

        // Mark old versions as not active
        const updatedVersions = oldVersions.map(v => ({ ...v, isActive: false }));
        updatedVersions.push(newVersion);

        newMessages[aiMessageIndex] = {
          ...newMessages[aiMessageIndex],
          id: newMessageId,
          content: fullText,
          versionNumber: newVersionNumber,
          totalVersions: totalVersions,
          versions: updatedVersions,
          isActive: true,
        };
        return newMessages;
      });

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Regenerate was aborted");
        return;
      }
      console.error("Regenerate Error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[aiMessageIndex] = {
          ...newMessages[aiMessageIndex],
          content: "ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const switchVersion = async (aiMessageIndex: number, targetVersion: MessageVersion) => {
    if (!currentChatId || isLoading) return;

    try {
      const response = await fetch(API_ENDPOINTS.SWITCH_VERSION(currentChatId), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messageId: targetVersion.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to switch version");
      }

      // Update local state
      setMessages((prev) => {
        const newMessages = [...prev];
        const currentMessage = newMessages[aiMessageIndex];

        const updatedVersions = currentMessage.versions?.map(v => ({
          ...v,
          isActive: v.id === targetVersion.id,
        }));

        newMessages[aiMessageIndex] = {
          ...currentMessage,
          id: targetVersion.id,
          content: targetVersion.content,
          versionNumber: targetVersion.versionNumber,
          isActive: true,
          versions: updatedVersions,
        };
        return newMessages;
      });
    } catch (error) {
      console.error("Switch version error:", error);
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

    setMessages((prev) => [...prev, userMessage, { role: "model", content: "" }]);
    const botMessageIndex = messages.length + 1;
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const systemInstruction = getCurrentSystemInstruction();
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: currentInput,
          chatId: currentChatId,
          temporary: isTemporary,
          modelId: selectedModel,
          systemInstruction: systemInstruction || undefined,
          history: isTemporary ? messages : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

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
                } else if (data.Type === "message_ids") {
                  // Update messages with their IDs for regenerate functionality
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    // Update user message ID
                    if (data.UserMessageId && newMessages[botMessageIndex - 1]) {
                      newMessages[botMessageIndex - 1] = {
                        ...newMessages[botMessageIndex - 1],
                        id: data.UserMessageId,
                      };
                    }
                    // Update bot message ID and set up initial version
                    if (data.BotMessageId && newMessages[botMessageIndex]) {
                      newMessages[botMessageIndex] = {
                        ...newMessages[botMessageIndex],
                        id: data.BotMessageId,
                        parentMessageId: data.UserMessageId,
                        versionNumber: 1,
                        totalVersions: 1,
                        isActive: true,
                        versions: [{
                          id: data.BotMessageId,
                          content: newMessages[botMessageIndex].content,
                          createdAt: new Date().toISOString(),
                          versionNumber: 1,
                          isActive: true,
                        }],
                      };
                    }
                    return newMessages;
                  });
                } else if (data.Type === "done") {
                  loadChats();
                }
              } catch (e) {
                console.error("Parse error:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request was aborted");
        return;
      }

      console.error("Chat Error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[botMessageIndex] = {
          role: "model",
          content: "ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Show loading screen while checking auth
  if (status === "loading") {
    return (
      <div className="flex h-screen bg-[#0f0f0f] text-white items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mb-4 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white overflow-hidden">
      {/* Sidebar - Minimal & Compact */}
      <aside
        className={`${
          isSidebarOpen ? "w-60" : "w-0"
        } bg-[#161616] flex flex-col transition-all duration-300 overflow-hidden border-r border-[#222]`}
      >
        {/* Sidebar Header - Compact */}
        <div className="p-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="font-medium text-sm text-white">Chatbot AI</span>
        </div>

        {/* New Chat Button - Smaller */}
        <div className="px-3 pb-2">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-medium transition-colors text-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            แชทใหม่
          </button>
        </div>

        {/* Search - Compact */}
        <div className="px-3 pb-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Chat List - Compact */}
        <div className="flex-1 overflow-y-auto scrollbar-custom px-2">
          {chats.length > 0 && !searchQuery && (
            <div className="px-2 py-1.5 text-[10px] text-gray-500 font-medium uppercase">ประวัติ</div>
          )}

          {chats.length === 0 && searchQuery && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-xs">ไม่พบผลลัพธ์</p>
            </div>
          )}

          {chats.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-xs">ยังไม่มีแชท</p>
            </div>
          )}

          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex items-center gap-2 px-2 py-2 mb-0.5 rounded-lg cursor-pointer transition-colors ${
                currentChatId === chat.id
                  ? "bg-orange-500/15 text-orange-100"
                  : "hover:bg-[#1e1e1e] text-gray-300"
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
                  className="flex-1 bg-[#1e1e1e] border border-orange-500 rounded px-2 py-1 text-xs focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{chat.title}</div>
                  </div>
                  <button
                    className={`flex-shrink-0 p-1 rounded transition-opacity ${
                      menuOpenId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                    }}
                  >
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {menuOpenId === chat.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl z-50 w-32 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#252525] flex items-center gap-2"
                        onClick={() => {
                          setIsRenaming(chat.id);
                          setRenameValue(chat.title);
                          setMenuOpenId(null);
                        }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        เปลี่ยนชื่อ
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-[#252525] flex items-center gap-2"
                        onClick={() => deleteChat(chat.id)}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ลบ
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Footer - User Info & Settings */}
        <div className="p-2 border-t border-[#222]">
          {/* User Info */}
          {session?.user && (
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-medium">
                {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{session.user.name || session.user.email}</div>
                {session.user.name && session.user.email && (
                  <div className="text-[10px] text-gray-500 truncate">{session.user.email}</div>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors"
                title="ออกจากระบบ"
              >
                <svg className="w-4 h-4 text-gray-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#1e1e1e] rounded-lg text-xs transition-colors group"
          >
            <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-gray-400 group-hover:text-white">ตั้งค่า</span>
            {(selectedPersona || customInstruction) && (
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full ml-auto"></span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-[#0f0f0f]">
        {/* Header - Minimal & Friendly */}
        <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-base font-medium text-white">Chatbot AI</span>
            {isTemporary && (
              <span className="px-2 py-1 text-xs bg-orange-500/15 text-orange-400 rounded-md font-medium">
                ชั่วคราว
              </span>
            )}
          </div>

          <button
            onClick={toggleTemporaryChat}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isTemporary
                ? "bg-orange-500/15 text-orange-400"
                : "hover:bg-[#1a1a1a] text-gray-400 hover:text-white"
            }`}
            title="แชทชั่วคราว"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">แชทชั่วคราว</span>
          </button>
        </header>

        {/* Messages */}
        <div className={`${messages.length === 0 ? 'hidden' : 'flex-1 overflow-y-auto scrollbar-custom'}`}>
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              null
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {editingIndex === index && msg.role === "user" ? (
                    <div className="w-full max-w-lg ml-auto">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full p-4 bg-[#1a1a1a] border border-orange-500/50 rounded-2xl text-white text-sm resize-none focus:outline-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                          ยกเลิก
                        </button>
                        <button onClick={submitEditedMessage} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl">
                          ส่งใหม่
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`group relative ${msg.role === "user" ? "max-w-lg" : "w-full"}`}>
                      {msg.role === "user" ? (
                        <div className="bg-orange-500 text-white px-5 py-3 rounded-2xl rounded-br-md shadow-md">
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-3 text-white">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-white">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-2 text-white">{children}</h3>,
                                  p: ({ children }) => <p className="mb-3 last:mb-0 text-gray-300">{children}</p>,
                                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-gray-400">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-gray-300">{children}</li>,
                                  code: ({ className, children }) => {
                                    const isInline = !className;
                                    return isInline ? (
                                      <code className="bg-[#252525] text-orange-400 px-2 py-1 rounded text-sm font-mono">
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block bg-[#0f0f0f] text-gray-300 p-4 rounded-xl text-sm font-mono overflow-x-auto my-3 border border-[#252525]">
                                        {children}
                                      </code>
                                    );
                                  },
                                  pre: ({ children }) => <pre className="bg-[#0f0f0f] rounded-xl overflow-x-auto my-3">{children}</pre>,
                                  a: ({ href, children }) => (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
                                      {children}
                                    </a>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-3 border-orange-500 pl-4 my-3 text-gray-400 italic">
                                      {children}
                                    </blockquote>
                                  ),
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        className={`flex gap-1 mt-2 transition-opacity ${
                          msg.role === "user" ? "justify-end" : "ml-13"
                        } ${hoveredIndex === index && !isLoading ? "opacity-100" : "opacity-0"}`}
                      >
                        <button
                          onClick={() => copyToClipboard(msg.content, index)}
                          className="p-1.5 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                          title="คัดลอก"
                        >
                          {copiedIndex === index ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>

                        {msg.role === "user" && (
                          <button
                            onClick={() => handleEditMessage(index, msg.content)}
                            className="p-1.5 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}

                        {msg.role === "model" && (
                          <>
                            {/* Version Switcher */}
                            {msg.versions && msg.versions.length > 1 && (
                              <div className="flex items-center gap-1 px-1">
                                <button
                                  onClick={() => {
                                    const currentIdx = msg.versions!.findIndex(v => v.isActive);
                                    if (currentIdx > 0) {
                                      switchVersion(index, msg.versions![currentIdx - 1]);
                                    }
                                  }}
                                  disabled={(msg.versions.findIndex(v => v.isActive) || 0) === 0}
                                  className="p-1 hover:bg-[#1a1a1a] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="คำตอบก่อนหน้า"
                                >
                                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                                <span className="text-xs text-gray-500 min-w-[40px] text-center">
                                  {(msg.versions.findIndex(v => v.isActive) || 0) + 1}/{msg.versions.length}
                                </span>
                                <button
                                  onClick={() => {
                                    const currentIdx = msg.versions!.findIndex(v => v.isActive);
                                    if (currentIdx < msg.versions!.length - 1) {
                                      switchVersion(index, msg.versions![currentIdx + 1]);
                                    }
                                  }}
                                  disabled={(msg.versions.findIndex(v => v.isActive) || 0) === msg.versions.length - 1}
                                  className="p-1 hover:bg-[#1a1a1a] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="คำตอบถัดไป"
                                >
                                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            <button
                              onClick={() => regenerateResponse(index)}
                              className="p-1.5 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                              title="ตอบใหม่"
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-4 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 pt-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></div>
                  <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Center when empty, bottom when chatting */}
        <div className={`transition-all duration-300 ${messages.length === 0 ? 'flex-1 flex flex-col items-center justify-center px-4' : 'p-4 pb-6'}`}>
          {/* Welcome message - only show when no messages */}
          {messages.length === 0 && (
            <div className="text-center mb-6">
              <div className="w-16 h-16 mb-5 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              {isTemporary ? (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-2">แชทชั่วคราว</h1>
                  <p className="text-gray-400 text-sm">คุยได้เลย แชทนี้จะหายไปเมื่อปิดหน้านี้หรือเริ่มแชทใหม่</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-2">มีอะไรให้ช่วยไหม?</h1>
                  <p className="text-gray-400 text-sm">ถามอะไรก็ได้ ช่วยเขียนโค้ด หรือแค่อยากคุยเล่น</p>
                </>
              )}
            </div>
          )}

          <form onSubmit={sendMessage} className={`w-full ${messages.length === 0 ? 'max-w-2xl' : 'max-w-3xl mx-auto'}`}>
            <div className={`bg-[#1a1a1a] rounded-xl border ${input.trim() ? 'border-orange-500/40' : 'border-[#2a2a2a]'} transition-all`}>
              <div className="flex items-end gap-2 p-3">
                {/* Persona selector - at the front */}
                <div className="relative flex-shrink-0" ref={personaDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                    className={`p-1.5 rounded-lg text-base transition-colors ${
                      selectedPersona || customInstruction
                        ? "bg-orange-500/15 hover:bg-orange-500/25"
                        : "hover:bg-[#252525]"
                    }`}
                    title={customInstruction ? "กำหนดเอง" : (selectedPersona ? PERSONAS.find(p => p.id === selectedPersona)?.name : "เลือกบุคลิก AI")}
                  >
                    {customInstruction ? "✏️" : (PERSONAS.find(p => p.id === selectedPersona)?.icon || "🤖")}
                  </button>

                  {isPersonaDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl z-50 w-48 overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2a2a2a]">
                        <span className="text-xs text-gray-500">เลือกบุคลิก AI</span>
                      </div>
                      {PERSONAS.map((persona) => (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => {
                            setSelectedPersona(persona.id === "default" ? null : persona.id);
                            setCustomInstruction("");
                            setIsPersonaDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                            (selectedPersona === persona.id || (!selectedPersona && !customInstruction && persona.id === "default"))
                              ? "bg-orange-500/15 text-orange-100"
                              : "hover:bg-[#252525] text-gray-300"
                          }`}
                        >
                          <span className="text-base">{persona.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{persona.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{persona.description}</div>
                          </div>
                          {(selectedPersona === persona.id || (!selectedPersona && !customInstruction && persona.id === "default")) && (
                            <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                      {/* Custom instruction option */}
                      <div className="border-t border-[#2a2a2a]">
                        <button
                          type="button"
                          onClick={() => {
                            setTempCustomInstruction(customInstruction);
                            setIsCustomInstructionModalOpen(true);
                            setIsPersonaDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                            customInstruction
                              ? "bg-orange-500/15 text-orange-100"
                              : "hover:bg-[#252525] text-gray-300"
                          }`}
                        >
                          <span className="text-base">✏️</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">กำหนดเอง</div>
                            <div className="text-[10px] text-gray-500 truncate">
                              {customInstruction ? "มีคำสั่งที่ตั้งไว้" : "เขียนคำสั่งของคุณเอง"}
                            </div>
                          </div>
                          {customInstruction && (
                            <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="พิมพ์อะไรก็ได้..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none resize-none py-1.5"
                  style={{ minHeight: '24px', maxHeight: '120px' }}
                />

                {/* Model selector */}
                <div className="relative flex-shrink-0" ref={modelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors"
                    title={AI_MODELS.find(m => m.id === selectedModel)?.name || "Model"}
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {isModelDropdownOpen && (
                    <div className="absolute bottom-full right-0 mb-2 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl z-50 w-52 overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2a2a2a]">
                        <span className="text-xs text-gray-500">เลือกโมเดล AI</span>
                      </div>
                      {AI_MODELS.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                            selectedModel === model.id
                              ? "bg-orange-500/15 text-orange-100"
                              : "hover:bg-[#252525] text-gray-300"
                          }`}
                        >
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{model.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">{model.description}</div>
                          </div>
                          {selectedModel === model.id && (
                            <svg className="w-3 h-3 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send/Stop button */}
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    className="flex-shrink-0 p-2 bg-[#252525] hover:bg-[#303030] text-white rounded-lg transition-colors"
                    title="หยุด"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <rect x="6" y="6" width="8" height="8" rx="1" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                      input.trim()
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-[#252525] text-gray-600 cursor-not-allowed'
                    }`}
                    title="ส่ง"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Settings Modal - Simplified */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-base font-medium text-white">ตั้งค่า</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#252525] flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-white mb-2">Coming Soon</h3>
              <p className="text-xs text-gray-500">ฟีเจอร์การตั้งค่าเพิ่มเติมกำลังพัฒนา</p>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#252525]">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Instruction Modal */}
      {isCustomInstructionModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#252525] rounded-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#252525] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <span className="text-base font-medium text-white">คำสั่งกำหนดเอง</span>
              </div>
              <button
                onClick={() => setIsCustomInstructionModalOpen(false)}
                className="p-1.5 hover:bg-[#252525] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">
                เขียนคำสั่งเพื่อกำหนดพฤติกรรมของ AI ตามที่คุณต้องการ
              </p>
              <textarea
                value={tempCustomInstruction}
                onChange={(e) => setTempCustomInstruction(e.target.value)}
                placeholder="เช่น: คุณคือผู้เชี่ยวชาญด้านการเงิน ตอบคำถามเกี่ยวกับการลงทุนอย่างละเอียด..."
                className="w-full h-32 p-3 bg-[#0f0f0f] border border-[#252525] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
                autoFocus
              />
              <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                <span>{tempCustomInstruction.length} ตัวอักษร</span>
                {tempCustomInstruction && (
                  <button
                    onClick={() => setTempCustomInstruction("")}
                    className="text-red-400 hover:text-red-300"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#252525] flex gap-2">
              <button
                onClick={() => setIsCustomInstructionModalOpen(false)}
                className="flex-1 py-2 bg-[#252525] hover:bg-[#303030] text-white rounded-lg text-sm font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setCustomInstruction(tempCustomInstruction);
                  if (tempCustomInstruction.trim()) {
                    setSelectedPersona(null);
                  }
                  setIsCustomInstructionModalOpen(false);
                }}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
