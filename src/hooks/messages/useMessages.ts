import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useFiles } from "../files/useFiles";

/**
 * Messages Hook
 *
 * This hook provides functionality for interacting with message-related API endpoints.
 * All implementations follow the Swagger API specification for consistency.
 *
 * Key features:
 * - Robust error handling with fallbacks to prevent UI crashes
 * - Multiple endpoint format support for maximum compatibility
 * - Automatic retries with different HTTP methods where appropriate
 * - Comprehensive logging for debugging
 */

// Define Message types
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  type: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  conversation_id?: string;
  timestamp?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  sender?: {
    id: string;
    name: string;
    profile_picture_url?: string;
  };
  recipient?: {
    id: string;
    name: string;
    profile_picture_url?: string;
  };
  media_url?: string;
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
}

// Updated interface for SearchMessagesParams
export interface SearchMessagesParams {
  q: string;
  chatId: string;
  type: "user" | "group";
  limit?: number;
  offset?: number;
}

// Message history request params
export interface MessageHistoryParams {
  type: "private" | "group";
  target_id: string;
  limit?: number;
  before?: string;
  _retryCount?: number; // Track retry attempts to prevent infinite loops
}

// New message request interface
export interface SendMessageRequest {
  content: string;
  receiver_id?: string;
  group_id?: string;
  type?: string;
  attachment_url?: string;
}

// Pagination interface
export interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_more_pages: boolean;
}

// Define API response
export interface ApiResponse {
  message?: string;
  data?: any;
  messages?: any[]; // Add messages property to support message history responses
  pagination?: Pagination;
  error?: string;
  success?: boolean;
  count?: number; // Added count for unread messages count endpoint
  _throttled?: boolean; // Added for throttling detection in request handlers
}

// Interface for file upload response
export interface FileUploadResponse {
  id?: string;
  url?: string;
  file_url?: string;
  name?: string;
  size?: string | number;
  type?: string;
  content_type?: string;
  [key: string]: any; // Allow for any other properties that might come back
}

export interface MessageRequest {
  content?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  receiver_id?: string;
  group_id?: string;
  type?: string;
}

export interface MediaUploadRequest {
  file_url: string;
  media_type: string;
  related_to: string;
}

