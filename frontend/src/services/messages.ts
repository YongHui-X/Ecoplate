import { api } from "./api";

export interface Message {
  id: number;
  conversationId: number;
  userId: number;
  messageText: string;
  isRead: boolean;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

export interface ConversationListing {
  id: number;
  title: string;
  price: number | null;
  images: string | null;
  status: string;
}

export interface Conversation {
  id: number;
  listingId: number;
  listing: ConversationListing;
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  buyer: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  role: "buying" | "selling";
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationDetail {
  id: number;
  listingId: number;
  listing: ConversationListing;
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  buyer: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  role: "buying" | "selling";
  messages: Message[];
}

export interface ConversationInfo {
  id: number;
  listingId: number;
  listing: {
    id: number;
    title: string;
  };
  seller: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  buyer: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

export type ConversationTab = "all" | "buying" | "selling" | "archived";

export const messageService = {
  async getConversations(): Promise<Conversation[]> {
    return api.get<Conversation[]>("/marketplace/conversations");
  },

  async getConversation(conversationId: number): Promise<ConversationDetail> {
    return api.get<ConversationDetail>(
      `/marketplace/conversations/${conversationId}`
    );
  },

  async getOrCreateConversationForListing(
    listingId: number
  ): Promise<ConversationInfo> {
    return api.get<ConversationInfo>(
      `/marketplace/conversations/listing/${listingId}`
    );
  },

  async sendMessage(
    conversationId: number,
    messageText: string
  ): Promise<Message> {
    return api.post<Message>("/marketplace/messages", {
      conversationId,
      messageText,
    });
  },

  async sendMessageToListing(
    listingId: number,
    messageText: string
  ): Promise<Message> {
    return api.post<Message>("/marketplace/messages", {
      listingId,
      messageText,
    });
  },

  async markAsRead(conversationId: number): Promise<void> {
    await api.patch("/marketplace/messages/read", { conversationId });
  },

  async getUnreadCount(): Promise<{ count: number }> {
    return api.get<{ count: number }>("/marketplace/messages/unread-count");
  },
};
