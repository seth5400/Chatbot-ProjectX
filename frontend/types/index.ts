export type MessageVersion = {
  id: string;
  content: string;
  createdAt: string;
  versionNumber: number;
  isActive: boolean;
};

export type Message = {
  id?: string;
  role: "user" | "model";
  content: string;
  createdAt?: string;
  // Version tracking fields
  parentMessageId?: string;
  versionNumber?: number;
  isActive?: boolean;
  totalVersions?: number;
  versions?: MessageVersion[];
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
