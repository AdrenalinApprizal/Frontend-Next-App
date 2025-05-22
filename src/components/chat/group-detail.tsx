"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaUsers,
  FaEnvelope,
  FaPaperPlane,
  FaUser,
  FaEllipsisV,
  FaSearch,
  FaFile,
  FaImage,
  FaExclamationTriangle,
  FaComment,
} from "react-icons/fa";
import { Paperclip, X, Edit2, Trash, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import SearchFilterPopup from "./search-on-group";
import GroupProfileInfo from "./group-profile-info";
import { useAuth } from "@/hooks/auth/useAuth";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProvider";
import {
  useGroup,
  GroupMessage as ApiGroupMessage,
  GroupMember as ApiGroupMember,
  GroupMessagesResponse,
  SendGroupMessageResponse,
  Pagination,
  ApiResponse,
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
  groupName: string;
}

// Tentukan ulang interface yang diperlukan untuk komponen
interface GroupDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  avatar?: string;
}

// Interface for GroupMember in the component
interface GroupMember {
  id: string;
  name: string;
  status: "online" | "offline" | "busy" | "away";
  role: "admin" | "member";
  avatar?: string;
  isBlocked?: boolean;
  lastSeen?: string;
}

// Interface for ProfileInfoMember (compatible with GroupProfileInfo component)
interface ProfileInfoMember {
  id: string;
  name: string;
  status: "online" | "offline"; // This component only accepts "online" | "offline"
  role: "admin" | "member";
  avatar?: string;
  lastSeen?: string;
}

interface GroupMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
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
  pending?: boolean; // For optimistic updates
  failed?: boolean; // For error handling
  retrying?: boolean; // For retry status
}

// Update the WebSocket message type
interface WebSocketMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at?: string;
  chatroom_id?: string;
  group_id?: string;
}

