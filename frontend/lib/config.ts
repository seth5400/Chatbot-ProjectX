// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export const API_ENDPOINTS = {
  CHAT: `${API_BASE_URL}/api/chat`,
  CHAT_BY_ID: (id: string) => `${API_BASE_URL}/api/chat/${id}`,
  CHAT_NEW: `${API_BASE_URL}/api/chat/new`,
};
