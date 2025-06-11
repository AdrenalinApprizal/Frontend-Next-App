"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  UserPlus,
  Users,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { FaUser, FaTimes, FaUsers, FaEnvelope, FaCircle } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { useGroup } from "@/hooks/auth/useGroup";
import { useFriendship } from "@/hooks/auth/useFriends";
import { useMessages } from "@/hooks/messages/useMessages";
import usePresence from "@/hooks/presence/usePresence";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProviderNew";
import {
  formatMessageTimestamp,
  formatTimeString,
} from "@/utils/timestampHelper";

type MessageType = "friend" | "group";

// Status type for users
type UserStatus = "online" | "offline";

// Message read status type
type ReadStatus = "read" | "delivered" | "sent" | "unread";

// Tipe data untuk pesan
interface Message {
  id: string;
  sender: {
    name: string;
    profile_picture_url?: string;
    id?: string;
    status?: UserStatus; // Added status for friend messages
  };
  content: string;
  timestamp: string;
  formattedTime?: string; // For displaying formatted time
  readStatus?: ReadStatus;
  unreadCount?: number;
  type: MessageType; // Add type to distinguish between friend and group messages
  lastActivity?: string; // ISO date string for the last activity
  isTyping?: boolean; // Added to show typing indicator
  hasMessages?: boolean; // Flag to identify which have real messages
}

// Interface untuk friend data
interface Friend {
  id: string;
  name: string;
  username: string;
  profile_picture_url?: string;
  status?: UserStatus;
  selected?: boolean;
}

// Extended interface for Friends from API
interface FriendFromAPI {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  selected?: boolean;
}

