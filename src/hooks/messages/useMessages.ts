import { useState, useRef, useCallback } from "react";
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
 * - Comprehensive logging with consistent "[Messages Store]" prefix
 * - Performance tracking for API calls and operations
 * - Unified message handling patterns
 */

/**
 * Helper function to measure performance of async operations
 * @param label Operation label for logging
 * @param callback The async function to measure
 * @returns A wrapped function that measures performance
 */
function measurePerformance<T extends any[], R>(
  label: string,
  callback: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    const start = performance.now();
    try {
      const result = await callback(...args);
      const elapsed = performance.now() - start;

      return result;
    } catch (error) {
      const elapsed = performance.now() - start;
      throw error;
    }
  };
}

// Define Message types
export interface Message {
  id: string;
  message_id?: string; // Added for compatibility with APIs that use message_id
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
  sent_at?: string;
  delivered_at?: string;
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
  media_url?: string;
  attachment_url?: string; // Added for compatibility
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
  // Additional properties for UI state management
  pending?: boolean;
  sent?: boolean;
  isCurrentUser?: boolean;
  temp_id?: string;
  replacedTempMessage?: boolean;
  fromWebSocket?: boolean;
  updatedViaWebSocket?: boolean;
  recoveredFromError?: boolean;
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
  recipient_id?: string;
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
  errorCode?: string; // Added for specific error identification (e.g., ALL_METHODS_FAILED)
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
  recipient_id?: string;
  group_id?: string;
  type?: string;
}

export interface MediaUploadRequest {
  file_url: string;
  media_type: string;
  related_to: string;
}

// New interface for unified parameters, similar to the Vue implementation
export interface UnifiedMessageParams {
  target_id: string;
  type: "private" | "group";
  limit?: number;
  page?: number;
  before?: string;
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

