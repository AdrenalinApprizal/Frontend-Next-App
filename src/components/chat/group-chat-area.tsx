"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  FaUsers,
  FaPaperPlane,
  FaUser,
  FaEllipsisV,
  FaSearch,
  FaFile,
  FaImage,
  FaExclamationTriangle,
  FaTimes,
  FaInfoCircle,
  FaClock,
  FaCheck,
} from "react-icons/fa";
import { Paperclip, X, Edit2, Trash, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import SearchFilterPopup from "./search-on-group";
import GroupProfileInfo from "./group-info-panel";
import GroupMessageItem from "./group-message-item";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUserInfoContext } from "@/components/auth/user-info-provider";
import { useGroup } from "@/hooks/auth/useGroup";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProviderNew";
import type {
  GroupMessage as ApiGroupMessage,
  GroupMember as ApiGroupMember,
  GroupMessagesResponse,
  SendGroupMessageResponse,
  Pagination,
} from "@/hooks/auth/useGroup";

// Interface for WebSocket message data
interface NewMessageData {
  id: string;
  content: string;
  sender_id: string;
  created_at?: string;
  chatroom_id?: string;
  group_id?: string;
}

interface GroupDetailProps {
  groupId: string;
  isOwner?: boolean;
}

// Interface for group details in the component
interface GroupDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  avatar_url?: string;
}

// Interface for GroupMember in the component
interface GroupMember {
  id: string;
  name: string;
  status: "online" | "offline" | "busy" | "away";
  role: "admin" | "owner" | "member";
  avatar_url?: string;
  lastSeen?: string;
  isBlocked?: boolean;
  user_id?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    profile_picture_url?: string;
  };
}

// Define a separate type for message sender to avoid conflicts
interface MessageSender {
  id: string;
  name: string;
  avatar_url: string | null | undefined;
}

// Enhanced interface for message with improved status tracking
interface GroupMessage {
  id: string;
  content: string;
  sender: MessageSender;
  timestamp: string;
  isCurrentUser: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
  // Enhanced status tracking for better UX
  pending?: boolean;
  failed?: boolean;
  retrying?: boolean;
  delivered?: boolean;
  read?: boolean;
  readBy?: string[];
  editHistory?: { content: string; editedAt: string }[];
  replyTo?: string;
  reactions?: { emoji: string; users: string[] }[];
}

// Enhanced WebSocket message interface with better typing
interface WebSocketMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at?: string;
  chatroom_id?: string;
  group_id?: string;
  type?: "message" | "file" | "image" | "typing" | "read_receipt";
  attachment?: {
    url: string;
    name: string;
    type: string;
    size?: number;
  };
  metadata?: {
    edited?: boolean;
    deleted?: boolean;
    reply_to?: string;
  };
}

// Session storage utility for message caching
const CACHE_KEY_PREFIX = "group_messages_";
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface MessageCache {
  messages: GroupMessage[];
  timestamp: number;
  pagination: Pagination;
}

