"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Plus, UserPlus, Users, AlertTriangle } from "lucide-react";
import { FaUser, FaTimes, FaUsers, FaEnvelope } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { useGroup } from "@/hooks/auth/useGroup";
import { useFriendship } from "@/hooks/auth/useFriends";
import { useMessages } from "@/hooks/messages/useMessages";
import { usePresence } from "@/hooks/presence/usePresence";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProvider";

type MessageType = "friend" | "group";

// Tipe data untuk pesan
interface Message {
  id: string;
  sender: {
    name: string;
    avatar?: string;
    id?: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
  unreadCount?: number;
  type: MessageType; // Add type to distinguish between friend and group messages
}

// Interface untuk friend data
interface Friend {
  id: string;
  name: string;
  username: string;
  avatar?: string;
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
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // States for data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const { isConnected, messages: wsMessages } = useWebSocketContext();
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
  } = useGroup();

  // Get data from the messages hook
  const {
    loading: messageLoading,
    error: messageError,
    getConversations,
    getUnreadCount,
  } = useMessages();

  const presence = usePresence();

  // Fetch friends, groups and conversations when component mounts
  useEffect(() => {
    // We're now using the refreshData function that uses hooks
    // No need for the old implementation
    refreshData();
  }, []);

  // Fetch data when component mounts
  useEffect(() => {
    refreshData();

    // Subscribe to WebSocket for realtime updates if needed
    if (isConnected) {
      // Subscribe to unread counts or other relevant data
    }

    return () => {
      // Cleanup - unsubscribe from WebSocket events if needed
    };
  }, [isConnected]);

  // Function to refresh data
  const refreshData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load data in parallel
      await Promise.all([getGroups(), getFriends(), getUnreadCount()]);

      // Transform and combine the data
      const groupMessages = transformGroupsToMessages(hookGroups || []);
      const friendMessages = transformFriendsToMessages(hookFriends || []);

      // Update our messages list
      setMessages([...groupMessages, ...friendMessages]);
    } catch (err: any) {
      setError(err.message || "Failed to load messages");
      console.error("Error loading messages data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format timestamps
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return "Never";

    const messageDate = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if message is from today
    if (messageDate >= today) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    // Check if message is from yesterday
    else if (messageDate >= yesterday) {
      return "Yesterday";
    }
    // For older messages show the date
    else {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[messageDate.getMonth()]} ${messageDate.getDate()}`;
    }
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
    setFriends(
      friends.map((friend) =>
        friend.id === id ? { ...friend, selected: !friend.selected } : friend
      )
    );
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
      setFriends(friends.map((friend) => ({ ...friend, selected: false })));
      setShowCreateGroupPopup(false);

      // Refresh data to show the new group
      await refreshData();
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
      setShowCreateGroupPopup(true);
    }
  };

  // Helper functions for data transformation
  const transformGroupsToMessages = (groups: any[]): Message[] => {
    return groups.map((group) => {
      const lastMessage = group.last_message;
      return {
        id: group.id,
        sender: {
          name: group.name,
          avatar: group.avatar_url,
          id: group.id,
        },
        content: lastMessage
          ? `${lastMessage.sender_name}: ${lastMessage.content}`
          : "No messages yet",
        timestamp: lastMessage
          ? formatTimestamp(lastMessage.created_at)
          : formatTimestamp(
              group.created_at || group.updated_at || new Date().toISOString()
            ),
        read: true,
        unreadCount: group.unread_count || 0,
        type: "group",
      };
    });
  };

  const transformFriendsToMessages = (friends: any[]): Message[] => {
    return friends.map((friend) => {
      // In a real app this would come from message data
      return {
        id: friend.id,
        sender: {
          name: friend.full_name || friend.username,
          avatar: friend.avatar_url || friend.profile_picture_url,
          id: friend.id,
        },
        content: "Click to start chatting", // This would be the last message in real implementation
        timestamp: formatTimestamp(new Date().toISOString()),
        read: true,
        unreadCount: 0,
        type: "friend",
      };
    });
  };

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action button */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Messages</h1>
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
              <p className="text-gray-500 font-medium">No messages yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Start a conversation with friends or groups
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMessages.map((message) => (
                <Link
                  key={message.id}
                  href={
                    message.type === "friend"
                      ? `/chat/messages/${message.id}`
                      : `/chat/messages/${message.id}?type=group`
                  }
                >
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
                        {message.sender.avatar ? (
                          <img
                            src={message.sender.avatar}
                            alt={message.sender.name}
                            className="h-full w-full object-cover"
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
                              : presence.getStatus(message.id) === "busy"
                              ? "bg-red-500"
                              : presence.getStatus(message.id) === "away"
                              ? "bg-yellow-500"
                              : "bg-gray-400"
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
                        <p className="text-xs text-gray-600 truncate flex-1">
                          {message.content}
                        </p>
                        {message.unreadCount && message.unreadCount > 0 && (
                          <div className="ml-2 h-5 w-5 min-w-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                            {message.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      friend.selected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex-shrink-0 flex items-center justify-center">
                      {friend.avatar ? (
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="h-full w-full object-cover"
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
                ))}
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