  // For tracking API call performance
  const perfMetrics = useRef<{
    [key: string]: { count: number; totalTime: number; avgTime: number };
  }>({});

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
        // Request logging removed
      }

      // Delete Content-Type header for FormData requests
      if (options.body instanceof FormData) {
        const headers = mergedOptions.headers as Record<string, string>;
        delete headers["Content-Type"];
      }

      // Construct full URL
      const fullUrl = `${proxyUrl}/${normalizedEndpoint}`;

      // Enhanced logging for all requests
      if (
        endpoint.includes("messages/history") ||
        endpoint.includes("messages") ||
        options.method !== "GET"
      ) {
        ({
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

        // For message history and direct message access, provide fallback data for certain errors
        if (
          (endpoint.includes("messages/history") ||
            endpoint.match(/^messages\/[0-9a-f-]{36}$/)) &&
          (response.status === 404 || response.status === 500)
        ) {
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
      // Provide fallback for critical endpoints to prevent UI crashes
      if (endpoint.includes("messages/history")) {
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
   * Unified function to get messages - supports both initial load and pagination
   * Uses consistent parameter structure for both private chat and group scenarios
   */
  const getUnifiedMessages = async (
    params: UnifiedMessageParams
  ): Promise<ApiResponse> => {
    const { target_id, type = "private", limit = 20, page, before } = params;

    // Parameter validation - prevent empty API calls
    if (!target_id || target_id.trim() === "") {
      return {
        data: [],
        messages: [],
        success: false,
        error:
          "Invalid target_id: cannot fetch messages without a valid target ID",
        pagination: {
          current_page: page || 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    if (!type || !["private", "group"].includes(type)) {
      return {
        data: [],
        messages: [],
        success: false,
        error: "Invalid type: must be 'private' or 'group'",
        pagination: {
          current_page: page || 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    // Parameter validation - prevent empty API calls
    if (!target_id || target_id.trim() === "") {
      return {
        data: [],
        messages: [],
        success: false,
        error:
          "Invalid target_id: cannot fetch messages without a valid target ID",
        pagination: {
          current_page: page || 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    if (!type || !["private", "group"].includes(type)) {
      return {
        data: [],
        messages: [],
        success: false,
        error: "Invalid type: must be 'private' or 'group'",
        pagination: {
          current_page: page || 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    // Determine if this is pagination (before parameter) or page-based load
    const isPagination = !!before;
    const isInitialLoad = !page || page === 1;

    // Avoid concurrent/overlapping requests for the same conversation
    const requestKey = `${type}-${target_id}`;
    const now = Date.now();
    const lastRequest = requestTimestamps.current[requestKey] || 0;
    const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

    if (now - lastRequest < MIN_REQUEST_INTERVAL) {
      return {
        data: messages, // Return current messages from state
        messages: messages,
        success: true,
        _throttled: true,
      };
    }

    // Update timestamp
    requestTimestamps.current[requestKey] = now;

    // Start performance measurement
    const startTime = performance.now();

    setLoading(true);
    setError(null);

    try {
      const apiType = type; // Keep original type: "private" or "group"

      // Build query parameters consistently
      let queryParams = new URLSearchParams({
        type: apiType,
        target_id,
        limit: limit.toString(),
      });

      // Add pagination parameter (before takes precedence over page)
      if (before) {
        queryParams.append("before", before);
      } else if (page && page > 1) {
        queryParams.append("page", page.toString());
      }

      // Try multiple endpoint formats, based on Vue.js API compatibility
      const endpoints = [
        // Primary endpoint with query params (matches Vue.js exactly)
        {
          url: `messages/history?${queryParams.toString()}`,
          method: "GET",
        },
        // Alternative endpoint formats
        {
          url: `messages/${apiType}/${target_id}/history${
            before
              ? `?before=${before}&limit=${limit}`
              : page && page > 1
              ? `?page=${page}&limit=${limit}`
              : `?limit=${limit}`
          }`,
          method: "GET",
        },
      ];

      let lastError = null;
      let response = null;

      // Try each endpoint until one works
      for (const endpoint of endpoints) {
        try {
          response = await apiCall(endpoint.url, {});

          if (response) {
            break;
          }
        } catch (error) {
        
          lastError = error;
        }
      }

      if (!response) {
        throw lastError || new Error("All message history endpoints failed");
      }

      // Extract messages from response (exactly like Vue.js implementation)
      let messagesArray = [];
      if (Array.isArray(response)) {
        // If response itself is the array of messages

        messagesArray = response;
      } else if (Array.isArray(response.data)) {
        // If data property contains the array

        messagesArray = response.data;
      } else if (Array.isArray(response.messages)) {
        messagesArray = response.messages;
      } else {
       
        messagesArray = [];
      }

      // Normalize message field names for consistency
      messagesArray = messagesArray.map((msg: any) => ({
        ...msg,
        // Ensure both id and message_id are available for compatibility
        id: msg.id || msg.message_id,
        message_id: msg.message_id || msg.id,
      }));

      // Handle message array updates based on load type
      if (isInitialLoad && !before) {
        // Initial load - replace messages array
        setMessages(messagesArray);
      } else {
        // Pagination - safely merge messages without duplicates
        const existingIds = new Set(
          messages.map((m) => m.id || m.message_id).filter(Boolean)
        );

        const newMessages = messagesArray.filter((msg: any) => {
          const msgId = msg.id || msg.message_id;
          return msgId && !existingIds.has(msgId);
        });

        if (newMessages.length > 0) {
          if (before) {
            setMessages((prevMessages) => [...newMessages, ...prevMessages]);
          } else {
            // Page pagination - add older messages at the beginning

            setMessages((prevMessages) => [...newMessages, ...prevMessages]);
          }
        }
      }

      // Update pagination info if provided
      if (response.pagination) {
        setMessagesPagination(response.pagination);
      }

      const endTime = performance.now();

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      

      const errorMsg = err.message || "Failed to fetch messages";
      setError(errorMsg);
      setLoading(false);

      // Return a fallback response instead of throwing
      return {
        data: [],
        messages: [],
        success: false,
        error: errorMsg,
        pagination: {
          current_page: page || 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }
  };

  /**
   * Legacy function to get messages with a specific user
   * Now delegates to the unified messages function for consistent API patterns
   * Default is to get the latest messages (page 1, limit 20)
   */
  const getMessages = async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    // Enhanced parameter validation - prevent empty API calls
    if (!userId || userId.trim() === "") {
      
      return {
        data: [],
        messages: [],
        success: false,
        error: "Invalid userId: cannot fetch messages without a valid user ID",
        pagination: {
          current_page: page,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    const cleanUserId = userId.trim();

    return getUnifiedMessages({
      target_id: cleanUserId,
      type: "private",
      page,
      limit,
      // Ensure we're getting the most recent messages
      before: undefined,
    });
  };

  /**
   * Load more messages for pagination using unified approach
   */
  const loadMoreMessages = async (
    targetId: string,
    type: "private" | "group" = "private"
  ): Promise<ApiResponse | null> => {
    if (messagesPagination.has_more_pages) {
      const nextPage = messagesPagination.current_page + 1;

      return getUnifiedMessages({
        target_id: targetId,
        type,
        page: nextPage,
        limit: messagesPagination.items_per_page,
      });
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
   * Send a message to a user with improved error handling
   * Uses API endpoint: POST /messages
   */
  const sendMessage = async (
    recipientId: string,
    content: string,
    type = "text"
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Use recipient_id as the backend now supports it
      const payload = {
        recipient_id: recipientId, // ✅ Updated to use recipient_id
        content,
        type,
      };

      const response = await apiCall("messages", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
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
   * Uses the unified /messages endpoint with group_id in payload
   */
  const sendMessageToGroup = async (
    groupId: string,
    content: string,
    type = "text"
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Use unified messages endpoint
      const response = await apiCall(`messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          type,
          group_id: groupId, // Include group_id in payload
        }),
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send group message: ${err.message}`);
     
      setLoading(false);

      // Return error response instead of throwing for consistency with other methods
      throw err;
    }
  };

  /**
   * Edit a message with improved error handling and temporary message support
   */
  const editMessage = async (
    messageId: string,
    content: string
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      // Check if this is a temporary ID that needs special handling
      if (messageId.startsWith("temp-")) {
        // Find the message in our local state to check if it has a real message_id
        const messageToEdit = messages.find((msg) => msg.id === messageId);

        if (
          messageToEdit?.message_id &&
          !messageToEdit.message_id.startsWith("temp-")
        ) {
          // If the message has a real message_id, use that instead
          messageId = messageToEdit.message_id;
        } else {
          // For truly temporary messages that haven't been sent to the server yet,
          // just update them in the local state without making an API call
          messages.forEach((message) => {
            if (message.id === messageId) {
              message.content = content;
              message.updated_at = new Date().toISOString();
              message.is_edited = true;
            }
          });
          const endTime = performance.now();

          return {
            message: "Local temporary message updated",
            success: true,
          };
        }
      }
      const response = await apiCall(`messages/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
        }),
      });

      // Update the message in our local state - handle both id and message_id
      const beforeCount = messages.length;
      setMessages(
        messages.map((message) => {
          if (message.id === messageId || message.message_id === messageId) {
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

      const endTime = performance.now();

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();

      setError(`Failed to edit message: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Delete a message with enhanced error handling and temporary message support
   * @param messageId - ID of the message to delete
   * @param isGroupMessage - Indicates if the message is from a group chat (optional)
   */
  const deleteMessage = async (
    messageId: string,
    isGroupMessage?: boolean
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      // Check if this is a temporary ID that needs special handling
      if (messageId.startsWith("temp-")) {
        // Find the message in our local state to check if it has a real message_id
        const messageToDelete = messages.find((msg) => msg.id === messageId);

        if (messageToDelete) {
          // Check if the message has a real message_id that's not a temporary ID
          if (
            messageToDelete.message_id &&
            typeof messageToDelete.message_id === "string" &&
            !messageToDelete.message_id.startsWith("temp-")
          ) {
            messageId = messageToDelete.message_id;
          } else {
            // For truly temporary messages that haven't been sent to the server yet,
            // just remove them from the local state without making an API call

            setMessages(messages.filter((message) => message.id !== messageId));

            const endTime = performance.now();

            return {
              message: "Local temporary message removed",
              success: true,
            };
          }
        } else {
          const endTime = performance.now();

          return {
            message: "Message not found in local state",
            success: false,
          };
        }
      }

      // Determine the proper endpoint based on whether it's a group message
      let deleteEndpoint = `messages/${messageId}`;

      // If it's explicitly a group message, use the group-specific endpoint format
      if (isGroupMessage) {
        // Add group-specific logic if needed, or keep consistent endpoint format
      }

      // Find the original message to get any additional metadata that might be needed
      const originalMessage = messages.find(
        (msg) => msg.id === messageId || msg.message_id === messageId
      );

      // Send delete request with additional context if available
      const deleteRequestBody = originalMessage?.sent_at
        ? {
            sent_at: originalMessage.sent_at,
            recipient_id: originalMessage.recipient_id,
            sender_id: originalMessage.sender_id,
          }
        : undefined;

      const response = await apiCall(deleteEndpoint, {
        method: "DELETE",
        ...(deleteRequestBody && { body: JSON.stringify(deleteRequestBody) }),
      });

      // Remove the message from our local state or mark as deleted
      const beforeCount = messages.length;

      // Some implementations might really delete, others just mark as deleted
      // First try to find the message to determine what to do
      const messageToDelete = messages.find(
        (msg) => msg.id === messageId || msg.message_id === messageId
      );

      if (messageToDelete) {
        // Option 1: Mark as deleted but keep in history (recommended for better UX)
        setMessages(
          messages.map((message) => {
            if (message.id === messageId || message.message_id === messageId) {
              return {
                ...message,
                content: "This message was deleted",
                is_deleted: true,
              };
            }
            return message;
          })
        );
      } else {
        // Option 2: Remove completely from state
        setMessages(
          messages.filter(
            (message) =>
              message.id !== messageId && message.message_id !== messageId
          )
        );
      }

      const afterCount = messages.length;

      const endTime = performance.now();

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
     

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to delete message";
      if (err.message?.includes("clustering keys")) {
        errorMessage = "Unable to delete message: Database constraint error";
      } else if (err.message?.includes("not found")) {
        errorMessage = "Message not found or already deleted";
      } else if (err.message?.includes("permission")) {
        errorMessage = "You don't have permission to delete this message";
      } else if (err.message) {
        errorMessage = `Failed to delete message: ${err.message}`;
      }

      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  /**
   * Mark messages as read with enhanced error handling and temp message support
   */
  const markMessagesAsRead = async (
    messageIds: string[]
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      // Filter out temporary message IDs and replace with real message_ids if available
      const finalMessageIds = messageIds
        .map((id) => {
          if (id.startsWith("temp-")) {
            const message = messages.find((msg) => msg.id === id);
            return message?.message_id || id;
          }
          return id;
        })
        .filter((id) => !id.startsWith("temp-")); // Remove any remaining temp IDs

      // If we have no valid IDs after filtering, return early
      if (finalMessageIds.length === 0) {
        const endTime = performance.now();

        return {
          message: "No valid messages to mark as read",
          success: true,
        };
      }

      const response = await apiCall("messages/read", {
        method: "PUT",
        body: JSON.stringify({
          message_ids: finalMessageIds,
        }),
      });

      // Update messages in our local state - handle both id and message_id matching
      setMessages(
        messages.map((message) => {
          if (
            messageIds.includes(message.id) ||
            (message.message_id && finalMessageIds.includes(message.message_id))
          ) {
            return { ...message, read: true };
          }
          return message;
        })
      );

      const endTime = performance.now();

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();

      setError(`Failed to mark messages as read: ${err.message}`);
      setLoading(false);

      // Update local state even if the API call fails for better UX
      setMessages(
        messages.map((message) => {
          if (
            messageIds.includes(message.id) ||
            messageIds.includes(message.message_id || "")
          ) {
            return { ...message, read: true };
          }
          return message;
        })
      );

      // Return a partial success response
      return {
        message: "Updated read status locally, but server update failed",
        success: false,
        error: err.message,
      };
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

      const response = await apiCall(`messages/search?${queryString}`);

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to search messages: ${err.message}`);
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
   * Get message history for private chat or group conversation
   * @deprecated This function now delegates to the unified getUnifiedMessages function
   */
  const getMessageHistory = async (
    params: MessageHistoryParams
  ): Promise<ApiResponse> => {
    // Convert MessageHistoryParams to UnifiedMessageParams
    const unifiedParams: UnifiedMessageParams = {
      target_id: params.target_id,
      type: params.type,
      limit: params.limit,
      before: params.before,
    };

    return getUnifiedMessages(unifiedParams);
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
        messageData.recipient_id = recipientId; // ✅ Updated to use recipient_id
      }

      // Send the message with attachment
      const response = await postMessage(messageData);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send message with attachment: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get the last message for a conversation (for MessagesList preview)
   * Unified approach for both private and group conversations
   */
  const getLastMessage = async (
    targetId: string,
    type: "private" | "group" = "private"
  ): Promise<ApiResponse> => {
    return getUnifiedMessages({
      target_id: targetId,
      type,
      limit: 1,
      page: 1,
    });
  };

  /**
   * Get conversation history (for ChatArea)
   * Unified approach with proper pagination support
   */
  const getConversationHistory = async (
    targetId: string,
    type: "private" | "group" = "private",
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    return getUnifiedMessages({
      target_id: targetId,
      type,
      page,
      limit,
    });
  };

  return {
    // State
    loading,
    error,
    messages,
    conversations,
    unreadCount,
    messagesPagination,

    // Unified API
    getUnifiedMessages, // New unified function - primary recommended API
    getLastMessage, // Helper for getting last message (MessagesList)
    getConversationHistory, // Helper for getting conversation history (ChatArea)

    // Legacy Actions for backward compatibility
    getMessages, // Now delegates to getUnifiedMessages
    getMessageHistory, // Now delegates to getUnifiedMessages

    // Actions
    loadMoreMessages, // Enhanced to support unified params
    getConversations,
    sendMessage,
    sendMessageToFriend,
    sendMessageToGroup,
    editMessage, // Enhanced with temp message support
    deleteMessage, // Enhanced with temp message and group support
    markMessagesAsRead, // Enhanced with temp message support
    markAsRead,
    sendMessageWithMedia,
    uploadMedia,
    uploadAttachment,
    searchMessages,
    postMessage,
    getUnreadCount,
    sendMessageWithAttachment,

    // Performance metrics access if needed by consumers
    perfMetrics: perfMetrics.current,
  };
};