const saveMessagesToCache = (
  groupId: string,
  messages: GroupMessage[],
  pagination: Pagination
) => {
  try {
    const cacheData: MessageCache = {
      messages,
      timestamp: Date.now(),
      pagination,
    };
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${groupId}`,
      JSON.stringify(cacheData)
    );
  } catch (error) {
    console.warn("Failed to save messages to cache:", error);
  }
};

const loadMessagesFromCache = (groupId: string): MessageCache | null => {
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${groupId}`);
    if (!cached) return null;

    const cacheData: MessageCache = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - cacheData.timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${groupId}`);
      return null;
    }

    return cacheData;
  } catch (error) {
    console.warn("Failed to load messages from cache:", error);
    return null;
  }
};

// Main GroupDetail component with all handlers and state management
const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, isOwner }) => {
  // State management for the component
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<GroupDetails>({
    id: groupId,
    name: "Loading...",
    description: "Loading...",
    createdAt: "",
    memberCount: 0,
    members: [],
    avatar_url: undefined,
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });
  const [canLoadMoreMessages, setCanLoadMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [showProfile, setShowProfile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected");

  // Search related states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<GroupMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Refs for managing scrolling and typing timeouts
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get user info and WebSocket context
  const { user } = useAuth();
  const { userInfo } = useUserInfoContext();
  const {
    getGroupDetails,
    getGroupMembers,
    getGroupMessages,
    sendGroupMessage,
    sendGroupMessageWithAttachment,
    editGroupMessage,
    deleteGroupMessage,
    blockedUsers,
  } = useGroup();
  const {
    messages: wsMessages,
    isConnected,
    error: wsError,
  } = useWebSocketContext();

  // Enhanced user ID detection - Use userInfo from UserInfoContext
  const currentUserId = useMemo(() => {
    // Try to get user ID from multiple sources
    const userId = userInfo?.user_id || user?.id;
    return userId;
  }, [user, userInfo]);

  // Enhanced message ownership detection function
  const isMessageFromCurrentUser = useCallback(
    (senderId: any): boolean => {
      if (!currentUserId) {
        return false;
      }

      // Handle different sender ID formats
      let actualSenderId = senderId;
      if (typeof senderId === "object" && senderId !== null) {
        actualSenderId = senderId.id || senderId.user_id || senderId.sender_id;
      }

      // Convert both to strings and trim whitespace for comparison
      const currentUserIdStr = String(currentUserId).trim();
      const senderIdStr = String(actualSenderId).trim();

      const isCurrentUser = currentUserIdStr === senderIdStr;

      return isCurrentUser;
    },
    [currentUserId, user]
  );

  // Enhanced sender name resolution function
  const resolveSenderName = useCallback(
    (
      senderId: any,
      isFromCurrentUser: boolean
    ): { name: string; avatar: string | null } => {
      // If it's the current user, return "You"
      if (isFromCurrentUser) {
        return {
          name: "You",
          avatar:
            userInfo?.profile_picture_url || user?.profile_picture_url || null,
        };
      }

      // Handle different sender ID formats
      let actualSenderId = senderId;
      if (typeof senderId === "object" && senderId !== null) {
        actualSenderId = senderId.id || senderId.user_id || senderId.sender_id;
      }

      const senderIdStr = String(actualSenderId).trim();

      // Find the member by ID - check both user_id and id fields
      const matchedMember = groupDetails.members?.find((member) => {
        const memberUserId = String(member.user_id || member.id).trim();
        const memberIdMatch = memberUserId === senderIdStr;

        // Also check if the member.user object exists and matches
        const userIdMatch =
          member.user?.id && String(member.user.id).trim() === senderIdStr;

        return memberIdMatch || userIdMatch;
      });

      if (matchedMember) {
        return {
          name:
            matchedMember.name || matchedMember.user?.name || "Unknown User",
          avatar:
            matchedMember.avatar_url ||
            matchedMember.user?.profile_picture_url ||
            null,
        };
      }

      // Fallback to a simple name
      return {
        name: `User ${senderIdStr.substring(0, 8)}`,
        avatar: null,
      };
    },
    [
      groupDetails.members,
      user?.profile_picture_url,
      userInfo?.profile_picture_url,
    ]
  );

  // Utility functions for file handling
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileTypeFromUrl = (url: string): "image" | "file" => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
    return imageExtensions.some((ext) => url.toLowerCase().includes(ext))
      ? "image"
      : "file";
  };

  const getFileNameFromUrl = (url: string): string => {
    const urlParts = url.split("/");
    return urlParts[urlParts.length - 1] || "attachment";
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch group details when component mounts or groupId changes
  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        setIsLoading(true);

        const groupData = await getGroupDetails(groupId);
        const membersData = await getGroupMembers(groupId);

        // Simple member processing
        const processedMembers = (membersData?.members || []).map(
          (member: ApiGroupMember) => {
            const memberName =
              member.user?.name || member.full_name || "Unknown User";

            const formattedMember: GroupMember = {
              id: member.id || member.user_id,
              name: memberName,
              status: "offline" as const,
              role: member.is_owner ? ("admin" as const) : ("member" as const),
              avatar_url: member.avatar_url || member.user?.profile_picture_url,
              lastSeen: "Not available",
              user_id: member.user_id,
            };

            return formattedMember;
          }
        );

        setGroupDetails({
          id: groupData.id,
          name: groupData.name,
          description:
            groupData.description ||
            "Group for team collaboration and discussions.",
          createdAt: new Date(groupData.created_at).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          ),
          memberCount: groupData.member_count,
          members: processedMembers,
          avatar_url: groupData.avatar_url,
        });
      } catch (error: any) {
        console.error("Error fetching group details:", error);
        setError("Failed to load group details");
        toast.error("Failed to load group details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupDetails();
  }, [groupId]);

  // Function to fetch group messages with pagination support
  const fetchGroupMessages = useCallback(
    async (page = 1, limit = 20) => {
      try {
        setLoadingMessages(true);
        const messagesData = await getGroupMessages(groupId, page, limit);

        const paginationData = {
          current_page: messagesData.current_page || page,
          total_pages: Math.ceil((messagesData.total || 0) / limit) || 1,
          total_items: messagesData.total || messagesData.messages?.length || 0,
          items_per_page: limit,
          has_more_pages:
            (messagesData.current_page || 1) <
            (Math.ceil((messagesData.total || 0) / limit) || 1),
        };

        setCanLoadMoreMessages(!!paginationData?.has_more_pages);

        // Simple message transformation
        const formattedMessages = messagesData.messages.map(
          (apiMsg: ApiGroupMessage) => {
            const messageId = apiMsg.id || `msg-${Date.now()}-${Math.random()}`;
            const isCurrentUser = isMessageFromCurrentUser(apiMsg.sender_id);
            const senderInfo = resolveSenderName(
              apiMsg.sender_id,
              isCurrentUser
            );

            let attachment = undefined;
            if (apiMsg.attachment_url) {
              const fileType = getFileTypeFromUrl(apiMsg.attachment_url);
              const fileName = getFileNameFromUrl(apiMsg.attachment_url);

              attachment = {
                type: fileType,
                url: apiMsg.attachment_url,
                name: fileName,
                size: "Unknown size",
              };
            }

            const message: GroupMessage = {
              id: messageId,
              content: apiMsg.content || "",
              sender: {
                id: apiMsg.sender_id,
                name: senderInfo.name,
                avatar_url: senderInfo.avatar,
              },
              timestamp:
                apiMsg.sent_at || apiMsg.created_at || new Date().toISOString(),
              isCurrentUser: isCurrentUser,
              attachment: attachment,
              pending: false,
              failed: false,
              delivered: true,
            };

            return message;
          }
        );

        const sortedMessages = formattedMessages.sort(
          (a: GroupMessage, b: GroupMessage) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (page === 1) {
          setMessages(sortedMessages);
        } else {
          setMessages((prevMessages) => [...sortedMessages, ...prevMessages]);
        }

        return messagesData;
      } catch (error: any) {
        console.error("Error fetching group messages:", error);
        setError("Failed to load messages");
        toast.error("Failed to load messages");
        throw error;
      } finally {
        setLoadingMessages(false);
      }
    },
    [groupId, getGroupMessages, isMessageFromCurrentUser, resolveSenderName]
  );

  // Fetch messages when group ID changes or initially
  useEffect(() => {
    fetchGroupMessages(1, 20);
  }, [groupId, fetchGroupMessages]);

  // Simple message sending with optimistic update
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isSending) return;

    const messageContent = inputMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    try {
      setIsSending(true);
      setInputMessage("");

      // Optimistic update - add message immediately
      const optimisticMessage: GroupMessage = {
        id: tempId,
        content: messageContent,
        sender: {
          id: String(currentUserId),
          name: "You",
          avatar_url:
            userInfo?.profile_picture_url || user?.profile_picture_url || null,
        },
        timestamp: new Date().toISOString(),
        isCurrentUser: true,
        pending: true,
        failed: false,
        delivered: false,
      };

      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

      // Send message via API
      await sendGroupMessage(groupId, messageContent);

      // Update the optimistic message to show as sent
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId ? { ...msg, pending: false, delivered: true } : msg
        )
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");

      // Mark the optimistic message as failed
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId ? { ...msg, pending: false, failed: true } : msg
        )
      );

      // Restore input on error
      setInputMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  }, [
    inputMessage,
    isSending,
    groupId,
    sendGroupMessage,
    currentUserId,
    userInfo,
    user,
  ]);

  // Handle Enter key for sending messages
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Enhanced WebSocket message handling
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0 || !groupId) return;

    const newGroupMessages = wsMessages.filter(
      (msg: NewMessageData) => msg.group_id === groupId
    );

    if (newGroupMessages.length === 0) return;

    const processedMessages = newGroupMessages.map((msg: NewMessageData) => {
      // Check if message is from current user
      const isFromCurrentUser = isMessageFromCurrentUser(msg.sender_id);

      // Use sender name resolution function
      const senderInfo = resolveSenderName(msg.sender_id, isFromCurrentUser);

      // Create message with proper typing
      const processedMessage: GroupMessage = {
        id: msg.id || `ws-${Date.now()}-${Math.random()}`,
        content: msg.content,
        sender: {
          id: String(msg.sender_id),
          name: senderInfo.name,
          avatar_url: senderInfo.avatar,
        },
        timestamp: msg.created_at || new Date().toISOString(),
        isCurrentUser: isFromCurrentUser,
        pending: false,
        failed: false,
        delivered: true,
      };

      return processedMessage;
    });

    // Enhanced message deduplication and handling
    setMessages((prevMessages) => {
      const existingIds = new Set(prevMessages.map((m) => m.id));
      const uniqueNewMessages = processedMessages.filter(
        (m) => !existingIds.has(m.id)
      );

      if (uniqueNewMessages.length === 0) return prevMessages;

      // Remove any temporary/optimistic messages that match the new real messages
      const messagesWithoutOptimistic = prevMessages.filter((msg) => {
        // Keep the message if it's not optimistic/pending OR if there's no matching real message
        if (!msg.pending && !msg.id.startsWith("temp-")) return true;

        // Check if there's a real message with similar content and timestamp
        const hasMatchingRealMessage = uniqueNewMessages.some((newMsg) => {
          const contentMatch = newMsg.content === msg.content;
          const userMatch = newMsg.isCurrentUser === msg.isCurrentUser;
          const timeDiff = Math.abs(
            new Date(newMsg.timestamp).getTime() -
              new Date(msg.timestamp).getTime()
          );
          return contentMatch && userMatch && timeDiff < 10000; // 10 second window
        });

        return !hasMatchingRealMessage;
      });

      const allMessages = [...messagesWithoutOptimistic, ...uniqueNewMessages];
      return allMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });
  }, [
    wsMessages,
    groupId,
    isMessageFromCurrentUser,
    resolveSenderName,
    currentUserId,
  ]);

  // Handle search functionality
  const handleSearch = (query: string, members: string[]) => {
    setSearchQuery(query);
    setSelectedMembers(members);
    setIsSearching(true);

    // First filter out blocked users' messages, then apply search filters
    const blockedFiltered = filterBlockedMessages(messages);

    // Filter messages by content and/or sender
    const filtered = blockedFiltered.filter((message) => {
      const contentMatch =
        !query.trim() ||
        message.content.toLowerCase().includes(query.toLowerCase());

      const memberMatch =
        members.length === 0 || members.includes(message.sender.id);

      return contentMatch && memberMatch;
    });

    setFilteredMessages(filtered);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setFilteredMessages([]);
    setSelectedMembers([]);
  };

  // Filter out messages from blocked users
  const filterBlockedMessages = useCallback(
    (messagesToFilter: GroupMessage[]): GroupMessage[] => {
      if (!blockedUsers || blockedUsers.length === 0) {
        return messagesToFilter;
      }

      const filtered = messagesToFilter.filter((message) => {
        // Always show current user's messages
        if (message.isCurrentUser) {
          return true;
        }

        // Check if sender is in blocked users list - check multiple possible ID fields
        const senderId = message.sender.id;
        const isBlocked = blockedUsers.some((blockedUser) => {
          // Check both user_id and id fields as they might be stored differently
          const blockedUserId = blockedUser.user_id || blockedUser.id;
          const match = blockedUserId === senderId;

          if (match) {
            console.log(
              `Found blocked user match: sender=${senderId}, blocked=${blockedUserId}`
            );
          }

          return match;
        });

        if (isBlocked) {
          console.log(
            `Filtering out message from blocked user: ${message.sender.name} (ID: ${senderId})`
          );
          return false;
        }

        return true;
      });

      if (filtered.length !== messagesToFilter.length) {
        console.log(
          `Filtered ${
            messagesToFilter.length - filtered.length
          } messages from blocked users in group ${groupId}`
        );
        console.log(
          `Blocked users list:`,
          blockedUsers.map((u) => ({
            id: u.id,
            user_id: u.user_id,
            name: u.name,
          }))
        );
      }

      return filtered;
    },
    [blockedUsers, groupId]
  );

  // Get visible messages (filtered for blocked users, then search if applicable)
  const visibleMessages = useMemo(() => {
    // First filter out blocked users' messages
    const filteredForBlocked = filterBlockedMessages(messages);

    // Then apply search filter if searching
    return isSearching ? filteredMessages : filteredForBlocked;
  }, [messages, filteredMessages, isSearching, filterBlockedMessages]);

  // Connection status monitoring
  useEffect(() => {
    setConnectionStatus(isConnected ? "connected" : "disconnected");
  }, [isConnected]);

  // Show WebSocket errors
  useEffect(() => {
    if (wsError) {
      toast.error(`Connection error: ${wsError}`);
    }
  }, [wsError]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading group...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600">
          <FaExclamationTriangle className="mx-auto h-8 w-8 mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {groupDetails.avatar_url ? (
                <img
                  src={groupDetails.avatar_url}
                  alt={groupDetails.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <FaUsers className="text-white text-lg" />
                </div>
              )}
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {groupDetails.name}
              </h2>
              <p className="text-sm text-gray-500">
                {groupDetails.memberCount} members
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Search in conversation"
            >
              <FaSearch className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Info className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMessages && messages.length === 0 && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* No messages placeholder when searching */}
          {isSearching && visibleMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="mb-1">No matching messages found</p>
                <button
                  onClick={clearSearch}
                  className="text-blue-500 hover:underline"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}

          {visibleMessages.map((message) => (
            <GroupMessageItem key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <Paperclip className="h-5 w-5" />
            </button>

            <div className="flex-1">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSending}
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <FaPaperPlane className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search UI Popup */}
      {showSearch && (
        <SearchFilterPopup
          groupMembers={groupDetails.members.map((member) => ({
            id: member.id,
            name: member.name,
            status: member.status === "online" ? "online" : "offline",
            role: member.role,
            avatar_url: member.avatar_url,
          }))}
          isOpen={showSearch}
          onClose={() => {
            setShowSearch(false);
            if (!searchQuery && selectedMembers.length === 0) {
              setIsSearching(false);
            }
          }}
          onSearch={handleSearch}
        />
      )}

      {/* Group Profile Sidebar */}
      {showProfile && (
        <GroupProfileInfo
          groupName={groupDetails.name}
          onClose={() => setShowProfile(false)}
          groupDetails={groupDetails}
        />
      )}
    </div>
  );
};

export default GroupDetail;
export { GroupDetail };
