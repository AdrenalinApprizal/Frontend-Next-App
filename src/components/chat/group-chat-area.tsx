"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
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
import {
  uploadFileAndSendMessage,
  validateFile,
  formatFileSize,
  getMediaType,
} from "@/utils/fileUploadHelper";
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
  // Local state tracking to prevent server overwrites
  lastEditedAt?: string;
  lastDeletedAt?: string;
  // Protection timestamps to prevent overwrites for a period after operations
  localEditProtection?: number;
  localDeleteProtection?: number;
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

// Group details interface
interface GroupDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  avatar_url?: string;
}

const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, isOwner }) => {
  // Refs for managing scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get user info and WebSocket context
  const { data: session } = useSession();
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
    getGroupBlocks,
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

  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<GroupMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading state for initial data
  const [groupDetailsLoaded, setGroupDetailsLoaded] = useState(false);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);

  // Track if we have any pending operations to avoid overwriting local state
  const [hasPendingOperations, setHasPendingOperations] = useState(false);

  // Group details state
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

  // Update main loading state based on both conditions
  useEffect(() => {
    setIsLoading(!groupDetailsLoaded || !initialMessagesLoaded);
  }, [groupDetailsLoaded, initialMessagesLoaded]);

  // Track pending operations to avoid state conflicts
  useEffect(() => {
    const pendingMessages = messages.some((msg) => msg.pending || msg.retrying);
    setHasPendingOperations(pendingMessages);
  }, [messages]);

  // Debug logging for blocked users
  useEffect(() => {
    if (blockedUsers && blockedUsers.length > 0) {
      // Blocked users loaded
    }
  }, [blockedUsers, groupId]);

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
        setGroupDetailsLoaded(true);
      }
    };

    fetchGroupDetails();
  }, [groupId]);

  // Fetch blocked users when component mounts or groupId changes
  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        await getGroupBlocks(groupId);
      } catch (error: any) {
        // Don't show error toast for blocked users fetch failure as it's not critical
      }
    };

    if (groupId) {
      fetchBlockedUsers();
    }
  }, [groupId, getGroupBlocks]);

  // Fetch group messages - FIXED: Use unified messages endpoint like private chat
  const fetchGroupMessages = useCallback(
    async (page = 1, limit = 20) => {
      try {
        setLoadingMessages(true);

        // CHANGED: Use the same unified endpoint as private chat for consistency
        // This endpoint has better support for edit/delete states
        const response = await fetch(
          `/api/proxy/messages/history?type=group&target_id=${groupId}&limit=${limit}&page=${page}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const messagesData = await response.json();

        // Extract messages from various possible response formats
        let messagesList = [];
        if (Array.isArray(messagesData)) {
          messagesList = messagesData;
        } else if (
          messagesData.messages &&
          Array.isArray(messagesData.messages)
        ) {
          messagesList = messagesData.messages;
        } else if (messagesData.data && Array.isArray(messagesData.data)) {
          messagesList = messagesData.data;
        }

        const paginationData = {
          current_page: messagesData.current_page || page,
          total_pages:
            Math.ceil((messagesData.total || messagesList.length) / limit) || 1,
          total_items: messagesData.total || messagesList.length || 0,
          items_per_page: limit,
          has_more_pages:
            (messagesData.current_page || page) <
            (Math.ceil((messagesData.total || messagesList.length) / limit) ||
              1),
        };

        setPagination(paginationData);
        setCanLoadMoreMessages(paginationData.has_more_pages);

        const formattedMessages = messagesData.messages.map(
          (apiMsg: ApiGroupMessage): GroupMessage => {
            const messageId =
              apiMsg.id || apiMsg.message_id || String(Date.now());
            const isCurrentUser = isMessageFromCurrentUser(apiMsg.sender_id);
            const senderInfo = resolveSenderName(
              apiMsg.sender_id,
              isCurrentUser
            );

            // Process message data

            let attachment = undefined;
            if (apiMsg.attachment_url) {
              const fileType = getFileTypeFromUrl(apiMsg.attachment_url);
              attachment = {
                type: fileType,
                url: apiMsg.attachment_url,
                name: getFileNameFromUrl(apiMsg.attachment_url),
              };
            }

            // Check for edit/delete state from various possible API field names
            const isEdited = Boolean(
              (apiMsg as any).isEdited ||
                (apiMsg as any).is_edited ||
                (apiMsg as any).edited ||
                (apiMsg as any).editedAt ||
                (apiMsg as any).edited_at
            );

            const isDeleted = Boolean(
              (apiMsg as any).isDeleted ||
                (apiMsg as any).is_deleted ||
                (apiMsg as any).deleted ||
                (apiMsg as any).deletedAt ||
                (apiMsg as any).deleted_at ||
                apiMsg.content === "This message was deleted" ||
                apiMsg.content === "[Deleted]" ||
                (apiMsg.content === "" && (apiMsg as any).deleted)
            );

            // For deleted messages, show appropriate content
            let messageContent = apiMsg.content;
            if (
              isDeleted &&
              apiMsg.content &&
              apiMsg.content !== "This message was deleted"
            ) {
              messageContent = "This message was deleted";
            }

            const message: GroupMessage = {
              id: messageId,
              content: messageContent,
              sender: {
                id: String(apiMsg.sender_id),
                name: senderInfo.name,
                avatar_url: senderInfo.avatar,
              },
              timestamp: apiMsg.created_at || new Date().toISOString(),
              isCurrentUser,
              attachment,
              pending: false,
              failed: false,
              delivered: true,
              isEdited,
              isDeleted,
            };

            return message;
          }
        );

        const sortedMessages = formattedMessages.sort(
          (a: GroupMessage, b: GroupMessage) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (page === 1) {
          // SMART MERGE: Preserve local edit/delete states that haven't been synced yet
          setMessages((prevMessages) => {
            const mergedMessages = sortedMessages.map(
              (newMsg: GroupMessage) => {
                const existingMsg = prevMessages.find(
                  (m) => m.id === newMsg.id
                );

                // If we have a locally edited/deleted message that's newer than server data,
                // preserve the local state
                if (existingMsg) {
                  const now = Date.now();
                  const hasEditProtection =
                    existingMsg.localEditProtection &&
                    now < existingMsg.localEditProtection;
                  const hasDeleteProtection =
                    existingMsg.localDeleteProtection &&
                    now < existingMsg.localDeleteProtection;

                  const hasLocalEdit =
                    existingMsg.lastEditedAt &&
                    new Date(existingMsg.lastEditedAt) >
                      new Date(newMsg.timestamp);
                  const hasLocalDelete =
                    existingMsg.lastDeletedAt &&
                    new Date(existingMsg.lastDeletedAt) >
                      new Date(newMsg.timestamp);

                  // ENHANCED: Also preserve if local state shows edit/delete but server doesn't
                  const localEditNotOnServer =
                    existingMsg.isEdited && !newMsg.isEdited;
                  const localDeleteNotOnServer =
                    existingMsg.isDeleted && !newMsg.isDeleted;

                  const shouldPreserveLocal =
                    hasEditProtection ||
                    hasDeleteProtection ||
                    hasLocalEdit ||
                    hasLocalDelete ||
                    localEditNotOnServer ||
                    localDeleteNotOnServer;

                  if (shouldPreserveLocal) {
                    // Preserve local state over server state

                    return {
                      ...newMsg, // Use server data as base
                      content: existingMsg.content, // But keep local content
                      isEdited: existingMsg.isEdited, // Keep local edit state
                      isDeleted: existingMsg.isDeleted, // Keep local delete state
                      lastEditedAt: existingMsg.lastEditedAt, // Keep local timestamps
                      lastDeletedAt: existingMsg.lastDeletedAt,
                      localEditProtection: existingMsg.localEditProtection, // Keep protections
                      localDeleteProtection: existingMsg.localDeleteProtection,
                      pending: existingMsg.pending, // Keep pending state
                    };
                  }
                }

                return newMsg;
              }
            );

            return mergedMessages;
          });
        } else {
          // For pagination (loading older messages), add them to the BEGINNING of the array
          // since they are older than existing messages
          setMessages((prevMessages) => [...sortedMessages, ...prevMessages]);
        }

        return messagesData;
      } catch (error: any) {
        console.error("Error fetching group messages:", error);
        setError("Failed to load messages");
        toast.error("Failed to load messages");
      } finally {
        setLoadingMessages(false);
        if (page === 1) {
          setInitialMessagesLoaded(true);
        }
      }
    },
    [groupId, getGroupMessages, isMessageFromCurrentUser, resolveSenderName]
  );

  // Load messages on mount
  useEffect(() => {
    if (groupId) {
      fetchGroupMessages(1, 20);
    }
  }, [groupId, fetchGroupMessages]);

  // Enhanced filter out messages from blocked users with client-side validation
  const filterBlockedMessages = useCallback(
    (messagesToFilter: GroupMessage[]): GroupMessage[] => {
      // Messages from blocked users are primarily filtered by the backend
      // This function provides client-side validation as backup

      if (!blockedUsers || blockedUsers.length === 0) {
        return messagesToFilter;
      }

      // Create a Set of blocked user IDs for efficient lookup
      const blockedUserIds = new Set(
        blockedUsers.map((user) => user.user_id || user.id).filter(Boolean)
      );

      // Filter messages with client-side validation
      const filtered = messagesToFilter.filter((message) => {
        // Always show current user's messages
        if (message.isCurrentUser) {
          return true;
        }

        // Check if sender is in blocked users list
        const senderId = message.sender.id;
        const isBlocked = blockedUserIds.has(senderId);

        if (isBlocked) {
          return false;
        }

        return true;
      });

      return filtered;
    },
    [blockedUsers, groupId]
  );

  // Get visible messages with enhanced filtering
  const visibleMessages = useMemo(() => {
    // First apply client-side blocked user filtering as backup
    const clientFiltered = filterBlockedMessages(messages);

    // Then apply search filter if searching
    const finalMessages = isSearching ? filteredMessages : clientFiltered;

    // TEMP FIX: Reverse message order to put newest at bottom if they're currently at top
    return finalMessages.slice().reverse();
  }, [messages, filteredMessages, isSearching, filterBlockedMessages]);

  // Handle edit message
  const handleEditMessage = useCallback(
    (messageId: string) => {
      // Check if this is a temporary ID that shouldn't be edited via API
      if (messageId.startsWith("temp-")) {
        toast.error("Cannot edit message that hasn't been sent yet");
        return;
      }

      const message = messages.find((msg) => msg.id === messageId);
      if (message && !message.isDeleted && !message.pending) {
        setEditingMessageId(messageId);
        setInputMessage(message.content);
      }
    },
    [messages]
  );

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setInputMessage("");
  }, []);

  // Handle submit edit (updated to accept content parameter)
  const handleSubmitEdit = useCallback(
    async (editContent?: string) => {
      if (!editingMessageId) return;

      const messageContent = editContent;
      if (!messageContent) return;

      const originalMessage = messages.find(
        (msg) => msg.id === editingMessageId
      );

      if (!originalMessage) return;

      setIsSending(true);

      try {
        // Update message optimistically
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
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

        // Call API to edit message
        const response = await editGroupMessage(
          groupId,
          editingMessageId,
          messageContent
        );

        // Simple validation - if we get a response, consider it successful
        if (!response) {
          throw new Error("No response received from edit API");
        }

        // Update with successful edit - ENHANCED with protection timestamp
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === editingMessageId
              ? {
                  ...msg,
                  content: messageContent,
                  isEdited: true,
                  pending: false,
                  lastEditedAt: new Date().toISOString(), // Add timestamp to track local edits
                  localEditProtection: Date.now() + 30000, // Protect from overwrites for 30 seconds
                }
              : msg
          )
        );

        // Clear edit state
        setEditingMessageId(null);

        toast.success("Message updated successfully");

        // REMOVED: Background refresh that was causing state loss
        // The message state is already correct from optimistic update + API response
      } catch (error: any) {
        console.error("🔧 EDIT ERROR: Failed to edit message:", error);

        // Show more specific error message
        const errorMessage =
          error?.message || error?.error || "Failed to edit message";
        const statusCode = error?.status || error?.statusCode;

        if (statusCode === 404) {
          toast.error(
            "Edit failed: Message not found or endpoint not available"
          );
        } else if (statusCode === 500) {
          toast.error("Edit failed: Server error - please try again later");
        } else if (statusCode === 403) {
          toast.error(
            "Edit failed: You don't have permission to edit this message"
          );
        } else {
          toast.error(`Edit failed: ${errorMessage}`);
        }

        // Revert optimistic update on error
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === editingMessageId
              ? { ...originalMessage, pending: false }
              : msg
          )
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      editingMessageId,
      messages,
      editGroupMessage,
      groupId,
      fetchGroupMessages,
      hasPendingOperations,
    ]
  );

  // Handle delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Check if this is a temporary ID that shouldn't be deleted via API
      if (messageId.startsWith("temp-")) {
        toast.error("Cannot delete message that hasn't been sent yet");
        return;
      }

      // Show confirmation using react-hot-toast
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
        // Optimistically mark message as deleted
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: "This message was deleted",
                  isDeleted: true,
                  pending: true,
                }
              : msg
          )
        );

        // Call API to delete message
        const response = await deleteGroupMessage(groupId, messageId);

        // Simple validation - if we get a response, consider it successful
        if (!response) {
          throw new Error("No response received from delete API");
        }

        // Confirm deletion - ENHANCED with protection timestamp
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  pending: false,
                  lastDeletedAt: new Date().toISOString(), // Add timestamp to track local deletes
                  localDeleteProtection: Date.now() + 30000, // Protect from overwrites for 30 seconds
                }
              : msg
          )
        );

        toast.success("Message deleted successfully");

        // REMOVED: Background refresh that was causing message disappearance
        // The message state is already correct from optimistic update + API response
      } catch (error: any) {
        console.error("🗑️ DELETE ERROR: Failed to delete message:", error);

        // Show more specific error message
        const errorMessage =
          error?.message || error?.error || "Failed to delete message";
        const statusCode = error?.status || error?.statusCode;

        if (statusCode === 404) {
          toast.error(
            "Delete failed: Message not found or endpoint not available"
          );
        } else if (statusCode === 500) {
          toast.error("Delete failed: Server error - please try again later");
        } else if (statusCode === 403) {
          toast.error(
            "Delete failed: You don't have permission to delete this message"
          );
        } else {
          toast.error(`Delete failed: ${errorMessage}`);
        }

        // Revert optimistic update on error
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...message, pending: false, isDeleted: false }
              : msg
          )
        );
      }
    },
    [
      messages,
      deleteGroupMessage,
      groupId,
      fetchGroupMessages,
      hasPendingOperations,
    ]
  );

  // Handle retry failed message
  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      try {
        // Mark message as retrying
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, retrying: true, failed: false }
              : msg
          )
        );

        // Retry sending the message
        await sendGroupMessage(groupId, message.content);

        // Update message as sent
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, retrying: false, delivered: true }
              : msg
          )
        );

        toast.success("Message sent successfully");
      } catch (error) {
        console.error("Failed to retry message:", error);
        toast.error("Failed to send message");

        // Mark as failed again
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, retrying: false, failed: true }
              : msg
          )
        );
      }
    },
    [messages, sendGroupMessage, groupId, fetchGroupMessages]
  );

  // Handle file upload button
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle original message sending (form submission)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !groupId || isSending) return;

    const messageContent = inputMessage.trim();
    setInputMessage(""); // Clear input early for better UX
    setIsSending(true);

    const tempId = `temp-${Date.now()}-${Math.random()}`;

    try {
      // Create optimistic message for immediate UI feedback
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
        delivered: false,
      };

      // Add optimistic message to UI immediately
      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

      // Auto-scroll to show the new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);

      const response = await sendGroupMessage(groupId, messageContent);

      // Extract real message ID from response
      const realMessageId = response?.message_id;

      if (realMessageId) {
        // Update optimistic message with real ID and delivered status
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: realMessageId, // Replace temp ID with real ID
                  pending: false,
                  delivered: true,
                }
              : msg
          )
        );
      } else {
        // Fallback: just mark as delivered if no real ID available
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === tempId
              ? { ...msg, pending: false, delivered: true }
              : msg
          )
        );
      }

      toast.success("Message sent successfully", { id: `send-${tempId}` });
    } catch (error: any) {
      console.error("Failed to send message:", error);

      // Mark optimistic message as failed
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId ? { ...msg, pending: false, failed: true } : msg
        )
      );

      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Enhanced form submission handler for both new messages and edits
  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Handle edit submission
      if (editingMessageId) {
        await handleSubmitEdit(inputMessage.trim());
        return;
      }

      // Handle new message submission
      await handleSendMessage(e);
    },
    [editingMessageId, inputMessage, handleSubmitEdit, handleSendMessage]
  );

  // Handle search
  const handleSearch = (query: string, members: string[]) => {
    setSearchQuery(query);
    setSelectedMembers(members);
    setIsSearching(true);

    // Filter messages based on search criteria
    const blockedFiltered = filterBlockedMessages(messages);
    const filtered = blockedFiltered.filter((message) => {
      const contentMatch = query
        ? message.content.toLowerCase().includes(query.toLowerCase())
        : true;
      const memberMatch =
        members.length === 0 ||
        members.some((memberId) => message.sender.id === memberId);

      return contentMatch && memberMatch;
    });

    setFilteredMessages(filtered);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setFilteredMessages([]);
    setSelectedMembers([]);
  };

  // Connection status effect
  useEffect(() => {
    setConnectionStatus(isConnected ? "connected" : "disconnected");
  }, [isConnected]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      toast.error(`Connection error: ${wsError}`);
    }
  }, [wsError]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0 || !groupId) return;

    const newGroupMessages = wsMessages.filter(
      (msg: any) => msg.group_id === groupId || msg.chatroom_id === groupId
    );

    if (newGroupMessages.length === 0) return;

    const formattedNewMessages = newGroupMessages.map((wsMsg: any) => {
      const isCurrentUser = isMessageFromCurrentUser(wsMsg.sender_id);
      const senderInfo = resolveSenderName(wsMsg.sender_id, isCurrentUser);

      // Check for edit/delete status from WebSocket message
      const isEdited = Boolean(
        wsMsg.isEdited ||
          wsMsg.is_edited ||
          wsMsg.edited ||
          wsMsg.editedAt ||
          wsMsg.edited_at
      );

      const isDeleted = Boolean(
        wsMsg.isDeleted ||
          wsMsg.is_deleted ||
          wsMsg.deleted ||
          wsMsg.deletedAt ||
          wsMsg.deleted_at ||
          wsMsg.content === "This message was deleted" ||
          wsMsg.content === "[Deleted]"
      );

      // Handle deleted message content
      let messageContent = wsMsg.content;
      if (isDeleted && wsMsg.content !== "This message was deleted") {
        messageContent = "This message was deleted";
      }

      return {
        id: wsMsg.id,
        content: messageContent,
        sender: {
          id: String(wsMsg.sender_id),
          name: senderInfo.name,
          avatar_url: senderInfo.avatar,
        },
        timestamp: wsMsg.created_at || new Date().toISOString(),
        isCurrentUser,
        isEdited,
        isDeleted,
        pending: false,
        delivered: true,
      };
    });

    // Track if we have new messages for background refresh decision
    const hasNewMessages =
      formattedNewMessages.length > 0 &&
      formattedNewMessages.some(
        (msg: GroupMessage) =>
          !messages.some((prev: GroupMessage) => prev.id === msg.id)
      );

    setMessages((prevMessages) => {
      const existingIds = new Set(prevMessages.map((m) => m.id));
      const uniqueNewMessages = formattedNewMessages.filter(
        (m) => !existingIds.has(m.id)
      );

      if (uniqueNewMessages.length === 0) {
        // No new messages, but check if existing messages need updates
        // ENHANCED: Better merge of WebSocket updates with local states
        const updatedMessages = prevMessages.map((existingMsg) => {
          const wsUpdate = formattedNewMessages.find(
            (ws) => ws.id === existingMsg.id
          );
          if (wsUpdate) {
            // Check for local changes that should be preserved
            const now = Date.now();
            const hasEditProtection =
              existingMsg.localEditProtection &&
              now < existingMsg.localEditProtection;
            const hasDeleteProtection =
              existingMsg.localDeleteProtection &&
              now < existingMsg.localDeleteProtection;

            const hasRecentLocalEdit =
              existingMsg.lastEditedAt &&
              new Date(existingMsg.lastEditedAt) > new Date(Date.now() - 10000); // 10 seconds
            const hasRecentLocalDelete =
              existingMsg.lastDeletedAt &&
              new Date(existingMsg.lastDeletedAt) >
                new Date(Date.now() - 10000); // 10 seconds

            // Also preserve if we have pending operations
            const hasPendingOperation = existingMsg.pending;

            const shouldPreserveLocal =
              hasEditProtection ||
              hasDeleteProtection ||
              hasRecentLocalEdit ||
              hasRecentLocalDelete ||
              hasPendingOperation;

            if (shouldPreserveLocal) {
              // Preserve local changes over WebSocket updates

              return existingMsg; // Keep existing message as-is
            } else {
              // Safe to update with WebSocket data
              return {
                ...existingMsg,
                content: wsUpdate.content,
                isEdited: wsUpdate.isEdited,
                isDeleted: wsUpdate.isDeleted,
                timestamp: wsUpdate.timestamp,
              };
            }
          }
          return existingMsg;
        });

        return updatedMessages;
      }

      // Remove any temporary/optimistic messages that match the new real messages
      const messagesWithoutOptimistic = prevMessages.filter((msg) => {
        if (!msg.pending && !msg.failed) return true;

        const hasMatchingRealMessage = uniqueNewMessages.some((newMsg) => {
          // Same sender and content
          return (
            newMsg.sender.id === msg.sender.id &&
            newMsg.content === msg.content &&
            Math.abs(
              new Date(newMsg.timestamp).getTime() -
                new Date(msg.timestamp).getTime()
            ) < 10000
          );
        });

        return !hasMatchingRealMessage;
      });

      const safeNewMessages = uniqueNewMessages.filter((newMsg) => {
        const hasDuplicate = prevMessages.some(
          (existing) => existing.id === newMsg.id
        );
        return !hasDuplicate;
      });

      const combined = [...messagesWithoutOptimistic, ...safeNewMessages];
      return combined.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    // DISABLED: Background refresh completely to prevent state overwrites
    // The WebSocket already provides real-time updates, no need for additional fetching
    // that can overwrite local optimistic states for edit/delete operations
  }, [
    wsMessages,
    groupId,
    currentUserId,
    isMessageFromCurrentUser,
    resolveSenderName,
    fetchGroupMessages,
    hasPendingOperations,
  ]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <FaExclamationTriangle className="text-red-500 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <div className="p-2 sm:p-3 lg:p-4 border-b border-gray-200 bg-white shadow-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shrink-0">
              {groupDetails.avatar_url ? (
                <img
                  src={groupDetails.avatar_url}
                  alt={groupDetails.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <FaUsers className="text-white text-sm sm:text-base lg:text-lg" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base lg:text-lg truncate leading-tight">
                {groupDetails.name}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate leading-tight mt-0.5">
                {groupDetails.memberCount} member
                {groupDetails.memberCount !== 1 ? "s" : ""}
                {connectionStatus === "connected" && (
                  <span className="ml-2 hidden xs:inline">
                    <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>{" "}
                    <span className="hidden sm:inline text-xs">Connected</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-0.5 sm:space-x-1 shrink-0">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              title="Search messages"
            >
              <FaSearch className="text-sm sm:text-base" />
            </button>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              title="Group info"
            >
              <Info className="text-sm sm:text-base" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      {showSearch && (
        <SearchFilterPopup
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onSearch={handleSearch}
          groupMembers={groupDetails.members.map((member) => ({
            id: member.id,
            name: member.name,
            status:
              member.status === "busy" || member.status === "away"
                ? "offline"
                : member.status,
            role: member.role || "member",
            avatar: member.avatar_url,
            avatar_url: member.avatar_url,
          }))}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Messages area */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            showProfile ? "lg:mr-80" : ""
          }`}
        >
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3">
            {!loadingMessages &&
              visibleMessages.length === 0 &&
              !isSearching && (
                <div className="text-center py-8 sm:py-12 lg:py-16">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 lg:mb-6">
                    <FaUsers className="text-gray-400 text-lg sm:text-2xl lg:text-3xl" />
                  </div>
                  <p className="text-base sm:text-lg lg:text-xl font-medium mb-2 text-gray-800">
                    No messages yet
                  </p>
                  <p className="text-gray-500 text-sm sm:text-base px-4 max-w-md mx-auto">
                    Start the conversation by sending a message to this group!
                  </p>
                </div>
              )}

            {isSearching && visibleMessages.length === 0 && (
              <div className="text-center py-8 sm:py-12 lg:py-16">
                <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 lg:mb-6">
                  <FaSearch className="text-gray-400 text-lg sm:text-2xl lg:text-3xl" />
                </div>
                <p className="text-base sm:text-lg lg:text-xl font-medium mb-2 text-gray-800">
                  No messages found
                </p>
                <p className="text-gray-500 text-sm sm:text-base px-4 max-w-md mx-auto">
                  Try adjusting your search criteria or clear filters
                </p>
              </div>
            )}

            {/* Messages list */}
            {visibleMessages.map((message) => (
              <GroupMessageItem
                key={message.id}
                message={message}
                onRetryClick={handleRetryMessage}
                onEditClick={handleEditMessage}
                onDeleteClick={handleDeleteMessage}
              />
            ))}

            {loadingMessages && (
              <div className="text-center py-6 sm:py-8">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">
                  Loading messages...
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="p-2 sm:p-3 lg:p-4 border-t border-gray-200 bg-white shrink-0">
            {/* Edit mode indicator */}
            {editingMessageId && (
              <div className="flex items-center mb-2 bg-blue-50 p-2 rounded-lg">
                <span className="text-sm text-blue-700 flex-1">
                  Editing message
                </span>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-600 hover:text-gray-800 p-1 rounded transition-colors"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
            )}

            <form
              onSubmit={handleFormSubmit}
              className="flex items-center space-x-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && groupId) {
                    try {
                      // Validate file first
                      const validation = validateFile(file);
                      if (!validation.valid) {
                        toast.error(validation.error || "Invalid file");
                        return;
                      }

                      setIsUploadingFile(true);
                      setUploadProgress(0);

                      // Create optimistic message first
                      const tempId = `temp-${Date.now()}-${Math.random()}`;
                      const optimisticMessage: GroupMessage = {
                        id: tempId,
                        content: `📎 ${file.name}`,
                        sender: {
                          id: String(currentUserId),
                          name: "You",
                          avatar_url:
                            userInfo?.profile_picture_url ||
                            user?.profile_picture_url ||
                            null,
                        },
                        timestamp: new Date().toISOString(),
                        isCurrentUser: true,
                        pending: true,
                        delivered: false,
                        attachment: {
                          type:
                            getMediaType(file.type) === "image"
                              ? "image"
                              : "file",
                          url: URL.createObjectURL(file), // Use temporary URL for immediate display
                          name: file.name,
                          size: formatFileSize(file.size),
                        },
                      };

                      // Add optimistic message to UI immediately
                      setMessages((prevMessages) => [
                        ...prevMessages,
                        optimisticMessage,
                      ]);

                      // Upload file and send message using fileUploadHelper
                      const result = await uploadFileAndSendMessage(
                        file,
                        groupId,
                        "", // messageText (empty since we're just sending a file)
                        true, // isGroup set to true for group chat
                        (progress: number) => setUploadProgress(progress),
                        session?.access_token
                      );

                      // Extract real message ID from response
                      const realMessageId = result?.messageId;

                      if (realMessageId) {
                        // Update optimistic message with real ID and server URL
                        setMessages((prevMessages) =>
                          prevMessages.map((msg) =>
                            msg.id === tempId
                              ? {
                                  ...msg,
                                  id: realMessageId, // Replace temp ID with real ID
                                  pending: false,
                                  delivered: true,
                                  attachment: {
                                    ...msg.attachment!,
                                    url: result.fileUrl,
                                  },
                                }
                              : msg
                          )
                        );
                      } else {
                        // Fallback: just mark as delivered if no real ID available
                        setMessages((prevMessages) =>
                          prevMessages.map((msg) =>
                            msg.id === tempId
                              ? {
                                  ...msg,
                                  pending: false,
                                  delivered: true,
                                  attachment: {
                                    ...msg.attachment!,
                                    url: result.fileUrl,
                                  },
                                }
                              : msg
                          )
                        );
                      }

                      // Auto-scroll to show the new message
                      setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }, 50);

                      toast.success("File uploaded successfully!");
                    } catch (error) {
                      console.error("File upload failed:", error);
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "File upload failed"
                      );
                    } finally {
                      setIsUploadingFile(false);
                      setUploadProgress(0);
                      // Clear the file input
                      e.target.value = "";
                    }
                  }
                }}
                accept="image/*,application/pdf,.doc,.docx,.txt"
              />

              <button
                type="button"
                onClick={handleFileUpload}
                className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit(e as any);
                  }
                }}
                placeholder={
                  editingMessageId
                    ? "Edit your message..."
                    : "Type a message..."
                }
                className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={isSending}
                style={{
                  minHeight: "40px",
                  maxHeight: "120px",
                  overflowY: inputMessage.length > 100 ? "auto" : "hidden",
                }}
              />

              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <FaPaperPlane className="h-5 w-5" />
                )}
              </button>
            </form>

            {isUploadingFile && (
              <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md p-2">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent mr-2" />
                  <span className="text-xs text-blue-600">
                    Uploading... {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Group profile sidebar */}
        {showProfile && (
          <>
            {/* Mobile overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setShowProfile(false)}
            />

            {/* Sidebar */}
            <div className="fixed lg:absolute right-0 top-0 h-full w-full sm:w-96 lg:w-80 bg-white border-l border-gray-200 z-50 lg:z-auto shadow-xl lg:shadow-none transform transition-transform duration-300">
              {/* Content */}
              <div className="h-full overflow-hidden">
                <GroupProfileInfo
                  groupName={groupDetails.name}
                  groupDetails={groupDetails}
                  onClose={() => setShowProfile(false)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupDetail;
export { GroupDetail };
