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
import {
  formatMessageTimestamp,
  formatDateForSeparator,
} from "@/utils/timestampHelper";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProviderNew";
import { eventBus } from "@/hooks/websocket/useEventBus";
import ChatAreaItem from "./chat-area-item";
import UserProfileInfo from "./friend-info-panel";
import SearchOnFriend from "./search-on-friend";
import { OptimizedAvatar } from "../optimized-avatar";

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
  if (!dateString) {
    console.warn("formatTimestamp called with empty/null dateString");
    return "No Time";
  }

  try {
    // Use 'time' format for HH:MM display in message bubbles like Vue.js
    const result = formatMessageTimestamp({
      timestamp: dateString,
      format: "time",
    });

    // If result is empty, it means the timestamp was invalid
    if (!result) {
      console.warn(
        "formatMessageTimestamp returned empty result for:",
        dateString
      );
      return "No Time";
    }

    return result;
  } catch (error) {
    console.warn(
      "Error in formatTimestamp:",
      error,
      "for dateString:",
      dateString
    );
    return "No Time";
  }
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

  const { getFriendById, recipientData, setRecipientData, blockedUsers } =
    useFriendship();
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

  // Simplified session logging - reduced for production readiness
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[ChatArea] Session:", {
        currentUserId,
        friendId,
        messageCount: localMessages.length,
      });
    }
  }, [currentUserId, friendId, localMessages.length]);

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
      // Log removed for cleaner code
    }

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
    } else {
      // Second priority: Try to construct from API data
      const recipientDataAny = recipientData as any; // Type cast to access additional properties

      // Check if API returned proper first_name and last_name
      if (recipientDataAny.first_name && recipientDataAny.last_name) {
        displayName = `${recipientDataAny.first_name} ${recipientDataAny.last_name}`;
      } else if (
        recipientData.full_name &&
        !recipientData.full_name.startsWith("User ")
      ) {
        displayName = recipientData.full_name;
      } else if (
        recipientData.display_name &&
        !recipientData.display_name.startsWith("User ")
      ) {
        displayName = recipientData.display_name;
      } else if (
        recipientData.name &&
        !recipientData.name.startsWith("User ")
      ) {
        displayName = recipientData.name;
      } else if (recipientData.username) {
        displayName = recipientData.username;
      } else {
        // Last resort: use recipientName even if it's a fallback, or fallback to "User"
        displayName = recipientName || "User";
      }
    }

    // Parse name parts for header display
    const nameParts = displayName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const avatar_url =
      recipientData.profile_picture_url || recipientData.avatar;

    // Create a recipient object with properly typed fields
    return {
      ...recipientData,
      name: displayName,
      profile_picture_url:
        recipientData.profile_picture_url || recipientData.avatar,
      avatar: recipientData.avatar || recipientData.profile_picture_url,
      status: onlineStatus,
      // Use firstName/lastName from our parsing
      first_name: firstName,
      last_name: lastName,
    };
  }, [friendId, recipientName, recipientData, presence]);

  // Debug recipient data for header
  useEffect(() => {
    console.log("[ChatArea] Debug recipient data:", {
      friendId,
      recipientName,
      recipientData: recipientData
        ? {
            id: recipientData.id,
            name: recipientData.name,
            profile_picture_url: recipientData.profile_picture_url,
            avatar: recipientData.avatar,
            avatar_url: (recipientData as any).avatar_url,
            all_keys: Object.keys(recipientData),
          }
        : null,
      finalRecipient: {
        name: recipient.name,
        profile_picture_url: recipient.profile_picture_url,
        avatar: recipient.avatar,
        hasProfilePic: !!recipient.profile_picture_url,
        hasAvatar: !!recipient.avatar,
      },
    });
  }, [friendId, recipientName, recipientData, recipient]);

  // Validate recipient avatar
  const validatedRecipientAvatar = useMemo(() => {
    const avatarUrl = recipient.profile_picture_url || recipient.avatar;
    if (!avatarUrl) return null;

    // Check if it's a data URL
    if (avatarUrl.startsWith("data:")) {
      // Check size limit (most browsers support up to 2MB for data URLs)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (avatarUrl.length > maxSize) {
        console.warn(
          "[ChatArea] Avatar too large:",
          avatarUrl.length,
          "bytes, max:",
          maxSize
        );
        return null; // Fallback to default icon
      }

      // Validate data URL format
      const dataUrlRegex =
        /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,/;
      if (!dataUrlRegex.test(avatarUrl)) {
        console.warn(
          "[ChatArea] Invalid data URL format:",
          avatarUrl.substring(0, 100)
        );
        return null;
      }
    }

    return avatarUrl;
  }, [recipient.profile_picture_url, recipient.avatar]);

  // Simplified message ownership detection - backend now returns reliable sender_id
  const isCurrentUserMessage = useCallback(
    (message: any): boolean => {
      if (!currentUserId || !message) {
        return false;
      }

      const currentUserIdStr = String(currentUserId);
      const senderId = String(message.sender_id || message.sender?.id || "");

      // Temp messages are always from current user
      if (message.id?.startsWith("temp-")) {
        return true;
      }

      // Simple check - backend now returns correct sender_id consistently
      return senderId === currentUserIdStr;
    },
    [currentUserId]
  ); // Function to filter out messages from blocked users (for current user only)
  const filterBlockedMessages = useCallback(
    (messages: Message[]): Message[] => {
      if (!blockedUsers || blockedUsers.length === 0) {
        return messages; // No blocked users, return all messages
      }

      const filtered = messages.filter((message) => {
        // If current user sent the message, always show it
        if (message.isCurrentUser) {
          return true;
        }

        // Check if message is from a blocked user
        const senderId = message.sender_id;
        if (senderId) {
          const isBlocked = blockedUsers.some((blockedUser) => {
            // For individual chats, blockedUsers are of type User[] and only have id field
            const blockedUserId = blockedUser.id;
            const match = blockedUserId === senderId;

            if (match) {
              console.log(
                `[ChatArea] Found blocked user match: sender=${senderId}, blocked=${blockedUserId}`
              );
            }

            return match;
          });

          if (isBlocked) {
            console.log(
              `[ChatArea] Filtering out message from blocked user: ${senderId}`
            );
            return false; // Hide message from blocked user
          }
        }

        return true; // Show message if not from blocked user
      });

      if (filtered.length !== messages.length) {
        console.log(
          `[ChatArea] Filtered ${
            messages.length - filtered.length
          } messages from blocked users`
        );
        console.log(
          `[ChatArea] Blocked users list:`,
          blockedUsers.map((u) => ({ id: u.id, name: u.name }))
        );
      }

      return filtered;
    },
    [blockedUsers]
  );

  // Debug function to check current session and message data
  const debugSessionAndMessages = useCallback(() => {
    // Simple debug function - logs removed for cleaner production code
    // Basic session validation
    const sessionValid = !!(session && currentUserId && friendId);
    const messageCount = localMessages.length;

    if (!sessionValid) {
      toast.error("Session validation failed", {
        duration: 2000,
        position: "top-center",
      });
      return;
    }

    toast.success(`Debug: ${messageCount} messages loaded`, {
      duration: 2000,
      position: "top-center",
    });
  }, [session, currentUserId, friendId, localMessages]);

  // Enhanced message grouping by date with better formatting
  const groupedMessages = useMemo(() => {
    if (!localMessages || !Array.isArray(localMessages)) return [];

    // First filter out messages from blocked users
    const filteredMessages = filterBlockedMessages(localMessages);

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

    // Sort filtered messages by timestamp first
    const sortedMessages = [...filteredMessages].sort((a, b) => {
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
        console.warn("Invalid date for message:", {
          messageId: message.id,
          content: message.content?.substring(0, 20),
          raw_timestamp: message.raw_timestamp,
          sent_at: message.sent_at,
          created_at: message.created_at,
          timestamp: message.timestamp,
          allTimestamps: {
            raw_timestamp: message.raw_timestamp,
            sent_at: message.sent_at,
            created_at: message.created_at,
            timestamp: message.timestamp,
          },
        });
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

      // Backend data is now reliable - no need to recalculate ownership
      const validatedMessage = {
        ...message,
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
  }, [localMessages, filterBlockedMessages]);

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

  // Comprehensive function to debug and fix recipient_ids issues
  const debugAndFixRecipientIds = useCallback(() => {
    // Analyze current messages for recipient_id issues
    const problematicMessages: any[] = [];
    const fixedMessages: Message[] = [];

    localMessages.forEach((msg) => {
      const isProblematic =
        !msg.recipient_id || msg.recipient_id === "undefined";

      if (isProblematic) {
        problematicMessages.push(msg);

        // Attempt to fix the message
        let fixedRecipientId = msg.recipient_id;

        // Fix logic: infer recipient_id based on sender_id
        if (!fixedRecipientId || fixedRecipientId === "undefined") {
          if (msg.sender_id === String(currentUserId)) {
            // Current user sent this message, recipient should be friend
            fixedRecipientId = friendId;
          } else if (msg.sender_id === String(friendId)) {
            // Friend sent this message, recipient should be current user
            fixedRecipientId = String(currentUserId);
          } else if (msg.receiver_id && msg.receiver_id !== "undefined") {
            // Use receiver_id as fallback
            fixedRecipientId = msg.receiver_id;
          }
        }

        // Create fixed message
        const fixedMessage: Message = {
          ...msg,
          recipient_id: fixedRecipientId,
          receiver_id: fixedRecipientId, // Also update receiver_id for consistency
        };

        // Recalculate ownership
        fixedMessage.isCurrentUser = isCurrentUserMessage(fixedMessage);
        fixedMessages.push(fixedMessage);
      }
    });

    // Store fixes for potential application
    if (fixedMessages.length > 0) {
      (window as any).__messageFixData = {
        fixedMessages,
        originalProblematicMessages: problematicMessages,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      total: localMessages.length,
      problematic: problematicMessages.length,
      fixed: fixedMessages.length,
      recommendations:
        problematicMessages.length > 0
          ? [
              `Found ${problematicMessages.length} messages with missing/invalid recipient_id`,
            ]
          : [],
    };
  }, [
    localMessages,
    currentUserId,
    friendId,
    recipient.name,
    isCurrentUserMessage,
  ]);

  // Function to apply recipient_id fixes stored by debugAndFixRecipientIds
  const applyRecipientIdFixes = useCallback(() => {
    const fixData = (window as any).__messageFixData;
    if (!fixData || !fixData.fixedMessages) {
      toast.error("No fixes available. Run debugAndFixRecipientIds first.", {
        duration: 3000,
        position: "top-center",
      });
      return;
    }

    // Create a map of message ID to fixed data
    const fixMap = new Map();
    fixData.fixedMessages.forEach((fixed: Message) => {
      fixMap.set(fixed.id, fixed);
    });

    // Apply fixes to local messages
    setLocalMessages((prev) => {
      const updatedMessages = prev.map((msg) => {
        const fix = fixMap.get(msg.id);
        if (fix) {
          return fix;
        }
        return msg;
      });

      // Save to session storage
      saveToSessionStorage(updatedMessages);
      return updatedMessages;
    });

    toast.success(
      `Applied ${fixData.fixedMessages.length} recipient_id fixes!`,
      {
        duration: 3000,
        position: "top-center",
      }
    );

    // Clear fix data
    delete (window as any).__messageFixData;
  }, [saveToSessionStorage]);

  // Remove auto-fix effects - backend is now consistent and reliable

  // Load messages from session storage
  const loadFromSessionStorage = useCallback((): Message[] => {
    if (!friendId) return [];

    try {
      const conversationKey = `chat_${friendId}`;
      const stored = sessionStorage.getItem(conversationKey);
      if (stored) {
        const parsedMessages = JSON.parse(stored);
        return parsedMessages;
      }
    } catch (error) {
      console.warn("[ChatArea] Failed to load from session storage:", error);
    }
    return [];
  }, [friendId]);

  // Simplified API response debug (development only)
  const debugApiResponse = useCallback(
    (response: any, source: string) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[ChatArea] API ${source}:`, {
          messageCount: Array.isArray(response)
            ? response.length
            : response?.data?.length || 0,
          hasData: !!(response && (Array.isArray(response) || response.data)),
          currentUserId,
          friendId,
        });
      }
    },
    [currentUserId, friendId]
  );

  // Enhanced message validation and processing - backend now returns consistent data
  const processApiMessages = useCallback(
    (messagesArray: any[]): Message[] => {
      return messagesArray.map((message: any) => {
        // Enhanced recipient_id extraction from multiple possible sources
        let extractedRecipientId = message.recipient_id || message.receiver_id;

        // Basic fallback for recipient_id
        if (!extractedRecipientId && currentUserId && friendId) {
          if (message.sender_id === String(currentUserId)) {
            extractedRecipientId = friendId;
          } else if (message.sender_id === String(friendId)) {
            extractedRecipientId = String(currentUserId);
          }
        }

        const rawTimestamp =
          message.sent_at || message.created_at || message.timestamp;

        const processedMessage: Message = {
          ...message,
          id:
            message.id ||
            message.message_id ||
            `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message_id: message.message_id || message.id,
          sender_id: message.sender_id, // Backend now returns correct sender_id
          receiver_id: message.receiver_id || extractedRecipientId,
          recipient_id: extractedRecipientId || message.receiver_id,
          timestamp: formatTimestamp(rawTimestamp),
          raw_timestamp: rawTimestamp || new Date().toISOString(),
          created_at:
            message.created_at || message.sent_at || new Date().toISOString(),
          sent_at: message.sent_at,
          content: message.content || "",
          read: Boolean(message.read || message.is_read),
          isEdited: Boolean(message.isEdited || message.is_edited),
          isDeleted: Boolean(message.isDeleted || message.is_deleted),
          pending: Boolean(message.pending),
          failed: Boolean(message.failed),
          isCurrentUser: false, // Will be set below
        };

        // Simple ownership calculation - backend sender_id is now reliable
        processedMessage.isCurrentUser = isCurrentUserMessage(processedMessage);

        return processedMessage;
      });
    },
    [isCurrentUserMessage, currentUserId, friendId]
  );

  // Enhanced message loading with session storage integration (Vue.js style)
  useEffect(() => {
    // Skip if friendId hasn't changed or is null
    if (!friendId || friendId === previousFriendIdRef.current) return;

    // Update ref to track current friendId
    previousFriendIdRef.current = friendId;

    // Reset state for new conversation
    setFilteredMessages([]);
    setEditingMessageId(null);
    setInputMessage("");
    setIsSearching(false);

    setIsLoading(true);

    // 1. Load cached messages first for instant display
    const cachedMessages = loadFromSessionStorage();
    if (cachedMessages.length > 0) {
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
        if (isMountedRef.current) {
          toast.error("Could not load contact information");
        }
      });

    // Always load fresh messages from API
    const loadFreshMessages = async () => {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "[ChatArea] Loading fresh messages for friendId:",
            friendId
          );
        }

        // Always get the latest messages when switching rooms
        const response = await getMessages(friendId);

        // Add debug logging here
        debugApiResponse(response, "getMessages");

        if (!isMountedRef.current) return; // Stop if component unmounted

        // Extract messages from the API response
        let messagesArray = [];

        // Check if response indicates an error state
        if (response && response.success === false) {
          // Handle specific error cases
          if (
            response.errorCode === "ALL_METHODS_FAILED" ||
            response.error?.includes("Could not retrieve message history")
          ) {
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
              messagesArray = array;
            }
          }
        }

        // Enhanced logic to ensure latest messages are properly displayed
        if (messagesArray.length > 0) {
          const processedMessages = processApiMessages(messagesArray);

          // Enhanced deduplication: compare with cached messages
          const currentMessageIds = new Set(localMessages.map((msg) => msg.id));
          const newMessages = processedMessages.filter(
            (msg) => !currentMessageIds.has(msg.id)
          );

          if (newMessages.length > 0) {
            setLocalMessages((prev) => {
              // Merge cached and fresh messages, removing duplicates
              const allMessages = [...prev, ...newMessages];
              const uniqueMessages = allMessages.filter(
                (msg, index, arr) =>
                  arr.findIndex((m) => m.id === msg.id) === index
              );

              // Sort by timestamp
              const sortedMessages = uniqueMessages.sort((a, b) => {
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
            // Check if we need to update anyway - compare message counts
            if (processedMessages.length > localMessages.length) {
              setLocalMessages(processedMessages);
              saveToSessionStorage(processedMessages);
            } else if (
              processedMessages.length > 0 &&
              cachedMessages.length === 0
            ) {
              // First load and we have some messages from API
              setLocalMessages(processedMessages);
              saveToSessionStorage(processedMessages);
            }
          }
        } else {
          if (cachedMessages.length === 0) {
            setLocalMessages([]);
          }
          // Clear session storage if no messages
          saveToSessionStorage([]);
        }
      } catch (error: any) {
        // Handle specific API error cases
        if (
          error?.message?.includes("ALL_METHODS_FAILED") ||
          error?.errorCode === "ALL_METHODS_FAILED"
        ) {
          // If we have cached messages, use them and don't show error
          if (cachedMessages.length > 0) {
            // Keep the cached messages already displayed
          } else {
            // No cached messages available, show empty state
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
      // Only handle messages for current conversation
      const isRelevantMessage =
        messageData.sender_id === friendId ||
        messageData.recipient_id === friendId ||
        messageData.receiver_id === friendId ||
        messageData.conversation_id === friendId ||
        messageData.chat_room_id === friendId;

      if (!isRelevantMessage) {
        return;
      }

      // Ensure all timestamp fields have valid values
      const currentTime = new Date().toISOString();
      const validCreatedAt =
        messageData.created_at || messageData.timestamp || currentTime;
      const validRawTimestamp =
        messageData.created_at ||
        messageData.timestamp ||
        messageData.sent_at ||
        currentTime;

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
        created_at: validCreatedAt,
        raw_timestamp: validRawTimestamp, // Store raw timestamp for accurate sorting
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
        timestamp: formatTimestamp(validRawTimestamp),
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
          return prev;
        }

        const updatedMessages = [...prev, enhancedMessage].sort((a, b) => {
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

        // Auto-clear typing indicator after 5 seconds
        if (data.isTyping) {
          setTimeout(() => {
            setIsTyping(false);
          }, 5000);
        }
      }
    };

    // Handler for message read status updates
    const handleMessageRead = (messageIds: string[]) => {
      if (messageIds && messageIds.length > 0) {
        setLocalMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg.id) ||
            messageIds.includes(msg.message_id || "")
              ? { ...msg, read: true, is_read: true }
              : msg
          )
        );
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
    };

    // Register enhanced event listeners
    eventBus.on("new_message", handleNewMessage);
    eventBus.on("message-received", handleNewMessage); // Fixed event name
    eventBus.on("typing-status-changed", handleTypingStatus);
    eventBus.on("user_typing", handleTypingStatus); // Alternative event name
    eventBus.on("message-read", handleMessageRead); // Fixed event name
    // Note: message_updated and message_deleted are not defined in EventTypes
    // These would need to be added to the EventTypes interface or handled differently

    // Cleanup
    return () => {
      eventBus.off("new_message", handleNewMessage);
      eventBus.off("message-received", handleNewMessage);
      eventBus.off("typing-status-changed", handleTypingStatus);
      eventBus.off("user_typing", handleTypingStatus);
      eventBus.off("message-read", handleMessageRead);
      // Removed message_updated and message_deleted event cleanup
    };
  }, [friendId, currentUserId, isCurrentUserMessage, saveToSessionStorage]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!friendId || !currentUserId) return;

    const setupWebSocket = async () => {
      // Connect to WebSocket if not already connected
      if (!isConnected && !isConnecting) {
        await connect();
      }

      // Subscribe to private messages for this conversation
      if (isConnected) {
        subscribeToPrivateMessages(friendId);
      }
    };

    setupWebSocket();

    // Cleanup
    return () => {
      // Unsubscribe from WebSocket events
      if (isConnected) {
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
            b.raw_timestamp || b.created_at || a.sent_at || b.timestamp || 0
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
        try {
          const wsResult = await sendPrivateMessage(friendId, messageContent);
          // WebSocket returns boolean, use temp ID for now
          if (wsResult) {
            // Keep temp ID for WebSocket messages since they don't return message ID
            messageId = tempId;
          }
        } catch (wsError) {
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

  // Enhanced edit message functionality
  const handleEditMessage = useCallback(
    (messageId: string) => {
      const message = localMessages.find((msg) => msg.id === messageId);
      if (message && !message.isDeleted && !message.pending) {
        setEditingMessageId(messageId);
        setInputMessage(message.content);
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
              <OptimizedAvatar
                src={validatedRecipientAvatar}
                alt={recipient.name}
                size="lg"
                className="flex-shrink-0"
              />
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

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200"
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
                <ChatAreaItem
                  key={message.id}
                  message={message}
                  recipient={recipient}
                  onRetryClick={retryFailedMessage}
                  onEditClick={handleEditMessage}
                  onDeleteClick={handleUnsendMessage}
                />
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
