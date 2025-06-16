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
      console.log(`[Messages Store] Starting ${label}...`);
      const result = await callback(...args);
      const elapsed = performance.now() - start;
      console.log(
        `[Messages Store] Completed ${label} in ${elapsed.toFixed(2)}ms`
      );
      return result;
    } catch (error) {
      const elapsed = performance.now() - start;
      console.error(
        `[Messages Store] Failed ${label} after ${elapsed.toFixed(2)}ms:`,
        error
      );
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
        console.log(
          `[Messages Store] Making ${
            mergedOptions.method || "GET"
          } request to: ${normalizedEndpoint}`
        );
        if (mergedOptions.body) {
          console.log(`[Messages Store] Request body: ${mergedOptions.body}`);
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
      console.log(`[Messages Store] Making API call to: ${fullUrl}`);
      if (
        endpoint.includes("messages/history") ||
        endpoint.includes("messages") ||
        options.method !== "GET"
      ) {
        console.log(`[Messages Store] Request options:`, {
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
          `[Messages Store] API error for ${endpoint}: Status ${response.status}, Response:`,
          text
        );

        // For message history and direct message access, provide fallback data for certain errors
        if (
          (endpoint.includes("messages/history") ||
            endpoint.match(/^messages\/[0-9a-f-]{36}$/)) &&
          (response.status === 404 || response.status === 500)
        ) {
          console.log(
            `[Messages Store] Returning fallback data for ${response.status} error on ${endpoint}`
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
   * Unified function to get messages - supports both initial load and pagination
   * Uses consistent parameter structure for both private chat and group scenarios
   */
  const getUnifiedMessages = async (
    params: UnifiedMessageParams
  ): Promise<ApiResponse> => {
    console.log(`[Messages Store] Getting unified messages:`, params);

    const { target_id, type = "private", limit = 20, page, before } = params;

    // Parameter validation - prevent empty API calls
    if (!target_id || target_id.trim() === "") {
      console.error(`[Messages Store] Invalid target_id provided:`, target_id);
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
      console.error(`[Messages Store] Invalid type provided:`, type);
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
      console.error(`[Messages Store] Invalid target_id provided:`, target_id);
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
      console.error(`[Messages Store] Invalid type provided:`, type);
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
      console.log(
        `[Messages Store] Throttling request for ${requestKey}, too soon after previous request (${
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
    requestTimestamps.current[requestKey] = now;

    // Start performance measurement
    const startTime = performance.now();

    setLoading(true);
    setError(null);

    try {
      console.log(
        `[Messages Store] getUnifiedMessages: ${type} chat with ${target_id}, ` +
          `${
            isPagination ? `pagination before ${before}` : `page ${page || 1}`
          }`
      );

      // Use type directly like Vue.js implementation - no mapping needed
      const apiType = type; // Keep original type: "private" or "group"

      console.log(
        `[Messages Store] Using type directly: '${type}' for unified messages API`
      );

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

      console.log(`[Messages Store] Query parameters:`, queryParams.toString());

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
          console.log(
            `[Messages Store] Trying endpoint: ${endpoint.url} with method ${endpoint.method}`
          );

          response = await apiCall(endpoint.url, {});

          if (response) {
            console.log(`[Messages Store] Endpoint ${endpoint.url} succeeded`);
            break;
          }
        } catch (error) {
          console.warn(
            `[Messages Store] Endpoint ${endpoint.url} failed:`,
            error
          );
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
        console.log(
          `[Messages Store] Response is direct array with ${response.length} messages`
        );
        messagesArray = response;
      } else if (Array.isArray(response.data)) {
        // If data property contains the array
        console.log(
          `[Messages Store] Response.data contains ${response.data.length} messages`
        );
        messagesArray = response.data;
      } else if (Array.isArray(response.messages)) {
        messagesArray = response.messages;
      } else {
        // Log the actual response structure to debug
        console.warn(`[Messages Store] Unexpected response structure:`, {
          responseKeys: Object.keys(response || {}),
          responseType: typeof response,
          isArray: Array.isArray(response),
          dataExists: !!response?.data,
          dataType: typeof response?.data,
          dataIsArray: Array.isArray(response?.data),
        });
        messagesArray = [];
      }

      // Normalize message field names for consistency
      messagesArray = messagesArray.map((msg: any) => ({
        ...msg,
        // Ensure both id and message_id are available for compatibility
        id: msg.id || msg.message_id,
        message_id: msg.message_id || msg.id,
      }));

      console.log(
        `[Messages Store] Retrieved ${messagesArray.length} messages`
      );

      // Handle message array updates based on load type
      if (isInitialLoad && !before) {
        // Initial load - replace messages array
        setMessages(messagesArray);
        console.log(
          `[Messages Store] Initial load: Set ${messagesArray.length} messages`
        );
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
            // Cursor pagination - add older messages at the beginning
            console.log(
              `[Messages Store] Pagination: Adding ${newMessages.length} older messages`
            );
            setMessages((prevMessages) => [...newMessages, ...prevMessages]);
          } else {
            // Page pagination - add older messages at the beginning
            console.log(
              `[Messages Store] Page load: Adding ${newMessages.length} messages`
            );
            setMessages((prevMessages) => [...newMessages, ...prevMessages]);
          }
        }
      }

      // Update pagination info if provided
      if (response.pagination) {
        setMessagesPagination(response.pagination);
      }

      const endTime = performance.now();
      console.log(
        `[Messages Store] getUnifiedMessages completed in ${(
          endTime - startTime
        ).toFixed(2)}ms`
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      console.error(
        `[Messages Store] Failed to fetch unified messages after ${(
          endTime - startTime
        ).toFixed(2)}ms:`,
        err
      );

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
    console.log(
      `[Messages Store] Legacy getMessages called - converting to unified format`
    );

    // Enhanced parameter validation - prevent empty API calls
    if (!userId || userId.trim() === "") {
      console.error(
        `[Messages Store] Invalid userId provided to getMessages:`,
        userId
      );
      console.error(`[Messages Store] userId type:`, typeof userId);
      console.error(`[Messages Store] userId length:`, userId?.length);
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
    console.log(`[Messages Store] Calling getUnifiedMessages with:`, {
      target_id: cleanUserId,
      type: "private",
      page,
      limit,
    });

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
      console.log(
        `[Messages Store] loadMoreMessages: Loading page ${nextPage} for ${type} chat with ${targetId}`
      );

      return getUnifiedMessages({
        target_id: targetId,
        type,
        page: nextPage,
        limit: messagesPagination.items_per_page,
      });
    }
    console.log(`[Messages Store] loadMoreMessages: No more pages available`);
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

    // Log the attempt
    console.log(`[Messages] Attempting to send message to ${recipientId}`);

    try {
      console.log(`[Messages] Sending message via /messages endpoint`);

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

      console.log(`[Messages] Message sent successfully`);
      setLoading(false);
      return response;
    } catch (err: any) {
      console.error(`[Messages] Failed to send message:`, err);
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
   * Edit a message with improved error handling and temporary message support
   */
  const editMessage = async (
    messageId: string,
    content: string
  ): Promise<ApiResponse> => {
    console.log(`[Messages Store] Editing message ${messageId}`);
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      // Check if this is a temporary ID that needs special handling
      if (messageId.startsWith("temp-")) {
        console.log(
          `[Messages Store] Attempting to edit a temp message: ${messageId}`
        );

        // Find the message in our local state to check if it has a real message_id
        const messageToEdit = messages.find((msg) => msg.id === messageId);

        if (
          messageToEdit?.message_id &&
          !messageToEdit.message_id.startsWith("temp-")
        ) {
          // If the message has a real message_id, use that instead
          console.log(
            `[Messages Store] Using real message_id ${messageToEdit.message_id} instead of temp ID`
          );
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
          console.log(
            `[Messages Store] Updated local-only temporary message without API call`
          );

          const endTime = performance.now();
          console.log(
            `[Messages Store] Edit completed locally in ${(
              endTime - startTime
            ).toFixed(2)}ms`
          );

          return {
            message: "Local temporary message updated",
            success: true,
          };
        }
      }

      // Send the edit request to the API
      console.log(
        `[Messages Store] Sending edit request for message ${messageId}`
      );

      const response = await apiCall(`messages/${messageId}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
        }),
      });

      console.log(`[Messages Store] Edit API response:`, response);

      // Update the message in our local state - handle both id and message_id
      const beforeCount = messages.length;
      setMessages(
        messages.map((message) => {
          if (message.id === messageId || message.message_id === messageId) {
            console.log(
              `[Messages Store] Updating message ${messageId} in local state`
            );
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
      console.log(
        `[Messages Store] Edit completed in ${(endTime - startTime).toFixed(
          2
        )}ms`
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      console.error(
        `[Messages Store] Failed to edit message after ${(
          endTime - startTime
        ).toFixed(2)}ms:`,
        err
      );

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
    console.log(
      `[Messages Store] Deleting message ${messageId}, is group message: ${!!isGroupMessage}`
    );
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      // Check if this is a temporary ID that needs special handling
      if (messageId.startsWith("temp-")) {
        console.log(
          `[Messages Store] Attempting to delete a temp message: ${messageId}`
        );

        // Find the message in our local state to check if it has a real message_id
        const messageToDelete = messages.find((msg) => msg.id === messageId);

        if (messageToDelete) {
          // Check if the message has a real message_id that's not a temporary ID
          if (
            messageToDelete.message_id &&
            typeof messageToDelete.message_id === "string" &&
            !messageToDelete.message_id.startsWith("temp-")
          ) {
            // If the message has a real message_id, use that instead
            console.log(
              `[Messages Store] Using real message_id ${messageToDelete.message_id} instead of temp ID`
            );
            messageId = messageToDelete.message_id;
          } else {
            // For truly temporary messages that haven't been sent to the server yet,
            // just remove them from the local state without making an API call
            console.log(
              `[Messages Store] Removing local-only temporary message without API call`
            );
            setMessages(messages.filter((message) => message.id !== messageId));

            const endTime = performance.now();
            console.log(
              `[Messages Store] Delete completed locally in ${(
                endTime - startTime
              ).toFixed(2)}ms`
            );

            return {
              message: "Local temporary message removed",
              success: true,
            };
          }
        } else {
          console.log(
            `[Messages Store] Could not find message with ID: ${messageId}`
          );

          const endTime = performance.now();
          console.log(
            `[Messages Store] Delete abandoned (message not found) in ${(
              endTime - startTime
            ).toFixed(2)}ms`
          );

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
        console.log(`[Messages Store] Using group message deletion endpoint`);
        // Add group-specific logic if needed, or keep consistent endpoint format
      }

      console.log(
        `[Messages Store] Sending delete request for message ${messageId}`
      );

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
      console.log(
        `[Messages Store] Updated ${
          beforeCount - afterCount === 0 ? "marked as deleted" : "removed"
        } message from local state`
      );

      const endTime = performance.now();
      console.log(
        `[Messages Store] Delete completed in ${(endTime - startTime).toFixed(
          2
        )}ms`
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      console.error(
        `[Messages Store] Failed to delete message after ${(
          endTime - startTime
        ).toFixed(2)}ms:`,
        err
      );

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
      console.error(
        `[Messages Store] Error deleting message ${messageId}:`,
        err
      );
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
    console.log(
      `[Messages Store] Marking ${messageIds.length} messages as read`
    );
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
        console.log("[Messages Store] No valid message IDs to mark as read");
        const endTime = performance.now();
        console.log(
          `[Messages Store] Operation completed (no action) in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        return {
          message: "No valid messages to mark as read",
          success: true,
        };
      }

      console.log(
        `[Messages Store] Sending read status update for ${finalMessageIds.length} messages`
      );

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
      console.log(
        `[Messages Store] Mark as read completed in ${(
          endTime - startTime
        ).toFixed(2)}ms`
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      console.error(
        `[Messages Store] Failed to mark messages as read after ${(
          endTime - startTime
        ).toFixed(2)}ms:`,
        err
      );

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
   * Get message history for private chat or group conversation
   * @deprecated This function now delegates to the unified getUnifiedMessages function
   */
  const getMessageHistory = async (
    params: MessageHistoryParams
  ): Promise<ApiResponse> => {
    console.log(
      `[Messages Store] getMessageHistory called - delegating to unified getUnifiedMessages`
    );

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
        messageData.recipient_id = recipientId; // ✅ Updated to use recipient_id
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

  /**
   * Get conversation history - specifically for chat conversations
   * This function explicitly calls /messages/history endpoint for conversation-specific messages
   */
  const getConversationHistory = async (
    targetId: string,
    type: "private" | "group" = "private",
    limit = 20,
    before?: string
  ): Promise<ApiResponse> => {
    console.log(
      `[Messages Store] getConversationHistory: ${type} conversation with ${targetId}`
    );

    // Parameter validation - prevent empty API calls
    if (!targetId || targetId.trim() === "") {
      console.error(
        `[Messages Store] Invalid targetId provided to getConversationHistory:`,
        targetId
      );
      return {
        data: [],
        messages: [],
        success: false,
        error:
          "Invalid targetId: cannot fetch conversation history without a valid target ID",
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    if (!type || !["private", "group"].includes(type)) {
      console.error(
        `[Messages Store] Invalid type provided to getConversationHistory:`,
        type
      );
      return {
        data: [],
        messages: [],
        success: false,
        error: "Invalid type: must be 'private' or 'group'",
        pagination: {
          current_page: 1,
          total_pages: 1,
          total_items: 0,
          items_per_page: limit,
          has_more_pages: false,
        },
      };
    }

    setLoading(true);
    setError(null);

    try {
      // Use type directly like Vue.js implementation - no mapping needed
      const apiType = type; // Keep original type: "private" or "group"

      console.log(
        `[Messages Store] Using type directly: '${type}' for conversation history API`
      );

      // Build query parameters for conversation history
      const queryParams = new URLSearchParams({
        type: apiType,
        target_id: targetId,
        limit: limit.toString(),
      });

      if (before) {
        queryParams.append("before", before);
      }

      console.log(
        `[Messages Store] Conversation history query:`,
        queryParams.toString()
      );

      // Direct call to messages/history endpoint
      const response = await apiCall(
        `messages/history?${queryParams.toString()}`,
        {
          method: "GET",
        }
      );

      if (response) {
        console.log(
          `[Messages Store] Conversation history loaded successfully`
        );

        // Extract messages from response
        let messagesArray = [];
        if (Array.isArray(response)) {
          messagesArray = response;
        } else if (response.messages && Array.isArray(response.messages)) {
          messagesArray = response.messages;
        } else if (response.data && Array.isArray(response.data)) {
          messagesArray = response.data;
        } else if (
          response.data &&
          response.data.messages &&
          Array.isArray(response.data.messages)
        ) {
          messagesArray = response.data.messages;
        }

        console.log(
          `[Messages Store] Extracted ${messagesArray.length} messages from conversation history`
        );

        setMessages(messagesArray);
        setLoading(false);
        return response;
      } else {
        throw new Error(
          "No response received from conversation history endpoint"
        );
      }
    } catch (error: any) {
      console.error(
        `[Messages Store] Error loading conversation history:`,
        error
      );
      setError(`Failed to load conversation history: ${error.message}`);
      setLoading(false);
      throw error;
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

    // Unified API
    getUnifiedMessages, // New unified function - primary recommended API

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
    getConversationHistory, // New dedicated function for conversation history

    // Performance metrics access if needed by consumers
    perfMetrics: perfMetrics.current,
  };
};