// Fix the GroupDetail component at the top
export function GroupDetail({ groupId, groupName }: GroupDetailProps) {
  // User and connection data
  const { user: userInfo } = useAuth();
  const {
    isConnected,
    messages: wsMessages,
    error: wsError,
    sendGroupMessage: sendWebSocketGroupMessage,
  } = useWebSocketContext();

  // Use the existing useGroup hook instead of groupService
  const {
    getGroupDetails,
    getGroupMembers,
    getGroupMessages,
    loadMoreMessages,
    sendGroupMessage,
    sendGroupMessageWithAttachment,
    updateGroup: updateGroupApi,
    loading: groupLoading,
    error: groupError,
  } = useGroup();

  // Input and UI state
  const [inputMessage, setInputMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Search related states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<GroupMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Pagination data
  const [canLoadMoreMessages, setCanLoadMoreMessages] = useState(false);

  // DOM refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Group data states
  const [groupDetails, setGroupDetails] = useState<GroupDetails>({
    id: groupId,
    name: groupName,
    description: "Loading group information...",
    createdAt: "",
    memberCount: 0,
    members: [],
    avatar: undefined,
  });

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Function to format timestamps similar to the Vue version
  const formatTimestamp = (dateString: string): string => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        // Format as time if today
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } else {
        // Format as relative time
        const diffInSeconds = Math.floor(
          (now.getTime() - date.getTime()) / 1000
        );

        if (diffInSeconds < 60) return "just now";

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60)
          return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24)
          return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7)
          return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;

        const diffInWeeks = Math.floor(diffInDays / 7);
        return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
      }
    } catch (error) {
      return dateString;
    }
  };

  // Fetch group details when component loads
  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        setIsLoading(true);
        const groupData = await getGroupDetails(groupId);
        const membersData = await getGroupMembers(groupId);

        // Format the group details
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
          members: (membersData?.members || []).map(
            (member: ApiGroupMember) => ({
              id: member.id || member.user_id,
              name:
                member.full_name ||
                member.username ||
                (member.user ? member.user.name : "Unknown User"),
              status: "offline",
              role: member.is_owner ? "admin" : "member",
              avatar:
                member.avatar_url ||
                (member.user ? member.user.profile_picture_url : undefined),
              lastSeen: "Not available",
            })
          ),
          avatar: groupData.avatar_url,
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
  }, [groupId, getGroupDetails, getGroupMembers]);

  // Fungsi untuk fetch group messages dengan pagination support yang diperbaiki
  const fetchGroupMessages = async (page = 1, limit = 20) => {
    try {
      setLoadingMessages(true);
      const messagesData = await getGroupMessages(groupId, page, limit);

      // Define pagination structure explicitly
      const pagination = {
        current_page: messagesData.current_page || page,
        total_pages: Math.ceil((messagesData.total || 0) / limit) || 1,
        total_items: messagesData.total || messagesData.messages?.length || 0,
        items_per_page: limit,
        has_more_pages:
          (messagesData.current_page || 1) <
          (Math.ceil((messagesData.total || 0) / limit) || 1),
      };

      setCanLoadMoreMessages(!!pagination?.has_more_pages);

      // Format messages for display
      const formattedMessages = messagesData.messages.map(
        (apiMsg: ApiGroupMessage) => ({
          id: apiMsg.message_id || apiMsg.id || "",
          content: apiMsg.content,
          sender: {
            id: apiMsg.sender_id,
            name: "Unknown User",
            avatar: undefined,
          },
          timestamp:
            apiMsg.sent_at || apiMsg.created_at || new Date().toISOString(),
          isCurrentUser: apiMsg.sender_id === userInfo?.id,
          attachment: apiMsg.attachment_url
            ? {
                type: determineAttachmentType(apiMsg.attachment_url),
                url: apiMsg.attachment_url,
                name: getFileNameFromUrl(apiMsg.attachment_url),
                size: "Unknown size", // API doesn't provide size
              }
            : undefined,
        })
      );

      // Match sender names from members list
      const messagesWithNames = formattedMessages.map((msg) => {
        const matchedMember = groupDetails.members.find(
          (member) => member.id === msg.sender.id
        );
        if (matchedMember) {
          return {
            ...msg,
            sender: {
              ...msg.sender,
              name: matchedMember.name,
              avatar: matchedMember.avatar,
            },
          };
        }
        return msg;
      });

      // If first page, replace messages; otherwise prepend (for older messages)
      if (page === 1) {
        setMessages(messagesWithNames);
      } else {
        setMessages([...messagesWithNames, ...messages]);
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
  };

  // Load more messages (older messages)
  const handleLoadMoreMessages = async () => {
    if (isLoadingMore || !canLoadMoreMessages) return;

    try {
      setIsLoadingMore(true);
      await loadMoreMessages(groupId);
    } catch (error) {
      console.error("Error loading more messages:", error);
      toast.error("Failed to load more messages");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Helper functions for attachments
  const determineAttachmentType = (url: string): "image" | "file" => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some((ext) => lowerUrl.endsWith(ext))
      ? "image"
      : "file";
  };

  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  // Fetch messages when group details are loaded
  useEffect(() => {
    if (groupDetails.members.length > 0) {
      fetchGroupMessages();
    }
  }, [groupId, groupDetails.members, userInfo?.id]);

  // Listen for new WebSocket group messages
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0 || !groupId) return;

    // Find messages for this particular group
    const newGroupMessages = wsMessages.filter(
      (msg: NewMessageData) => msg.group_id === groupId
    );

    if (newGroupMessages.length === 0) return;

    // Add new messages to our local messages state
    const formattedWsMessages = newGroupMessages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: {
        id: msg.sender_id,
        name: "Unknown User",
        avatar: undefined,
      },
      timestamp: msg.created_at || new Date().toISOString(),
      isCurrentUser: msg.sender_id === userInfo?.id,
    }));

    // Match sender names from members list
    const messagesWithNames = formattedWsMessages.map((msg) => {
      const matchedMember = groupDetails.members.find(
        (member) => member.id === msg.sender.id
      );
      if (matchedMember) {
        return {
          ...msg,
          sender: {
            ...msg.sender,
            name: matchedMember.name,
            avatar: matchedMember.avatar,
          },
        };
      }
      return msg;
    });

    setMessages((prevMessages) => {
      // Filter out duplicates by ID
      const existingIds = new Set(prevMessages.map((m) => m.id));
      const uniqueNewMessages = messagesWithNames.filter(
        (m) => !existingIds.has(m.id)
      );
      return [...prevMessages, ...uniqueNewMessages];
    });
  }, [wsMessages, groupId, userInfo?.id, groupDetails.members]);

  // Show WebSocket connection status
  useEffect(() => {
    if (wsError) {
      toast.error(`WebSocket error: ${wsError}`);
    }
  }, [wsError]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Format file size to readable format (KB, MB)
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Handle file upload with optimistic UI updates
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsSending(true);

      // Create temporary optimistic UI message
      const tempId = `temp-${Date.now()}`;
      const newMessage: GroupMessage = {
        id: tempId,
        content: "File attachment",
        sender: {
          id: userInfo?.id || "user",
          name: userInfo?.first_name
            ? `${userInfo.first_name} ${userInfo.last_name || ""}`
            : "You",
          avatar: userInfo?.profile_picture_url,
        },
        timestamp: new Date().toISOString(),
        isCurrentUser: true,
        attachment: {
          type: "file",
          url: "#", // Placeholder URL
          name: file.name,
          size: formatFileSize(file.size),
        },
        pending: true,
      };

      // Add to messages for optimistic UI
      setMessages([...messages, newMessage]);

      // Upload via API
      const response = await sendGroupMessageWithAttachment(
        groupId,
        "File attachment",
        "file",
        file
      );

      // Update message with real ID from response
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: response.message || response.data?.id || msg.id,
                pending: false,
              }
            : msg
        )
      );

      setIsAttachmentMenuOpen(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending file:", error);
      toast.error("Failed to send file. Please try again.");

      // Mark message as failed but keep it in UI for retry
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id.startsWith("temp-")
            ? {
                ...msg,
                pending: false,
                failed: true,
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // Handle image upload with optimistic UI updates
  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsSending(true);

      // Create local preview URL
      const imageUrl = URL.createObjectURL(file);

      // Create temporary optimistic UI message
      const tempId = `temp-${Date.now()}`;
      const newMessage: GroupMessage = {
        id: tempId,
        content: "Image attachment",
        sender: {
          id: userInfo?.id || "user",
          name: userInfo?.first_name
            ? `${userInfo.first_name} ${userInfo.last_name || ""}`
            : "You",
          avatar: userInfo?.profile_picture_url,
        },
        timestamp: new Date().toISOString(),
        isCurrentUser: true,
        attachment: {
          type: "image",
          url: imageUrl,
          name: file.name,
          size: formatFileSize(file.size),
        },
        pending: true,
      };

      // Add to messages for optimistic UI
      setMessages([...messages, newMessage]);

      // Upload via API
      const response = await sendGroupMessageWithAttachment(
        groupId,
        "Image attachment",
        "image",
        file
      );

      // Update message with real ID from response
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: response.message || response.data?.id || msg.id,
                pending: false,
              }
            : msg
        )
      );

      setIsAttachmentMenuOpen(false);

      // Reset file input
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending image:", error);
      toast.error("Failed to send image. Please try again.");

      // Mark message as failed but keep it in UI
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id.startsWith("temp-")
            ? {
                ...msg,
                pending: false,
                failed: true,
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // Send a text message with optimistic updates
  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !editingMessageId) return;

    try {
      if (editingMessageId) {
        // Handle editing existing message
        try {
          setIsSending(true);

          // Update message locally
          setMessages(
            messages.map((message) =>
              message.id === editingMessageId
                ? { ...message, content: inputMessage, isEdited: true }
                : message
            )
          );

          // For now, we'll just fake the API call since we don't have an edit endpoint
          // In a real app, you would call an API to edit the message
          await new Promise((resolve) => setTimeout(resolve, 500));

          setEditingMessageId(null);
          setInputMessage("");
          toast.success("Message updated");
        } catch (error) {
          console.error("Error updating message:", error);
          toast.error("Failed to update message");
        } finally {
          setIsSending(false);
        }
      } else {
        // Sending a new message
        setIsSending(true);
        const messageContent = inputMessage;
        const tempId = `temp-${Date.now()}`;

        // Create optimistic message
        const newMessage: GroupMessage = {
          id: tempId,
          content: messageContent,
          sender: {
            id: userInfo?.id || "user",
            name: userInfo?.first_name
              ? `${userInfo.first_name} ${userInfo.last_name || ""}`
              : "You",
            avatar: userInfo?.profile_picture_url,
          },
          timestamp: new Date().toISOString(),
          isCurrentUser: true,
          pending: true,
        };

        // Add optimistic message to UI immediately
        setMessages([...messages, newMessage]);

        // Clear input early for better UX
        setInputMessage("");

        try {
          // Try to send via WebSocket first
          let sentViaWs = false;
          if (isConnected && sendWebSocketGroupMessage) {
            sentViaWs = sendWebSocketGroupMessage(groupId, messageContent);
          }

          // If WebSocket fails, send via REST API
          if (!sentViaWs) {
            const sendMessageResponse = await sendGroupMessage(
              groupId,
              messageContent,
              "text"
            );

            // Update the temporary message with the real ID
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === tempId
                  ? {
                      ...msg,
                      id: sendMessageResponse.message_id || msg.id,
                      pending: false,
                    }
                  : msg
              )
            );
          } else {
            // Just mark as not pending if sent via WebSocket
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === tempId ? { ...msg, pending: false } : msg
              )
            );
          }
        } catch (error) {
          console.error("Error sending message:", error);
          toast.error("Failed to send message", {
            duration: 5000,
            icon: <FaExclamationTriangle />,
          });

          // Mark message as failed but keep it in UI
          setMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === tempId
                ? {
                    ...msg,
                    pending: false,
                    failed: true,
                  }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error("Error in message flow:", error);
      toast.error("Failed to process message");
    } finally {
      setIsSending(false);
    }
  };

  // Function to retry sending a failed message
  const retryMessage = async (tempId: string, content: string) => {
    try {
      setIsSending(true);

      // Update UI to show retrying
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                pending: true,
                failed: false,
                retrying: true,
              }
            : msg
        )
      );

      // Try to send again
      const response = await sendGroupMessage(groupId, content, "text");

      // Update UI on success
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: response.message_id || msg.id,
                pending: false,
                failed: false,
                retrying: false,
              }
            : msg
        )
      );

      toast.success("Message sent successfully");
    } catch (error) {
      console.error("Error retrying message:", error);

      // Mark as failed again
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                pending: false,
                failed: true,
                retrying: false,
              }
            : msg
        )
      );

      toast.error("Failed to send message again");
    } finally {
      setIsSending(false);
    }
  };

  // Handle edit message flow
  const handleEditMessage = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setInputMessage(message.content);
      setEditingMessageId(messageId);
      setShowDropdown(null);

      // Focus on input
      const inputElement = document.querySelector("input.flex-1");
      if (inputElement instanceof HTMLInputElement) {
        inputElement.focus();
      }
    }
  };

  // Handle unsend message (delete)
  const handleUnsendMessage = async (messageId: string) => {
    try {
      // Update UI immediately for better UX
      setMessages(
        messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: "This message was unsent",
                isDeleted: true,
              }
            : message
        )
      );

      setShowDropdown(null);

      // For now, we'll just fake the API call since we don't have a delete endpoint
      // In a real app, you would call an API to delete the message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputMessage("");
  };

  // Toggle dropdown for message actions
  const toggleDropdown = (messageId: string) => {
    setShowDropdown((prevId) => (prevId === messageId ? null : messageId));
  };

  // Handle keydown for message input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle search functionality
  const handleSearch = (query: string, members: string[]) => {
    setSearchQuery(query);
    setSelectedMembers(members);
    setIsSearching(true);

    // Filter messages by content and/or sender
    const filtered = messages.filter((message) => {
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

  // Get visible messages (filtered or all)
  const visibleMessages = isSearching ? filteredMessages : messages;

  // Toggle attachment menu
  const handleAttachmentClick = () => {
    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
  };

  // Handle file upload button click
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
      setIsAttachmentMenuOpen(false);
    }
  };

  // Handle image upload button click
  const handleImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
      setIsAttachmentMenuOpen(false);
    }
  };

  // Update group data (from profile component)
  const handleUpdateGroup = async (updatedGroup: any) => {
    try {
      await updateGroupApi(groupId, {
        name: updatedGroup.name,
        avatar_url: updatedGroup.avatar,
      });

      // Update local group details
      setGroupDetails((prev) => ({
        ...prev,
        name: updatedGroup.name || prev.name,
        avatar: updatedGroup.avatar || prev.avatar,
      }));

      toast.success("Group updated successfully");
    } catch (error) {
      console.error("Error updating group:", error);
      toast.error("Failed to update group");
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      <div className="flex-1 flex flex-col h-full">
        {/* Header with group info */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                {groupDetails.avatar ? (
                  <img
                    src={groupDetails.avatar}
                    alt={groupDetails.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FaUsers className="h-6 w-6 text-gray-500" />
                )}
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">
                {groupDetails.name || "Loading..."}
              </h2>
              <p className="text-xs text-gray-500">
                {groupDetails.memberCount} members
              </p>
            </div>
          </div>

          <div className="flex items-center">
            {isLoading && (
              <div className="mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
              title="Search in conversation"
            >
              <FaSearch className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2 ${
                showInfo ? "text-blue-500" : ""
              }`}
              title="Group info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages container */}
        <div
          className="flex-1 overflow-auto p-6 space-y-4 relative"
          ref={messagesContainer}
        >
          {/* Loading state */}
          {loadingMessages && (
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
          {!loadingMessages && visibleMessages.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              {isSearching ? (
                <div className="text-center text-gray-500">
                  <p className="mb-1">No matching messages found</p>
                  <button
                    onClick={clearSearch}
                    className="text-blue-500 hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <p className="mb-1">No messages yet</p>
                  <p className="text-sm">
                    Start the conversation by sending a message
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Load more messages button */}
          {canLoadMoreMessages && visibleMessages.length > 0 && (
            <div className="text-center mb-4">
              <button
                onClick={handleLoadMoreMessages}
                className={`px-4 py-2 text-sm bg-gray-100 text-blue-600 rounded-lg hover:bg-gray-200 transition-colors ${
                  isLoadingMore ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    Loading...
                  </div>
                ) : (
                  <span>Load earlier messages</span>
                )}
              </button>
            </div>
          )}

          {/* Messages list */}
          {visibleMessages.map((message) => (
            <div key={message.id} className="message">
              <div
                className={`flex ${
                  message.isCurrentUser ? "justify-end" : "justify-start"
                } mb-4`}
              >
                {!message.isCurrentUser && (
                  <div className="mr-2">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {message.sender.avatar ? (
                        <img
                          src={message.sender.avatar}
                          alt={message.sender.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FaUser className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-col max-w-[70%]">
                  {/* Sender name display */}
                  {!message.isCurrentUser && (
                    <span className="text-xs text-gray-600 mb-1 ml-1">
                      {message.sender.name}
                    </span>
                  )}
                  {message.isCurrentUser && (
                    <span className="text-xs text-gray-600 mb-1 self-end">
                      You
                    </span>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.isCurrentUser
                        ? message.isDeleted
                          ? "bg-gray-200 text-gray-500 italic"
                          : "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    {/* Show spinner for pending messages */}
                    {message.pending && (
                      <div className="absolute top-0 right-0 -mt-1 -mr-1 h-3 w-3">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                      </div>
                    )}

                    {/* Message content */}
                    <p className="break-words whitespace-pre-wrap">
                      {message.content}
                    </p>

                    {/* Attachment display */}
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
                            {message.attachment.name}{" "}
                            {message.attachment.size &&
                              `(${message.attachment.size})`}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Message metadata */}
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      {message.isEdited && !message.isDeleted && (
                        <span
                          className={`text-xs ${
                            message.isCurrentUser
                              ? "text-white"
                              : "text-gray-600"
                          }`}
                        >
                          (edited)
                        </span>
                      )}
                      <span
                        className={`text-xs ${
                          message.isCurrentUser ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>

                    {/* Message actions dropdown */}
                    {message.isCurrentUser && !message.isDeleted && (
                      <div className="relative">
                        <button
                          onClick={() => toggleDropdown(message.id)}
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
                              onClick={() => handleEditMessage(message.id)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <Edit2 className="h-4 w-4 mr-2" /> Edit
                            </button>
                            <button
                              onClick={() => handleUnsendMessage(message.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                            >
                              <Trash className="h-4 w-4 mr-2" /> Unsend
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
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={handleAttachmentClick}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
                title="Attach file"
                disabled={isSending}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              {isAttachmentMenuOpen && (
                <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                  <button
                    onClick={handleFileUpload}
                    className="flex items-center text-gray-700 hover:text-blue-500 mb-2 w-full text-left px-4 py-2"
                  >
                    <FaFile className="mr-2" /> File
                  </button>
                  <button
                    onClick={handleImageUpload}
                    className="flex items-center text-gray-700 hover:text-blue-500 w-full text-left px-4 py-2"
                  >
                    <FaImage className="mr-2" /> Image
                  </button>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessageId
                  ? "Edit your message..."
                  : "Type your message..."
              }
              className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:border-blue-400 text-gray-700"
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              className={`bg-blue-500 text-white p-3 rounded-full ml-2 hover:bg-blue-600 focus:outline-none flex items-center justify-center ${
                isSending || (!inputMessage.trim() && !editingMessageId)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={
                isSending || (!inputMessage.trim() && !editingMessageId)
              }
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <FaPaperPlane className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Group profile sidebar */}
      {showProfile && (
        <GroupProfileInfo
          groupName={groupDetails.name}
          groupDetails={groupDetails}
          onClose={() => setShowProfile(false)}
          onUpdateGroup={handleUpdateGroup}
        />
      )}

      {/* Group info panel */}
      {showInfo && (
        <GroupProfileInfo
          groupName={groupDetails.name}
          groupDetails={{
            ...groupDetails,
            // Create a new members array with types that match GroupProfileInfo's expectations
            members: groupDetails.members.map((member) => ({
              id: member.id,
              name: member.name,
              // Explicitly map any status to just "online" or "offline" since that's all the component accepts
              status: member.status === "online" ? "online" : "offline",
              role: member.role,
              avatar: member.avatar,
              lastSeen: member.lastSeen,
              // Include these properties to maintain compatibility
              user_id: member.id,
              isBlocked: member.isBlocked,
            })),
          }}
          onClose={() => setShowInfo(false)}
          onUpdateGroup={handleUpdateGroup}
        />
      )}

      {/* Search UI Popup */}
      {showSearch && (
        <SearchFilterPopup
          groupMembers={groupDetails.members.map((member) => ({
            id: member.id,
            name: member.name,
            // Convert to just "online" or "offline" since that's all SearchFilterPopup accepts
            status: member.status === "online" ? "online" : "offline",
            role: member.role,
            avatar: member.avatar,
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
    </div>
  );
}
