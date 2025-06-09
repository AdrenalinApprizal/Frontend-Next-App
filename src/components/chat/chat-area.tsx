"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  FaUser,
  FaPaperPlane,
  FaSearch,
  FaInfoCircle,
  FaCheck,
  FaCheckDouble,
  FaUpload,
  FaEllipsisV,
  FaTimes,
  FaPaperclip,
} from "react-icons/fa";
import { useMessages } from "@/hooks/messages/useMessages";
import { useFriendship } from "@/hooks/auth/useFriends";
import usePresence from "@/hooks/presence/usePresence";
import { toast } from "react-hot-toast";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProviderNew";
import { eventBus } from "@/hooks/websocket/useWebSocket";
import {
  formatMessageTimestamp,
  formatTimeString,
  formatDateForSeparator,
} from "@/utils/timestampHelper";
import UserProfileInfo from "./friend-info-panel";
import SearchOnFriend from "./search-on-friend";

// Define message interface based on the Vue template
interface Message {
  id: string;
  message_id?: string;
  sender_id?: string;
  recipient_id?: string;
  receiver_id?: string; // Adding receiver_id for API consistency
  chat_room_id?: string;
  conversation_id?: string;
  room_id?: string;
  content: string;
  timestamp?: string;
  raw_timestamp?: string;
  sent_at?: string;
  created_at: string;
  updated_at?: string;
  type?: string;
  isCurrentUser: boolean;
  read?: boolean;
  is_read?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  is_deleted?: boolean;
  attachment?: Attachment;
  pending?: boolean;
  retrying?: boolean;
  retryCount?: number;
  sent?: boolean;
  failed?: boolean;
  errorMessage?: string;
  message_type?: string;
  fromWebSocket?: boolean;
  receivedViaWebSocket?: boolean;
  sourceApi?: boolean;
  sender?: any;
  recipient?: any;
}

interface Attachment {
  type: "image" | "file";
  url: string;
  name: string;
  size?: string;
}

interface Recipient {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar?: string;
  profile_picture_url?: string;
  status: "online" | "offline";
  phone?: string;
  joinDate?: string;
  location?: string;
  display_name?: string;
  full_name?: string;
}

interface ChatAreaProps {
  recipientId?: string;
  recipientName?: string;
  isGroup?: boolean;
  chatMessages?: Message[];
}

// Format timestamp for display using centralized helper - matches Vue.js implementation
const formatTimestamp = (dateString?: string): string => {
  if (!dateString) return "";

  // Use 'time' format for HH:MM display in message bubbles like Vue.js
  return formatMessageTimestamp({
    timestamp: dateString,
    format: "time",
  });
};