export const useMessages = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination state
  const [messagesPagination, setMessagesPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });

  // Using the useFiles hook for file operations
  const fileService = useFiles();

  // Base URL for API proxy
  const proxyUrl = "/api/proxy";

  // Helper function for API calls
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    try {
      const defaultOptions: RequestInit = {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      };

      // Add authorization header if session has access_token
      if (session?.access_token) {
        defaultOptions.headers = {
          ...defaultOptions.headers,
          Authorization: `Bearer ${session.access_token}`,
        };
      }

      // Normalize endpoint to ensure no double slashes in URL
      const normalizedEndpoint = endpoint.startsWith("/")
        ? endpoint.substring(1)
        : endpoint;

      // Merge default options with provided options
      const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
      };

      // Add extra logging for message history requests to debug 405 errors
      if (
        endpoint.includes("messages") &&
        (endpoint.includes("history") ||
          endpoint.includes("private") ||
          endpoint.includes("group"))
      ) {
        console.log(
          `[Messages] Making ${
            mergedOptions.method || "GET"
          } request to: ${normalizedEndpoint}`
        );
        if (mergedOptions.body) {
          console.log(`[Messages] Request body: ${mergedOptions.body}`);
        }
      }

      // Delete Content-Type header for FormData requests
      if (options.body instanceof FormData) {
        const headers = mergedOptions.headers as Record<string, string>;
        delete headers["Content-Type"];
      }

      // Construct full URL
      const fullUrl = `${proxyUrl}/${normalizedEndpoint}`;

      // Enhanced logging for all requests
      console.log(`[Messages] Making API call to: ${fullUrl}`);
      if (
        endpoint.includes("messages/history") ||
        endpoint.includes("messages") ||
        options.method !== "GET"
      ) {
        console.log(`[Messages] Request options:`, {
          method: mergedOptions.method || "GET",
          headers: Object.keys(mergedOptions.headers).reduce((acc, key) => {
            acc[key] =
              key.toLowerCase() === "authorization"
                ? "[REDACTED]"
                : (mergedOptions.headers as any)[key];
            return acc;
          }, {} as Record<string, string>),
          bodyType: options.body ? typeof options.body : "none",
        });
      }

      // Make the request with a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(fullUrl, {
        ...mergedOptions,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      // Handle different response formats
      if (!response.ok) {
        const text = await response.text();
        console.error(
          `[Messages] API error for ${endpoint}: Status ${response.status}, Response:`,
          text
        );

        // For message history and direct message access, provide fallback data for certain errors
        if (
          (endpoint.includes("messages/history") ||
            endpoint.match(/^messages\/[0-9a-f-]{36}$/)) &&
          (response.status === 404 || response.status === 500)
        ) {
          console.log(
            `[Messages] Returning fallback data for ${response.status} error on ${endpoint}`
          );
          return {
            data: [],
            messages: [],
            success: response.status === 404, // Only mark as success for 404 (empty results), not 500 (server error)
            error:
              response.status === 500 ? "Server error occurred" : undefined,
            pagination: {
              current_page: 1,
              total_pages: 1,
              total_items: 0,
              items_per_page: 20,
              has_more_pages: false,
            },
          };
        }

        try {
          const errorData = JSON.parse(text);
          throw new Error(
            errorData.message ||
              errorData.error ||
              (typeof errorData === "string" ? errorData : "") ||
              `API error: ${response.status}`
          );
        } catch (e) {
          throw new Error(text || `API error: ${response.status}`);
        }
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const jsonData = await response.json();
        return jsonData;
      }

      return await response.text();
    } catch (err: any) {
      console.error(`[Messages] API call failed for ${endpoint}:`, err);

      // Provide fallback for critical endpoints to prevent UI crashes
      if (endpoint.includes("messages/history")) {
        console.warn(
          "[Messages] Returning fallback data for failed message history request"
        );
        return {
          data: [],
          messages: [],
          success: false,
          pagination: {
            current_page: 1,
            total_pages: 1,
            total_items: 0,
            items_per_page: 20,
            has_more_pages: false,
          },
          error: err?.toString() || "Unknown error",
        };
      }

      throw err;
    }
  };

  // Track request timestamps to avoid overlapping requests for the same user
  const requestTimestamps = useRef<{ [userId: string]: number }>({});

  /**
   * Get messages with a specific user
   */
  const getMessages = async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    // Avoid concurrent/overlapping requests for the same user
    const now = Date.now();
    const lastRequest = requestTimestamps.current[userId] || 0;
    const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests for the same user

    if (now - lastRequest < MIN_REQUEST_INTERVAL) {
      console.log(
        `[Messages] Throttling request for ${userId}, too soon after previous request (${
          now - lastRequest
        }ms)`
      );
      return {
        data: messages, // Return current messages from state
        messages: messages,
        success: true,
        _throttled: true,
      };
    }

    // Update timestamp
    requestTimestamps.current[userId] = now;

    setLoading(true);
    setError(null);

    try {
      // Try both GET and POST approaches for maximum compatibility
      const methods = ["GET", "POST"];
      let lastError = null;

      for (const method of methods) {
        try {
          console.log(`[Messages] Attempting to get messages with ${method}`);

          let response;
          if (method === "GET") {
            response = await apiCall(
              `messages?userId=${userId}&page=${page}&limit=${limit}`
            );
          } else {
            response = await apiCall("messages", {
              method: "POST",
              body: JSON.stringify({
                userId,
                page,
                limit,
              }),
            });
          }

          console.log(`[Messages] ${method} request successful:`, response);

          if (page === 1 || page <= 0) {
            setMessages(response.data || response.messages || []);
          } else {
            // For pagination, append older messages
            setMessages((prevMessages) => [
              ...(response.data || response.messages || []),
              ...prevMessages,
            ]);
          }

          // Update pagination info
          if (response.pagination) {
            setMessagesPagination(response.pagination);
          }

          setLoading(false);
          return response;
        } catch (err: any) {
          console.warn(`[Messages] ${method} request failed:`, err);
          lastError = err;

          // If method is GET, try POST next
          if (method === "GET") {
            continue;
          }
        }
      }

      // If we get here, both methods failed
      setError(
        `Failed to fetch messages: ${lastError?.message || "Unknown error"}`
      );
      console.error(
        `[Messages] Error fetching messages with user ${userId}:`,
        lastError
      );
      setLoading(false);

      // Return a fallback response instead of throwing to prevent UI breakage
      return {
        data: [],
        messages: [],
        success: false,
        error: lastError?.message || "Failed to fetch messages",
      };
    } catch (err: any) {
      setError(`Failed to fetch messages: ${err.message}`);
      console.error(
        `[Messages] Error fetching messages with user ${userId}:`,
        err
      );
      setLoading(false);

      // Return a fallback response instead of throwing
      return {
        data: [],
        messages: [],
        success: false,
        error: err.message || "Failed to fetch messages",
      };
    }
  };

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = async (
    userId: string
  ): Promise<ApiResponse | null> => {
    if (messagesPagination.has_more_pages) {
      const nextPage = messagesPagination.current_page + 1;
      return getMessages(userId, nextPage);
    }
    return null;
  };

  /**
   * Get chat conversations for the current user
   * Consistent with Swagger API endpoint: GET /messages/conversations
   */
  const getConversations = async (): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("messages/conversations");
      // Standardize the response handling to use data property first, then fall back to the entire response
      setConversations(response.data || response);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to get conversations: ${err.message}`);
      console.error("[Messages] Error fetching conversations:", err);
      setLoading(false);

      // Return a fallback response for consistency
      return {
        data: [],
        success: false,
        error: err.message || "Failed to fetch conversations",
      };
    }
  };

  /**
   * Send a message to a user with improved error handling and multiple endpoint fallbacks
   * Consistent with Swagger API endpoint: POST /messages or POST /messages/send
   */
  const sendMessage = async (
    recipientId: string,
    content: string,
    type = "text"
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    // Try multiple endpoints in case one fails - ordered by preference according to Swagger
    const endpoints = [
      "messages", // Primary endpoint per Swagger
      "messages/send", // Fallback endpoint
    ];

    let lastError = null;

    // Log the attempt
    console.log(`[Messages] Attempting to send message to ${recipientId}`);

    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.log(`[Messages] Trying to send message via ${endpoint}`);

        // Standardize on receiver_id for consistency with API specs
        const payload = {
          receiver_id: recipientId,
          content,
          type,
        };

        const response = await apiCall(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        console.log(`[Messages] Message sent successfully via ${endpoint}`);
        setLoading(false);
        return response;
      } catch (err: any) {
        console.warn(`[Messages] Failed to send message via ${endpoint}:`, err);
        lastError = err;
      }
    }

    // All endpoints failed
    const errorMessage = lastError?.message || "Unknown error";
    setError(`Failed to send message: ${errorMessage}`);
    console.error(
      `[Messages] Error sending message to user ${recipientId}:`,
      lastError
    );
    setLoading(false);

    throw (
      lastError ||
      new Error("Failed to send message through all available endpoints")
    );
  };

  /**
   * Send a message to a friend
   */
  const sendMessageToFriend = async (friendId: string, content: string) => {
    return sendMessage(friendId, content);
  };

  /**
   * Send a message to a group
   * Consistent with Swagger API endpoint: POST /messages/group/{groupId}
   */
  const sendMessageToGroup = async (
    groupId: string,
    content: string,
    type = "text"
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Follow Swagger endpoint specification
      const response = await apiCall(`messages/group/${groupId}`, {
        method: "POST",
        body: JSON.stringify({
          content,
          type,
          // Add group_id to match request schema for consistency
          group_id: groupId,
        }),
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send group message: ${err.message}`);
      console.error(
        `[Messages] Error sending message to group ${groupId}:`,
        err
      );
      setLoading(false);

      // Return error response instead of throwing for consistency with other methods
      throw err;
    }
  };

  /**
   * Edit a message
   */
  const editMessage = async (
    messageId: string,
    content: string
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`messages/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
        }),
      });

      // Update the message in our local state
      setMessages(
        messages.map((message) => {
          if (message.id === messageId) {
            return {
              ...message,
              content,
              updated_at: new Date().toISOString(),
              is_edited: true,
            };
          }
          return message;
        })
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to edit message: ${err.message}`);
      console.error(`Error editing message ${messageId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Delete a message
   */
  const deleteMessage = async (messageId: string): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`messages/${messageId}`, {
        method: "DELETE",
      });

      // Update the message in our local state
      setMessages(
        messages.map((message) => {
          if (message.id === messageId) {
            return {
              ...message,
              content: "This message has been deleted",
              is_deleted: true,
            };
          }
          return message;
        })
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to delete message: ${err.message}`);
      console.error(`Error deleting message ${messageId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Mark messages as read
   */
  const markMessagesAsRead = async (
    messageIds: string[]
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall("messages/read", {
        method: "PUT",
        body: JSON.stringify({
          message_ids: messageIds,
        }),
      });

      // Update messages in our local state
      setMessages(
        messages.map((message) => {
          if (messageIds.includes(message.id)) {
            return { ...message, read: true };
          }
          return message;
        })
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to mark messages as read: ${err.message}`);
      console.error("Error marking messages as read:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Mark a single message as read
   */
  const markAsRead = async (messageId: string) => {
    return markMessagesAsRead([messageId]);
  };

  /**
   * Send a message with media attachment
   */
  const sendMessageWithMedia = async (
    recipientId: string,
    content: string,
    type: string,
    mediaFile: File,
    isGroup: boolean = false
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append(isGroup ? "group_id" : "recipient_id", recipientId);
      formData.append("content", content);
      formData.append("type", type);
      formData.append("media", mediaFile);

      const response = await apiCall("messages/media", {
        method: "POST",
        body: formData,
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send message with media: ${err.message}`);
      console.error(`Error sending message with media:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Search messages in a chat by query text
   * Consistent with Swagger API endpoint: GET /messages/search
   */
  const searchMessages = async (
    params: SearchMessagesParams
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { q, chatId, type, limit = 20, offset = 0 } = params;
      const queryString = new URLSearchParams({
        q,
        chatId,
        type,
        limit: limit.toString(),
        offset: offset.toString(),
      }).toString();

      console.log(`[Messages] Searching messages with query: ${q}`);
      const response = await apiCall(`messages/search?${queryString}`);

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to search messages: ${err.message}`);
      console.error("[Messages] Error searching messages:", err);
      setLoading(false);

      // Return a fallback response instead of throwing for consistency
      return {
        data: [],
        messages: [],
        success: false,
        error: err.message || "Failed to search messages",
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: 20,
          has_more_pages: false,
        },
      };
    }
  };

  /**
   * Get message history for a private conversation or group
   */
  const getMessageHistory = async (
    params: MessageHistoryParams
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { type, target_id, limit = 20, before, _retryCount = 0 } = params;

      // Log the parameters for debugging
      console.log("[Messages] GetMessageHistory parameters:", {
        type,
        target_id,
        limit,
        before,
        _retryCount,
      });

      // Set initial empty state if no messages loaded yet
      if (messages.length === 0) {
        console.log("[Messages] Setting initial empty state while loading");
      }

      // Try multiple endpoint formats to handle different API implementations
      // If we're retrying, prioritize different formats based on retry count
      const endpoints =
        _retryCount > 0
          ? [
              // On retry, prioritize POST methods first
              // Format 4: POST to history endpoint (moved up for retries)
              {
                url: `messages/history`,
                method: "POST",
                body: {
                  type,
                  target_id,
                  limit,
                  ...(before ? { before } : {}),
                },
              },

              // Format 5: POST to RESTful format (moved up for retries)
              {
                url: `messages/${type}/${target_id}/history`,
                method: "POST",
                body: {
                  limit,
                  ...(before ? { before } : {}),
                },
              },

              // Format 1: RESTful format
              {
                url: `messages/${type}/${target_id}/history${
                  before
                    ? `?before=${before}&limit=${limit}`
                    : `?limit=${limit}`
                }${_retryCount ? `&_retryCount=${_retryCount}` : ""}`,
                method: "GET",
              },
            ]
          : [
              // Standard order for first attempts
              // Format 1: RESTful format
              {
                url: `messages/${type}/${target_id}/history${
                  before
                    ? `?before=${before}&limit=${limit}`
                    : `?limit=${limit}`
                }`,
                method: "GET",
              },

              // Format 2: Traditional query params
              {
                url: `messages/history?type=${encodeURIComponent(
                  type
                )}&target_id=${encodeURIComponent(target_id)}&limit=${limit}${
                  before ? `&before=${encodeURIComponent(before)}` : ""
                }`,
                method: "GET",
              },

              // Format 3: Alternative path format
              {
                url: `messages/history/${type}/${target_id}${
                  before
                    ? `?before=${before}&limit=${limit}`
                    : `?limit=${limit}`
                }`,
                method: "GET",
              },

              // Format 4: POST to history endpoint
              {
                url: `messages/history`,
                method: "POST",
                body: {
                  type,
                  target_id,
                  limit,
                  ...(before ? { before } : {}),
                },
              },

              // Format 5: POST to RESTful format
              {
                url: `messages/${type}/${target_id}/history`,
                method: "POST",
                body: {
                  limit,
                  ...(before ? { before } : {}),
                },
              },
            ];

      let lastError = null;

      // Try each endpoint until one works
      for (const endpoint of endpoints) {
        try {
          console.log(
            `[Messages] Trying endpoint: ${endpoint.url} with method ${endpoint.method}`
          );

          const options: RequestInit =
            endpoint.method === "POST"
              ? {
                  method: "POST",
                  body: JSON.stringify(endpoint.body),
                }
              : {};

          const response = await apiCall(endpoint.url, options);

          // Process messages from response
          const messages =
            response.data?.messages || response.messages || response.data || [];
          console.log(
            `[Messages] Got ${messages.length} messages from endpoint ${endpoint.url}`
          );

          // Update state with messages
          if (!before) {
            setMessages(messages);
          } else {
            setMessages((prevMessages) => [...messages, ...prevMessages]);
          }

          setLoading(false);
          return response;
        } catch (error) {
          console.warn(`[Messages] Endpoint ${endpoint} failed:`, error);
          lastError = error;
        }
      }

      // If we get here, all endpoints failed
      console.error(
        "[Messages] All endpoints failed for message history:",
        lastError
      );

      // For critical UI components, return an empty array instead of throwing
      console.warn("[Messages] Returning empty messages array as fallback");
      setMessages([]);
      setLoading(false);

      // Return a valid response structure to prevent UI errors
      return {
        messages: [],
        data: [],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: 20,
          has_more_pages: false,
        },
        error: lastError
          ? lastError.toString()
          : "Failed to fetch messages history",
        success: false,
      };
    } catch (err: any) {
      const errorMsg = err.message || "Unknown error";
      setError(`Failed to get message history: ${errorMsg}`);
      console.error(`[Messages] Error getting message history:`, err);

      // Log more details about the error for debugging
      if (err.response) {
        console.error("[Messages] Error response:", err.response);
      }
      if (err.request) {
        console.error("[Messages] Error request:", err.request);
      }

      // Log the parameters that caused the error for debugging
      console.error("[Messages] Failed request parameters:", params);

      setLoading(false);

      // Return a fallback response for UI resilience
      return {
        messages: [],
        data: [],
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: 20,
          has_more_pages: false,
        },
        error: errorMsg,
        success: false,
      };
    }
  };

  /**
   * Send a new message using the /messages POST endpoint
   */
  const postMessage = async (
    messageData: SendMessageRequest
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall("messages", {
        method: "POST",
        body: JSON.stringify(messageData),
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to post message: ${err.message}`);
      console.error("Error posting message:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get unread messages count
   * Consistent with Swagger API endpoint: GET /messages/unread-count
   */
  const getUnreadCount = async (): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall("messages/unread-count");
      setUnreadCount(response.count || response.data?.count || 0);

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to get unread count: ${err.message}`);
      console.error("[Messages] Error getting unread message count:", err);
      setLoading(false);

      // Return a fallback response with count 0 instead of throwing
      // Using the ApiResponse interface format
      return {
        data: { count: 0 },
        count: 0,
        success: false,
        error: err.message || "Failed to fetch unread count",
      };
    }
  };

  /**
   * Upload media for a message
   */
  const uploadMedia = async (mediaData: MediaUploadRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("messages/media", {
        method: "POST",
        body: JSON.stringify(mediaData),
      });
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to upload media: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Upload file attachment for a message
   */
  const uploadAttachment = async (
    conversationId: string,
    file: File,
    isGroup: boolean = false
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Use fileService instead of directly accessing uploadMessageAttachment
      const result = (await fileService.uploadMessageAttachment(
        file,
        conversationId,
        isGroup
      )) as FileUploadResponse;

      setLoading(false);

      // Ensure we return in the expected format
      return {
        url:
          result.url ||
          result.file_url ||
          (typeof result === "string" ? result : ""),
        name: result.name || file.name,
        size: result.size || file.size.toString(),
        type: result.type || result.content_type || file.type,
      };
    } catch (err: any) {
      setError(`Failed to upload attachment: ${err.message}`);
      console.error("Error uploading attachment:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Send a message with file attachment
   */
  const sendMessageWithAttachment = async (
    recipientId: string,
    content: string,
    file: File,
    isGroup: boolean = false
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Use uploadAttachment function instead of direct fileService call
      const fileUploadResponse = await uploadAttachment(
        recipientId,
        file,
        isGroup
      );

      // Create message data with attachment info
      const messageData: SendMessageRequest = {
        content: content,
        attachment_url: fileUploadResponse.url,
        type: file.type.startsWith("image/") ? "image" : "file",
      };

      if (isGroup) {
        messageData.group_id = recipientId;
      } else {
        messageData.receiver_id = recipientId;
      }

      // Send the message with attachment
      const response = await postMessage(messageData);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send message with attachment: ${err.message}`);
      console.error("Error sending message with attachment:", err);
      setLoading(false);
      throw err;
    }
  };

  return {
    // State
    loading,
    error,
    messages,
    conversations,
    unreadCount,
    messagesPagination,

    // Actions
    getMessages,
    loadMoreMessages,
    getConversations,
    sendMessage,
    sendMessageToFriend,
    sendMessageToGroup,
    editMessage,
    deleteMessage,
    markMessagesAsRead,
    markAsRead,
    sendMessageWithMedia,
    uploadMedia,
    uploadAttachment,
    searchMessages,
    getMessageHistory,
    postMessage,
    getUnreadCount,
    sendMessageWithAttachment,
  };
};
