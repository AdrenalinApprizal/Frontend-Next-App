// Shared message types for consistency across components

export interface BaseMessage {
  id: string;
  message_id?: string;
  sender_id: string;
  recipient_id?: string;
  receiver_id?: string;
  content: string;
  type?: string;
  read?: boolean;
  is_read?: boolean;
  created_at: string;
  updated_at?: string;
  timestamp?: string;
  sent_at?: string;
  delivered_at?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  conversation_id?: string;
  chat_room_id?: string;
  room_id?: string;
  sender?: {
    id: string;
    name: string;
    profile_picture_url?: string;
    avatar?: string;
  };
  recipient?: {
    id: string;
    name: string;
    profile_picture_url?: string;
  };
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
  media_url?: string;
  attachment_url?: string;
}

export interface ConversationMessage extends BaseMessage {
  isCurrentUser: boolean;
  pending?: boolean;
  sent?: boolean;
  failed?: boolean;
  retrying?: boolean;
  retryCount?: number;
  errorMessage?: string;
  fromWebSocket?: boolean;
  receivedViaWebSocket?: boolean;
  temp_id?: string;
  replacedTempMessage?: boolean;
}

export interface MessageListItem {
  id: string;
  sender: {
    name: string;
    profile_picture_url?: string;
    id?: string;
    status?: "online" | "offline";
  };
  content: string;
  timestamp: string;
  formattedTime?: string;
  readStatus?: "read" | "delivered" | "sent" | "unread";
  unreadCount?: number;
  type: "friend" | "group";
  lastActivity?: string;
  isTyping?: boolean;
  hasMessages?: boolean;
}

export interface ApiResponse<T = any> {
  data?: T[];
  messages?: T[];
  success?: boolean;
  error?: string;
  errorCode?: string;
  pagination?: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_more_pages: boolean;
  };
}

// Helper type for message API parameters
export interface MessageApiParams {
  target_id: string;
  type: "private" | "group";
  page?: number;
  limit?: number;
  before?: string;
}

// Response normalization utilities
export const normalizeApiResponse = <T>(response: any): T[] => {
  if (!response) return [];

  if (Array.isArray(response)) {
    return response;
  }

  if (response.data && Array.isArray(response.data)) {
    return response.data;
  }

  if (response.messages && Array.isArray(response.messages)) {
    return response.messages;
  }

  return [];
};

export const normalizeSingleMessage = (response: any): BaseMessage | null => {
  const messages = normalizeApiResponse<BaseMessage>(response);
  return messages.length > 0 ? messages[0] : null;
};