export function ChatArea({
  recipientId,
  recipientName,
  isGroup = false,
  chatMessages,
}: ChatAreaProps) {
  // Access route params if recipientId is not provided via props
  const params = useParams();
  const friendId =
    recipientId || (params?.friendId as string) || (params?.id as string);

  // Session data
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // State hooks
  const [inputMessage, setInputMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Prevent dependency array issues by using refs for functions that could change
  const isMountedRef = useRef(true);
  const previousFriendIdRef = useRef<string | null | undefined>(null);

  // Api hooks
  const {
    messages: apiMessages,
    loading: loadingMessages,
    error: apiError,
    sendMessage,
    getMessages,
    editMessage,
    deleteMessage,
  } = useMessages();

  const { getFriendById, recipientData, setRecipientData } = useFriendship();
  const presence = usePresence();

  const {
    connect,
    isConnected,
    error: connectionError,
    isConnecting,
    sendPrivateMessage,
    subscribeToPrivateMessages,
    unsubscribeFromPrivateMessages,
  } = useWebSocketContext();

  // Memoized recipient based on data and presence
  const recipient = useMemo(() => {
    // Default recipient if we don't have data yet
    const defaultRecipient: Recipient = {
      id: friendId || "",
      name: recipientName || friendId || "Contact",
      email: "",
      status: "offline",
    };

    // If we don't have recipient data, return default
    if (!recipientData) return defaultRecipient;

    // Prioritize recipientName prop over API data for cases where we have a known name
    const shouldUseProvidedName =
      recipientName &&
      recipientName !== friendId &&
      !recipientName.startsWith("User ") && // Don't use fallback names
      recipientData.name?.startsWith("User "); // API returned fallback data

    if (shouldUseProvidedName) {
      console.log(
        `[ChatArea] Using provided recipientName '${recipientName}' over API fallback '${recipientData.name}'`
      );
    }

    console.log(`[ChatArea] Recipient data analysis:`, {
      recipientName,
      friendId,
      recipientDataName: recipientData?.name,
      shouldUseProvidedName,
    });

    // Get online status from presence service
    const onlineStatus =
      presence && typeof presence.getStatus === "function"
        ? presence.getStatus(recipientData.id) === "online"
          ? "online"
          : "offline"
        : "offline";

    // Build full name from first_name and last_name if available
    let displayName = "";

    // First priority: Use provided recipientName if it's not empty and not a fallback
    if (
      recipientName &&
      recipientName.trim() &&
      !recipientName.startsWith("User ")
    ) {
      displayName = recipientName;
      console.log(
        `[ChatArea] Using provided recipientName: '${recipientName}'`
      );
    } else {
      // Second priority: Try to construct from API data
      const recipientDataAny = recipientData as any; // Type cast to access additional properties

      // Check if API returned proper first_name and last_name
      if (recipientDataAny.first_name && recipientDataAny.last_name) {
        displayName = `${recipientDataAny.first_name} ${recipientDataAny.last_name}`;
        console.log(
          `[ChatArea] Using API first_name + last_name: '${displayName}'`
        );
      } else if (
        recipientData.full_name &&
        !recipientData.full_name.startsWith("User ")
      ) {
        displayName = recipientData.full_name;
        console.log(`[ChatArea] Using API full_name: '${displayName}'`);
      } else if (
        recipientData.display_name &&
        !recipientData.display_name.startsWith("User ")
      ) {
        displayName = recipientData.display_name;
        console.log(`[ChatArea] Using API display_name: '${displayName}'`);
      } else if (
        recipientData.name &&
        !recipientData.name.startsWith("User ")
      ) {
        displayName = recipientData.name;
        console.log(`[ChatArea] Using API name: '${displayName}'`);
      } else if (recipientData.username) {
        displayName = recipientData.username;
        console.log(`[ChatArea] Using API username: '${displayName}'`);
      } else {
        // Last resort: use recipientName even if it's a fallback, or fallback to "User"
        displayName = recipientName || "User";
        console.log(`[ChatArea] Using fallback name: '${displayName}'`);
      }
    }

    console.log(`[ChatArea] Final display name: '${displayName}'`);

    // Parse name parts for header display
    const nameParts = displayName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Create a recipient object with properly typed fields
    return {
      ...recipientData,
      name: displayName,
      profile_picture_url: recipientData.profile_picture_url,
      status: onlineStatus,
      // Use firstName/lastName from our parsing
      first_name: firstName,
      last_name: lastName,
    };
  }, [friendId, recipientName, recipientData, presence]);

  // Enhanced message ownership detection with better validation
  const isCurrentUserMessage = useCallback(
    (message: any): boolean => {
      if (!currentUserId || !message) return false;

      const currentUserIdStr = String(currentUserId);

      // Temp messages are always from current user
      if (message.id?.startsWith("temp-")) return true;

      // Check multiple possible sender ID fields
      const messageIds = [
        message.sender_id,
        message.sender?.id,
        message.from_id,
        message.user_id,
        message.author_id,
      ]
        .filter(Boolean)
        .map(String);

      // If message has any sender ID that matches current user
      if (messageIds.includes(currentUserIdStr)) return true;
      
      // Check receiver_id first (API standard)
      if (message.receiver_id) {
        const receiverIdStr = String(message.receiver_id);
        // If receiver is current user, then message is not from current user
        if (receiverIdStr === currentUserIdStr) return false;
        // If receiver is friend and we have a valid sender ID, then message is from current user
        if (receiverIdStr === friendId && messageIds.length > 0) return true;
      }

      // For message from API/WebSocket that has recipientId (legacy/backup check)
      if (message.recipient_id) {
        const recipientIdStr = String(message.recipient_id);
        // If recipient is current user, then message is not from current user
        if (recipientIdStr === currentUserIdStr) return false;
        // If recipient is friend and we have a valid sender ID, then message is from current user
        if (recipientIdStr === friendId && messageIds.length > 0) return true;
      }

      // If we have an explicit sender that's different from current user
      if (messageIds.length > 0 && !messageIds.includes(currentUserIdStr))
        return false;

      return false; // Default to false if ownership cannot be determined
    },
    [currentUserId, friendId] // Add friendId to dependencies
  );

  // Validate and fix message bubble positioning
  const validateMessageBubbles = useCallback((): number => {
    let fixedCount = 0;
    setLocalMessages((prev) =>
      prev.map((msg) => {
        const correctIsCurrentUser = isCurrentUserMessage(msg);
        if (msg.isCurrentUser !== correctIsCurrentUser) {
          fixedCount++;
          return { ...msg, isCurrentUser: correctIsCurrentUser };
        }
        return msg;
      })
    );
    return fixedCount;
  }, [isCurrentUserMessage]);

  // Enhanced message grouping by date with better formatting
  const groupedMessages = useMemo(() => {
    if (!localMessages || !Array.isArray(localMessages)) return [];

    const messagesByDate: Record<
      string,
      {
        dateKey: string;
        date: string;
        messages: Message[];
        isToday: boolean;
        isYesterday: boolean;
      }
    > = {};

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Sort messages by timestamp first
    const sortedMessages = [...localMessages].sort((a, b) => {
      // Use raw_timestamp for most accurate sorting, fallback to other timestamps
      const timeA = new Date(
        a.raw_timestamp || a.sent_at || a.created_at || a.timestamp || 0
      ).getTime();
      const timeB = new Date(
        b.raw_timestamp || b.sent_at || b.created_at || b.timestamp || 0
      ).getTime();
      return timeA - timeB;
    });

    sortedMessages.forEach((message) => {
      const messageDate = new Date(
        message.raw_timestamp ||
          message.sent_at ||
          message.created_at ||
          message.timestamp ||
          new Date()
      );

      // Check if date is invalid and provide fallback
      if (isNaN(messageDate.getTime())) {
        console.warn("Invalid date for message:", message);
        messageDate.setTime(new Date().getTime()); // Set to current time as fallback
      }

      const dateKey = messageDate.toDateString();

      if (!messagesByDate[dateKey]) {
        messagesByDate[dateKey] = {
          dateKey,
          date: formatDateForSeparator(messageDate),
          messages: [],
          isToday: dateKey === today,
          isYesterday: dateKey === yesterday,
        };
      }

      // Ensure message has correct ownership before adding
      const validatedMessage = {
        ...message,
        isCurrentUser: isCurrentUserMessage(message),
        timestamp: formatTimestamp(
          message.raw_timestamp ||
            message.sent_at ||
            message.created_at ||
            message.timestamp
        ),
      };

      messagesByDate[dateKey].messages.push(validatedMessage);
    });

    // Convert to array and sort by date
    return Object.values(messagesByDate).sort(
      (a, b) => new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime()
    );
  }, [localMessages, isCurrentUserMessage]);

  // Session storage management for message caching
  const saveToSessionStorage = useCallback(
    (messagesList: Message[]) => {
      if (!messagesList || messagesList.length === 0 || !friendId) return;

      try {
        const conversationKey = `chat_${friendId}`;

        // Sort messages by timestamp first to ensure newest messages are kept
        const sortedMessages = [...messagesList].sort((a, b) => {
          const timeA = new Date(
            a.raw_timestamp || a.sent_at || a.created_at || a.timestamp || 0
          ).getTime();
          const timeB = new Date(
            b.raw_timestamp || b.sent_at || b.created_at || b.timestamp || 0
          ).getTime();
          return timeB - timeA; // Sort in descending order (newest first)
        });

        // Optimize storage by saving only essential fields
        const optimizedMessages = sortedMessages
          .filter((msg) => !msg.id?.startsWith("temp-")) // Exclude temp messages
          .slice(0, 100) // Keep only last 100 messages to prevent storage quota issues
          .map((msg) => ({
            id: msg.id,
            content: msg.content,
            sender_id: msg.sender_id,
            recipient_id: msg.recipient_id,
            created_at: msg.created_at,
            raw_timestamp: msg.raw_timestamp || msg.sent_at || msg.created_at, // Include raw timestamp for accurate sorting
            timestamp: msg.timestamp,
            isCurrentUser: msg.isCurrentUser,
            read: msg.read,
            isEdited: msg.isEdited,
            isDeleted: msg.isDeleted,
            type: msg.type,
            attachment: msg.attachment,
          }));

        sessionStorage.setItem(
          conversationKey,
          JSON.stringify(optimizedMessages)
        );
        console.log(
          `[ChatArea] Saved ${optimizedMessages.length} messages to session storage`
        );
      } catch (error) {
        console.warn("[ChatArea] Failed to save to session storage:", error);
        // Handle QuotaExceededError by keeping only 50 latest messages
        if (
          error instanceof DOMException &&
          error.name === "QuotaExceededError"
        ) {
          try {
            // Sort by timestamp to ensure newest messages are kept
            const sortedMessages = [...messagesList].sort((a, b) => {
              const timeA = new Date(
                a.raw_timestamp || a.sent_at || a.created_at || a.timestamp || 0
              ).getTime();
              const timeB = new Date(
                b.raw_timestamp || b.sent_at || b.created_at || b.timestamp || 0
              ).getTime();
              return timeB - timeA; // Descending order (newest first)
            });

            // Take only the 50 newest messages
            const reducedMessages = sortedMessages.slice(0, 50);
            const conversationKey = `chat_${friendId}`;
            sessionStorage.setItem(
              conversationKey,
              JSON.stringify(reducedMessages)
            );
          } catch (retryError) {
            console.error(
              "[ChatArea] Failed to save reduced messages:",
              retryError
            );
          }
        }
      }
    },
    [friendId]
  );

  // Load messages from session storage
  const loadFromSessionStorage = useCallback((): Message[] => {
    if (!friendId) return [];

    try {
      const conversationKey = `chat_${friendId}`;
      const stored = sessionStorage.getItem(conversationKey);
      if (stored) {
        const parsedMessages = JSON.parse(stored);
        console.log(
          `[ChatArea] Loaded ${parsedMessages.length} messages from session storage`
        );
        return parsedMessages;
      }
    } catch (error) {
      console.warn("[ChatArea] Failed to load from session storage:", error);
    }
    return [];
  }, [friendId]);

  // Enhanced message validation and processing
  const processApiMessages = useCallback(
    (messagesArray: any[]): Message[] => {
      return messagesArray.map((message: any) => {
        // Ensure consistent message structure with proper timestamp handling
        const processedMessage: Message = {
          ...message,
          id:
            message.id ||
            message.message_id ||
            `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message_id: message.message_id || message.id,
          receiver_id: message.receiver_id || message.recipient_id, // Ensure receiver_id is set
          recipient_id: message.recipient_id || message.receiver_id, // Ensure recipient_id is set
          isCurrentUser: isCurrentUserMessage(message),
          // Format timestamp for display using priority: sent_at > created_at > timestamp
          timestamp: formatTimestamp(
            message.sent_at || message.created_at || message.timestamp
          ),
          // Preserve raw timestamp for accurate sorting
          raw_timestamp:
            message.sent_at || message.created_at || message.timestamp,
          created_at:
            message.created_at || message.sent_at || new Date().toISOString(),
          sent_at: message.sent_at, // Keep original sent_at
          content: message.content || "",
          // Normalize boolean fields
          read: Boolean(message.read || message.is_read),
          isEdited: Boolean(message.isEdited || message.is_edited),
          isDeleted: Boolean(message.isDeleted || message.is_deleted),
          pending: Boolean(message.pending),
          failed: Boolean(message.failed),
        };

        return processedMessage;
      });
    },
    [isCurrentUserMessage]
  );

  // Enhanced message loading with session storage integration (Vue.js style)
  useEffect(() => {
    // Skip if friendId hasn't changed or is null
    if (!friendId || friendId === previousFriendIdRef.current) return;

    // Update ref to track current friendId
    previousFriendIdRef.current = friendId;

    // Reset state for new conversation
    setFilteredMessages([]);
    setShowDropdown(null);
    setEditingMessageId(null);
    setInputMessage("");
    setIsSearching(false);

    setIsLoading(true);
    console.log(`[ChatArea] Loading data for recipient ID: ${friendId}`);

    // 1. Load cached messages first for instant display (Vue.js style)
    const cachedMessages = loadFromSessionStorage();
    if (cachedMessages.length > 0) {
      console.log(
        `[ChatArea] Displaying ${cachedMessages.length} cached messages for instant UX`
      );
      const processedCachedMessages = processApiMessages(cachedMessages);
      setLocalMessages(processedCachedMessages);
      setIsLoading(false); // Hide loading for cached content

      // Scroll to bottom after cached messages are displayed
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      // No cached messages, keep loading state
      setLocalMessages([]);
    }

    // 2. Load friend details
    getFriendById(friendId)
      .then((response) => {
        if (response && isMountedRef.current) {
          setRecipientData({
            ...response,
            display_name:
              response.full_name || response.display_name || response.name,
          });
        }
      })
      .catch((err) => {
        console.error("[ChatArea] Error loading friend details:", err);
        if (isMountedRef.current) {
          toast.error("Could not load contact information");
        }
      });

    // 3. Always load fresh messages from API, even if cached messages are available
    // This ensures we have the latest messages, including any sent while in other rooms
    const loadFreshMessages = async () => {
      try {
        console.log(
          `[ChatArea] Fetching fresh messages from API for ${friendId}`
        );
        // Always get the latest messages when switching rooms
        const response = await getMessages(friendId);

        if (!isMountedRef.current) return; // Stop if component unmounted

        // Extract messages from the API response
        let messagesArray = [];

        // Check if response indicates an error state
        if (response && response.success === false) {
          console.warn(`[ChatArea] API returned error response:`, response);

          // Handle specific error cases
          if (
            response.errorCode === "ALL_METHODS_FAILED" ||
            response.error?.includes("Could not retrieve message history")
          ) {
            console.log(
              "[ChatArea] Message history retrieval failed, using cached messages"
            );
            // Don't throw error, just use cached messages
            messagesArray = [];
          } else {
            // For other errors, still try to extract any messages that might be present
            messagesArray = response.messages || response.data || [];
          }
        } else {
          // Normal response processing
          if (Array.isArray(response)) {
            messagesArray = response;
          } else if (response && Array.isArray(response.data)) {
            messagesArray = response.data;
          } else if (response && Array.isArray(response.messages)) {
            messagesArray = response.messages;
          } else if (response && typeof response === "object") {
            // Find the first array property in the response
            const arrayProps = Object.entries(response)
              .filter(([_, value]) => Array.isArray(value))
              .sort(([_, a], [__, b]) =>
                Array.isArray(b)
                  ? b.length - (Array.isArray(a) ? a.length : 0)
                  : 0
              );

            if (arrayProps.length > 0) {
              const [propName, array] = arrayProps[0];
              console.log(
                `[ChatArea] Found messages in '${propName}' property`
              );
              messagesArray = array;
            }
          }
        }

        // Add this enhanced logic to ensure latest messages are properly displayed
        if (messagesArray.length > 0) {
          console.log(
            `[ChatArea] Loaded ${messagesArray.length} fresh messages from API`
          );

          const processedMessages = processApiMessages(messagesArray);

          // Enhanced deduplication: compare with cached messages
          const currentMessageIds = new Set(localMessages.map((msg) => msg.id));
          const newMessages = processedMessages.filter(
            (msg) => !currentMessageIds.has(msg.id)
          );

          if (newMessages.length > 0) {
            console.log(
              `[ChatArea] Found ${newMessages.length} new messages from API`
            );
            setLocalMessages((prev) => {
              // Merge cached and fresh messages, removing duplicates
              const allMessages = [...prev, ...newMessages];
              const uniqueMessages = allMessages.filter(
                (msg, index, arr) =>
                  arr.findIndex((m) => m.id === msg.id) === index
              );

              // Sort by timestamp
              const sortedMessages = uniqueMessages.sort((a, b) => {
                // Use raw_timestamp for most accurate sorting, fallback to other timestamps
                const timeA = new Date(
                  a.raw_timestamp ||
                    a.sent_at ||
                    a.created_at ||
                    a.timestamp ||
                    0
                ).getTime();
                const timeB = new Date(
                  b.raw_timestamp ||
                    b.sent_at ||
                    b.created_at ||
                    b.timestamp ||
                    0
                ).getTime();
                return timeA - timeB;
              });

              // Save to session storage for next time
              saveToSessionStorage(sortedMessages);

              return sortedMessages;
            });
          } else {
            // No new messages found in the API response that aren't already in local state
            // Check if we need to update anyway - compare message counts
            if (processedMessages.length > localMessages.length) {
              console.log(
                "[ChatArea] API has more messages than local state, updating"
              );
              setLocalMessages(processedMessages);
              saveToSessionStorage(processedMessages);
            } else if (
              processedMessages.length > 0 &&
              cachedMessages.length === 0
            ) {
              // First load and we have some messages from API
              setLocalMessages(processedMessages);
              saveToSessionStorage(processedMessages);
            } else {
              console.log("[ChatArea] Local state is already up to date");
            }
          }
        } else {
          console.log(`[ChatArea] No messages found for ${friendId}`);
          if (cachedMessages.length === 0) {
            setLocalMessages([]);
          }
          // Clear session storage if no messages
          saveToSessionStorage([]);
        }
      } catch (error: any) {
        console.error("[ChatArea] Error loading fresh messages:", error);

        // Handle specific API error cases
        if (
          error?.message?.includes("ALL_METHODS_FAILED") ||
          error?.errorCode === "ALL_METHODS_FAILED"
        ) {
          console.warn(
            "[ChatArea] All message retrieval methods failed, using cached messages only"
          );

          // If we have cached messages, use them and don't show error
          if (cachedMessages.length > 0) {
            console.log("[ChatArea] Using cached messages as fallback");
            // Keep the cached messages already displayed
          } else {
            // No cached messages available, show empty state
            console.log(
              "[ChatArea] No cached messages available, showing empty state"
            );
            setLocalMessages([]);
            if (isMountedRef.current) {
              // Show a more informative message for connection issues
              toast(
                "Unable to load message history. Please check your connection and try again.",
                {
                  duration: 4000,
                  position: "top-center",
                  icon: "⚠️",
                }
              );
            }
          }
        } else if (error?.message?.includes("MAX_RETRIES_EXCEEDED")) {
          console.warn(
            "[ChatArea] Maximum retries exceeded for message loading"
          );
          if (isMountedRef.current && cachedMessages.length === 0) {
            toast(
              "Message loading is temporarily unavailable. Please try again later.",
              {
                duration: 4000,
                position: "top-center",
                icon: "⚠️",
              }
            );
          }
        } else {
          // Generic error handling
          if (isMountedRef.current && cachedMessages.length === 0) {
            toast.error("Could not load messages");
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Load fresh messages (either in background or foreground)
    loadFreshMessages();

    return () => {
      // Nothing to clean up for this effect
    };
  }, [
    friendId,
    getFriendById,
    getMessages,
    isCurrentUserMessage,
    loadFromSessionStorage,
    processApiMessages,
    saveToSessionStorage,
  ]);

  // Enhanced WebSocket event listeners with better deduplication (Vue.js style)
  useEffect(() => {
    if (!friendId) return;

    // Handler for new messages with enhanced deduplication
    const handleNewMessage = (messageData: any) => {
      console.log(
        "[ChatArea] Received new message via WebSocket:",
        messageData
      );

      // Only handle messages for current conversation
      const isRelevantMessage =
        messageData.sender_id === friendId ||
        messageData.recipient_id === friendId ||
        messageData.receiver_id === friendId ||
        messageData.conversation_id === friendId ||
        messageData.chat_room_id === friendId;

      if (!isRelevantMessage) {
        console.log("[ChatArea] Ignoring message for different conversation");
        return;
      }

      const enhancedMessage: Message = {
        id:
          messageData.id ||
          messageData.message_id ||
          `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message_id: messageData.message_id || messageData.id,
        sender_id: messageData.sender_id,
        recipient_id: messageData.recipient_id || messageData.receiver_id,
        receiver_id: messageData.receiver_id || messageData.recipient_id, // Ensure both fields are set
        conversation_id: messageData.conversation_id,
        chat_room_id: messageData.chat_room_id,
        content: messageData.content || messageData.message || "",
        created_at:
          messageData.created_at ||
          messageData.timestamp ||
          new Date().toISOString(),
        raw_timestamp:
          messageData.created_at ||
          messageData.timestamp ||
          messageData.sent_at ||
          new Date().toISOString(), // Store raw timestamp for accurate sorting
        updated_at: messageData.updated_at,
        type: messageData.type || messageData.message_type || "text",
        isCurrentUser: isCurrentUserMessage(messageData),
        read: Boolean(messageData.read || messageData.is_read),
        isEdited: Boolean(messageData.isEdited || messageData.is_edited),
        isDeleted: Boolean(messageData.isDeleted || messageData.is_deleted),
        fromWebSocket: true,
        receivedViaWebSocket: true,
        sender: messageData.sender,
        attachment: messageData.attachment,
        timestamp: formatTimestamp(
          messageData.created_at || messageData.timestamp
        ),
      };

      // Enhanced deduplication with multiple ID checks
      setLocalMessages((prev) => {
        const messageExists = prev.some((msg) => {
          // Check multiple possible ID matches
          const msgIds = [msg.id, msg.message_id].filter(Boolean);
          const newMsgIds = [
            enhancedMessage.id,
            enhancedMessage.message_id,
          ].filter(Boolean);

          // Check if any ID combination matches
          return (
            msgIds.some((id) => newMsgIds.includes(id)) ||
            // Content-based deduplication for edge cases
            (msg.content === enhancedMessage.content &&
              Math.abs(
                new Date(msg.created_at).getTime() -
                  new Date(enhancedMessage.created_at).getTime()
              ) < 1000)
          );
        });

        if (messageExists) {
          console.log(
            "[ChatArea] Duplicate WebSocket message filtered out:",
            enhancedMessage.id
          );
          return prev;
        }

        console.log(
          "[ChatArea] Adding new WebSocket message:",
          enhancedMessage.id
        );
        const updatedMessages = [...prev, enhancedMessage].sort((a, b) => {
          // Use raw_timestamp for most accurate sorting, fallback to other timestamps
          const timeA = new Date(
            a.raw_timestamp || a.sent_at || a.created_at || a.timestamp || 0
          ).getTime();
          const timeB = new Date(
            b.raw_timestamp || b.sent_at || b.created_at || b.timestamp || 0
          ).getTime();
          return timeA - timeB;
        });

        // Important: Always update session storage with new messages
        saveToSessionStorage(updatedMessages);

        return updatedMessages;
      });

      // Show toast notification if not from current user
      if (!isCurrentUserMessage(messageData)) {
        const senderName =
          messageData.sender?.name ||
          messageData.sender?.display_name ||
          messageData.sender?.full_name ||
          "Someone";
        toast.success(`New message from ${senderName}`, {
          duration: 3000,
          position: "top-right",
        });
      }

      // Auto-scroll to bottom for new messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };

    // Handler for typing status with enhanced validation
    const handleTypingStatus = (data: {
      userId: string;
      recipientId: string;
      isTyping: boolean;
      user?: any;
    }) => {
      // Only show typing indicator for current conversation
      if (data.userId === friendId || data.recipientId === currentUserId) {
        setIsTyping(data.isTyping);
        console.log("[ChatArea] Updated typing status:", {
          user: data.user?.name || data.userId,
          isTyping: data.isTyping,
        });

        // Auto-clear typing indicator after 5 seconds
        if (data.isTyping) {
          setTimeout(() => {
            setIsTyping(false);
          }, 5000);
        }
      }
    };

    // Handler for message read status updates
    const handleMessageRead = (data: {
      messageId: string;
      conversationId: string;
      userId: string;
    }) => {
      if (data.conversationId === friendId || data.userId === friendId) {
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId || msg.message_id === data.messageId
              ? { ...msg, read: true, is_read: true }
              : msg
          )
        );
        console.log("[ChatArea] Message marked as read:", data.messageId);
      }
    };

    // Handler for message updates (edit/delete)
    const handleMessageUpdate = (data: {
      messageId: string;
      content?: string;
      isDeleted?: boolean;
      isEdited?: boolean;
    }) => {
      setLocalMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId || msg.message_id === data.messageId) {
            return {
              ...msg,
              content: data.content !== undefined ? data.content : msg.content,
              isDeleted:
                data.isDeleted !== undefined ? data.isDeleted : msg.isDeleted,
              isEdited:
                data.isEdited !== undefined ? data.isEdited : msg.isEdited,
            };
          }
          return msg;
        })
      );
      console.log("[ChatArea] Message updated via WebSocket:", data.messageId);
    };

    // Register enhanced event listeners
    eventBus.on("new_message", handleNewMessage);
    eventBus.on("message_received", handleNewMessage); // Alternative event name
    eventBus.on("typing-status-changed", handleTypingStatus);
    eventBus.on("user_typing", handleTypingStatus); // Alternative event name
    eventBus.on("message_read", handleMessageRead);
    eventBus.on("message_updated", handleMessageUpdate);
    eventBus.on("message_deleted", handleMessageUpdate);

    // Cleanup
    return () => {
      eventBus.off("new_message", handleNewMessage);
      eventBus.off("message_received", handleNewMessage);
      eventBus.off("typing-status-changed", handleTypingStatus);
      eventBus.off("user_typing", handleTypingStatus);
      eventBus.off("message_read", handleMessageRead);
      eventBus.off("message_updated", handleMessageUpdate);
      eventBus.off("message_deleted", handleMessageUpdate);
    };
  }, [friendId, currentUserId, isCurrentUserMessage, saveToSessionStorage]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!friendId || !currentUserId) return;

    console.log(`[ChatArea] Setting up WebSocket for chat with ${friendId}`);

    const setupWebSocket = async () => {
      // Connect to WebSocket if not already connected
      if (!isConnected && !isConnecting) {
        console.log("[ChatArea] Initiating WebSocket connection...");
        await connect();
      }

      // Subscribe to private messages for this conversation
      if (isConnected) {
        console.log(`[ChatArea] Subscribing to messages with ${friendId}`);
        subscribeToPrivateMessages(friendId);
      }
    };

    setupWebSocket();

    // Cleanup
    return () => {
      // Unsubscribe from WebSocket events
      if (isConnected) {
        console.log(`[ChatArea] Unsubscribing from messages with ${friendId}`);
        unsubscribeFromPrivateMessages(friendId);
      }
    };
  }, [
    friendId,
    currentUserId,
    connect,
    isConnected,
    isConnecting,
    subscribeToPrivateMessages,
    unsubscribeFromPrivateMessages,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [localMessages]);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Clear any pending timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // HANDLERS

  // Enhanced message sending with optimistic updates and retry mechanisms (Vue.js style)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !friendId || isSending) return;

    const messageContent = inputMessage.trim();
    setInputMessage(""); // Clear input early for better UX
    setIsSending(true);

    // Generate unique temp ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      // Create optimistic message for immediate UI feedback
      const nowIsoString = new Date().toISOString();
      const optimisticMessage: Message = {
        id: tempId,
        message_id: tempId,
        content: messageContent,
        created_at: nowIsoString,
        timestamp: formatTimestamp(nowIsoString),
        raw_timestamp: nowIsoString, // Store raw timestamp for accurate sorting
        sender_id: currentUserId,
        recipient_id: friendId,
        receiver_id: friendId, // Add receiver_id for consistency with API standard
        isCurrentUser: true,
        pending: true,
        read: false,
        type: "text",
        sent: false,
        failed: false,
        retryCount: 0,
      };

      // Add optimistic message to UI immediately
      setLocalMessages((prev) => {
        const updatedMessages = [...prev, optimisticMessage].sort((a, b) => {
          // Use raw_timestamp for most accurate sorting, fallback to other timestamps
          const timeA = new Date(
            a.raw_timestamp || a.created_at || a.sent_at || a.timestamp || 0
          ).getTime();
          const timeB = new Date(
            b.raw_timestamp || b.created_at || b.sent_at || b.timestamp || 0
          ).getTime();
          return timeA - timeB;
        });
        return updatedMessages;
      });

      // Auto-scroll to show the new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      let response: any = null;
      let messageId = tempId;

      // Enhanced sending logic with WebSocket priority and API fallback
      if (isConnected) {
        console.log(`[ChatArea] Sending message via WebSocket to ${friendId}`);
        try {
          const wsResult = await sendPrivateMessage(friendId, messageContent);
          console.log(
            "[ChatArea] Message sent via WebSocket successfully",
            wsResult
          );

          // WebSocket returns boolean, use temp ID for now
          if (wsResult) {
            // Keep temp ID for WebSocket messages since they don't return message ID
            messageId = tempId;
          }
        } catch (wsError) {
          console.warn(
            "[ChatArea] WebSocket send failed, falling back to API:",
            wsError
          );
          response = await sendMessage(friendId, messageContent);

          if (
            response &&
            typeof response === "object" &&
            response.data &&
            (response.data.id || response.data.message_id)
          ) {
            messageId = response.data.id || response.data.message_id;
          }
        }
      } else {
        console.log(`[ChatArea] WebSocket not connected, sending via API`);
        response = await sendMessage(friendId, messageContent);

        if (
          response &&
          typeof response === "object" &&
          response.data &&
          (response.data.id || response.data.message_id)
        ) {
          messageId = response.data.id || response.data.message_id;
        }
      }

      // Update optimistic message with successful state
      setLocalMessages((prev) => {
        const updatedMessages = prev.map((msg) => {
          if (msg.id === tempId) {
            return {
              ...msg,
              id: messageId,
              message_id: messageId,
              receiver_id: friendId, // Ensure receiver_id is set to friendId
              recipient_id: friendId, // Ensure recipient_id is set to friendId
              pending: false,
              sent: true,
              failed: false,
              sourceApi: !isConnected, // Track if sent via API fallback
              // Include any additional data from response
              ...(response && typeof response === "object" ? response : {}),
            };
          }
          return msg;
        });

        // Update session storage with successful message
        saveToSessionStorage(updatedMessages);
        return updatedMessages;
      });

      console.log(`[ChatArea] Message sent successfully with ID: ${messageId}`);
    } catch (error) {
      console.error("[ChatArea] Error sending message:", error);

      // Update optimistic message to show failure state
      setLocalMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === tempId) {
            return {
              ...msg,
              pending: false,
              failed: true,
              sent: false,
              errorMessage:
                error instanceof Error
                  ? error.message
                  : "Failed to send message",
              retryCount: (msg.retryCount || 0) + 1,
            };
          }
          return msg;
        })
      );

      // Show error notification
      toast.error("Failed to send message. Click the message to retry.", {
        duration: 5000,
        position: "top-center",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Enhanced retry mechanism for failed messages
  const retryFailedMessage = useCallback(
    async (message: Message) => {
      if (!message.content || !friendId) return;

      console.log(`[ChatArea] Retrying failed message: ${message.id}`);

      // Update message to show retrying state
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id
            ? { ...msg, retrying: true, failed: false, errorMessage: undefined }
            : msg
        )
      );

      try {
        let response: any = null;
        let messageId = message.id;

        // Retry with same logic as new messages
        if (isConnected) {
          try {
            const wsResult = await sendPrivateMessage(
              friendId,
              message.content
            );
            if (wsResult) {
              // WebSocket successful, keep existing message ID
              messageId = message.id;
            }
          } catch (wsError) {
            console.warn(
              "[ChatArea] WebSocket retry failed, using API:",
              wsError
            );
            response = await sendMessage(friendId, message.content);
            if (
              response &&
              typeof response === "object" &&
              response.data &&
              (response.data.id || response.data.message_id)
            ) {
              messageId = response.data.id || response.data.message_id;
            }
          }
        } else {
          response = await sendMessage(friendId, message.content);
          if (
            response &&
            typeof response === "object" &&
            response.data &&
            (response.data.id || response.data.message_id)
          ) {
            messageId = response.data.id || response.data.message_id;
          }
        }

        // Update message to show success
        setLocalMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.id === message.id
              ? {
                  ...msg,
                  id: messageId,
                  message_id: messageId,
                  receiver_id: friendId, // Ensure receiver_id is set to friendId
                  recipient_id: friendId, // Ensure recipient_id is set to friendId
                  retrying: false,
                  failed: false,
                  sent: true,
                  errorMessage: undefined,
                  retryCount: (msg.retryCount || 0) + 1,
                }
              : msg
          );

          saveToSessionStorage(updatedMessages);
          return updatedMessages;
        });

        toast.success("Message sent successfully!", {
          duration: 2000,
          position: "top-center",
        });
      } catch (error) {
        console.error("[ChatArea] Retry failed:", error);

        // Update message to show retry failure
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id
              ? {
                  ...msg,
                  retrying: false,
                  failed: true,
                  errorMessage:
                    error instanceof Error ? error.message : "Retry failed",
                  retryCount: (msg.retryCount || 0) + 1,
                }
              : msg
          )
        );

        toast.error("Retry failed. Please try again.", {
          duration: 4000,
          position: "top-center",
        });
      }
    },
    [
      friendId,
      isConnected,
      sendPrivateMessage,
      sendMessage,
      saveToSessionStorage,
    ]
  );

  // Handle typing indicator with enhanced WebSocket integration
  const handleTyping = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing status via WebSocket if connected
    if (isConnected && friendId) {
      try {
        // You would implement sendTypingStatus in your WebSocket context
        // sendTypingStatus(friendId, true);
        console.log(`[ChatArea] Sent typing indicator to ${friendId}`);
      } catch (error) {
        console.warn("[ChatArea] Failed to send typing indicator:", error);
      }
    }

    // Clear typing indicator after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (isConnected && friendId) {
        try {
          // sendTypingStatus(friendId, false);
          console.log(`[ChatArea] Cleared typing indicator for ${friendId}`);
        } catch (error) {
          console.warn("[ChatArea] Failed to clear typing indicator:", error);
        }
      }
    }, 3000);
  }, [isConnected, friendId]);

  // Toggle dropdown menu
  const toggleDropdown = (messageId: string) => {
    setShowDropdown(showDropdown === messageId ? null : messageId);
  };

  // Enhanced edit message functionality
  const handleEditMessage = useCallback(
    (messageId: string) => {
      const message = localMessages.find((msg) => msg.id === messageId);
      if (message && !message.isDeleted && !message.pending) {
        setEditingMessageId(messageId);
        setInputMessage(message.content);
        setShowDropdown(null);
        console.log(`[ChatArea] Editing message: ${messageId}`);
      }
    },
    [localMessages]
  );

  // Handle cancel edit with cleanup
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setInputMessage("");
    console.log("[ChatArea] Edit cancelled");
  }, []);

  // Handle submit edit
  const handleSubmitEdit = useCallback(async () => {
    if (!editingMessageId || !inputMessage.trim()) return;

    const messageContent = inputMessage.trim();
    const originalMessage = localMessages.find(
      (msg) => msg.id === editingMessageId
    );

    if (!originalMessage) return;

    setIsSending(true);

    try {
      // Update message optimistically
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId
            ? {
                ...msg,
                content: messageContent,
                isEdited: true,
                pending: true,
              }
            : msg
        )
      );

      // Call edit API
      const response = await editMessage(editingMessageId, messageContent);

      // Update with successful edit
      setLocalMessages((prev) => {
        const updatedMessages = prev.map((msg) =>
          msg.id === editingMessageId
            ? {
                ...msg,
                content: messageContent,
                isEdited: true,
                pending: false,
                updated_at: new Date().toISOString(),
              }
            : msg
        );

        // Update session storage
        saveToSessionStorage(updatedMessages);
        return updatedMessages;
      });

      // Clear edit state
      setEditingMessageId(null);
      setInputMessage("");

      toast.success("Message updated successfully", {
        duration: 3000,
        position: "top-center",
      });
      console.log(
        `[ChatArea] Message edited successfully: ${editingMessageId}`
      );
    } catch (error) {
      console.error("[ChatArea] Error editing message:", error);

      // Revert optimistic update
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId
            ? { ...originalMessage, pending: false }
            : msg
        )
      );

      toast.error("Failed to edit message", {
        duration: 4000,
        position: "top-center",
      });
    } finally {
      setIsSending(false);
    }
  }, [
    editingMessageId,
    inputMessage,
    localMessages,
    editMessage,
    saveToSessionStorage,
  ]);

  // Enhanced delete/unsend message with confirmation
  const handleUnsendMessage = useCallback(
    async (messageId: string) => {
      const message = localMessages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Show confirmation using react-hot-toast instead of window.confirm
      const shouldDelete = await new Promise<boolean>((resolve) => {
        toast(
          (t) => (
            <div className="flex flex-col">
              <p className="font-medium">Delete Message</p>
              <p className="text-sm text-gray-600 mb-3">
                Are you sure you want to delete this message? This action cannot
                be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(true);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(false);
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ),
          {
            duration: Infinity,
            style: { minWidth: "300px" },
          }
        );
      });

      if (!shouldDelete) return;

      try {
        // Optimistically mark as deleted
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  isDeleted: true,
                  content: "This message was deleted",
                  pending: true,
                }
              : msg
          )
        );

        await deleteMessage(messageId);

        // Confirm deletion
        setLocalMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.id === messageId ? { ...msg, pending: false } : msg
          );

          // Update session storage
          saveToSessionStorage(updatedMessages);
          return updatedMessages;
        });

        setShowDropdown(null);
        toast.success("Message deleted successfully", {
          duration: 3000,
          position: "top-center",
        });
        console.log(`[ChatArea] Message deleted: ${messageId}`);
      } catch (error) {
        console.error("[ChatArea] Error deleting message:", error);

        // Revert optimistic deletion
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...message, pending: false } : msg
          )
        );

        toast.error("Failed to delete message. Please try again.", {
          duration: 4000,
          position: "top-center",
        });
      }
    },
    [localMessages, deleteMessage, saveToSessionStorage]
  );

  // Handle search
  const handleAdvancedSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim()) {
      setIsSearching(true);
      setFilteredMessages(
        localMessages.filter((msg) =>
          msg.content.toLowerCase().includes(query.toLowerCase())
        )
      );
    } else {
      clearSearch();
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setFilteredMessages([]);
    setIsSearching(false);
    setShowSearch(false);
  };

  // Handle scroll for loading more messages
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollTop === 0 && !isLoadingMore) {
      // Load more messages when scrolled to top
      // Implementation would go here if the API supports pagination
    }
  };

  // Handle file attachment button
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
      setIsAttachmentMenuOpen(false);
    }
  };

  // Handle image attachment button
  const handleImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
      setIsAttachmentMenuOpen(false);
    }
  };

  // Enhanced form submission handler for both new messages and edits
  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Handle edit submission
      if (editingMessageId) {
        await handleSubmitEdit();
        return;
      }

      // Handle new message submission
      await handleSendMessage(e);
    },
    [editingMessageId, handleSubmitEdit, handleSendMessage]
  );

  return (
    <div className="flex h-full bg-white">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header with recipient info */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                {recipient.profile_picture_url ? (
                  <img
                    src={recipient.profile_picture_url}
                    alt={recipient.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FaUser className="h-6 w-6 text-gray-500" />
                )}
              </div>
              {recipient.status === "online" && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">
                {recipient.name || "Contact"}
              </h2>
              <p className="text-xs text-gray-500">
                {recipient.status === "online" ? "Online" : "Offline"}
                {isTyping && (
                  <span className="ml-2 text-blue-500">typing...</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
              title="Search in conversation"
            >
              <FaSearch className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 ${
                showInfo ? "text-blue-500" : ""
              }`}
              title="View info"
            >
              <FaInfoCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search component */}
        <SearchOnFriend
          isOpen={showSearch}
          onClose={clearSearch}
          onSearch={handleAdvancedSearch}
        />

        {/* Messages container */}
        <div
          className="flex-1 overflow-auto p-6 space-y-4 relative"
          ref={messagesContainer}
          onScroll={handleScroll}
        >
          {/* Loading indicator for older messages */}
          {isLoadingMore && (
            <div className="text-center py-2">
              <span className="inline-flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                Loading older messages...
              </span>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 z-10">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-sm text-gray-500">
                  Loading messages...
                </p>
              </div>
            </div>
          )}

          {/* No messages placeholder */}
          {!isLoading && localMessages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={
                  isSearching
                    ? "text-center text-gray-500"
                    : "text-center text-gray-500"
                }
              >
                {isSearching ? (
                  <>
                    <p className="mb-1">No matching messages found</p>
                    <button
                      onClick={clearSearch}
                      className="text-blue-500 hover:underline"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mb-1">No messages yet</p>
                    <p className="text-sm">
                      Start the conversation by sending a message
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages list with date separators */}
          {groupedMessages.map((group) => (
            <div key={group.dateKey} className="message-group">
              {/* Date separator */}
              <div className="flex justify-center my-4">
                <div className="bg-gray-100 rounded-full px-3 py-1">
                  <span className="text-xs text-gray-600 font-medium">
                    {group.isToday
                      ? "Today"
                      : group.isYesterday
                      ? "Yesterday"
                      : group.date}
                  </span>
                </div>
              </div>

              {/* Messages for this date */}
              {group.messages.map((message) => (
                <div key={message.id} className="message">
                  <div
                    className={`flex ${
                      message.isCurrentUser ? "justify-end" : "justify-start"
                    } mb-4`}
                  >
                    <div className="flex flex-col max-w-[70%]">
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.isCurrentUser
                            ? message.isDeleted
                              ? "bg-gray-200 text-gray-500 italic"
                              : message.failed
                              ? "bg-red-100 border border-red-300 text-gray-800"
                              : "bg-blue-500 text-white"
                            : "bg-white border border-gray-200 text-gray-800"
                        } min-w-[80px] ${
                          message.failed ? "cursor-pointer" : ""
                        }`}
                        onClick={
                          message.failed
                            ? () => retryFailedMessage(message)
                            : undefined
                        }
                      >
                        <p className="break-words whitespace-pre-wrap">
                          {message.content || "(No message content)"}
                        </p>

                        {message.failed && (
                          <p className="text-xs text-red-500 mt-1 flex items-center">
                            ⚠️{" "}
                            {message.errorMessage ||
                              "Failed to send - click to retry"}
                          </p>
                        )}

                        {message.attachment && (
                          <div className="mt-2">
                            {message.attachment.type === "image" ? (
                              <img
                                src={message.attachment.url}
                                alt={message.attachment.name}
                                className="max-w-full rounded"
                              />
                            ) : (
                              <a
                                href={message.attachment.url}
                                download={message.attachment.name}
                                className="text-blue-500 hover:underline"
                              >
                                {message.attachment.name} (
                                {message.attachment.size})
                              </a>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <span
                            className={`text-xs ${
                              message.isCurrentUser
                                ? "text-blue-200"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTimestamp(
                              message.raw_timestamp ||
                                message.sent_at ||
                                message.timestamp ||
                                message.created_at
                            )}
                          </span>

                          {message.isEdited && !message.isDeleted && (
                            <span
                              className={`text-xs ${
                                message.isCurrentUser
                                  ? "text-blue-200"
                                  : "text-gray-500"
                              }`}
                            >
                              (edited)
                            </span>
                          )}

                          {message.isCurrentUser &&
                            !message.failed &&
                            !message.pending && (
                              <span>
                                {message.read ? (
                                  <FaCheckDouble
                                    className="h-3 w-3 text-blue-200"
                                    title="Read"
                                  />
                                ) : (
                                  <FaCheck
                                    className="h-3 w-3 text-blue-200"
                                    title="Sent"
                                  />
                                )}
                              </span>
                            )}

                          {message.pending && (
                            <span className="text-xs text-blue-200">
                              sending...
                            </span>
                          )}
                        </div>

                        {/* Message dropdown actions */}
                        {message.isCurrentUser &&
                          !message.isDeleted &&
                          !message.pending &&
                          !message.failed && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDropdown(message.id);
                                }}
                                className="absolute top-0 right-0 -mt-1 -mr-8 p-1 rounded-full hover:bg-gray-200"
                                aria-label="Message options"
                              >
                                <FaEllipsisV className="h-3 w-3 text-gray-500" />
                              </button>

                              {showDropdown === message.id && (
                                <div
                                  ref={dropdownRef}
                                  className="absolute right-0 mt-1 mr-8 bg-white rounded-md shadow-lg z-10 w-36 py-1"
                                >
                                  <button
                                    onClick={() =>
                                      handleEditMessage(message.id)
                                    }
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <span className="mr-2">✏️</span> Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleUnsendMessage(message.id)
                                    }
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                                  >
                                    <span className="mr-2">🗑️</span> Unsend
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* End of messages indicator for auto-scroll */}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Message input area */}
        <div className="p-4 bg-white border-t border-gray-200">
          {editingMessageId && (
            <div className="flex items-center mb-2 bg-blue-50 p-2 rounded">
              <span className="text-sm text-blue-700 flex-1">
                Editing message
              </span>
              <button
                onClick={handleCancelEdit}
                className="text-gray-600 hover:text-gray-800"
              >
                <FaTimes className="h-4 w-4" />
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="flex flex-col">
            <div className="flex items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                  className={`p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2 ${
                    isAttachmentMenuOpen ? "bg-blue-100 text-blue-600" : ""
                  }`}
                  title="Attach file"
                  disabled={isSending}
                >
                  <FaPaperclip className="h-5 w-5" />
                </button>

                {isAttachmentMenuOpen && (
                  <div
                    className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 animate-fadeIn"
                    style={{ minWidth: "150px" }}
                  >
                    <button
                      type="button"
                      onClick={handleFileUpload}
                      className="flex items-center text-gray-700 hover:bg-blue-50 hover:text-blue-600 mb-2 w-full text-left px-4 py-2 rounded transition-all duration-200"
                      disabled={isSending}
                    >
                      <span className="mr-2">📄</span>
                      <span>File</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      className="flex items-center text-gray-700 hover:bg-blue-50 hover:text-blue-600 w-full text-left px-4 py-2 rounded transition-all duration-200"
                      disabled={isSending}
                    >
                      <span className="mr-2">🖼️</span>
                      <span>Image</span>
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={() => {
                  // File handling would go here
                  toast.success(
                    "File upload feature not implemented in this demo",
                    {
                      duration: 4000,
                      position: "top-center",
                    }
                  );
                }}
                disabled={isSending}
              />

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={() => {
                  // Image handling would go here
                  toast.success(
                    "Image upload feature not implemented in this demo",
                    {
                      duration: 4000,
                      position: "top-center",
                    }
                  );
                }}
                disabled={isSending}
              />

              <input
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  handleTyping();
                }}
                type="text"
                placeholder={
                  editingMessageId
                    ? "Edit your message..."
                    : "Type your message..."
                }
                className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:border-blue-400 text-gray-700"
                disabled={isSending}
              />

              <button
                type="submit"
                className="bg-blue-500 text-white p-3 rounded-full ml-2 hover:bg-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  (!inputMessage.trim() && !editingMessageId) || isSending
                }
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                ) : (
                  <FaPaperPlane className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* WebSocket connection indicator */}
            <div className="mt-1 flex justify-end">
              {isConnected ? (
                <span
                  className="text-xs text-green-500 flex items-center"
                  title="Connected to real-time messaging"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                  Live
                </span>
              ) : isConnecting ? (
                <span
                  className="text-xs text-yellow-500 flex items-center"
                  title="Connecting to real-time messaging"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mr-1 animate-pulse"></span>
                  Connecting...
                </span>
              ) : (
                <span
                  className="text-xs text-red-500 flex items-center"
                  title="Offline - No real-time connection"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1"></span>
                  Offline
                </span>
              )}

              {connectionError && (
                <span
                  className="text-xs text-red-500 ml-2"
                  title={connectionError}
                >
                  Connection error
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Friend Profile Sidebar - rendered as sibling like in group-chat-area */}
      {showInfo && (
        <UserProfileInfo
          friendDetails={{
            id: recipient.id,
            name: recipient.name,
            email: recipient.email || "",
            phone: "",
            status: recipient.status === "online" ? "online" : "offline",
            avatar: recipient.avatar,
            username: recipient.name,
          }}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}

// Also provide default export for compatibility
export default ChatArea;