export function MessagesList() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"all" | "friends" | "groups">(
    "all"
  );
  const [showNewChatPopup, setShowNewChatPopup] = useState(false);
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState<{ [key: string]: boolean }>({});

  // States for data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const webSocketContext = useWebSocketContext();
  const { isConnected } = webSocketContext;
  const wsMessages = (webSocketContext as any).messages || [];
  const {
    friends: hookFriends,
    loading: friendsLoading,
    error: friendsError,
    getFriends,
    addFriendByUsername,
    searchFriends,
  } = useFriendship();

  const {
    groups: hookGroups,
    loading: groupsLoading,
    error: groupsError,
    getGroups,
    createGroup,
    getGroupMessages,
  } = useGroup();

  // Get data from the messages hook
  const {
    loading: messageLoading,
    error: messageError,
    getUnreadCount,
    getMessages,
    getUnifiedMessages,
  } = useMessages();

  const presence = usePresence();

  // Load friends and groups data directly when component mounts
  useEffect(() => {
    getFriends();
    getGroups();
  }, [getFriends, getGroups]);

  // Update local state when hook data changes
  useEffect(() => {
    if (hookFriends && Array.isArray(hookFriends)) {
      console.log("[MessagesList] Transforming friends data:", hookFriends);

      const transformAndSetFriends = async () => {
        const friendsWithMessages = await transformFriendsToMessages(
          hookFriends
        );
        console.log(
          "[MessagesList] Transformed friends with profile pictures:",
          friendsWithMessages.map((f) => ({
            id: f.id,
            name: f.sender.name,
            profile_url: f.sender.profile_picture_url,
            content: f.content,
          }))
        );
        setMessages((prevMessages) => {
          // Remove old friend messages and add new ones
          const nonFriendMessages = prevMessages.filter(
            (msg) => msg.type !== "friend"
          );
          return [...nonFriendMessages, ...friendsWithMessages];
        });
      };

      transformAndSetFriends();
    }
  }, [hookFriends]);

  useEffect(() => {
    if (hookGroups && Array.isArray(hookGroups)) {
      const transformAndSetGroups = async () => {
        const groupsWithMessages = await transformGroupsToMessages(hookGroups);
        setMessages((prevMessages) => {
          // Remove old group messages and add new ones
          const nonGroupMessages = prevMessages.filter(
            (msg) => msg.type !== "group"
          );
          return [...nonGroupMessages, ...groupsWithMessages];
        });
      };

      transformAndSetGroups();
    }
  }, [hookGroups]);

  // WebSocket handling for real-time updates
  useEffect(() => {
    // Subscribe to WebSocket for realtime updates
    if (isConnected) {
      // Subscribe to friend status changes
      const handlePresenceUpdate = (data: any) => {
        if (data.type === "presence" && data.user_id) {
          // Trigger fresh data fetch when friend status changes
          getFriends();
        }
      };

      // Subscribe to new message events
      const handleNewMessage = (data: any) => {
        if (data.type === "new_message") {
          // Trigger fresh data fetch when new message arrives
          getFriends();
          getGroups();
        }
      };

      // Subscribe to typing indicators
      const handleTypingEvent = (data: any) => {
        if (data.type === "typing" && data.user_id) {
          setIsTyping((prev) => ({
            ...prev,
            [data.user_id]: data.isTyping,
          }));
        }
      };

      // Process existing messages and register for new ones
      if (wsMessages && wsMessages.length > 0) {
        // Process existing messages
        wsMessages.forEach((message: any) => {
          if (message.type === "presence") handlePresenceUpdate(message);
          if (message.type === "message") handleNewMessage(message);
          if (message.type === "typing") handleTypingEvent(message);
        });
      }

      // No cleanup needed for this approach since we're just processing the array
      // The WebSocketProvider handles the actual connection management
    }
  }, [isConnected, wsMessages]);

  // Function to get last message for a conversation
  const getLastMessageForConversation = async (
    conversationId: string,
    type: "friend" | "group"
  ) => {
    try {
      if (type === "group") {
        // For groups, use the group messages API from the hook
        const response = await getGroupMessages(conversationId, 1, 1); // Get only 1 message (latest)
        if (response && response.messages && response.messages.length > 0) {
          return response.messages[0]; // Return the latest message
        }
      } else {
        // For friends, try the unified messages API with correct type
        const response = await getUnifiedMessages({
          target_id: conversationId,
          type: "private",
          limit: 1,
          page: 1,
        });
        if (response && response.data && response.data.length > 0) {
          return response.data[0]; // Return the latest message
        }
      }
      return null;
    } catch (error) {
      console.error(
        `[MessagesList] Failed to get last message for ${type} ${conversationId}:`,
        error
      );
      return null;
    }
  };

  // Function to refresh data
  const refreshData = async () => {
    const isInitialLoad = !messages.length;

    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      // Just trigger fresh data fetch from hooks
      await Promise.all([getFriends(), getGroups()]);

      // The useEffect hooks will automatically update the messages when hookFriends and hookGroups change
      console.log("[MessagesList] Data refresh completed");
    } catch (err: any) {
      setError(err.message || "Failed to load conversations");
      console.error("Error loading conversations data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Helper function to format timestamps using centralized helper
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return "Never";
    return formatMessageTimestamp({ timestamp, format: "relative" });
  };

  // Filter messages based on active tab and search query
  const filteredMessages = messages.filter((message) => {
    // First filter by search query if it exists
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = message.sender.name.toLowerCase().includes(query);
      const contentMatch = message.content.toLowerCase().includes(query);

      if (!nameMatch && !contentMatch) return false;
    }

    // Then filter by active tab
    if (activeTab === "all") return true;
    if (activeTab === "friends") return message.type === "friend";
    if (activeTab === "groups") return message.type === "group";

    return true;
  });

  // Sort messages - newest first based on timestamp logic
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    // Sort logic based on timestamp
    const getTimePriority = (timestamp: string) => {
      if (timestamp.includes("now") || timestamp.includes("Just now")) return 1;
      if (timestamp.includes("minute")) return 2;
      if (timestamp.includes("hour")) return 3;
      if (timestamp.includes("day")) return 4;
      if (timestamp.includes("week")) return 5;
      return 6;
    };

    return getTimePriority(a.timestamp) - getTimePriority(b.timestamp);
  });

  const toggleFriendSelection = (id: string) => {
    // We need to work with hookFriends directly and then update local state
    if (!hookFriends) return;

    // Create updated friends with selection toggled
    const updatedHookFriends = hookFriends.map((friend: any) =>
      friend.id === id ? { ...friend, selected: !friend.selected } : friend
    );

    // Update local friends state for UI
    const localFriendsUpdate = updatedHookFriends.map((friend: any) => {
      const friendStatus = presence.getStatus(friend.id);
      return {
        id: friend.id,
        name: friend.full_name || friend.username,
        username: friend.username,
        profile_picture_url: friend.profile_picture_url,
        // Map any status that's not 'online' to 'offline' for compatibility
        status:
          friendStatus === "online"
            ? ("online" as UserStatus)
            : ("offline" as UserStatus),
        selected: friend.selected,
      };
    });

    setFriends(localFriendsUpdate);
  };

  // Function to handle adding a friend using the hook
  const handleAddFriend = async () => {
    if (!friendUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }

    setIsAddingFriend(true);
    try {
      const result = await addFriendByUsername(friendUsername);

      setShowAddFriendPopup(false);
      setFriendUsername("");
      toast.success(
        result?.message || `Friend request sent to ${friendUsername}`
      );
    } catch (err: any) {
      console.error("Failed to add friend:", err);
      toast.error(err.message || "Failed to send friend request");
    } finally {
      setIsAddingFriend(false);
    }
  };

  // Function to handle creating a group using the hook
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    const selectedFriendIds = friends
      .filter((friend) => friend.selected)
      .map((friend) => friend.id);

    if (selectedFriendIds.length === 0) {
      toast.error("Please select at least one friend");
      return;
    }

    setIsLoading(true);
    try {
      await createGroup({
        name: groupName,
        description: groupDescription,
        members: selectedFriendIds,
      });

      toast.success(`Group "${groupName}" created successfully!`);

      // Reset form and close popup
      setGroupName("");
      setGroupDescription("");
      // Reset friend selections
      setFriends(friends.map((friend) => ({ ...friend, selected: false })));
      setShowCreateGroupPopup(false);

      // Refresh data to show the new group
      await getGroups();
    } catch (err: any) {
      console.error("Failed to create group:", err);
      toast.error(err.message || "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to open the appropriate popup based on selection
  const handleOption = (option: "friend" | "group") => {
    setShowNewChatPopup(false);
    if (option === "friend") {
      setShowAddFriendPopup(true);
    } else {
      // Load friends when opening create group popup
      getFriends();
      setShowCreateGroupPopup(true);
    }
  };

  // Helper functions for data transformation
  const transformGroupsToMessages = async (
    groups: any[]
  ): Promise<Message[]> => {
    // Filter out invalid groups first
    const validGroups = await Promise.all(
      groups
        .filter((group) => group && group.id)
        .map(async (group) => {
          // Handle different formats of last_message
          let lastMessage = group.last_message || {};

          // Debug: Log the actual last_message structure for groups
          console.log(
            `[MessagesList] Group ${group.name || group.id} last_message:`,
            lastMessage
          );

          // If no last_message from group data, try to fetch from messages API
          if (!lastMessage || !Object.keys(lastMessage).length) {
            console.log(
              `[MessagesList] No last_message for group ${
                group.name || group.id
              }, fetching from API...`
            );
            lastMessage = await getLastMessageForConversation(
              group.id,
              "group"
            );
          }

          // Enhanced check for message existence - check multiple possible content fields
          let messageContent = "";
          let hasMessage = false;

          if (lastMessage && typeof lastMessage === "object") {
            // Try multiple possible content fields for groups
            messageContent =
              lastMessage.content ||
              lastMessage.message_content ||
              lastMessage.text ||
              lastMessage.message ||
              "";

            // Check if we have actual content
            hasMessage = !!(messageContent && messageContent.trim() !== "");

            console.log(
              `[MessagesList] Group ${
                group.name || group.id
              } - Content: "${messageContent}", HasMessage: ${hasMessage}, LastMessage:`,
              lastMessage
            );
          }

          // Find a valid timestamp for sorting
          const lastActivity =
            lastMessage?.sent_at ||
            lastMessage?.created_at ||
            group.updated_at ||
            group.created_at ||
            new Date().toISOString();

          // Format content properly with sender name if it's a group message
          let content;
          if (hasMessage) {
            // Include sender name in the preview if available
            content = lastMessage.sender_name
              ? `${lastMessage.sender_name}: ${messageContent}`
              : messageContent;
          } else {
            // Show "No messages yet" for groups without messages
            content = "No messages yet";
          }

          return {
            id: group.id,
            sender: {
              name: group.name || "Unnamed Group",
              profile_picture_url:
                group.avatar_url || group.profile_picture_url || null,
              id: group.id,
            },
            content: content,
            timestamp: hasMessage
              ? formatTimestamp(lastMessage.sent_at || lastMessage.created_at)
              : "",
            formattedTime: formatTimestamp(lastActivity),
            read: !group.unread_count || group.unread_count === 0,
            readStatus:
              group.unread_count && group.unread_count > 0
                ? ("unread" as ReadStatus)
                : ("read" as ReadStatus),
            unreadCount:
              group.unread_count && group.unread_count > 0
                ? group.unread_count
                : undefined,
            type: "group" as MessageType,
            lastActivity,
            isTyping: false, // Will be updated by WebSocket events
            hasMessages: hasMessage, // Flag to identify which have real messages
          } as Message;
        })
    );

    // Sort groups (we're sure all values are valid now after filtering)
    return validGroups.sort((a, b) => {
      // First sort by whether they have messages (those with messages come first)
      const aHasMessages = a.hasMessages ? 1 : 0;
      const bHasMessages = b.hasMessages ? 1 : 0;

      if (aHasMessages !== bHasMessages) {
        return bHasMessages - aHasMessages; // Groups with messages first
      }

      // Then sort by last activity time (most recent first)
      const aTime = new Date(a.lastActivity || "").getTime();
      const bTime = new Date(b.lastActivity || "").getTime();
      return bTime - aTime;
    });
  };

  const transformFriendsToMessages = async (
    friends: any[]
  ): Promise<Message[]> => {
    // Show ALL friends, not just those with messages
    const friendMessages = await Promise.all(
      friends.map(async (friend) => {
        const userId = friend.id;
        const friendStatus = presence.getStatus(userId);
        let lastMessage = friend.last_message;

        // Debug: Log the actual last_message structure
        console.log(
          `[MessagesList] Friend ${
            friend.username || friend.name || friend.id
          } last_message:`,
          lastMessage
        );

        // If no last_message from friend data, try to fetch from messages API
        if (!lastMessage || !Object.keys(lastMessage).length) {
          console.log(
            `[MessagesList] No last_message for friend ${
              friend.username || friend.name || friend.id
            }, fetching from API...`
          );
          lastMessage = await getLastMessageForConversation(
            friend.id,
            "friend"
          );
        }

        // Enhanced check for message existence - check multiple possible content fields
        let messageContent = "";
        let hasMessage = false;

        if (lastMessage && typeof lastMessage === "object") {
          // Try multiple possible content fields for friends
          messageContent =
            lastMessage.content ||
            lastMessage.message_content ||
            lastMessage.text ||
            lastMessage.message ||
            "";

          // Check if we have actual content
          hasMessage = !!(messageContent && messageContent.trim() !== "");

          console.log(
            `[MessagesList] Friend ${
              friend.username || friend.name || friend.id
            } - Content: "${messageContent}", HasMessage: ${hasMessage}, LastMessage:`,
            lastMessage
          );
        }

        const lastActivity =
          friend.last_active ||
          lastMessage?.sent_at ||
          lastMessage?.created_at ||
          friend.created_at ||
          new Date().toISOString();

        // Build full name from first_name and last_name if available
        let displayName = "";
        if (friend.first_name && friend.last_name) {
          displayName = `${friend.first_name} ${friend.last_name}`;
        } else if (friend.full_name) {
          displayName = friend.full_name;
        } else if (friend.display_name) {
          displayName = friend.display_name;
        } else if (friend.name) {
          displayName = friend.name;
        } else if (friend.username) {
          displayName = friend.username;
        } else {
          // Just display "User" instead of the ID
          displayName = "User";
        }

        return {
          id: friend.id,
          sender: {
            name: displayName,
            profile_picture_url: friend.profile_picture_url || null,
            id: friend.id,
            // Map any status that's not 'online' to 'offline' for compatibility
            status:
              friendStatus === "online"
                ? ("online" as UserStatus)
                : ("offline" as UserStatus),
          },
          content: hasMessage ? messageContent : "No messages yet",
          timestamp: hasMessage
            ? formatTimestamp(lastMessage.sent_at || lastMessage.created_at)
            : friendStatus === "online"
            ? "Online"
            : "Offline",
          formattedTime: formatTimestamp(lastActivity),
          read: !friend.unread_count || friend.unread_count === 0,
          readStatus:
            friend.unread_count && friend.unread_count > 0
              ? ("unread" as ReadStatus)
              : ("read" as ReadStatus),
          unreadCount:
            friend.unread_count && friend.unread_count > 0
              ? friend.unread_count
              : undefined,
          type: "friend" as MessageType,
          lastActivity,
          isTyping: isTyping[userId] || false,
          hasMessages: hasMessage, // Add flag to identify which have real messages
        };
      })
    );

    // Sort to show friends with messages first, then those without messages
    return friendMessages.sort((a, b) => {
      const aHasMessages = a.hasMessages ? 1 : 0;
      const bHasMessages = b.hasMessages ? 1 : 0;

      // If one has messages and the other doesn't, prioritize the one with messages
      if (aHasMessages !== bHasMessages) {
        return bHasMessages - aHasMessages;
      }

      // If both have messages or both don't have messages, sort by activity time
      const aTime = new Date(a.lastActivity).getTime();
      const bTime = new Date(b.lastActivity).getTime();
      return bTime - aTime;
    });
  };

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action buttons */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-800">Messages</h1>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="ml-2 p-1.5 text-gray-400 hover:text-blue-500 rounded-full focus:outline-none transition-colors"
            title="Refresh Messages"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <NotificationDropdown />
          <button
            onClick={() => setShowNewChatPopup(true)}
            className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
            title="New Chat"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-5 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("all")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "friends"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Friends
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Groups
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search messages"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
        />
      </div>

      {/* Message list with loading/error states */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-red-500">{error}</p>
            <button
              onClick={refreshData}
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Empty state */}
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <FaEnvelope className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No conversations yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Start chatting with friends or groups to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMessages.map((message) => {
                // Debug logging for navigation URL construction
                const friendUrl =
                  message.type === "friend"
                    ? `/chat/messages/${message.id}${
                        message.sender.name
                          ? `?name=${encodeURIComponent(message.sender.name)}`
                          : ""
                      }`
                    : `/chat/messages/${message.id}?type=group`;

                console.log("🔍 [MessagesList] Building URL:", {
                  messageId: message.id,
                  messageType: message.type,
                  senderName: message.sender.name,
                  finalUrl: friendUrl,
                });

                return (
                  <Link key={message.id} href={friendUrl}>
                    <div
                      className={`flex items-start p-4 rounded-lg transition-colors ${
                        (message.type === "friend" &&
                          pathname === `/chat/messages/${message.id}`) ||
                        (message.type === "group" &&
                          pathname === `/chat/messages/${message.id}` &&
                          pathname.includes("type=group"))
                          ? "bg-blue-50 border border-blue-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Avatar with online status */}
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 mr-3 flex-shrink-0 flex items-center justify-center">
                          {message.sender.profile_picture_url ? (
                            <img
                              src={message.sender.profile_picture_url}
                              alt={message.sender.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                console.log(
                                  "[MessagesList] Avatar failed to load:",
                                  message.sender.profile_picture_url,
                                  "Type:",
                                  message.type,
                                  "Full message:",
                                  message
                                );
                                // If image fails to load, fall back to icon
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                                (
                                  e.currentTarget.parentElement as HTMLElement
                                ).classList.add("avatar-error");
                                (
                                  e.currentTarget.parentElement as HTMLElement
                                ).innerHTML +=
                                  message.type === "friend"
                                    ? '<svg class="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>'
                                    : '<svg class="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>';
                              }}
                            />
                          ) : message.type === "friend" ? (
                            <FaUser className="h-5 w-5 text-gray-500" />
                          ) : (
                            <FaUsers className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        {/* Status indicator (only for friends) */}
                        {message.type === "friend" && (
                          <div
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                              presence.getStatus(message.id) === "online"
                                ? "bg-green-500"
                                : "bg-gray-400" // Offline status
                            }`}
                          ></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Top row with name and timestamp */}
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-gray-900 truncate text-sm">
                            {message.sender.name}
                          </h3>
                          <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">
                            {message.timestamp}
                          </span>
                        </div>

                        {/* Second row with message and badge */}
                        <div className="flex justify-between items-start mt-1">
                          <div className="flex-1 relative">
                            {/* Show typing indicator when active */}
                            {message.isTyping ? (
                              <p className="text-xs text-blue-500 truncate flex items-center">
                                <span className="mr-1">Typing</span>
                                <span className="flex">
                                  <FaCircle className="animate-pulse h-1 w-1 mx-0.5" />
                                  <FaCircle className="animate-pulse h-1 w-1 mx-0.5 animate-delay-100" />
                                  <FaCircle className="animate-pulse h-1 w-1 mx-0.5 animate-delay-200" />
                                </span>
                              </p>
                            ) : (
                              <p className="text-xs text-gray-600 truncate flex-1">
                                {message.content}
                              </p>
                            )}
                          </div>
                          {message.unreadCount && message.unreadCount > 0 && (
                            <div className="ml-2 h-5 w-5 min-w-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                              {message.unreadCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New Chat Options Popup */}
      {showNewChatPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">New Chat</h2>
              <button
                onClick={() => setShowNewChatPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleOption("friend")}
                className="flex items-center w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="p-2 bg-blue-100 rounded-full mr-3">
                  <UserPlus size={20} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Add a Friend</div>
                  <div className="text-xs text-gray-500">
                    Find and add new friends
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleOption("group")}
                className="flex items-center w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="p-2 bg-green-100 rounded-full mr-3">
                  <Users size={20} className="text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create a Group</div>
                  <div className="text-xs text-gray-500">
                    Start a group conversation
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Popup */}
      {showAddFriendPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Add a Friend
              </h2>
              <button
                onClick={() => setShowAddFriendPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAddFriendPopup(false)}
                className="px-4 py-2 mr-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFriend}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                disabled={!friendUsername.trim()}
              >
                Add Friend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Popup */}
      {showCreateGroupPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Create a Group
              </h2>
              <button
                onClick={() => setShowCreateGroupPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Enter group description"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                rows={2}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Friends
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                {friends && friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                        friend.selected ? "bg-blue-50" : ""
                      }`}
                      onClick={() => toggleFriendSelection(friend.id)}
                    >
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex-shrink-0 flex items-center justify-center">
                        {friend.profile_picture_url ? (
                          <img
                            src={friend.profile_picture_url}
                            alt={friend.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              console.log(
                                "[MessagesList] Friend avatar failed to load:",
                                friend
                              );
                              // If image fails to load, fall back to icon
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              (
                                e.currentTarget.parentElement as HTMLElement
                              ).classList.add("avatar-error");
                              (
                                e.currentTarget.parentElement as HTMLElement
                              ).innerHTML +=
                                '<svg class="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';
                            }}
                          />
                        ) : (
                          <FaUser className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{friend.name}</p>
                        <p className="text-xs text-gray-500">
                          @{friend.username}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!friend.selected}
                        onChange={() => {}} // Handled by the div onClick
                        className="h-4 w-4 text-blue-600"
                      />
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {friendsLoading
                      ? "Loading friends..."
                      : "No friends available"}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateGroupPopup(false)}
                className="px-4 py-2 mr-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                disabled={!groupName.trim() || !friends.some((f) => f.selected)}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
