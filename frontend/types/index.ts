export type Message = {
  id?: string;
  role: "user" | "model";
  content: string;
  imageUrl?: string;
  createdAt?: string;
};

export type Chat = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt: string;
  messageCount?: number;
};

export type Persona = {
  id: string;
  name: string;
  icon: string;
  description: string;
  instruction: string;
};

export type AIModel = {
  id: string;
  name: string;
  description: string;
};
